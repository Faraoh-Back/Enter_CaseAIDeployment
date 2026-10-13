import {mkdir, readFile, writeFile, rename, rm} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID, createHash} from 'node:crypto';
import {runGraphInFile, reservarExecucaoRivet, instalarTransporteRivet} from './rivet-runtime.mjs';
import {inputDirectory} from '../scripts/case-files.mjs';
import {exportarXlsx} from './exportar-xlsx.mjs';

export const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const names = {processos_texto:'processos.txt',subsidios_texto:'status_subsidios.txt',indices_texto:'tabela_indices.csv',custos_texto:'custo_recurso_por_tribunal.csv',probabilidades_texto:'subsidios_probabilidade_reversao.csv'};
export async function entradasCarteira(dir) {
  dir ??= await inputDirectory();
  if (!dir) throw new Error('INPUT_NAO_ENCONTRADO');
  return {...Object.fromEntries(await Promise.all(Object.entries(names).map(async ([k,file]) => [k,await readFile(path.join(dir,file),'utf8')]))),data_referencia:'2026-05-31'};
}

/** Executa o lote no Rivet. Node apenas transporta, registra eventos e materializa os outputs. */
export async function executarCarteira({execucao_id, modo, destino='outputs/s3', entradas, captura, apiKey=process.env.OPENAI_API_KEY,
  modelo=process.env.LLM_MODEL || 'gpt-4.1-mini-2025-04-14', signal, timeoutMs=30*60*1000, exportador=exportarXlsx}={}) {
  if (execucao_id !== undefined && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,159}$/.test(execucao_id)) throw new Error('ID_INVALIDO');
  if (!['real','replay'].includes(modo)) throw new Error('Escolha --real ou --replay');
  if (modo==='real' && !apiKey?.trim()) throw new Error('Configure OPENAI_API_KEY');
  if (modo==='replay' && !captura) throw new Error('Replay exige captura com respostas por identidade');
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs<=0) throw new Error('TIMEOUT_INVALIDO');
  signal?.throwIfAborted();
  const liberarExecucao = reservarExecucaoRivet();
  let restaurarTransporte = () => {};
  const nativeFetch=globalThis.fetch,warn=console.warn,errorLog=console.error;
  const redact=value=>String(value).replaceAll(apiKey||'\u0000','[CREDENCIAL OMITIDA]').replace(/sk-[A-Za-z0-9_*-]+/g,'[CREDENCIAL OMITIDA]');
  const controller=new AbortController();
  const abort=()=>controller.abort(signal.reason);signal?.addEventListener('abort',abort,{once:true});
  let timer,manifest,directory,queue=Promise.resolve(),queueError,outputs;
  const checkpoints=[],caseStarts=new Map(),calls={},http=[],start=Date.now();
  const artifacts=[];
  async function atomic(name,content) {
    const file=path.join(directory,name);
    try {await writeFile(`${file}.tmp`,content,{flag:'wx'});await rename(`${file}.tmp`,file);}
    finally {await rm(`${file}.tmp`,{force:true});}
  }
  async function publish(name,content) {await atomic(name,content);artifacts.push({nome:name,sha256:hash(await readFile(path.join(directory,name)))});}
  function enqueue(fn) {queue=queue.then(fn).catch(error=>{queueError??=error;controller.abort(error);});}
  try {
    const raw=entradas??await entradasCarteira();
    const capturedBytes=modo==='replay'?await readFile(captura):null;
    const captured=capturedBytes?JSON.parse(capturedBytes):null;
    if(captured) {
      for(const [k,v] of Object.entries(raw)) if(captured.entradas_sha256?.[k]!==hash(v)) throw new Error(`CAPTURA_INCOMPATIVEL: ${k}`);
      if(!captured.respostas || typeof captured.respostas!=='object') throw new Error('CAPTURA_INVALIDA');
      modelo=captured.modelo_solicitado;
    }
    const project=await readFile('rivet/analise_sentencas.rivet-project');
    const schemas=Object.fromEntries(await Promise.all(['extracao','processo','resumo'].map(async k=>[k,await readFile(`schemas/${k}.schema.json`,'utf8')])));
    const id=execucao_id??`${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`;
    await mkdir(destino,{recursive:true});directory=path.resolve(destino,id);
    if (execucao_id) {
      const initial=JSON.parse(await readFile(path.join(directory,'manifest.json'),'utf8'));
      if (initial.execucao_id!==id || initial.estado!=='executando' || initial.origem_http!==true) throw new Error('EXECUCAO_NAO_PREPARADA');
    } else await mkdir(directory);
    manifest={versao_contrato:'s4-v1',origem_http:Boolean(execucao_id),execucao_id:id,estado:'executando',modo,grafo:'analisar_lote',iniciado_em:new Date().toISOString(),encerrado_em:null,duracao_ms:null,
      node:process.version,sdk:'1.25.0',modelo_solicitado:modelo,timeout_global_ms:timeoutMs,parametros_enviados:null,
      entradas_sha256:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,hash(v)])),projeto_sha256:hash(project),
      prompt_sha256:hash(await readFile('rivet/prompts/extracao-s1.txt')),plugin_sha256:hash(await readFile('rivet/plugins/enter-bounded-extraction/index.js')),
      schemas_sha256:Object.fromEntries(Object.entries(schemas).map(([k,v])=>[k,hash(v)])),captura_sha256:capturedBytes?hash(capturedBytes):null,
      identidades:[],processados:0,nao_processados:null,requisicoes_extrator:0,chamadas_reais:0,http_status:[],tokens:null,custo_monetario:null,resumo:null,erros:[],artefatos:artifacts};
    await atomic('manifest.json',json(manifest));await atomic('entradas.json',json(raw));await atomic('projeto.rivet-project',project);
    await atomic('schemas.json',json(schemas));await atomic('plugin-extracao.js',await readFile('rivet/plugins/enter-bounded-extraction/index.js'));
    if(captured) await atomic('captura.json',capturedBytes);
    console.warn=(...args)=>warn(...args.map(redact));console.error=(...args)=>errorLog(...args.map(redact));
    timer=setTimeout(()=>controller.abort(new Error('TIMEOUT_GLOBAL')),timeoutMs);
    restaurarTransporte=instalarTransporteRivet(async(url,options)=>{
      if(String(url)!=='https://api.openai.com/v1/chat/completions') throw new Error('ENDPOINT_INESPERADO');
      const body=JSON.parse(options.body);
      // Identidade conferida pelo grafo; aqui só associa a chamada ao registro de transporte.
      const id=body.messages[0].content.match(/Processo nº ([\d.\-]+)/)?.[1];
      if(!manifest.identidades.includes(id) || (calls[id]??0)>=3) {controller.abort(new Error('LIMITE_EXTRATOR'));throw new Error('LIMITE_EXTRATOR');}
      calls[id]=(calls[id]??0)+1;manifest.requisicoes_extrator++;
      manifest.parametros_enviados={model:body.model,temperature:body.temperature,max_tokens:body.max_tokens,response_format:body.response_format.type,strict:body.response_format.json_schema?.strict};
      if(captured) {
        const value=captured.respostas[id];
        if(typeof value!=='string') throw new Error(`CAPTURA_SEM_IDENTIDADE: ${id}`);
        return new Response(`data: ${JSON.stringify({choices:[{index:0,delta:{content:value},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
      }
      manifest.chamadas_reais++;
      const response=await nativeFetch(url,{...options,signal:AbortSignal.any([controller.signal,options.signal].filter(Boolean))});
      http.push({numero_processo:id,tentativa:calls[id],status:response.status});return response;
    });
    outputs=await runGraphInFile(path.join(directory,'projeto.rivet-project'),{graph:'analisar_lote',openAiKey:modo==='real'?apiKey:'replay-sem-credencial',openAiEndpoint:'https://api.openai.com/v1/chat/completions',openAiOrganization:'',abortSignal:controller.signal,
      inputs:Object.fromEntries(Object.entries({...raw,modelo}).map(([k,value])=>[k,{type:'string',value}])),
      onNodeFinish:({node,outputs:r})=>{
        if(node.id==='preparar_lote') {manifest.identidades=[...r.identidades.value];enqueue(()=>atomic('manifest.json',json(manifest)));}
        if(node.id==='s1_preparar') caseStarts.set(r.preparado.value.numero,Date.now());
        if(node.id==='s1_consolidar') {
          const p=r.processos.value[0],a=r.auditoria.value[0];
          if(checkpoints.some(c=>c.processos[0].numero_processo===p.numero_processo)) {controller.abort(new Error('CHECKPOINT_DUPLICADO'));return;}
          checkpoints.push({processos:[p],auditoria:[a],duracao_ms:caseStarts.has(p.numero_processo)?Date.now()-caseStarts.get(p.numero_processo):null});
          manifest.processados=checkpoints.length;
          enqueue(async()=>{await atomic('checkpoint.json',json(checkpoints));await atomic('manifest.json',json(manifest));});
        }
      },onNodeError:({node,error})=>manifest.erros.push({no:node.id,mensagem:redact(error)})});
    await queue;if(queueError)throw queueError;clearTimeout(timer);
    const data={};
    for(const [k,type] of Object.entries({processos:'object[]',resumo:'object',auditoria:'object[]',relatorio_markdown:'string'})) {
      if(outputs[k]?.type!==type)throw new Error(`SAIDA_INVALIDA: ${k}`);data[k]=outputs[k].value;
    }
    if(JSON.stringify(data.processos.map(p=>p.numero_processo))!==JSON.stringify(manifest.identidades))throw new Error('RECONCILIACAO_EXECUTOR');
    manifest.resumo=data.resumo;
    for(const k of ['processos','resumo','auditoria'])await publish(`${k}.json`,json(data[k]));
    await publish('relatorio.md',data.relatorio_markdown);
    const file=path.join(directory,'processos.xlsx');
    try {await exportador(data,`${file}.tmp`,{execucao_id:id,data_referencia:raw.data_referencia});await rename(`${file}.tmp`,file);}
    finally {await rm(`${file}.tmp`,{force:true});}
    artifacts.push({nome:'processos.xlsx',sha256:hash(await readFile(file))});
    manifest.estado=data.resumo.pendencias?'concluida_com_pendencias':'concluida';
  } catch(error) {
    if(manifest){manifest.estado=controller.signal.aborted&&!queueError?'interrompida':'falhou';manifest.erros.push({mensagem:redact(error.message)});}
    throw Object.assign(new Error(redact(error.message)),{diretorio:directory});
  } finally {
    clearTimeout(timer);controller.abort();signal?.removeEventListener('abort',abort);
    await queue;restaurarTransporte();console.warn=warn;console.error=errorLog;liberarExecucao();
    if(manifest) {
      manifest.encerrado_em=new Date().toISOString();manifest.duracao_ms=Date.now()-start;
      manifest.processados=checkpoints.length;manifest.nao_processados=manifest.identidades.filter(id=>!checkpoints.some(c=>c.processos[0].numero_processo===id));
      manifest.http_status=http;manifest.requisicoes_por_identidade=calls;
      if(modo==='real'&&checkpoints.length&&checkpoints.every(c=>c.auditoria[0].tokens)) {
        manifest.tokens=Object.fromEntries(['entrada','saida','total'].map(k=>[k,checkpoints.reduce((s,c)=>s+c.auditoria[0].tokens[k],0)]));
      }
      manifest.tokens_parciais=checkpoints.filter(c=>c.auditoria[0].tokens).reduce((s,c)=>s+c.auditoria[0].tokens.total,0);
      await atomic('manifest.json',json(manifest));
    }
  }
  return {estado:manifest.estado,execucao_id:manifest.execucao_id,diretorio:directory};
}
