import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runGraphInFile } from '@ironclad/rivet-node';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { entradasS1 } from '../scripts/s1-fixture.mjs';

// S2.3: contrato futuro; toda chamada é interceptada, sem rede e sem credencial real.
const valid = JSON.parse(await readFile('schemas/extracao.exemplo.json','utf8'));
const ajv=new Ajv({allErrors:true}); addFormats(ajv);
ajv.addSchema(JSON.parse(await readFile('schemas/extracao.schema.json','utf8')),'extracao.schema.json');
const validateProcess=ajv.compile(JSON.parse(await readFile('schemas/processo.schema.json','utf8')));
const validateSummary=ajv.compile(JSON.parse(await readFile('schemas/resumo.schema.json','utf8')));
const response = change => { const copy=structuredClone(valid); change(copy); return copy; };
const invalidDate=response(d=>{d.data_citacao='2026-02-30';});
const http = (status,code) => ({http:status,code});
function replace(raw,key,pattern,replacement) {
  const before=raw[key]; raw[key]=before.replace(pattern,replacement);
  assert.notEqual(raw[key],before,`Mutação precisa atingir ${key}`);
}
async function run(t,{answers=[valid],changeInput=()=>{}}={}) {
  const raw=await entradasS1(); changeInput(raw);
  const abort=new AbortController(), timer=setTimeout(()=>abort.abort(),12000);
  t.after(()=>{clearTimeout(timer);abort.abort();});
  let calls=0, fixtureError;
  const errors=[];
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    try {
      assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
      assert.equal(JSON.parse(options.body).response_format.json_schema.strict,true);
    } catch(error) {fixtureError=error;abort.abort();throw error;}
    calls++;
    if(calls>3) {abort.abort();throw new Error('GUARDA_TESTE: excedeu três requisições totais');}
    const answer=answers[Math.min(calls-1,answers.length-1)];
    if(answer?.timeout) throw Object.assign(new Error('timeout de transporte simulado'),{code:'ETIMEDOUT'});
    if(answer?.http) return new Response(JSON.stringify({error:{message:'Falha simulada',type:answer.code,code:answer.code}}),
      {status:answer.http,headers:{'Content-Type':'application/json','Retry-After':'0'}});
    const content=typeof answer==='string'?answer:JSON.stringify(answer);
    return new Response(`data: ${JSON.stringify({choices:[{index:0,delta:{content},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`,
      {headers:{'Content-Type':'text/event-stream'}});
  });
  try {
    const output=await runGraphInFile('rivet/analise_sentencas.rivet-project',{
      graph:'analisar_carteira',inputs:Object.fromEntries(Object.entries(raw).map(([key,value])=>[key,{type:'string',value}])),
      openAiKey:'credencial-ficticia',openAiOrganization:'',openAiEndpoint:'https://api.openai.com/v1/chat/completions',
      abortSignal:abort.signal,chatNodeTimeout:10000,onNodeError:({error})=>errors.push(String(error)),
    });
    if(fixtureError) throw fixtureError;
    return {output,calls};
  } catch(error) {
    if(fixtureError) throw fixtureError;
    return {calls,error:errors.join('\n')||error.message};
  } finally {
    t.diagnostic(JSON.stringify({requisicoes_interceptadas:calls,abortado:abort.signal.aborted}));
  }
}
function history(a,calls) {
  assert.equal(a.tentativas,calls,'Tentativas incluem transporte e validação');
  assert.equal(a.historico_tentativas.length,calls,'Preservar diagnóstico de cada tentativa');
  a.historico_tentativas.forEach((entry,i)=>{
    assert.equal(entry.numero,i+1);
    assert.ok(['aprovada','extracao_invalida','falha_transporte'].includes(entry.estado));
    if(entry.estado!=='aprovada') assert.ok(entry.problemas?.length>0);
  });
}
function pending(result,{calls=3,code,state='pendente_revisao',knownResult=true,knownPrincipal=true,knownUpdated=false}) {
  assert.equal(result.error,undefined,'Falha individual deve produzir uma linha, sem abortar todo o grafo');
  assert.equal(result.calls,calls);
  const {processos,resumo,auditoria,relatorio_markdown}=result.output;
  assert.equal(processos.value.length,1);
  const p=processos.value[0],s=resumo.value,a=auditoria.value[0];
  assert.equal(validateProcess(p),true,JSON.stringify(validateProcess.errors));
  assert.equal(validateSummary(s),true,JSON.stringify(validateSummary.errors));
  assert.equal(p.numero_processo,valid.numero_processo);
  assert.equal(p.status_processamento,state);
  assert.equal(p.decisao_recurso,'pendente');
  assert.ok(p.problemas.some(x=>x.codigo===code && typeof x.mensagem==='string' && x.mensagem.length));
  assert.equal(p.resultado_sentenca,knownResult?'parcial_procedencia':null);
  assert.equal(p.valor_condenacao_centavos,knownPrincipal?630000:null);
  assert.equal(p.valor_atualizado_centavos,knownUpdated?667314:null);
  assert.equal(p.beneficio_esperado_centavos,null);
  assert.equal(s.total_identificado,1); assert.equal(s.processos_aptos,0); assert.equal(s.pendencias,1);
  assert.equal(s.resultados_desconhecidos,knownResult?0:1);
  assert.equal(s.condenacoes,knownResult?1:0); assert.equal(s.vitorias_confirmadas,0);
  assert.equal(s.passivo_centavos,knownUpdated?667314:0); // Soma conhecida; relatório deve informar a exclusão.
  assert.equal(s.recursos_recomendados,0); assert.equal(s.custo_recursos_centavos,0);
  assert.equal(s.beneficio_esperado_recursos_centavos,0);
  assert.equal(auditoria.value.length,1);assert.equal(a.numero_processo,valid.numero_processo);
  history(a,calls);
  assert.match(relatorio_markdown.value,/pend[eê]n|revis[aã]o|incomplet|parcial/i);
  assert.ok(relatorio_markdown.value.includes(valid.numero_processo));
  assert.doesNotMatch(relatorio_markdown.value,/NaN|undefined/);
}
for(const [name,first] of [['JSON incompleto','{"numero_processo":'],['data inválida',invalidDate]]) {
  test(`S2.3: repara ${name} na segunda tentativa`,async t=>{
    const result=await run(t,{answers:[first,valid]});
    assert.equal(result.error,undefined);
    assert.equal(result.calls,2);
    const p=result.output.processos.value[0],a=result.output.auditoria.value[0];
    assert.equal(p.status_processamento,'ok');assert.equal(p.valor_atualizado_centavos,667314);
    history(a,2);assert.equal(a.historico_tentativas[0].estado,'extracao_invalida');
    assert.equal(a.historico_tentativas[1].estado,'aprovada');
    assert.equal(a.historico_tentativas[0].resposta_original,typeof first==='string'?first:JSON.stringify(first));
  });
}
const failures=[
  ['JSON inválido persistente','{', {code:'EXTRACAO_INVALIDA',knownResult:false,knownPrincipal:false}],
  ['citação ausente',response(d=>{d.data_citacao=null;d.evidencias.data_citacao=null;}),{code:'DADO_AUSENTE'},
    raw=>replace(raw,'processos_texto','desde a citação (27/02/2026)','desde a citação, sem data informada')],
  ['data impossível',invalidDate,{code:'DATA_INVALIDA'}],
  ['data futura',response(d=>{d.data_citacao='2026-06-01';d.evidencias.data_citacao='desde a citação (01/06/2026)';}),{code:'DATA_FUTURA'},
    raw=>replace(raw,'processos_texto','27/02/2026','01/06/2026')],
  ['CNJ divergente',response(d=>{d.numero_processo='3094235-58.2024.8.26.0009';}),{code:'IDENTIDADE_DIVERGENTE',knownResult:false,knownPrincipal:false}],
  ['componente desconhecido',response(d=>{d.danos_morais_centavos=null;}),{code:'DADO_AUSENTE',knownPrincipal:false}],
  ['evidência inventada',response(d=>{d.evidencias.valores='Texto inexistente no documento.';}),{code:'EXTRACAO_INVALIDA',knownPrincipal:false}],
];
for(const [name,answer,expected,changeInput] of failures) test(`S2.3: ${name} vira pendência após três tentativas`,async t=>{
  const result=await run(t,{answers:[answer],changeInput});pending(result,expected);
  assert.equal(result.output.auditoria.value[0].historico_tentativas[2].estado,'extracao_invalida');
});
test('S2.3: subsídio não localizado preserva cálculo, sem supor ausentes',async t=>{
  const result=await run(t,{changeInput:raw=>{raw.subsidios_texto='numero_processo,status_subsidios\n';}});
  pending(result,{calls:1,code:'SUBSIDIO_NAO_LOCALIZADO',knownUpdated:true});
  assert.equal(result.output.processos.value[0].status_subsidios,null);
  assert.equal(result.output.processos.value[0].probabilidade_reversao_percentual,null);
});
test('S2.3: HTTP transitório seguido de extração inválida compartilha limite total de três',async t=>{
  const result=await run(t,{answers:[http(503,'server_error'),'{',valid]});
  assert.equal(result.error,undefined);assert.equal(result.calls,3);
  assert.equal(result.output.processos.value[0].status_processamento,'ok');
  const a=result.output.auditoria.value[0];history(a,3);
  assert.deepEqual(a.historico_tentativas.map(e=>e.estado),['falha_transporte','extracao_invalida','aprovada']);
});
for(const [name,answer] of [['HTTP 503',http(503,'server_error')],['timeout de transporte',{timeout:true}]]) {
  test(`S2.3: ${name} persistente vira erro após três chamadas`,async t=>{
    pending(await run(t,{answers:[answer]}),{code:'FALHA_TRANSPORTE',state:'erro',knownResult:false,knownPrincipal:false});
  });
}
for(const [name,answer] of [['credencial inválida',http(401,'invalid_api_key')],['quota esgotada',http(429,'insufficient_quota')]]) {
  test(`S2.3: ${name} interrompe sem retentar`,async t=>{
    const result=await run(t,{answers:[answer]});
    assert.equal(result.output,undefined);assert.ok(result.error);assert.equal(result.calls,1);
  });
}
const globals=[
  ['índice duplicado',raw=>{raw.indices_texto+='\n2025-12,1086.2922\n';},/duplicad/i,0],
  ['custo ausente',raw=>replace(raw,'custos_texto',/^TJSP;[^\r\n]*(?:\r?\n|$)/m,''),/custo.*ausente/i,0],
  ['índice final ausente',raw=>replace(raw,'indices_texto',/^2026-05,[^\r\n]*(?:\r?\n|$)/m,''),/[ií]ndice final ausente/i,0],
  ['índice-base ausente',raw=>replace(raw,'indices_texto',/^2025-12,[^\r\n]*(?:\r?\n|$)/m,''),/[ií]ndice.base/i,1],
  ['identidade duplicada entre blocos',raw=>{raw.processos_texto+=raw.processos_texto;},/duplicad/i,0],
];
for(const [name,changeInput,pattern,calls] of globals) test(`S2.3: falha global por ${name}`,async t=>{
  const result=await run(t,{changeInput});assert.equal(result.output,undefined);
  assert.match(result.error??'',pattern);assert.equal(result.calls,calls);
});
