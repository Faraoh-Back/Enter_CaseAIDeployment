import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runGraphInFile } from '../src/rivet-runtime.mjs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { entradasS1 } from '../scripts/s1-fixture.mjs';

const example = JSON.parse(await readFile('schemas/extracao.exemplo.json', 'utf8'));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
ajv.addSchema(JSON.parse(await readFile('schemas/extracao.schema.json', 'utf8')), 'extracao.schema.json');
const processoSchema = ajv.compile(JSON.parse(await readFile('schemas/processo.schema.json', 'utf8')));
const resumoSchema = ajv.compile(JSON.parse(await readFile('schemas/resumo.schema.json', 'utf8')));

async function executar(t, { changeInput = () => {}, changeExtraction = () => {}, invalidJson = false } = {}) {
  const raw = await entradasS1(); changeInput(raw);
  const extraction = structuredClone(example); changeExtraction(extraction);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  t.after(() => { clearTimeout(timer); controller.abort(); });
  let calls = 0;
  const errors = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    if (++calls > 3) { controller.abort(); throw new Error('Três chamadas no máximo neste teste'); }
    assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.response_format.type, 'json_schema');
    assert.equal(body.response_format.json_schema.strict, true);
    const content = invalidJson ? '{"incompleto":' : JSON.stringify(extraction);
    return new Response(`data: ${JSON.stringify({ choices: [{ index: 0, delta: { content }, finish_reason: null }] })}\n\ndata: ${JSON.stringify({ choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] })}\n\ndata: [DONE]\n\n`, { headers: { 'Content-Type': 'text/event-stream' } });
  });
  try {
    const output = await runGraphInFile('rivet/analise_sentencas.rivet-project', {
      graph: 'analisar_carteira', inputs: Object.fromEntries(Object.entries(raw).map(([key, value]) => [key, { type: 'string', value }])),
      openAiKey: 'credencial-ficticia', openAiOrganization: '', openAiEndpoint: 'https://api.openai.com/v1/chat/completions',
      abortSignal: controller.signal, chatNodeTimeout: 3000, onNodeError: ({ error }) => errors.push(String(error)),
    });
    return { output, calls };
  } catch (error) { return { error: errors.join('\n') || error.message, calls }; }
}

test('S1.2: saídas cumprem schemas e alterações de probabilidade são lidas do CSV', async t => {
  const { output, error, calls } = await executar(t, { changeInput: raw => { raw.probabilidades_texto = raw.probabilidades_texto.replace('ausentes;10%', 'ausentes;80%'); } });
  assert.equal(error, undefined);
  assert.equal(calls, 1);
  const p = output.processos.value[0];
  assert.equal(processoSchema(p), true, JSON.stringify(processoSchema.errors));
  assert.equal(resumoSchema(output.resumo.value), true, JSON.stringify(resumoSchema.errors));
  assert.equal(p.probabilidade_reversao_percentual, 80);
  assert.equal(p.beneficio_esperado_centavos, 213851);
  assert.equal(p.decisao_recurso, 'recorrer');
  assert.equal(output.resumo.value.recursos_recomendados, 1);
  assert.equal(output.resumo.value.beneficio_esperado_recursos_centavos, 213851);
  assert.equal(output.resumo.value.custo_recursos_centavos, 320000);
  assert.equal(processoSchema({ ...p, data_citacao: '2026-02-30' }), false);
  assert.equal(resumoSchema({ ...output.resumo.value, passivo_centavos: 667314.1 }), false);
});

const rejects = [
  ['lote não é truncado', { changeInput: raw => { raw.processos_texto += raw.processos_texto; } }, /duplicada/, 0],
  ['referência duplicada falha antes da LLM', { changeInput: raw => { raw.indices_texto += '\n2025-12,1086.2922\n'; } }, /duplicada/, 0],
  ['custo desconhecido falha antes da LLM', { changeInput: raw => { raw.custos_texto = raw.custos_texto.replace(/^TJSP;[^\r\n]*(?:\r?\n|$)/m, ''); } }, /Custo do tribunal ausente/, 0],
  ['índice-base ausente impede cálculo', { changeInput: raw => { raw.indices_texto = raw.indices_texto.replace(/^2025-12,[^\r\n]*(?:\r?\n|$)/m, ''); } }, /índice-base/, 1],
  ['JSON incompleto impede cálculo', { invalidJson: true }, /não é JSON completo/, 1],
  ['data impossível impede cálculo', { changeExtraction: data => { data.data_citacao = '2026-02-30'; } }, /EXTRACAO_INVALIDA/, 1],
  ['CNJ diferente impede cálculo', { changeExtraction: data => { data.numero_processo = '3094235-58.2024.8.26.0009'; } }, /CNJ divergente/, 1],
  ['trecho inventado impede cálculo', { changeExtraction: data => { data.evidencias.valores = 'O réu deve exatamente R$ 6.300,00.'; } }, /Evidencia inexistente/, 1],
  ['evidência recortada não permite omitir dano moral', { changeExtraction: data => { data.danos_morais_centavos = 0; data.evidencias.valores = 'R$ 6.000,00 a título de danos materiais'; } }, /danos_morais_centavos diverge/, 1],
];
for (const [name, options, pattern, calls] of rejects) {
  test(`S1.2: ${name}`, async t => {
    const result = await executar(t, options);
    if (options.changeExtraction || options.invalidJson) {
      assert.equal(result.error,undefined);
      const p=result.output.processos.value[0];
      assert.equal(processoSchema(p),true,JSON.stringify(processoSchema.errors));
      assert.equal(p.status_processamento,'pendente_revisao');
      assert.equal(p.valor_atualizado_centavos,null);
      assert.equal(p.beneficio_esperado_centavos,null);
      assert.equal(p.decisao_recurso,'pendente');
      assert.match(JSON.stringify(p.problemas),pattern);
      assert.equal(result.calls,3);
      assert.equal(result.output.auditoria.value[0].historico_tentativas.length,3);
    } else {
      assert.equal(result.output,undefined,'Falha global não publica resultados');
      assert.match(result.error??'',pattern);
      assert.equal(result.calls,calls);
    }
  });
}

// Captura real: os campos estavam corretos, mas as citações concatenavam trechos.
test('S1.2: rejeita a resposta real com evidências não literais', async t => {
  const record = JSON.parse(await readFile('docs/output/s1.2-llm-rejeitada.json', 'utf8'));
  const captured = JSON.parse(record.resposta_llm_original);
  const result = await executar(t, { changeExtraction: data => Object.assign(data, captured) });
  assert.equal(result.error,undefined);
  const p=result.output.processos.value[0];
  assert.equal(p.status_processamento,'pendente_revisao');
  assert.equal(p.valor_atualizado_centavos,null);
  assert.equal(p.decisao_recurso,'pendente');
  assert.match(JSON.stringify(p.problemas),/Evidencia inexistente: identificacao/);
  assert.match(JSON.stringify(p.problemas),/Evidencia inexistente: fundamento_decisao/);
  assert.equal(result.calls,3);
});
