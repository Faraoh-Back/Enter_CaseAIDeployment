import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {executarCarteira,entradasCarteira,hash} from '../src/executar-carteira.mjs';
const references=JSON.parse(await readFile('tests/fixtures/carteira-referencia.json','utf8'));
async function setup(t,subset) {
 const root=await mkdtemp(path.join(tmpdir(),'enter-s3-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const raw=await entradasCarteira();
 if(subset){raw.processos_texto=subset.map(r=>`${'='.repeat(30)}\nProcesso nº ${r.numero_processo}\n${'='.repeat(30)}\n${r.sentenca}\n`).join('');raw.subsidios_texto='numero_processo,status_subsidios\n'+subset.map(r=>`${r.numero_processo},${r.calculo_esperado.status_subsidios}\n`).join('');}
 const capture={modelo_solicitado:'gpt-4.1-mini-2025-04-14',entradas_sha256:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,hash(v)])),respostas:Object.fromEntries((subset??references).map(r=>[r.numero_processo,JSON.stringify(r.extracao_esperada)])),origem:'anotacao_offline; não é resposta de LLM real'};
 const file=path.join(root,'captura.json');await writeFile(file,JSON.stringify(capture));return {root,raw,file};
}
const sse=content=>new Response(`data: ${JSON.stringify({choices:[{index:0,delta:{content},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
test('S3.1: carteira inteira reconcilia 100 identidades e 52 condenações, sem truncamento',async t=>{
 const f=await setup(t),r=await executarCarteira({modo:'replay',destino:f.root,entradas:f.raw,captura:f.file});
 const m=JSON.parse(await readFile(path.join(r.diretorio,'manifest.json')));
 const ps=JSON.parse(await readFile(path.join(r.diretorio,'processos.json')));
 assert.equal(m.estado,'concluida');assert.equal(m.processados,100);assert.equal(m.requisicoes_extrator,100);assert.equal(m.chamadas_reais,0);
 assert.deepEqual(m.nao_processados,[]);assert.equal(m.resumo.condenacoes,52);assert.equal(m.resumo.vitorias_confirmadas,48);
 assert.deepEqual(ps.map(p=>p.numero_processo),references.map(r=>r.numero_processo));
 assert.equal(m.artefatos.length,5);for(const a of m.artefatos)assert.equal(hash(await readFile(path.join(r.diretorio,a.nome))),a.sha256);
 assert.equal(JSON.parse(await readFile(path.join(r.diretorio,'checkpoint.json'))).length,100);
});
test('S3.1: captura incompatível falha antes de iniciar execução',async t=>{
 const f=await setup(t,[references[0]]);f.raw.data_referencia='2026-05-30';
 await assert.rejects(executarCarteira({modo:'replay',destino:f.root,entradas:f.raw,captura:f.file}),/CAPTURA_INCOMPATIVEL/);
 assert.deepEqual(await readdir(f.root),['captura.json']);
});
test('S3.1: HTTP 401 preserva checkpoint e identifica os casos não processados',async t=>{
 const selected=references.slice(0,3),f=await setup(t,selected);let calls=0;
 t.mock.method(globalThis,'fetch',async()=>++calls===1?sse(JSON.stringify(selected[0].extracao_esperada)):new Response('{}',{status:401}));
 let error;try{await executarCarteira({modo:'real',destino:f.root,entradas:f.raw,apiKey:'credencial-ficticia'});}catch(e){error=e;}
 assert.ok(error?.diretorio);const m=JSON.parse(await readFile(path.join(error.diretorio,'manifest.json')));
 assert.equal(m.estado,'falhou');assert.equal(calls,2);assert.equal(m.processados,1);
 assert.deepEqual(m.nao_processados,selected.slice(1).map(r=>r.numero_processo));
 assert.equal(JSON.parse(await readFile(path.join(error.diretorio,'checkpoint.json'))).length,1);
 assert.deepEqual(m.artefatos,[]);
});
test('S3.1: cancelamento externo termina interrompida e restaura transporte',async t=>{
 const selected=references.slice(0,2),f=await setup(t,selected),controller=new AbortController();let calls=0;
 t.mock.method(globalThis,'fetch',async()=>{if(++calls===1)return sse(JSON.stringify(selected[0].extracao_esperada));controller.abort(new Error('Cancelamento de teste'));throw new Error('Cancelamento de teste');});
 const before=globalThis.fetch;let error;try{await executarCarteira({modo:'real',destino:f.root,entradas:f.raw,apiKey:'credencial-ficticia',signal:controller.signal});}catch(e){error=e;}
 assert.equal(globalThis.fetch,before);const m=JSON.parse(await readFile(path.join(error.diretorio,'manifest.json')));
 assert.equal(m.estado,'interrompida');assert.equal(m.processados,1);assert.equal(m.nao_processados.length,1);
});
test('S3.1: falha de exportação preserva JSON sem anunciar XLSX incompleto',async t=>{
 const f=await setup(t,[references[0]]);let error;
 try{await executarCarteira({modo:'replay',destino:f.root,entradas:f.raw,captura:f.file,exportador:async()=>{throw new Error('Disco indisponível');}});}catch(e){error=e;}
 const m=JSON.parse(await readFile(path.join(error.diretorio,'manifest.json')));assert.equal(m.estado,'falhou');assert.equal(m.artefatos.length,4);
 assert.ok(!(await readdir(error.diretorio)).some(x=>x.endsWith('.tmp')||x.endsWith('.xlsx')));
});
