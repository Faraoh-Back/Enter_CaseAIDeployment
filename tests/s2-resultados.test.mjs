import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { runGraphInFile } from '@ironclad/rivet-node';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sentencesForFixtures } from '../scripts/case-files.mjs';
import { entradasS1 } from '../scripts/s1-fixture.mjs';

// S2.1: aceitação em vermelho. Somente o transporte da LLM é simulado.
const golden = JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json','utf8'));
const originals = await sentencesForFixtures();
const references = await entradasS1();
const subsidies = (await readFile(path.join(originals.dir,'status_subsidios.txt'),'utf8')).trim().split(/\r?\n/);
const headers = [...originals.raw.matchAll(/={20,}\r?\nProcesso nº ([\d.\-]+)\r?\n={20,}\r?\n/g)];
const ajv = new Ajv({allErrors:true}); addFormats(ajv);
ajv.addSchema(JSON.parse(await readFile('schemas/extracao.schema.json','utf8')),'extracao.schema.json');
const validateExtraction = ajv.getSchema('extracao.schema.json');
const validateProcess = ajv.compile(JSON.parse(await readFile('schemas/processo.schema.json','utf8')));
const validateSummary = ajv.compile(JSON.parse(await readFile('schemas/resumo.schema.json','utf8')));

function prepare(record, distractor) {
  const original = originals.sentences.find(s=>s.numero===record.numero_processo);
  assert.equal(original?.texto,record.sentenca,'Gabarito deve corresponder ao original');
  assert.equal(createHash('sha256').update(record.sentenca).digest('hex'),record.sentenca_sha256);
  assert.equal(validateExtraction(record.extracao_esperada),true,JSON.stringify(validateExtraction.errors));
  for(const evidence of Object.values(record.extracao_esperada.evidencias)) {
    if(evidence !== null) assert.ok(record.sentenca.includes(evidence),'Evidência do gabarito deve ser literal');
  }
  const index = headers.findIndex(h=>h[1]===record.numero_processo);
  assert.ok(index>=0);
  const rows = subsidies.slice(1).filter(r=>r.split(',')[0]===record.numero_processo);
  assert.equal(rows.length,1);
  const raw = {...references, processos_texto:originals.raw.slice(headers[index].index,headers[index+1]?.index ?? originals.raw.length),
    subsidios_texto:`${subsidies[0]}\n${rows[0]}\n`};
  if(distractor) {
    const before=raw.processos_texto;
    raw.processos_texto=before.replace('Ante o exposto,',`${distractor}\n\nAnte o exposto,`);
    assert.notEqual(raw.processos_texto,before,'Mutação sintética precisa atingir o texto');
  }
  return raw;
}
async function execute(t,record,distractor) {
  const raw=prepare(record,distractor);
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),10000);
  t.after(()=>{clearTimeout(timer);controller.abort();});
  let calls=0, transportError;
  const errors=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    try {
      assert.equal(++calls,1,'Uma extração válida não exige retentativa');
      assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
      const body=JSON.parse(options.body);
      assert.equal(body.response_format.json_schema.strict,true);
      const messages=JSON.stringify(body.messages);
      assert.ok(messages.includes(record.numero_processo));
      if(distractor) assert.ok(messages.includes(distractor),'Pedido sintético deve chegar ao extrator');
      const response={choices:[{index:0,delta:{content:JSON.stringify(record.extracao_esperada)},finish_reason:'stop'}]};
      return new Response(`data: ${JSON.stringify(response)}\n\ndata: [DONE]\n\n`,{headers:{'Content-Type':'text/event-stream'}});
    } catch(error) { transportError=error; controller.abort(); throw error; }
  });
  let output;
  try {
    output=await runGraphInFile('rivet/analise_sentencas.rivet-project',{
      graph:'analisar_carteira',openAiKey:'credencial-ficticia',openAiOrganization:'',
      openAiEndpoint:'https://api.openai.com/v1/chat/completions',abortSignal:controller.signal,chatNodeTimeout:5000,
      inputs:Object.fromEntries(Object.entries(raw).map(([k,value])=>[k,{type:'string',value}])),
      onNodeError:({error})=>errors.push(String(error)),
    });
  } catch(error) { throw transportError ?? new Error(errors.join('\n') || error.message); }
  assert.equal(calls,1);
  return output;
}
function check(output,record) {
  assert.equal(output.processos.value.length,1,'Uma linha por identidade');
  const p=output.processos.value[0], s=output.resumo.value, a=output.auditoria.value;
  assert.equal(validateProcess(p),true,JSON.stringify(validateProcess.errors));
  assert.equal(validateSummary(s),true,JSON.stringify(validateSummary.errors));
  assert.equal(p.status_processamento,'ok'); assert.deepEqual(p.problemas,[]);
  const {valor_total_explicito_centavos,...extraction}=record.extracao_esperada;
  for(const [key,value] of Object.entries(extraction)) assert.deepEqual(p[key],value,key);
  const {memoria,...financial}=record.calculo_esperado;
  for(const [key,value] of Object.entries(financial)) assert.deepEqual(p[key],value,key);
  assert.equal(a.length,1); assert.equal(a[0].numero_processo,record.numero_processo);
  assert.deepEqual(a[0].extracao,record.extracao_esperada);
  assert.equal(a[0].tentativas,1);
  const victory=['improcedencia','extincao'].includes(record.extracao_esperada.resultado_sentenca);
  const recommended=record.calculo_esperado.decisao_recurso==='recorrer';
  for(const [key,value] of Object.entries({data_referencia:'2026-05-31',total_identificado:1,
    vitorias_confirmadas:victory?1:0,resultados_desconhecidos:0,condenacoes:victory?0:1,
    processos_aptos:1,pendencias:0,passivo_centavos:financial.valor_atualizado_centavos,
    recursos_recomendados:recommended?1:0,custo_recursos_centavos:recommended?financial.custo_recurso_centavos:0,
    beneficio_esperado_recursos_centavos:recommended?financial.beneficio_esperado_centavos:0})) assert.equal(s[key],value,key);
  if(victory) {
    assert.equal(a[0].memoria,null,'Vitória não deve inventar memória de atualização');
    assert.equal(a[0].indice_base,null); assert.equal(a[0].indice_final,null);
  } else {
    assert.equal(BigInt(a[0].memoria.total_numerador)*BigInt(memoria.total_exato_denominador),
      BigInt(memoria.total_exato_numerador)*BigInt(a[0].memoria.total_denominador),'Mesmo valor racional do oráculo independente');
  }
  assert.ok(output.relatorio_markdown.value.includes(record.numero_processo));
  assert.doesNotMatch(output.relatorio_markdown.value,/NaN|undefined/);
  if(victory) assert.match(output.relatorio_markdown.value,/sem condena[çc][ãa]o/i);
}
for(const record of golden) {
  test(`S2.1: ${record.extracao_esperada.resultado_sentenca} — ${record.numero_processo}`,async t=>check(await execute(t,record),record));
}
test('S2.1: pedido sintético maior não substitui os componentes concedidos',async t=>{
  const record=golden.find(r=>r.numero_processo==='3871230-78.2024.8.26.0002');
  const distractor='A parte autora requereu R$ 50.000,00 a título de danos materiais e R$ 20.000,00 a título de danos morais.';
  check(await execute(t,record,distractor),record);
});
