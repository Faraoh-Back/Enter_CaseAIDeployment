import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,open,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {prepararReplay} from '../scripts/preparar-replay-carteira.mjs';

async function root(t){const dir=await mkdtemp(path.join(tmpdir(),'enter-s4-cli-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
async function start(t,dir,args,label) {
 const outPath=path.join(dir,`${label}.stdout`),errPath=path.join(dir,`${label}.stderr`),out=await open(outPath,'w'),err=await open(errPath,'w');
 const child=spawn(process.execPath,['scripts/servidor.mjs','--port','0','--host','127.0.0.1',...args],{env:{...process.env,OPENAI_API_KEY:'',INPUT_DIR:'',OUTPUT_DIR:path.join(dir,'api')},stdio:['ignore',out.fd,err.fd]});
 const closed=new Promise((r,j)=>{child.once('error',j);child.once('close',r);});closed.catch(()=>{});
 t.after(async()=>{if(child.exitCode===null&&child.signalCode===null)child.kill('SIGTERM');await closed;await out.close();await err.close();});
 let ready;for(let i=0;i<500;i++){const text=await readFile(outPath,'utf8');if(text.trim()){ready=JSON.parse(text.trim());break;}if(child.exitCode!==null)assert.fail(await readFile(errPath,'utf8'));await new Promise(r=>setTimeout(r,10));}
 assert.ok(ready?.url);return {child,closed,ready,dir:path.join(dir,'api'),logs:async()=>await readFile(outPath,'utf8')+await readFile(errPath,'utf8')};
}
test('S4.5: processo CLI real sem credencial responde 503 e não inicia análise nem carrega .env implicitamente',async t=>{
 const dir=await root(t),server=await start(t,dir,['--real'],'real');assert.equal(server.ready.modo,'real');
 const r=await fetch(`${server.ready.url}/execucoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"dataset":"case"}'});assert.equal(r.status,503);assert.equal((await r.json()).erro.codigo,'CONFIGURACAO_INDISPONIVEL');
 assert.equal((await readdir(server.dir)).filter(n=>!n.startsWith('.')).length,0);
 server.child.kill('SIGTERM');assert.equal(await server.closed,0);
});
test('S4.5: crash real do processo deixa job recuperável; reinício marca interrompido sem nova análise',async t=>{
 const dir=await root(t),replay=await prepararReplay(path.join(dir,'captura'));
 const first=await start(t,dir,['--replay','--captura',replay.captura],'primeiro');
 const r=await fetch(`${first.ready.url}/execucoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"dataset":"case"}'});assert.equal(r.status,202);const accepted=await r.json();
 first.child.kill('SIGKILL');await first.closed;
 const manifestPath=path.join(first.dir,accepted.execucao_id,'manifest.json'),before=JSON.parse(await readFile(manifestPath));assert.equal(before.estado,'executando');
 const next=await start(t,dir,['--replay','--captura',replay.captura],'segundo'),response=await fetch(`${next.ready.url}${accepted.status_url}`);assert.equal(response.status,200);assert.equal((await response.json()).estado,'interrompida');
 const after=JSON.parse(await readFile(manifestPath));assert.equal(after.requisicoes_extrator??0,before.requisicoes_extrator??0);assert.equal(after.chamadas_reais??0,0);
 next.child.kill('SIGTERM');assert.equal(await next.closed,0);assert.ok(!(await readdir(first.dir)).includes('.api.lock'));
});
