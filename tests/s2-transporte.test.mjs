import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {executarS1} from '../src/executar-s1.mjs';
import {runGraphInFile} from '../src/rivet-runtime.mjs';
import {entradasS1} from '../scripts/s1-fixture.mjs';

const valid=await readFile('schemas/extracao.exemplo.json','utf8');
const usage={prompt_tokens:100,completion_tokens:50,total_tokens:150};
function sse(content=valid,{complete=true}={}) {
  return new Response(`data: ${JSON.stringify({choices:[{index:0,delta:{content},finish_reason:'stop'}]})}\n\n`+
    `data: ${JSON.stringify({choices:[],usage})}\n\n`+(complete?'data: [DONE]\n\n':''),{headers:{'Content-Type':'text/event-stream'}});
}
function http(status,code,after='0') {return new Response(JSON.stringify({error:{code}}),{status,headers:{'Retry-After':after}});}
async function setup(t,answers) {
  const dir=await mkdtemp(path.join(tmpdir(),'enter-s24-'));
  t.after(()=>rm(dir,{recursive:true,force:true}));
  let calls=0;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    calls++;
    assert.ok(calls<=3,'Guarda: nunca fazer quarta requisição');
    assert.ok(JSON.parse(options.body).stream_options.include_usage);
    return answers[Math.min(calls-1,answers.length-1)](options);
  });
  return {dir,calls:()=>calls,async execute(){
    const result=await executarS1({modo:'real',apiKey:'credencial-ficticia',destino:dir});
    const read=async name=>JSON.parse(await readFile(path.join(result.diretorio,`${name}.json`),'utf8'));
    return {manifest:await read('manifest'),audit:(await read('auditoria'))[0],process:(await read('processos'))[0]};
  }};
}
test('S2.4: executor permite HTTP + JSON inválido + reparo e registra uso parcial sem fingir total',async t=>{
  const ctx=await setup(t,[()=>http(503,'server_error'),()=>sse('{'),()=>sse()]);
  const {manifest,audit,process}=await ctx.execute();
  assert.equal(ctx.calls(),3);assert.equal(manifest.chamadas_reais,3);assert.equal(manifest.estado,'concluida');
  assert.equal(process.valor_atualizado_centavos,667314);
  assert.deepEqual(audit.historico_tentativas.map(h=>h.estado),['falha_transporte','extracao_invalida','aprovada']);
  assert.deepEqual(audit.historico_tentativas.map(h=>h.http_status),[503,200,200]);
  assert.equal(manifest.tokens,null);assert.equal(audit.tokens,null);
  assert.deepEqual(audit.historico_tentativas[1].uso,usage);
  assert.deepEqual(audit.historico_tentativas[2].uso,usage);
  assert.deepEqual(manifest.limites_extracao,{tentativas:3,timeout_tentativa_ms:10000,timeout_extracao_ms:40000});
  assert.match(manifest.plugin_sha256,/^[a-f0-9]{64}$/);
});
test('S2.4: consumo inclui as respostas rejeitadas, não somente a última',async t=>{
  const ctx=await setup(t,[()=>sse('{'),()=>sse('null'),()=>sse()]);
  const {manifest,audit}=await ctx.execute();
  assert.equal(ctx.calls(),3);
  assert.deepEqual(audit.tokens,{entrada:300,saida:150,total:450});
  assert.deepEqual(manifest.tokens,audit.tokens);
});
test('S2.4: rate limit transitório pode recuperar na segunda chamada',async t=>{
  const ctx=await setup(t,[()=>http(429,'rate_limit_exceeded'),()=>sse()]);
  assert.equal((await ctx.execute()).manifest.estado,'concluida');assert.equal(ctx.calls(),2);
});
test('S2.4: Retry-After maior que orçamento interrompe sem ignorar espera do provedor',async t=>{
  const ctx=await setup(t,[()=>http(429,'rate_limit_exceeded','120')]);
  await assert.rejects(ctx.execute());assert.equal(ctx.calls(),1);
  const [id]=await readdir(ctx.dir),m=JSON.parse(await readFile(path.join(ctx.dir,id,'manifest.json')));
  assert.equal(m.estado,'falhou');assert.deepEqual(m.artefatos,[]);
  assert.match(JSON.stringify(m.erros),/espera do provedor/);
});
test('S2.4: stream sem DONE não autoriza cálculo mesmo contendo JSON válido',async t=>{
  const ctx=await setup(t,[()=>sse(valid,{complete:false})]);
  const {manifest,process,audit}=await ctx.execute();
  assert.equal(ctx.calls(),3);assert.equal(manifest.estado,'concluida_com_pendencias');
  assert.equal(process.status_processamento,'erro');assert.equal(process.valor_atualizado_centavos,null);
  assert.equal(process.decisao_recurso,'pendente');
  assert.ok(audit.historico_tentativas.every(h=>h.estado==='falha_transporte'));
});
test('S2.4: cancelamento em transporte propaga sem retentar ou fabricar outputs',async t=>{
  const abort=new AbortController();let calls=0;
  t.mock.method(globalThis,'fetch',async(_url,options)=>{
    calls++;
    return new Promise((resolve,reject)=>{
      options.signal.addEventListener('abort',()=>reject(new Error('Cancelado')),{once:true});
      abort.abort();
    });
  });
  const raw=await entradasS1();
  await assert.rejects(runGraphInFile('rivet/analise_sentencas.rivet-project',{
    graph:'analisar_carteira',inputs:Object.fromEntries(Object.entries(raw).map(([k,value])=>[k,{type:'string',value}])),
    openAiKey:'credencial-ficticia',abortSignal:abort.signal,
  }));
  assert.equal(calls,1);
});
test('S2.4: tentativa paralisada é abortada pelo timeout e permite recuperação', {timeout:20000}, async t=>{
  let aborted=false;
  const ctx=await setup(t,[options=>new Promise((resolve,reject)=>{
    options.signal.addEventListener('abort',()=>{aborted=true;reject(new Error('Timeout observado'));},{once:true});
  }),()=>sse()]);
  const {process,audit}=await ctx.execute();
  assert.equal(aborted,true);assert.equal(ctx.calls(),2);assert.equal(process.status_processamento,'ok');
  assert.deepEqual(audit.historico_tentativas.map(h=>h.estado),['falha_transporte','aprovada']);
});
test('S2.4: Retry-After que cabe no orçamento é respeitado antes da segunda chamada',async t=>{
  let firstTime,secondTime;
  const ctx=await setup(t,[()=>{firstTime=performance.now();return http(429,'rate_limit_exceeded','1');},()=>{
    secondTime=performance.now();return sse();
  }]);
  assert.equal((await ctx.execute()).process.status_processamento,'ok');
  assert.ok(secondTime-firstTime>=950,'Não repetir antes do segundo solicitado pelo provedor');
  assert.equal(ctx.calls(),2);
});
