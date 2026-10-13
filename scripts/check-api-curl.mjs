import assert from 'node:assert/strict';
import {mkdir,open,readFile,writeFile} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {prepararReplay} from './preparar-replay-carteira.mjs';
import {hash} from '../src/executar-carteira.mjs';

const dir=path.resolve('outputs/s4-curl',randomUUID());await mkdir(dir,{recursive:true});
const replay=await prepararReplay(path.join(dir,'replay')),env={...process.env,OPENAI_API_KEY:''};
const commands=[];
async function command(program,args,label) {
  commands.push({programa:program,argumentos:args});
  const out=await open(path.join(dir,`${label}.stdout`),'w'),err=await open(path.join(dir,`${label}.stderr`),'w');
  try{
    const child=spawn(program,args,{env,stdio:['ignore',out.fd,err.fd],timeout:90000});
    const code=await new Promise((r,j)=>{child.once('error',j);child.once('close',r);});
    assert.equal(code,0,await readFile(path.join(dir,`${label}.stderr`),'utf8'));
    return await readFile(path.join(dir,`${label}.stdout`),'utf8');
  }finally{await out.close();await err.close();}
}
const logFile=path.join(dir,'servidor.stdout'),errorFile=path.join(dir,'servidor.stderr');
const out=await open(logFile,'w'),err=await open(errorFile,'w');
const args=['scripts/servidor.mjs','--replay','--captura',replay.captura,'--destino',path.join(dir,'api'),'--port','0'];
commands.push({programa:'node',argumentos:args});
const server=spawn(process.execPath,args,{env,stdio:['ignore',out.fd,err.fd]});
const closed=new Promise(resolve=>server.once('close',resolve));let evidence;
try{
  let config;for(let i=0;i<500;i++){const text=await readFile(logFile,'utf8');if(text.trim()){config=JSON.parse(text.trim());break;}if(server.exitCode!==null)throw new Error(await readFile(errorFile,'utf8'));await new Promise(r=>setTimeout(r,10));}
  assert.ok(config?.url,'Servidor não iniciou');const base=config.url;
  const postFile=path.join(dir,'post.json');
  const accepted=await command('curl',['-sS','--max-time','60','-D',path.join(dir,'post.headers'),'-o',postFile,'-w','%{http_code}','-X','POST',`${base}/execucoes`,'-H','Content-Type: application/json','--data','{"dataset":"case"}'],'post');
  assert.equal(accepted,'202');const response=JSON.parse(await readFile(postFile));
  const statusFile=path.join(dir,'estado.json');let state;
  for(let i=0;i<300;i++){
    const status=await command('curl',['-sS','--max-time','60','-o',statusFile,'-w','%{http_code}',`${base}${response.status_url}`],`consulta-${i}`);assert.equal(status,'200');state=JSON.parse(await readFile(statusFile));if(state.estado!=='executando')break;await new Promise(r=>setTimeout(r,100));
  }
  assert.equal(state.estado,'concluida');assert.equal(state.resumo.total_identificado,replay.identidades);assert.equal(state.resumo.pendencias,0);
  const downloaded=[];
  for(const item of state.artefatos){assert.equal(item.disponivel,true);const file=path.join(dir,`download-${item.nome}`);const status=await command('curl',['-sS','--max-time','60','-D',path.join(dir,`download-${item.nome}.headers`),'-o',file,'-w','%{http_code}',`${base}${item.url}`],`download-${item.nome}`);assert.equal(status,'200');assert.equal(hash(await readFile(file)),item.sha256);downloaded.push({nome:item.nome,sha256:item.sha256,http_status:200});}
  const m=JSON.parse(await readFile(path.join(dir,'api',response.execucao_id,'manifest.json')));assert.equal(m.chamadas_reais,0);
  const original=JSON.parse(await readFile('docs/output/s3/resumo.json'));
  assert.deepEqual(state.resumo,original);
  const configErrorFile=path.join(dir,'erro-configuracao.json');
  const disabled=await import('../src/api.mjs');const missing=await disabled.criarApi({destino:path.join(dir,'sem-credencial'),apiKey:''});
  missing.listen(0,'127.0.0.1');await new Promise((r,j)=>{missing.once('listening',r);missing.once('error',j);});
  let configStatus;
  try{configStatus=await command('curl',['-sS','-o',configErrorFile,'-w','%{http_code}','-X','POST',`http://127.0.0.1:${missing.address().port}/execucoes`,'-H','Content-Type: application/json','--data','{"dataset":"case"}'],'sem-credencial');assert.equal(configStatus,'503');assert.equal(JSON.parse(await readFile(configErrorFile)).erro.codigo,'CONFIGURACAO_INDISPONIVEL');}
  finally{await missing.encerrar();}
  evidence={etapa:'S4.5',estado:'aprovado',diretorio:dir,modo:'replay_respostas_reais_capturadas',chamadas_reais_llm:0,post_http_status:202,consulta_http_status:200,configuracao_ausente_http_status:Number(configStatus),execucao_id:response.execucao_id,
    resumo:state.resumo,artefatos:downloaded,manifest:m,replay_origem:JSON.parse(await readFile(replay.captura)).origem,comandos:commands};
  await writeFile(path.join(dir,'evidencia.json'),JSON.stringify(evidence,null,2)+'\n');
}finally{
  server.kill('SIGTERM');const deadline=setTimeout(()=>server.kill('SIGKILL'),5000);await closed;clearTimeout(deadline);await out.close();await err.close();
}
console.log(JSON.stringify({estado:evidence.estado,diretorio:dir,identidades:evidence.resumo.total_identificado,chamadas_reais_llm:0},null,2));
