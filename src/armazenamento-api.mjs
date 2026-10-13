import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

export async function gravarAtomico(file,data) {
  const temp=`${file}.${randomUUID()}.tmp`;
  try{await writeFile(temp,data,{flag:'wx'});await rename(temp,file);}
  finally{await rm(temp,{force:true});}
}
const alive=pid=>{if(!Number.isInteger(pid)||pid<=0)return true;try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
/** Exclusão local por diretório, antes de recuperar estados de uma instância anterior. */
export async function reservarDiretorio(destino) {
  await mkdir(destino,{recursive:true});
  const file=path.join(destino,'.api.lock'),recovery=path.join(destino,'.api.recovery.lock');
  const owner={pid:process.pid,token:randomUUID(),iniciado_em:new Date().toISOString()};
  const create=()=>writeFile(file,JSON.stringify(owner),{flag:'wx'});
  try{await create();}catch(error){
    if(error.code!=='EEXIST')throw error;
    let previous;try{previous=JSON.parse(await readFile(file,'utf8'));}catch{throw new Error('API_DIRETORIO_EM_USO');}
    if(alive(previous.pid))throw new Error('API_DIRETORIO_EM_USO');
    // Apenas um processo recupera lock obsoleto; uma nova aquisição nunca é removida.
    try{await writeFile(recovery,JSON.stringify(owner),{flag:'wx'});}catch{throw new Error('API_DIRETORIO_EM_USO');}
    try{
      const current=JSON.parse(await readFile(file,'utf8'));
      if(current.token!==previous.token||alive(current.pid))throw new Error('API_DIRETORIO_EM_USO');
      await rm(file);try{await create();}catch(e){if(e.code==='EEXIST')throw new Error('API_DIRETORIO_EM_USO');throw e;}
    }finally{await rm(recovery,{force:true});}
  }
  let released;
  return ()=>released??=(async()=>{
    try{const current=JSON.parse(await readFile(file,'utf8'));if(current.token===owner.token)await rm(file);}catch(error){if(error.code!=='ENOENT')throw error;}
  })();
}
