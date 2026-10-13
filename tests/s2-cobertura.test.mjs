import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runGraphInFile} from '../src/rivet-runtime.mjs';
import {loteMisto,loteMonetario} from './helpers/s2-lote.mjs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
const ajv=new Ajv({allErrors:true});addFormats(ajv);
ajv.addSchema(JSON.parse(await readFile('schemas/extracao.schema.json','utf8')),'extracao.schema.json');
const validateProcess=ajv.compile(JSON.parse(await readFile('schemas/processo.schema.json','utf8')));
const validateSummary=ajv.compile(JSON.parse(await readFile('schemas/resumo.schema.json','utf8')));
async function run(t,fixture,graph='analisar_lote') {
  const calls={};let mockError;const abort=new AbortController();
  const timer=setTimeout(()=>abort.abort(),15000);t.after(()=>{clearTimeout(timer);abort.abort();});
  t.mock.method(globalThis,'fetch',async(url,options)=>{
    try {
      assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
      const body=JSON.parse(options.body), text=body.messages[0].content;
      const id=text.match(/Processo nº ([\d.\-]+)/)?.[1];
      assert.ok(Object.hasOwn(fixture.answers,id),'Somente identidades previstas');
      calls[id]=(calls[id]??0)+1;assert.ok(calls[id]<=3);
      const answer=fixture.answers[id];
      if(answer.http) return new Response(JSON.stringify({error:{code:answer.http===401?'invalid_api_key':'server_error'}}),{status:answer.http});
      return new Response(`data: ${JSON.stringify({choices:[{index:0,delta:{content:typeof answer==='string'?answer:JSON.stringify(answer)},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
    }catch(error){mockError=error;abort.abort();throw error;}
  });
  const errors=[];let output,error;
  try {output=await runGraphInFile('rivet/analise_sentencas.rivet-project',{graph,openAiKey:'credencial-ficticia',openAiOrganization:'',abortSignal:abort.signal,
    inputs:Object.fromEntries(Object.entries(fixture.raw).map(([k,value])=>[k,{type:'string',value}])),onNodeError:({error})=>errors.push(String(error))});}
  catch(e){error=errors.join('\n')||e.message;}
  if(mockError)throw mockError;
  return {output,error,calls};
}
test('S2.5: pequeno lote misto preserva sete identidades e informa cobertura financeira e decisória',async t=>{
  const f=await loteMisto(),{output,error,calls}=await run(t,f);assert.equal(error,undefined);
  const ps=output.processos.value,s=output.resumo.value,a=output.auditoria.value;
  assert.deepEqual(ps.map(p=>p.numero_processo),f.records.map(r=>r.numero_processo));
  assert.deepEqual(a.map(x=>x.numero_processo),ps.map(p=>p.numero_processo));
  ps.forEach(p=>assert.equal(validateProcess(p),true,JSON.stringify(validateProcess.errors)));
  assert.equal(validateSummary(s),true,JSON.stringify(validateSummary.errors));
  assert.deepEqual(ps.map(p=>p.status_processamento),['ok','ok','pendente_revisao','pendente_revisao','pendente_revisao','erro','ok']);
  assert.deepEqual(f.records.map(r=>calls[r.numero_processo]),[1,1,3,1,3,3,1]);
  assert.deepEqual(Object.fromEntries(Object.entries(s).filter(([k])=>k!=='distribuicoes')),{data_referencia:'2026-05-31',total_identificado:7,vitorias_confirmadas:2,resultados_desconhecidos:2,condenacoes:3,processos_aptos:3,pendencias:4,
    passivo_centavos:f.expected.passivo,recursos_recomendados:1,custo_recursos_centavos:f.expected.custo,beneficio_esperado_recursos_centavos:f.expected.beneficio,
    processos_com_valor_atualizado:4,processos_sem_valor_atualizado:3,decisoes_concluidas:3,decisoes_pendentes:4,passivo_parcial:true});
  const report=output.relatorio_markdown.value;
  for(const r of f.records)assert.ok(report.includes(r.numero_processo));
  assert.match(report,/4\/7/);assert.match(report,/3\/7/);assert.match(report,/parcial/i);
  assert.doesNotMatch(report,/NaN|undefined/);
});
for(const kind of ['duplicado','vazio','subsidio_extra']) test(`S2.5: lote ${kind} falha globalmente antes da LLM`,async t=>{
  const f=await loteMisto();
  if(kind==='duplicado')f.raw.processos_texto+=f.raw.processos_texto;
  if(kind==='vazio')f.raw.processos_texto='';
  if(kind==='subsidio_extra')f.raw.subsidios_texto+='9999999-99.2026.8.26.0001,ausentes\n';
  const r=await run(t,f);assert.equal(r.output,undefined);assert.match(r.error,/duplicad|vazi|sem sentença|fora do lote/i);assert.deepEqual(r.calls,{});
});
test('S2.5: falha global no primeiro caso não chama os demais',async t=>{
  const f=await loteMisto();f.answers[f.records[0].numero_processo]={http:401};
  const r=await run(t,f);assert.equal(r.output,undefined);assert.ok(r.error);
  assert.deepEqual(r.calls,{[f.records[0].numero_processo]:1});
});

test('S2.5: passivo soma centavos finais por processo, não arredonda novamente a soma exata',async t=>{
  const f=await loteMonetario(),r=await run(t,f);assert.equal(r.error,undefined);
  assert.deepEqual(r.output.processos.value.map(p=>p.valor_atualizado_centavos),[1,1]);
  assert.equal(r.output.resumo.value.passivo_centavos,2); // Cada exato é 0,5 centavo: somar exatos e arredondar daria 1.
  assert.equal(r.output.resumo.value.passivo_parcial,false);
});
test('S2.5: estouro financeiro individual mantém as linhas sem retentar a extração',async t=>{
  const f=await loteMonetario({cents:Number.MAX_SAFE_INTEGER,base:'1.0000',final:'2.0000'}),r=await run(t,f);assert.equal(r.error,undefined);
  for(const p of r.output.processos.value) {
    assert.equal(p.status_processamento,'erro');assert.equal(p.decisao_recurso,'pendente');
    assert.equal(p.valor_atualizado_centavos,null);assert.equal(p.valor_condenacao_centavos,Number.MAX_SAFE_INTEGER);
    assert.equal(p.problemas[0].codigo,'VALOR_FORA_INTERVALO');
    assert.equal(r.calls[p.numero_processo],1);
  }
  assert.equal(r.output.resumo.value.passivo_centavos,0);assert.equal(r.output.resumo.value.passivo_parcial,true);
  assert.equal(r.output.resumo.value.processos_sem_valor_atualizado,2);
});
test('S2.5: soma agregada insegura falha, sem publicar total arredondado por Number',async t=>{
  const f=await loteMonetario({cents:Number.MAX_SAFE_INTEGER,base:'1.0000',final:'1.0000'}),r=await run(t,f);
  assert.equal(r.output,undefined);assert.match(r.error,/TOTAL_INSEGURO/);
  assert.deepEqual(Object.values(r.calls),[1,1]);
});
test('S2.5: toda exposição conhecida pode coexistir com decisão pendente',async t=>{
  const f=await loteMonetario();f.raw.subsidios_texto='numero_processo,status_subsidios\n';
  const r=await run(t,f);assert.equal(r.error,undefined);const s=r.output.resumo.value;
  assert.equal(s.passivo_parcial,false);assert.equal(s.passivo_centavos,2);
  assert.equal(s.processos_com_valor_atualizado,2);assert.equal(s.decisoes_concluidas,0);assert.equal(s.decisoes_pendentes,2);
  assert.equal(s.recursos_recomendados,0);assert.equal(s.beneficio_esperado_recursos_centavos,0);
});
for(const mutation of ['omitido','duplicado','auditoria_divergente']) test(`S2.5: consolidação recusa resultado ${mutation}`,async t=>{
  const f=await loteMonetario(),r=await run(t,f);assert.equal(r.error,undefined);
  const resultados=r.output.processos.value.map((p,i)=>({processos:[p],auditoria:[r.output.auditoria.value[i]]}));
  if(mutation==='omitido')resultados.pop();
  if(mutation==='duplicado')resultados[1]=structuredClone(resultados[0]);
  if(mutation==='auditoria_divergente')resultados[1].auditoria[0].numero_processo=resultados[0].processos[0].numero_processo;
  const errors=[];
  await assert.rejects(runGraphInFile('rivet/analise_sentencas.rivet-project',{graph:'s2_consolidacao_lote',
    inputs:{resultados:{type:'object[]',value:resultados},identidades:{type:'string[]',value:f.records.map(r=>r.numero_processo)},data_referencia:{type:'string',value:'2026-05-31'}},
    onNodeError:({error})=>errors.push(String(error))}));
  assert.match(errors.join('\n'),/RECONCILIACAO/);
});

test('S2.5: benefício positivo subcentavo recomenda e explica a apresentação zero no relatório',async t=>{
  const f=await loteMonetario({cents:11,base:'1.0000',final:'1.0000'});
  f.raw.custos_texto=f.raw.custos_texto.replace(/^TJSP;([^\r\n]*);[^;\r\n]+/m,'TJSP;$1;0.01');
  const r=await run(t,f);assert.equal(r.error,undefined);
  for(const p of r.output.processos.value) {assert.equal(p.decisao_recurso,'recorrer');assert.equal(p.beneficio_esperado_centavos,0);}
  assert.equal(r.output.resumo.value.recursos_recomendados,2);assert.equal(r.output.resumo.value.custo_recursos_centavos,2);
  assert.equal(r.output.resumo.value.beneficio_esperado_recursos_centavos,0);
  assert.match(r.output.relatorio_markdown.value,/positivo inferior a meio centavo/);
});
