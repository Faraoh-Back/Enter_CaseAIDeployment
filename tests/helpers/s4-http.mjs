import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const sha=value=>createHash('sha256').update(value).digest('hex');
function gate() {let release;const promise=new Promise(resolve=>{release=resolve;});return {promise,release};}
export async function setup(t,{apiOptions={},apiKey='credencial-ficticia',fail=false,root,executor,lerEntradas}={}) {
 root??=await mkdtemp(path.join(tmpdir(),'enter-s4-http-'));

 const wait=gate(),calls=[];let server;
 t.after(async()=>{wait.release();if(server)await server.encerrar();await rm(root,{recursive:true,force:true});});
 const fake=async options=>{
  calls.push(options);await wait.promise;
  if(fail)throw new Error('Falha de exportação simulada');
  const dir=path.join(options.destino,options.execucao_id);
  const manifest=JSON.parse(await readFile(path.join(dir,'manifest.json'),'utf8'));
  const content='[{"numero_processo":"caso-controlado"}]\n';
  await writeFile(path.join(dir,'processos.json'),content);
  const final={...manifest,estado:'concluida',processados:1,resumo:{total_identificado:1,pendencias:0},artefatos:[{nome:'processos.json',sha256:sha(content)}]};
  await writeFile(path.join(dir,'manifest.json'),JSON.stringify(final));
  return {execucao_id:options.execucao_id,diretorio:dir,estado:'concluida'};
 };
 const {criarApi}=await import('../../src/api.mjs');
 server=await criarApi({...apiOptions,destino:root,apiKey,modelo:'modelo-controlado',executor:executor??fake,lerEntradas:lerEntradas??(async()=>({processos_texto:'entrada-controlada'}))});
 server.listen(0,'127.0.0.1');await new Promise((resolve,reject)=>{server.once('listening',resolve);server.once('error',reject);});
 const base=`http://127.0.0.1:${server.address().port}`;
 return {root,server,base,calls,release:wait.release};
}
export async function post(f,body={dataset:'case'}) {return fetch(`${f.base}/execucoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});}
export async function accepted(f) {const r=await post(f);assert.equal(r.status,202);return r.json();}
export async function terminal(f,id) {
 for(let i=0;i<100;i++){const r=await fetch(`${f.base}/execucoes/${id}`);const state=await r.json();if(['concluida','concluida_com_pendencias','falhou','interrompida'].includes(state.estado))return state;await new Promise(resolve=>setTimeout(resolve,10));}
 assert.fail('Execução não chegou ao estado terminal no prazo do teste');
}
