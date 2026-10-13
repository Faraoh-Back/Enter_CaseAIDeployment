import {createServer} from 'node:http';
import {mkdir, readFile, writeFile, rename, readdir, lstat} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {executarCarteira, entradasCarteira, hash} from './executar-carteira.mjs';

const files = {'processos.json':'application/json','resumo.json':'application/json','auditoria.json':'application/json',
  'relatorio.md':'text/markdown; charset=utf-8','processos.xlsx':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'};
const validId = id => /^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(id);
const terminal = new Set(['concluida','concluida_com_pendencias','falhou','interrompida']);
const json = value => JSON.stringify(value,null,2)+'\n';
async function atomic(file,data) {
  const temp=`${file}.${randomUUID()}.tmp`;
  await writeFile(temp,data,{flag:'wx'});
  await rename(temp,file);
}

/** Interface de execução/arquivos. Não interpreta sentenças nem calcula indicadores. */
export async function criarApi({destino='outputs/api',apiKey=process.env.OPENAI_API_KEY,
  modelo=process.env.LLM_MODEL||'gpt-4.1-mini-2025-04-14',modo='real',captura,executor=executarCarteira,
  lerEntradas=entradasCarteira}={}) {
  if(!['real','replay'].includes(modo))throw new Error('MODO_INVALIDO');
  destino=path.resolve(destino);await mkdir(destino,{recursive:true});
  let active=false,controller,job=Promise.resolve(),closing=false;
  const redact=value=>String(value).replaceAll(apiKey||'\u0000','[CREDENCIAL OMITIDA]').replace(/sk-[A-Za-z0-9_*-]+/g,'[CREDENCIAL OMITIDA]');
  const manifestPath=id=>path.join(destino,id,'manifest.json');
  async function manifest(id) {
    if(!validId(id))return null;
    try {const dir=await lstat(path.join(destino,id));if(!dir.isDirectory()||dir.isSymbolicLink())return null;
      const m=JSON.parse(await readFile(manifestPath(id),'utf8'));return m.execucao_id===id?m:null;
    }catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  // Uma instância local por diretório de outputs. Execuções antigas não são retomadas.
  for(const entry of await readdir(destino,{withFileTypes:true})) {
    if(!entry.isDirectory()||!validId(entry.name))continue;
    const m=await manifest(entry.name);
    if(m?.estado==='executando')await atomic(manifestPath(entry.name),json({...m,estado:'interrompida',encerrado_em:new Date().toISOString(),erros:[...(m.erros??[]),{mensagem:'Servidor reiniciado; execução não retomada.'}]}));
  }
  async function artifact(id,m,name) {
    if(!Object.hasOwn(files,name))return null;
    const registered=m.artefatos?.find(a=>a.nome===name);
    if(!registered)return null;
    const file=path.join(destino,id,name);
    try {
      const stat=await lstat(file);if(!stat.isFile()||stat.isSymbolicLink())return null;
      const bytes=await readFile(file);return hash(bytes)===registered.sha256?bytes:null;
    }catch(error){if(error.code==='ENOENT')return null;throw error;}
  }
  const send=(res,status,value)=>{const bytes=json(value);res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':Buffer.byteLength(bytes),'Cache-Control':'no-store'});res.end(bytes);};
  const fail=(res,status,code,message)=>send(res,status,{erro:{codigo:code,mensagem:message}});
  const server=createServer(async(req,res)=>{
    try {
      const pathname=new URL(req.url,'http://localhost').pathname;
      if(req.method==='POST'&&pathname==='/execucoes') {
        let text='',size=0;
        for await(const chunk of req){size+=chunk.length;if(size>8192){fail(res,413,'ENTRADA_INVALIDA','Corpo excede 8192 bytes.');return;}text+=chunk.toString('utf8');}
        let body;try{body=JSON.parse(text);}catch{fail(res,400,'JSON_INVALIDO','JSON malformado.');return;}
        if(!body||Array.isArray(body)||typeof body!=='object'||Object.keys(body).length!==1||body.dataset!=='case'){fail(res,422,'ENTRADA_INVALIDA','Esperado somente {"dataset":"case"}.');return;}
        if(active){fail(res,409,'EXECUCAO_ATIVA','Há uma execução ativa.');return;}
        if(closing){fail(res,503,'CONFIGURACAO_INDISPONIVEL','Servidor encerrando.');return;}
        if(modo==='real'&&!apiKey?.trim()||modo==='replay'&&!captura){fail(res,503,'CONFIGURACAO_INDISPONIVEL','Configuração da execução indisponível.');return;}
        active=true;
        let raw;
        try{raw=await lerEntradas();if(modo==='replay')await readFile(captura);}catch{active=false;fail(res,503,'CONFIGURACAO_INDISPONIVEL','Insumos ou captura indisponíveis.');return;}
        const id=`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`;
        await mkdir(path.join(destino,id));
        const initial={versao_contrato:'s4-v1',origem_http:true,execucao_id:id,estado:'executando',modo,iniciado_em:new Date().toISOString(),encerrado_em:null,processados:0,resumo:null,erros:[],artefatos:[]};
        await atomic(manifestPath(id),json(initial));
        send(res,202,{execucao_id:id,estado:'executando',status_url:`/execucoes/${id}`});
        controller=new AbortController();
        job=Promise.resolve().then(()=>executor({execucao_id:id,destino,entradas:raw,modo,captura,apiKey,modelo,signal:controller.signal}))
          .catch(async error=>{
            const m=await manifest(id);
            if(m&&!terminal.has(m.estado))await atomic(manifestPath(id),json({...m,estado:controller.signal.aborted?'interrompida':'falhou',encerrado_em:new Date().toISOString(),erros:[...(m.erros??[]),{mensagem:redact(error.message)}]}));
          }).finally(()=>{active=false;controller=undefined;});
        // Erros de armazenamento não se tornam rejection sem observador.
        job.catch(()=>{});
        return;
      }
      const route=pathname.match(/^\/execucoes\/([^/]+)(?:\/artefatos\/([^/]+))?$/);
      if(req.method==='GET'&&route) {
        const id=decodeURIComponent(route[1]),name=route[2]===undefined?undefined:decodeURIComponent(route[2]),m=await manifest(id);
        if(!m){fail(res,404,'EXECUCAO_NAO_ENCONTRADA','Execução não encontrada.');return;}
        if(name!==undefined) {
          if(!Object.hasOwn(files,name)){fail(res,404,'ARTEFATO_NAO_ENCONTRADO','Nome de artefato não permitido.');return;}
          const bytes=await artifact(id,m,name);
          if(!bytes){fail(res,409,'ARTEFATO_INDISPONIVEL','Artefato ainda indisponível ou sem integridade confirmada.');return;}
          res.writeHead(200,{'Content-Type':files[name],'Content-Length':bytes.length,'Content-Disposition':`attachment; filename="${name}"`,'Cache-Control':'no-store'});res.end(bytes);return;
        }
        const artifacts=await Promise.all(Object.keys(files).map(async name=>{
          const registered=m.artefatos?.find(a=>a.nome===name),ready=Boolean(await artifact(id,m,name));
          return {nome:name,disponivel:ready,sha256:registered?.sha256??null,url:ready?`/execucoes/${id}/artefatos/${name}`:null};
        }));
        send(res,200,{execucao_id:id,estado:m.estado,modo:m.modo,processados:m.processados??0,resumo:m.resumo??null,erros:(m.erros??[]).map(e=>({mensagem:redact(e.mensagem??'Falha de execução.')})),artefatos:artifacts});return;
      }
      fail(res,404,'ROTA_NAO_ENCONTRADA','Rota não encontrada.');
    }catch(error){if(!res.headersSent)fail(res,500,'ERRO_INTERNO','Não foi possível atender à solicitação.');else res.destroy();}
  });
  server.encerrar=async()=>{
    closing=true;controller?.abort(new Error('Servidor encerrado'));
    await job;
    if(server.listening){server.closeAllConnections();await new Promise((resolve,reject)=>server.close(error=>error?reject(error):resolve()));}
  };
  return server;
}
