import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {criarApi} from '../src/api.mjs';
import {entradasS1} from '../scripts/s1-fixture.mjs';
import {hash} from '../src/executar-carteira.mjs';
async function setup(t,renderizador){
 const root=await mkdtemp(path.join(tmpdir(),'enter-s5-api-')),raw=await entradasS1();
 const capture=JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json'));
 const file=path.join(root,'captura.json');await writeFile(file,JSON.stringify({modelo_solicitado:capture.modelo_solicitado,entradas_sha256:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,hash(v)])),respostas:{'3871230-78.2024.8.26.0002':capture.resposta_llm_original}}));
 const server=await criarApi({destino:root,modo:'replay',captura:file,apiKey:'',lerEntradas:async()=>raw,renderizador});
 t.after(async()=>{await server.encerrar();await rm(root,{recursive:true,force:true});});
 server.listen(0,'127.0.0.1');await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});const base=`http://127.0.0.1:${server.address().port}`;
 const post=await fetch(`${base}/execucoes`,{method:'POST',body:'{"dataset":"case"}'});assert.equal(post.status,202);const {execucao_id:id}=await post.json();
 for(let i=0;i<1000;i++){const state=await (await fetch(`${base}/execucoes/${id}`)).json();if(state.estado!=='executando')return {root,base,id,state};await new Promise(r=>setTimeout(r,10));}assert.fail('Timeout');
}
test('S5.10: PDF publicado pelo executor é baixado com hash, MIME e integridade, sem novas chamadas LLM',async t=>{
 const bytes=Buffer.from('%PDF-1.4\n% transporte controlado para o contrato HTTP\n');
 const f=await setup(t,async(data,file)=>{assert.equal(data.resumo.passivo_centavos,667314);await writeFile(file,bytes,{flag:'wx'});});
 assert.equal(f.state.estado,'concluida');const a=f.state.artefatos.find(a=>a.nome==='relatorio.pdf');assert.equal(a.disponivel,true);
 const response=await fetch(f.base+a.url);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(hash(Buffer.from(await response.arrayBuffer())),a.sha256);
 const m=JSON.parse(await readFile(path.join(f.root,f.id,'manifest.json')));assert.equal(m.chamadas_reais,0);
 await writeFile(path.join(f.root,f.id,'relatorio.pdf'),'%PDF-adulterado');assert.equal((await fetch(f.base+a.url)).status,409);
});
test('S5.10: renderização inválida falha sem anunciar PDF e conserva os cinco artefatos anteriores',async t=>{
 const f=await setup(t,async(_data,file)=>writeFile(file,'arquivo incompleto'));
 assert.equal(f.state.estado,'falhou');assert.equal(f.state.artefatos.filter(a=>a.disponivel).length,5);
 assert.equal(f.state.artefatos.find(a=>a.nome==='relatorio.pdf').disponivel,false);
 await assert.rejects(readFile(path.join(f.root,f.id,'relatorio.pdf.tmp')),/ENOENT/);
});
