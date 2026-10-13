import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setup,post,accepted,terminal} from './helpers/s4-http.mjs';

test('S4.1: POST retorna 202 somente com ID/URL e manifesto persistido; GET mostra execução ativa',async t=>{
 const f=await setup(t),r=await accepted(f);assert.match(r.execucao_id,/^[A-Za-z0-9_.:-]+$/);assert.equal(r.estado,'executando');assert.equal(r.status_url,`/execucoes/${r.execucao_id}`);
 const disk=JSON.parse(await readFile(path.join(f.root,r.execucao_id,'manifest.json')));assert.equal(disk.estado,'executando');assert.equal(disk.execucao_id,r.execucao_id);
 const status=await fetch(`${f.base}${r.status_url}`);assert.equal(status.status,200);assert.equal((await status.json()).estado,'executando');
 f.release();await terminal(f,r.execucao_id);
});
test('S4.1: GET terminal e download reproduzem os bytes publicados e não expõem credencial',async t=>{
 const f=await setup(t),r=await accepted(f);f.release();const status=await terminal(f,r.execucao_id);assert.equal(status.estado,'concluida');
 const artifact=status.artefatos.find(a=>a.nome==='processos.json');assert.equal(artifact.disponivel,true);assert.equal(artifact.url,`/execucoes/${r.execucao_id}/artefatos/processos.json`);
 const download=await fetch(`${f.base}${artifact.url}`);assert.equal(download.status,200);assert.match(download.headers.get('content-type'),/application\/json/);assert.match(download.headers.get('content-disposition'),/attachment.*processos.json/);
 assert.equal(await download.text(),await readFile(path.join(f.root,r.execucao_id,'processos.json'),'utf8'));
 assert.ok(!JSON.stringify(status).includes('credencial-ficticia'));
});
test('S4.1: concorrência retorna 409; POST posterior cria outra execução sem sobrescrever a primeira',async t=>{
 const f=await setup(t),first=await accepted(f),blocked=await post(f);assert.equal(blocked.status,409);assert.equal((await blocked.json()).erro.codigo,'EXECUCAO_ATIVA');
 f.release();await terminal(f,first.execucao_id);const next=await accepted(f);assert.notEqual(next.execucao_id,first.execucao_id);await terminal(f,next.execucao_id);
 assert.equal(f.calls.length,2);assert.ok(await readFile(path.join(f.root,first.execucao_id,'processos.json')));
});
test('S4.1: JSON malformado retorna 400 e campos extras/dataset inválido retornam 422 sem executar',async t=>{
 const f=await setup(t),bad=await fetch(`${f.base}/execucoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{'});assert.equal(bad.status,400);assert.equal((await bad.json()).erro.codigo,'JSON_INVALIDO');
 for(const body of [{dataset:'case',path:'/tmp'},{dataset:'outro'},[],null,{}]){const r=await post(f,body);assert.equal(r.status,422);assert.equal((await r.json()).erro.codigo,'ENTRADA_INVALIDA');}
 assert.equal(f.calls.length,0);
});
test('S4.1: configuração sem credencial e insumo indisponível retornam 503 sem iniciar executor',async t=>{
 const f=await setup(t,{apiKey:''}),r=await post(f);assert.equal(r.status,503);assert.equal((await r.json()).erro.codigo,'CONFIGURACAO_INDISPONIVEL');assert.equal(f.calls.length,0);
 const other=await setup(t,{lerEntradas:async()=>{throw new Error('Arquivo ausente');}}),missing=await post(other);assert.equal(missing.status,503);assert.equal(other.calls.length,0);
});
test('S4.1: execução e artefato inexistentes retornam 404; artefato conhecido em andamento retorna 409',async t=>{
 const f=await setup(t);assert.equal((await fetch(`${f.base}/execucoes/inexistente`)).status,404);
 const r=await accepted(f),early=await fetch(`${f.base}/execucoes/${r.execucao_id}/artefatos/processos.xlsx`);assert.equal(early.status,409);assert.equal((await early.json()).erro.codigo,'ARTEFATO_INDISPONIVEL');
 const unknown=await fetch(`${f.base}/execucoes/${r.execucao_id}/artefatos/.env`);assert.equal(unknown.status,404);assert.equal((await unknown.json()).erro.codigo,'ARTEFATO_NAO_ENCONTRADO');
 f.release();await terminal(f,r.execucao_id);
});
test('S4.1: arquivo presente fora do manifesto não pode ser baixado',async t=>{
 const f=await setup(t),r=await accepted(f);f.release();await terminal(f,r.execucao_id);await writeFile(path.join(f.root,r.execucao_id,'segredo.txt'),'conteudo-privado');
 const response=await fetch(`${f.base}/execucoes/${r.execucao_id}/artefatos/segredo.txt`);assert.equal(response.status,404);assert.ok(!(await response.text()).includes('conteudo-privado'));
});
test('S4.1: falha do executor termina falhou sem anunciar artefatos completos',async t=>{
 const f=await setup(t,{fail:true}),r=await accepted(f);f.release();const state=await terminal(f,r.execucao_id);assert.equal(state.estado,'falhou');assert.ok(!state.artefatos.some(a=>a.disponivel));
 const disk=JSON.parse(await readFile(path.join(f.root,r.execucao_id,'manifest.json')));assert.equal(disk.estado,'falhou');
});
test('S4.1: reinício marca execução persistida ativa como interrompida e preserva arquivos',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'enter-s4-reinicio-')),id='execucao-anterior',dir=path.join(root,id);await mkdir(dir);
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify({execucao_id:id,estado:'executando',artefatos:[],processados:1}));await writeFile(path.join(dir,'checkpoint.json'),'[]');
 const f=await setup(t,{root}),r=await fetch(`${f.base}/execucoes/${id}`);assert.equal(r.status,200);assert.equal((await r.json()).estado,'interrompida');assert.equal(await readFile(path.join(dir,'checkpoint.json'),'utf8'),'[]');assert.equal(f.calls.length,0);
});
test('S4.1: download exige arquivo íntegro e não entrega bytes adulterados',async t=>{
 const f=await setup(t),r=await accepted(f);f.release();await terminal(f,r.execucao_id);await writeFile(path.join(f.root,r.execucao_id,'processos.json'),'adulterado');
 const response=await fetch(`${f.base}/execucoes/${r.execucao_id}/artefatos/processos.json`);assert.equal(response.status,409);assert.equal((await response.json()).erro.codigo,'ARTEFATO_INDISPONIVEL');
});
