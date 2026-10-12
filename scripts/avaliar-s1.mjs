import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { runGraphInFile } from '../src/rivet-runtime.mjs';
import { entradasS1 } from './s1-fixture.mjs';

// Avaliação de um caso: não é o executor integrado/CLI de entrega da S1.4.
const key = process.env.OPENAI_API_KEY;
if (!key?.trim()) throw new Error('Configure OPENAI_API_KEY no .env local.');
const model = process.env.LLM_MODEL || 'gpt-4.1-mini-2025-04-14';
const project = 'rivet/analise_sentencas.rivet-project';
const raw = await entradasS1();
const example = JSON.parse(await readFile('schemas/extracao.exemplo.json', 'utf8'));
const golden = JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json', 'utf8')).find(r => r.numero_processo === example.numero_processo);
const hash = value => createHash('sha256').update(value).digest('hex');
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 45000);
const nativeFetch = globalThis.fetch;
const redact = value => String(value).replaceAll(key, '[CREDENCIAL OMITIDA]').replace(/sk-[A-Za-z0-9_\-*]+/g, '[CREDENCIAL OMITIDA]');
const warn = console.warn, logError = console.error;
console.warn = (...args) => warn(...args.map(redact));
console.error = (...args) => logError(...args.map(redact));
let attempts = 0, sent = 0;
const start = Date.now();
const evidence = { executado_em: new Date().toISOString(), escopo: 'S2.4: avaliação de uma sentença de desenvolvimento, até três chamadas',
  node: process.version, sdk: '1.25.0', modelo_solicitado: model, custo_monetario: null,
  projeto_sha256: hash(await readFile(project)), entradas_sha256: Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, hash(v)])),
  plugin_sha256: hash(await readFile('rivet/plugins/enter-bounded-extraction/index.js')), schema_sha256: hash(await readFile('schemas/extracao.schema.json')), erros_nos: [],
};
globalThis.fetch = async (url, options) => {
  if (String(url) !== 'https://api.openai.com/v1/chat/completions' || ++attempts > 3) {
    controller.abort();
    throw Object.assign(new Error('Limite de três chamadas reais ou endpoint inesperado'), { code: 'S1_LIMITE' });
  }
  const body = JSON.parse(options.body);
  evidence.parametros_enviados = { model: body.model, temperature: body.temperature, max_tokens: body.max_tokens,
    response_format: body.response_format.type, strict: body.response_format.json_schema?.strict };
  sent++;
  try {
    const response = await nativeFetch(url, options);
    evidence.http_status = response.status;
    if (!response.ok) {
      evidence.erro_provedor = redact(await response.clone().text());
    }
    return response;
  } catch (error) {
    evidence.erro_rede = redact(error.cause?.code ?? error.message);
    throw error;
  }
};
try {
  const outputs = await runGraphInFile(project, { graph: 'analisar_carteira', openAiKey: key,
    openAiEndpoint: 'https://api.openai.com/v1/chat/completions', openAiOrganization: '', chatNodeTimeout: 30000,
    abortSignal: controller.signal, inputs: { ...Object.fromEntries(Object.entries(raw).map(([k, value]) => [k, { type: 'string', value }])), modelo: { type: 'string', value: model } },
    onNodeError: ({ node, error }) => evidence.erros_nos.push({ no: node.id, erro: redact(error) }),
    onNodeFinish: ({ node, outputs: result }) => { if (node.id === 's1_extrair') { evidence.resposta_llm_original = result.response.value; evidence.tokens = result.usage?.value?.total_tokens ?? null; } },
  });
  evidence.outputs = Object.fromEntries(['processos','resumo','auditoria','relatorio_markdown'].map(k => [k, outputs[k].value]));
  const extracted = outputs.auditoria.value[0].extracao;
  const fields = ['numero_processo','classe_processual','comarca','resultado_sentenca','danos_materiais_centavos',
    'danos_morais_centavos','valor_total_explicito_centavos','mes_base_correcao','data_citacao','tema'];
  evidence.campos_extraidos = fields.map(field => ({ campo: field, esperado: example[field], recebido: extracted[field], correto: example[field] === extracted[field] }));
  assert.ok(evidence.campos_extraidos.every(result => result.correto), 'Divergência na extração; ver campos_extraidos');
  for (const field of ['valor_condenacao_centavos','meses_completos','principal_corrigido_centavos','juros_centavos',
    'valor_atualizado_centavos','beneficio_esperado_centavos','decisao_recurso']) assert.equal(outputs.processos.value[0][field], golden.calculo_esperado[field], field);
  evidence.tokens = outputs.auditoria.value[0].tokens;
  evidence.estado = 'aprovado';
} catch (error) {
  evidence.estado = 'falhou'; evidence.erro = redact(error.message); process.exitCode = 1;
} finally {
  clearTimeout(timer); globalThis.fetch = nativeFetch; console.warn = warn; console.error = logError;
  evidence.duracao_ms = Date.now() - start; evidence.chamadas_reais = sent;
  const dir = `outputs/s1.2/${evidence.executado_em.replace(/[:.]/g, '-')}`;
  await mkdir(dir, { recursive: true });
  await writeFile(`${dir}/avaliacao.json`, JSON.stringify(evidence, null, 2) + '\n');
  console.log(JSON.stringify({ estado: evidence.estado, http_status: evidence.http_status ?? null,
    tokens: evidence.tokens ?? null, erro: evidence.erro_rede ?? evidence.erro ?? null, evidencia: `${dir}/avaliacao.json` }, null, 2));
}
