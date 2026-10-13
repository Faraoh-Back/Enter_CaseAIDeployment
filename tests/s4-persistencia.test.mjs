import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,symlink,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {setup,post,accepted,terminal} from './helpers/s4-http.mjs';
import {criarApi} from '../src/api.mjs';
import {gravarAtomico} from '../src/armazenamento-api.mjs';
import {hash} from '../src/executar-carteira.mjs';

test('S4.3: falha ao persistir manifesto impede 202/executor e libera o próximo POST',async t=>{
 let writes=0;const f=await setup(t,{apiOptions:{persistirManifesto:async(...args)=>{if(++writes===1)throw new Error('Disco indisponível');return gravarAtomico(...args);}}});
 const r=await post(f);assert.equal(r.status,500);assert.equal(f.calls.length,0);assert.deepEqual((await readdir(f.root)).filter(n=>!n.startsWith('.')),[]);
 const next=await accepted(f);f.release();assert.equal((await terminal(f,next.execucao_id)).estado,'concluida');
});
test('S4.3: falha com credencial no diagnóstico é sanitizada no GET e manifesto',async t=>{
 const key='credencial-ficticia-nao-publicavel';const f=await setup(t,{apiKey:key,executor:async()=>{throw new Error(`Erro com ${key}`);}}),r=await accepted(f);
 const state=await terminal(f,r.execucao_id);assert.equal(state.estado,'falhou');assert.ok(!JSON.stringify(state).includes(key));assert.ok(!(await readFile(path.join(f.root,r.execucao_id,'manifest.json'),'utf8')).includes(key));
});
test('S4.3: encerramento interrompe execução ativa, preserva checkpoint e permite reabrir diretório',async t=>{
 let started;const ready=new Promise(r=>{started=r;});
 const f=await setup(t,{executor:async({signal,destino,execucao_id})=>{
  await writeFile(path.join(destino,execucao_id,'checkpoint.json'),'[{"preservado":true}]');started();
  await new Promise((_,reject)=>{if(signal.aborted)return reject(signal.reason);signal.addEventListener('abort',()=>reject(signal.reason),{once:true});});
 }}),r=await accepted(f);await ready;await f.server.encerrar();
 const dir=path.join(f.root,r.execucao_id),m=JSON.parse(await readFile(path.join(dir,'manifest.json')));assert.equal(m.estado,'interrompida');assert.equal(await readFile(path.join(dir,'checkpoint.json'),'utf8'),'[{"preservado":true}]');
 const reopened=await criarApi({destino:f.root,apiKey:'ficticia'});await reopened.encerrar();
});
test('S4.3: segunda instância no mesmo diretório é recusada antes de recuperar o job ativo',async t=>{
 const f=await setup(t),r=await accepted(f);
 await assert.rejects(criarApi({destino:f.root,apiKey:'ficticia'}),/API_DIRETORIO_EM_USO/);
 assert.equal(JSON.parse(await readFile(path.join(f.root,r.execucao_id,'manifest.json'))).estado,'executando');
 f.release();await terminal(f,r.execucao_id);
});
test('S4.3: lock de processo morto é recuperado e job antigo passa a interrompido',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'enter-s4-lock-'));t.after(()=>rm(root,{recursive:true,force:true}));
 await writeFile(path.join(root,'.api.lock'),JSON.stringify({pid:2147483647,token:'lock-antigo'}));
 const id='execucao-antiga',dir=path.join(root,id);await mkdir(dir);await writeFile(path.join(dir,'manifest.json'),JSON.stringify({execucao_id:id,estado:'executando',artefatos:[]}));
 const server=await criarApi({destino:root,apiKey:'ficticia'});assert.equal(JSON.parse(await readFile(path.join(dir,'manifest.json'))).estado,'interrompida');await server.encerrar();
 assert.ok(!(await readdir(root)).includes('.api.lock'));
});
test('S4.3: symlink de artefato com hash correspondente continua indisponível',async t=>{
 const f=await setup(t),r=await accepted(f);f.release();await terminal(f,r.execucao_id);
 const dir=path.join(f.root,r.execucao_id),file=path.join(dir,'processos.json'),bytes=await readFile(file);
 const external=path.join(f.root,'externo.json');await writeFile(external,bytes);await rm(file);await symlink(external,file);
 const download=await fetch(`${f.base}/execucoes/${r.execucao_id}/artefatos/processos.json`);assert.equal(download.status,409);
});
test('S4.3: arquivo temporário não é publicado nem anunciado como artefato',async t=>{
 const f=await setup(t),r=await accepted(f),dir=path.join(f.root,r.execucao_id);await writeFile(path.join(dir,'processos.xlsx.tmp'),'incompleto');
 const state=await (await fetch(`${f.base}${r.status_url}`)).json();assert.equal(state.artefatos.find(a=>a.nome==='processos.xlsx').disponivel,false);
 assert.equal((await fetch(`${f.base}/execucoes/${r.execucao_id}/artefatos/processos.xlsx.tmp`)).status,404);
 f.release();await terminal(f,r.execucao_id);
});
test('S4.3: caminho codificado e symlink de diretório não expõem dados externos',async t=>{
 const f=await setup(t),outside=path.join(f.root,'externo');await mkdir(outside);await writeFile(path.join(outside,'manifest.json'),JSON.stringify({execucao_id:'atalho',estado:'concluida',artefatos:[]}));await symlink(outside,path.join(f.root,'atalho'));
 assert.equal((await fetch(`${f.base}/execucoes/atalho`)).status,404);
 assert.equal((await fetch(`${f.base}/execucoes/..%2Fexterno`)).status,404);
});
test('S4.3: arquivos completos já registrados permanecem disponíveis quando exportação posterior falha',async t=>{
 const f=await setup(t,{executor:async({destino,execucao_id})=>{
  const dir=path.join(destino,execucao_id),file=path.join(dir,'manifest.json'),m=JSON.parse(await readFile(file));const bytes='[]\n';await writeFile(path.join(dir,'processos.json'),bytes);
  await gravarAtomico(file,JSON.stringify({...m,artefatos:[{nome:'processos.json',sha256:hash(bytes)}]}));throw new Error('Falha posterior na planilha');
 }}),r=await accepted(f),state=await terminal(f,r.execucao_id);assert.equal(state.estado,'falhou');assert.equal(state.artefatos.find(a=>a.nome==='processos.json').disponivel,true);assert.equal(state.artefatos.find(a=>a.nome==='processos.xlsx').disponivel,false);
});
