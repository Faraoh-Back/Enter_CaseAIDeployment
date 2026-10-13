import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,open,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
import ExcelJS from 'exceljs';
import {criarApi} from '../src/api.mjs';
import {entradasS1} from '../scripts/s1-fixture.mjs';
import {hash} from '../src/executar-carteira.mjs';
import {executarS1} from '../src/executar-s1.mjs';

async function setup(t,{response,exportador}={}) {
 const root=await mkdtemp(path.join(tmpdir(),'enter-s4-integracao-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const raw=await entradasS1(),captured=JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json'));
 const capture={modelo_solicitado:captured.modelo_solicitado,entradas_sha256:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,hash(v)])),respostas:{'3871230-78.2024.8.26.0002':response??captured.resposta_llm_original}};
 const file=path.join(root,'captura.json'),inputs=path.join(root,'entradas.json');await writeFile(file,JSON.stringify(capture));await writeFile(inputs,JSON.stringify(raw));
 const options={destino:path.join(root,'api'),modo:'replay',captura:file,apiKey:'',lerEntradas:async()=>raw};
 if(exportador){const {executarCarteira}=await import('../src/executar-carteira.mjs');options.executor=o=>executarCarteira({...o,exportador});}
 const server=await criarApi(options);server.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
 t.after(()=>server.encerrar());
 return {root,server,file,inputs,base:`http://127.0.0.1:${server.address().port}`,dir:options.destino};
}
async function start(f){const r=await fetch(`${f.base}/execucoes`,{method:'POST',headers:{'Content-Type':'application/json'},body:'{"dataset":"case"}'});assert.equal(r.status,202);return r.json();}
async function finish(f,id){for(let i=0;i<1000;i++){const r=await fetch(`${f.base}/execucoes/${id}`),m=await r.json();if(m.estado!=='executando')return m;await new Promise(r=>setTimeout(r,10));}assert.fail('Timeout da execução HTTP');}
async function cli(f) {
 const out=await open(path.join(f.root,'stdout'),'w'),err=await open(path.join(f.root,'stderr'),'w');
 try {
  const child=spawn(process.execPath,['scripts/executar-carteira.mjs','--replay','--captura',f.file,'--entradas',f.inputs,'--destino',path.join(f.root,'cli')],{stdio:['ignore',out.fd,err.fd],timeout:30000,env:{...process.env,OPENAI_API_KEY:''}});
  const code=await new Promise((r,j)=>{child.once('error',j);child.once('close',r);});assert.equal(code,0,await readFile(path.join(f.root,'stderr'),'utf8'));
  return JSON.parse(await readFile(path.join(f.root,'stdout'),'utf8'));
 }finally{await out.close();await err.close();}
}
test('S4.2: API e CLI executam o mesmo grafo e publicam os mesmos JSON/Markdown sem rede LLM',async t=>{
 const f=await setup(t),r=await start(f),state=await finish(f,r.execucao_id);assert.equal(state.estado,'concluida');
 const result=await cli(f),apiDir=path.join(f.dir,r.execucao_id);
 for(const name of ['processos.json','resumo.json','auditoria.json','relatorio.md'])assert.deepEqual(await readFile(path.join(apiDir,name)),await readFile(path.join(result.diretorio,name)),name);
 const m=JSON.parse(await readFile(path.join(apiDir,'manifest.json')));assert.equal(m.chamadas_reais,0);assert.equal(m.execucao_id,r.execucao_id);assert.equal(m.origem_http,true);
 const b=new ExcelJS.Workbook();await b.xlsx.readFile(path.join(apiDir,'processos.xlsx'));const ws=b.getWorksheet('Processos');assert.equal(ws.getCell(2,ws.getRow(1).values.indexOf('Valor atualizado (R$)')).value,6673.14);
 for(const a of state.artefatos){assert.equal(a.disponivel,true);const download=await fetch(`${f.base}${a.url}`);assert.equal(download.status,200);assert.equal(hash(Buffer.from(await download.arrayBuffer())),a.sha256);}
});
test('S4.2: replay rejeitado termina com pendências e a API conserva a auditoria de três tentativas',async t=>{
 const f=await setup(t,{response:'{'}),r=await start(f),state=await finish(f,r.execucao_id);assert.equal(state.estado,'concluida_com_pendencias');assert.equal(state.resumo.pendencias,1);
 const a=state.artefatos.find(a=>a.nome==='auditoria.json');const [audit]=await (await fetch(`${f.base}${a.url}`)).json();assert.equal(audit.tentativas,3);assert.ok(audit.historico_tentativas.every(h=>h.estado==='extracao_invalida'));
});
test('S4.2: HTTP continua acessível enquanto o executor espera publicação e S1 compartilha exclusão',async t=>{
 let release;const wait=new Promise(r=>{release=r;});t.after(()=>release());
 const {exportarXlsx}=await import('../src/exportar-xlsx.mjs');
 const f=await setup(t,{exportador:async(...args)=>{await wait;await exportarXlsx(...args);}}),r=await start(f);
 await assert.rejects(executarS1({modo:'replay',destino:path.join(f.root,'s1')}),/EXECUCAO_ATIVA/);
 const read=await fetch(`${f.base}${r.status_url}`);assert.equal(read.status,200);assert.equal((await read.json()).estado,'executando');
 release();assert.equal((await finish(f,r.execucao_id)).estado,'concluida');
});
