import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { runGraphInFile } from '@ironclad/rivet-node';

const key = process.env.OPENAI_API_KEY;
if (!key?.trim()) throw new Error('Configure OPENAI_API_KEY no .env local.');
const model = process.env.LLM_MODEL || 'gpt-4.1-mini-2025-04-14';
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30000);
const nativeFetch = globalThis.fetch;
let calls = 0;
let request;
let status;
// Prova delimitada: no máximo uma requisição real. O SDK traz retentativas internas.
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://api.openai.com/v1/chat/completions') throw Object.assign(new Error('Endpoint inesperado'), { code: 'S0_ENDPOINT' });
  if (++calls > 1) throw Object.assign(new Error('Limite S0 de uma chamada atingido'), { code: 'S0_LIMIT' });
  const body = JSON.parse(options.body);
  request = { model: body.model, temperature: body.temperature, max_tokens: body.max_tokens, response_format: body.response_format, stream: body.stream };
  const response = await nativeFetch(url, options);
  status = response.status;
  return response;
};
const redact = value => String(value).replaceAll(key, '[CREDENCIAL OMITIDA]').replace(/sk-[A-Za-z0-9_\-*]+/g, '[CREDENCIAL OMITIDA]');
const originalWarn = console.warn;
const originalError = console.error;
console.warn = (...args) => originalWarn(...args.map(redact));
console.error = (...args) => originalError(...args.map(redact));
const start = Date.now();
const evidence = { executado_em: new Date().toISOString(), tipo: 'compatibilidade minima, nao avaliacao de extracao', node: process.version, sdk: '1.25.0', modelo_solicitado: model, custo_monetario: null };
try {
  const project = 'rivet/s0_compatibilidade.rivet-project';
  evidence.projeto_sha256 = createHash('sha256').update(await readFile(project)).digest('hex');
  const outputs = await runGraphInFile(project, { graph: 's0_llm', openAiKey: key,
    openAiEndpoint: 'https://api.openai.com/v1/chat/completions', openAiOrganization: '',
    chatNodeTimeout: 20000, abortSignal: controller.signal,
    inputs: { modelo: { type: 'string', value: model } },
  });
  const response = JSON.parse(outputs.resposta.value);
  assert.deepEqual(response, { numero_processo: '3871230-78.2024.8.26.0002', resultado_sentenca: 'parcial_procedencia' });
  const usage = outputs.uso?.value;
  evidence.estado = 'aprovado';
  evidence.resposta = response;
  evidence.tokens = usage ? { entrada: usage.prompt_tokens, saida: usage.completion_tokens, total: usage.total_tokens ?? usage.prompt_tokens + usage.completion_tokens } : null;
} catch (error) {
  evidence.estado = 'falhou';
  evidence.erro = redact(error.message);
  process.exitCode = 1;
} finally {
  clearTimeout(timer);
  globalThis.fetch = nativeFetch;
  console.warn = originalWarn;
  console.error = originalError;
  Object.assign(evidence, { duracao_ms: Date.now() - start, chamadas_reais: Math.min(calls, 1), http_status: status ?? null, parametros_enviados: request ?? null });
  await mkdir('outputs/s0', { recursive: true });
  await writeFile('outputs/s0/llm.json', JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify(evidence, null, 2));
}
