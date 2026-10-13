import {readFile,writeFile,mkdir,lstat,realpath,copyFile} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {hash} from '../src/executar-carteira.mjs';

export function caminhoPermitido(name){
 if(typeof name!=='string'||!name||path.isAbsolute(name)||name.includes('\\'))return false;
 const parts=name.split('/');
 if(parts.some(p=>!p||p==='.'||p==='..'||['.git','node_modules','outputs','deliverables'].includes(p)))return false;
 if(parts.some(p=>p.startsWith('.env')&&p!=='.env.example'))return false;
 return !/\.(log|tmp)$/.test(name);
}
export async function conferirLista(root,lista){
 const base=await realpath(root),seen=new Set(),items=[];
 for(const item of lista){
  if(!caminhoPermitido(item.origem)||!caminhoPermitido(item.destino)||seen.has(item.destino))throw new Error('ENTREGA_LISTA_INVALIDA');
  seen.add(item.destino);const source=path.join(base,item.origem);
  const st=await lstat(source);if(!st.isFile()||st.isSymbolicLink()||await realpath(source)!==source)throw new Error(`ENTREGA_ARQUIVO_INVALIDO: ${item.origem}`);
  const bytes=await readFile(source);
  if(/sk-(?:proj-)?[A-Za-z0-9_-]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(bytes.toString('utf8')))throw new Error(`ENTREGA_CREDENCIAL: ${item.origem}`);
  items.push({...item,tamanho:bytes.length,sha256:hash(bytes)});
 }
 return items;
}
export async function prepararEntrega({root=process.cwd(),lista='docs/entrega/arquivos.json',pdf,destino='deliverables'}={}){
 if(!pdf)throw new Error('ENTREGA_PDF_AUSENTE: informe --pdf com a versão final');
 const renderDir=path.dirname(path.resolve(pdf)),m=JSON.parse(await readFile(path.join(renderDir,'manifest.json'),'utf8'));
 const currentManifest=await readFile(path.join(root,'docs/output/s5/manifest.json'));
 const bytes=await readFile(pdf),registered=m.artefatos?.find(a=>a.nome==='relatorio.pdf');
 if(path.basename(pdf)!=='relatorio.pdf'||m.versao!=='s5-render-v1'||m.previa!==false||m.familia!=='Times New Roman'||m.manifest_origem_sha256!==hash(currentManifest)||registered?.sha256!==hash(bytes)||bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('ENTREGA_PDF_NAO_FINAL_OU_DIVERGENTE');
 const items=await conferirLista(root,JSON.parse(await readFile(path.join(root,lista),'utf8')));
 const dir=path.resolve(destino,`enter-case-${randomUUID()}`);await mkdir(dir,{recursive:true});
 for(const item of items){const target=path.join(dir,item.destino);await mkdir(path.dirname(target),{recursive:true});await copyFile(path.join(root,item.origem),target);if(hash(await readFile(target))!==item.sha256)throw new Error('ENTREGA_COPIA_DIVERGENTE');}
 // No pacote extraído, os insumos estão em case/Input; a lista deve apontar às cópias.
 const listItem=items.find(a=>a.destino==='docs/entrega/arquivos.json');
 if(listItem){
  const portable=items.map(({destino})=>({origem:destino,destino}));
  const content=JSON.stringify(portable,null,2)+'\n';
  await writeFile(path.join(dir,listItem.destino),content);
  listItem.origem_sha256=listItem.sha256;listItem.sha256=hash(content);listItem.tamanho=Buffer.byteLength(content);
 }
 await writeFile(path.join(dir,'relatorio.pdf'),bytes,{flag:'wx'});
 await writeFile(path.join(dir,'render-manifest.json'),JSON.stringify(m,null,2)+'\n');
 const record={versao:'s5-pacote-v1',zip_criado:false,arquivos:[...items,{destino:'relatorio.pdf',sha256:hash(bytes),tamanho:bytes.length},{destino:'render-manifest.json',sha256:hash(await readFile(path.join(dir,'render-manifest.json')))}]};
 await writeFile(path.join(dir,'entrega-manifest.json'),JSON.stringify(record,null,2)+'\n');
 return {diretorio:dir,arquivos:record.arquivos.length,zip_criado:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{const {values:v}=parseArgs({options:{pdf:{type:'string'},destino:{type:'string'}},strict:true});console.log(JSON.stringify(await prepararEntrega(v),null,2));}catch(e){console.error(e.message);process.exitCode=1;}}
