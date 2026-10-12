import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runGraphInFile, loadProjectFromFile } from '@ironclad/rivet-node';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { sentencesForFixtures } from '../scripts/case-files.mjs';

const projectPath = 'rivet/s0_compatibilidade.rivet-project';
const example = JSON.parse(await readFile('schemas/extracao.exemplo.json', 'utf8'));
const schema = JSON.parse(await readFile('schemas/extracao.schema.json', 'utf8'));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

test('o SDK carrega o projeto S0 com os três grafos previstos', async () => {
  const project = await loadProjectFromFile(projectPath);
  assert.deepEqual(Object.values(project.graphs).map(g => g.metadata.name).sort(),
    ['s0_calculo', 's0_llm', 's0_validacao']);
});

test('Code Node mantém precisão e serializa o caso financeiro independente', async () => {
  const outputs = await runGraphInFile(projectPath, { graph: 's0_calculo' });
  const result = outputs.resultado.value;
  assert.deepEqual({
    principal: result.principal_corrigido_centavos,
    juros: result.juros_centavos,
    total: result.valor_atualizado_centavos,
    beneficio: result.beneficio_esperado_centavos,
    decisao: result.decisao_recurso,
  }, { principal: 647878, juros: 19436, total: 667314, beneficio: -253269, decisao: 'nao_recorrer' });
  assert.equal(result.principal_corrigido_centavos + result.juros_centavos, result.valor_atualizado_centavos);
  assert.doesNotThrow(() => JSON.stringify(outputs));
  assert.equal(typeof result.memoria.total_numerador, 'string');
});

test('benefício residual e empate são decididos antes do arredondamento', async () => {
  const base = { condenacao_centavos: 1, indice_base: '10000000', indice_final: '10000000', meses: 0, probabilidade_percentual: 10, custo_centavos: 0 };
  const positive = await runGraphInFile(projectPath, { graph: 's0_calculo', inputs: { parametros: { type: 'object', value: base } } });
  assert.equal(positive.resultado.value.beneficio_esperado_centavos, 0);
  assert.equal(positive.resultado.value.decisao_recurso, 'recorrer');
  const tie = await runGraphInFile(projectPath, { graph: 's0_calculo', inputs: { parametros: { type: 'object', value: { ...base, probabilidade_percentual: 0 } } } });
  assert.equal(tie.resultado.value.decisao_recurso, 'nao_recorrer');
});

const cases = [
  ['válido', data => data, true],
  ['campo extra', data => ({ ...data, inventado: 1 }), false],
  ['dinheiro negativo', data => ({ ...data, danos_materiais_centavos: -1 }), false],
  ['data impossível', data => ({ ...data, data_citacao: '2026-02-30' }), false],
  ['identidade inválida', data => ({ ...data, numero_processo: '123' }), false],
  ['data não encontrada', data => ({ ...data, data_citacao: null }), true],
];

for (const [name, mutate, valid] of cases) {
  test(`contrato externo e Code Node concordam: ${name}`, async () => {
    const data = mutate(structuredClone(example));
    assert.equal(validate(data), valid);
    const outputs = await runGraphInFile(projectPath, { graph: 's0_validacao', inputs: { extracao: { type: 'object', value: data } } });
    assert.equal(outputs.validacao.value.schema_valido, valid);
    if (name === 'válido') assert.equal(outputs.validacao.value.apto_calculo, true);
    if (name === 'data não encontrada') assert.equal(outputs.validacao.value.apto_calculo, false);
  });
}

test('trecho inexistente impede aptidão mesmo com JSON válido', async () => {
  const data = structuredClone(example);
  data.evidencias.data_citacao = 'uma citação que não aparece na sentença';
  const outputs = await runGraphInFile(projectPath, { graph: 's0_validacao', inputs: { extracao: { type: 'object', value: data } } });
  assert.equal(outputs.validacao.value.schema_valido, true);
  assert.equal(outputs.validacao.value.apto_calculo, false);
});

test('evidência literal não basta quando contradiz o valor extraído', async () => {
  const data = { ...structuredClone(example), danos_materiais_centavos: 600001 };
  const outputs = await runGraphInFile(projectPath, { graph: 's0_validacao', inputs: { extracao: { type: 'object', value: data } } });
  assert.equal(outputs.validacao.value.schema_valido, true);
  assert.equal(outputs.validacao.value.apto_calculo, false);
});

test('arredondamento de meio centavo afasta de zero e índices inválidos falham', async () => {
  const base = { condenacao_centavos: 1, indice_base: '2', indice_final: '1', meses: 0, probabilidade_percentual: 50, custo_centavos: 1 };
  const outputs = await runGraphInFile(projectPath, { graph: 's0_calculo', inputs: { parametros: { type: 'object', value: base } } });
  assert.equal(outputs.resultado.value.valor_atualizado_centavos, 1);
  assert.equal(outputs.resultado.value.beneficio_esperado_centavos, -1);
  await assert.rejects(runGraphInFile(projectPath, { graph: 's0_calculo', inputs: { parametros: { type: 'object', value: { ...base, indice_base: '0' } } } }));
  await assert.rejects(runGraphInFile(projectPath, { graph: 's0_calculo', inputs: { parametros: { type: 'object', value: { ...base, condenacao_centavos: Number.MAX_SAFE_INTEGER, indice_base: '1', indice_final: '2' } } } }));
});

test('24 gabaritos são disjuntos, estratificados e rastreáveis aos originais', async () => {
  const { dir, sentences } = await sentencesForFixtures();
  const manifest = JSON.parse(await readFile('tests/fixtures/golden/manifest.json', 'utf8'));
  const hash = text => createHash('sha256').update(text).digest('hex');
  for (const [name, expected] of Object.entries(manifest.hashes_insumos)) assert.equal(hash(await readFile(path.join(dir, name))), expected);
  const ids = new Set();
  for (const name of ['desenvolvimento', 'reservado']) {
    const content = await readFile(`tests/fixtures/golden/${name}.json`, 'utf8');
    assert.equal(hash(content), manifest.hashes_conjuntos[`${name}.json`]);
    const records = JSON.parse(content);
    assert.equal(records.length, 12);
    const count = {};
    for (const record of records) {
      assert.ok(!ids.has(record.numero_processo));
      ids.add(record.numero_processo);
      assert.equal(record.sentenca, sentences.find(s => s.numero === record.numero_processo).texto);
      assert.equal(hash(record.sentenca), record.sentenca_sha256);
      assert.equal(validate(record.extracao_esperada), true, JSON.stringify(validate.errors));
      for (const evidence of Object.values(record.extracao_esperada.evidencias)) {
        if (evidence !== null) assert.ok(record.sentenca.includes(evidence));
      }
      const result = record.extracao_esperada.resultado_sentenca;
      count[result] = (count[result] ?? 0) + 1;
    }
    assert.deepEqual(Object.values(count), [3, 3, 3, 3]);
    assert.equal(new Set(records.map(r => r.calculo_esperado.status_subsidios)).size, 3);
    const losses = records.filter(r => r.calculo_esperado.valor_condenacao_centavos > 0);
    assert.equal(new Set(losses.map(r => r.extracao_esperada.danos_morais_centavos > 0)).size, 2);
  }
});

test('gabaritos de desenvolvimento passam no Code Node e no oráculo financeiro independente', async () => {
  const records = JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json', 'utf8'));
  const { dir } = await sentencesForFixtures();
  const indexLines = (await readFile(path.join(dir, 'tabela_indices.csv'), 'utf8')).trim().split(/\r?\n/).slice(1);
  const indices = Object.fromEntries(indexLines.map(line => { const [month, value] = line.split(','); return [month, value.replace('.', '')]; }));
  for (const record of records) {
    const extraction = record.extracao_esperada;
    const expected = record.calculo_esperado;
    const validation = await runGraphInFile(projectPath, { graph: 's0_validacao', inputs: {
      extracao: { type: 'object', value: extraction }, sentenca: { type: 'string', value: record.sentenca },
    } });
    assert.equal(validation.validacao.value.apto_calculo, true, JSON.stringify(validation.validacao.value));
    if (expected.valor_condenacao_centavos === 0) continue; // o cálculo S0 prova condenações; vitórias entram em S2.
    const outputs = await runGraphInFile(projectPath, { graph: 's0_calculo', inputs: { parametros: { type: 'object', value: {
      condenacao_centavos: expected.valor_condenacao_centavos, indice_base: indices[extraction.mes_base_correcao], indice_final: indices['2026-05'],
      meses: expected.meses_completos, probabilidade_percentual: expected.probabilidade_reversao_percentual, custo_centavos: expected.custo_recurso_centavos,
    } } } });
    for (const field of ['principal_corrigido_centavos', 'juros_centavos', 'valor_atualizado_centavos', 'beneficio_esperado_centavos', 'decisao_recurso']) assert.equal(outputs.resultado.value[field], expected[field], `${record.numero_processo}: ${field}`);
  }
});
