import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { runGraphInFile } from './rivet-runtime.mjs';
import { entradasS1 } from '../scripts/s1-fixture.mjs';
import { exportarXlsx } from './exportar-xlsx.mjs';

const hash = value => createHash('sha256').update(value).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
let active = false;

// Orquestra transporte e arquivos; interpretação e cálculo permanecem no grafo.
export async function executarS1({ destino = 'outputs/s1.4', modo, captura = 'docs/output/s1.2-llm-aprovada.json',
  apiKey = process.env.OPENAI_API_KEY, modelo = process.env.LLM_MODEL || 'gpt-4.1-mini-2025-04-14',
  exportador = exportarXlsx } = {}) {
  if (!['real','replay'].includes(modo)) throw new Error('Escolha --real ou --replay');
  if (modo === 'real' && !apiKey?.trim()) throw new Error('Configure OPENAI_API_KEY antes de executar --real');
  // O SDK usa fetch global; impedir interferência entre transportes na mesma instância.
  if (active) throw new Error('EXECUCAO_ATIVA');
  active = true;
  const nativeFetch = globalThis.fetch, warn = console.warn, errorLog = console.error;
  const redact = value => {
    let text = String(value);
    if (apiKey) text = text.replaceAll(apiKey, '[CREDENCIAL OMITIDA]');
    return text.replace(/sk-[A-Za-z0-9_*-]+/g, '[CREDENCIAL OMITIDA]');
  };
  const controller = new AbortController();
  let timer, manifest, directory, responseText;
  const start = Date.now();
  async function atomic(name, content) {
    const file = path.join(directory, name);
    try { await writeFile(`${file}.tmp`, content, { flag:'wx' }); await rename(`${file}.tmp`,file); }
    finally { await rm(`${file}.tmp`, { force:true }); }
  }
  async function register(name) {
    manifest.artefatos.push({ nome:name, sha256:hash(await readFile(path.join(directory,name))) });
  }
  try {
    const raw = await entradasS1();
    const project = await readFile('rivet/analise_sentencas.rivet-project');
    const schemaNames = ['extracao','processo','resumo'];
    const schemas = Object.fromEntries(await Promise.all(schemaNames.map(async name => [name, await readFile(`schemas/${name}.schema.json`,'utf8')])));
    const capturedBytes = modo === 'replay' ? await readFile(captura) : null;
    const captured = capturedBytes ? JSON.parse(capturedBytes) : null;
    if (captured) {
      if (typeof captured.resposta_llm_original !== 'string') throw new Error('Captura sem resposta original da LLM');
      for (const [name,value] of Object.entries(raw)) {
        if (captured.entradas_sha256?.[name] !== hash(value)) throw new Error(`Captura incompatível com entrada: ${name}`);
      }
      modelo = captured.modelo_solicitado;
    }
    const id = `${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`;
    await mkdir(destino,{recursive:true});
    directory = path.resolve(destino,id);
    await mkdir(directory);
    manifest = { versao_contrato:'s2.4-v1', execucao_id:id, estado:'executando', modo,
      iniciado_em:new Date().toISOString(), encerrado_em:null, duracao_ms:null,
      node:process.version, sdk:'1.25.0', grafo:'analisar_carteira', modelo_solicitado:modelo, parametros_enviados:null,
      plugin_sha256:hash(await readFile('rivet/plugins/enter-bounded-extraction/index.js')), projeto_sha256:hash(project), schemas_sha256:Object.fromEntries(Object.entries(schemas).map(([k,v])=>[k,hash(v)])),
      entradas_sha256:Object.fromEntries(Object.entries(raw).map(([k,v])=>[k,hash(v)])),
      captura_sha256:capturedBytes ? hash(capturedBytes) : null,
      requisicoes_extrator:0, chamadas_reais:0, tokens:null, custo_monetario:null,
      resumo:null, erros:[], artefatos:[] };
    await atomic('manifest.json',json(manifest));
    await atomic('entradas.json',json(raw));
    await atomic('projeto.rivet-project',project);
    await atomic('plugin-extracao.js',await readFile('rivet/plugins/enter-bounded-extraction/index.js'));
    await atomic('schemas.json',json(schemas));
    if (captured) await atomic('captura.json',capturedBytes);
    console.warn = (...args) => warn(...args.map(redact));
    console.error = (...args) => errorLog(...args.map(redact));
    timer = setTimeout(() => controller.abort(),45000);
    globalThis.fetch = async (url, options) => {
      if (String(url) !== 'https://api.openai.com/v1/chat/completions' || ++manifest.requisicoes_extrator > 3) {
        controller.abort(); throw new Error('Limite S2: três requisições ao endpoint de extração');
      }
      const body = JSON.parse(options.body);
      manifest.parametros_enviados = { model:body.model, temperature:body.temperature, max_tokens:body.max_tokens,
        response_format:body.response_format.type, strict:body.response_format.json_schema?.strict };
      if (captured) {
        // Reproduz somente a resposta textual; todos os outputs são recalculados pelo Rivet.
        const chunk = { choices:[{ index:0, delta:{ content:captured.resposta_llm_original }, finish_reason:'stop' }] };
        return new Response(`data: ${JSON.stringify(chunk)}\n\ndata: [DONE]\n\n`, {headers:{'Content-Type':'text/event-stream'}});
      }
      manifest.chamadas_reais++;
      {
        const response = await nativeFetch(url, { ...options, signal:AbortSignal.any([controller.signal, ...(options.signal ? [options.signal] : [])]) });
        manifest.http_status = response.status;
        return response;
      }
    };
    const outputs = await runGraphInFile(path.join(directory,'projeto.rivet-project'), {
      graph:'analisar_carteira', openAiKey:modo === 'real' ? apiKey : 'replay-sem-credencial',
      openAiOrganization:'', openAiEndpoint:'https://api.openai.com/v1/chat/completions',
      abortSignal:controller.signal, chatNodeTimeout:30000,
      inputs:Object.fromEntries(Object.entries({...raw,modelo}).map(([k,value])=>[k,{type:'string',value}])),
      onNodeFinish:({node,outputs:result}) => {
        if (node.id !== 's1_extrair') return;
        responseText = result.response?.value;
        manifest.limites_extracao = result.controle?.value?.limites ?? null;
        const usage = result.usage?.value;
        if (modo === 'real' && Number.isSafeInteger(usage?.total_tokens)) {
          manifest.tokens = {entrada:usage.prompt_tokens, saida:usage.completion_tokens, total:usage.total_tokens};
        }
      },
      onNodeError:({node,error}) => manifest.erros.push({no:node.id, mensagem:redact(error)}),
    });
    clearTimeout(timer);
    const expected = {processos:'object[]',resumo:'object',auditoria:'object[]',relatorio_markdown:'string'};
    const data = {};
    for (const [name,type] of Object.entries(expected)) {
      if (outputs[name]?.type !== type) throw new Error(`Graph Output inválido: ${name}`);
      data[name] = outputs[name].value;
    }
    manifest.resumo = data.resumo;
    manifest.tokens = modo === 'real' ? data.auditoria[0]?.tokens ?? null : null;
    for (const name of ['processos','resumo','auditoria']) {
      await atomic(`${name}.json`,json(data[name])); await register(`${name}.json`);
    }
    await atomic('relatorio.md',data.relatorio_markdown); await register('relatorio.md');
    const xlsx = path.join(directory,'processos.xlsx');
    try { await exportador(data,`${xlsx}.tmp`); await rename(`${xlsx}.tmp`,xlsx); }
    finally { await rm(`${xlsx}.tmp`,{force:true}); }
    await register('processos.xlsx');
    manifest.estado = data.resumo.pendencias ? 'concluida_com_pendencias' : 'concluida';
  } catch (error) {
    if (manifest) {
      manifest.estado = 'falhou';
      manifest.erros.push({mensagem:redact(error.message)});
    }
    throw Object.assign(new Error(redact(error.message)), {diretorio:directory});
  } finally {
    clearTimeout(timer); controller.abort();
    globalThis.fetch = nativeFetch; console.warn = warn; console.error = errorLog; active = false;
    if (manifest) {
      if (typeof responseText === 'string') {
        await atomic('extracao-resposta.txt',redact(responseText));
        manifest.extracao_resposta_sha256 = hash(redact(responseText));
      }
      manifest.encerrado_em = new Date().toISOString(); manifest.duracao_ms = Date.now()-start;
      await atomic('manifest.json',json(manifest));
    }
  }
  return {estado:manifest.estado, execucao_id:manifest.execucao_id, diretorio:directory};
}
