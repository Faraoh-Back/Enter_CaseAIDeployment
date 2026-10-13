import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {exportarPdf} from '../src/relatorio-pdf.mjs';
import {hash} from '../src/executar-carteira.mjs';
export async function render({origem='docs/output/s5',destino='outputs/s5-relatorio',fonte,previa=false,familia='Times New Roman'}={}){
 const manifest=JSON.parse(await readFile(path.join(origem,'manifest.json'),'utf8'));
 const data={};
 for(const name of ['resumo.json','processos.json','auditoria.json','relatorio.md']){
  const bytes=await readFile(path.join(origem,name)),item=manifest.artefatos.find(a=>a.nome===name);
  if(!item||hash(bytes)!==item.sha256)throw new Error(`RENDER_ORIGEM_DIVERGENTE: ${name}`);
  data[name==='relatorio.md'?'relatorio_markdown':name.replace('.json','')]=name.endsWith('.json')?JSON.parse(bytes):bytes.toString();
 }
 const dir=path.resolve(destino,`relatorio-${randomUUID()}`);await mkdir(dir,{recursive:true});
 const result=await exportarPdf(data,path.join(dir,'relatorio.pdf'),{fonte,previa,familia});
 await writeFile(path.join(dir,'relatorio.html'),result.html);
 const record={versao:'s5-render-v1',execucao_origem:manifest.execucao_id,manifest_origem_sha256:hash(await readFile(path.join(origem,'manifest.json'))),
  familia:result.familia,previa:result.previa,chamadas_llm:0,artefatos:[]};
 for(const name of ['relatorio.pdf','relatorio.html'])record.artefatos.push({nome:name,sha256:hash(await readFile(path.join(dir,name)))});
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify(record,null,2)+'\n');return {diretorio:dir,...record};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const {values:v}=parseArgs({options:{origem:{type:'string'},destino:{type:'string'},fonte:{type:'string'},previa:{type:'boolean'},familia:{type:'string'}},strict:true});console.log(JSON.stringify(await render(v),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
