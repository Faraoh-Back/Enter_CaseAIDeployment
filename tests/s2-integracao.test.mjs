import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, open, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';

// Uma execução real do grafo/CLI/exportador; somente o transporte da LLM é simulado.
let dir, logs, processos, resumo, auditoria, report, manifest;
before(async () => {
  logs = await mkdtemp(path.join(tmpdir(), 'enter-s2-integracao-'));
  const out = await open(path.join(logs, 'stdout'), 'w'), err = await open(path.join(logs, 'stderr'), 'w');
  try {
    const child = spawn(process.execPath, ['scripts/check-s2-5.mjs'], {
      stdio: ['ignore', out.fd, err.fd], timeout: 30000,
      env: { ...process.env, OPENAI_API_KEY: '' },
    });
    const code = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', resolve); });
    assert.equal(code, 0, await readFile(path.join(logs, 'stderr'), 'utf8'));
    dir = JSON.parse(await readFile(path.join(logs, 'stdout'), 'utf8')).diretorio;
  } finally { await out.close(); await err.close(); }
  [processos, resumo, auditoria, manifest] = await Promise.all(
    ['processos', 'resumo', 'auditoria', 'manifest'].map(async name => JSON.parse(await readFile(path.join(dir, `${name}.json`), 'utf8'))));
  report = await readFile(path.join(dir, 'relatorio.md'), 'utf8');
});
after(async () => {
  if (dir) await rm(dir, { recursive: true, force: true });
  if (logs) await rm(logs, { recursive: true, force: true });
});
async function book() {
  const b = new ExcelJS.Workbook();
  await b.xlsx.readFile(path.join(dir, 'processos.xlsx'));
  return b;
}
function rows(ws) { return ws.getSheetValues().slice(2).filter(Boolean); }
const brl = cents => cents === null ? 'desconhecido' : `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

test('S2.6: manifesto identifica os seis artefatos íntegros e transporte simulado', async () => {
  assert.deepEqual(manifest.artefatos.map(a => a.nome).sort(),
    ['entradas.json', 'processos.json', 'resumo.json', 'auditoria.json', 'relatorio.md', 'processos.xlsx'].sort());
  for (const a of manifest.artefatos) {
    assert.equal(createHash('sha256').update(await readFile(path.join(dir, a.nome))).digest('hex'), a.sha256);
  }
  assert.equal(manifest.chamadas_reais, 0);
  assert.equal(manifest.modo, 'offline_anotacoes_sinteticas');
  assert.deepEqual(Object.values(manifest.requisicoes_simuladas), [1, 1, 3, 1, 3, 3, 1]);
  assert.deepEqual(manifest.resumo, resumo);
});

test('S2.6: XLSX preserva todas as colunas, ordem, identidades e valores do JSON', async () => {
  const ws = (await book()).getWorksheet('Processos');
  const mapping = {
    Processo: 'numero_processo', Resultado: 'resultado_sentenca', Estado: 'status_processamento',
    Tribunal: 'tribunal', Comarca: 'comarca', Classe: 'classe_processual', Tema: 'tema', Fundamento: 'fundamento_decisao',
    Subsídios: 'status_subsidios', Decisão: 'decisao_recurso', Motivo: 'motivo_decisao',
    'Danos materiais (R$)': 'danos_materiais_centavos', 'Danos morais (R$)': 'danos_morais_centavos',
    'Condenação (R$)': 'valor_condenacao_centavos', 'Mês-base': 'mes_base_correcao', Citação: 'data_citacao',
    'Meses completos': 'meses_completos', 'Principal corrigido (R$)': 'principal_corrigido_centavos',
    'Juros (R$)': 'juros_centavos', 'Valor atualizado (R$)': 'valor_atualizado_centavos',
    'Probabilidade (%)': 'probabilidade_reversao_percentual', 'Custo do recurso (R$)': 'custo_recurso_centavos',
    'Benefício esperado (R$)': 'beneficio_esperado_centavos',
  };
  assert.equal(processos.length, 7);
  assert.equal(new Set(processos.map(p => p.numero_processo)).size, 7);
  assert.equal(ws.rowCount, 8);
  assert.deepEqual(ws.getRow(1).values.slice(1), Object.keys(mapping));
  processos.forEach((p, i) => Object.entries(mapping).forEach(([header, field], j) => {
    const c = ws.getCell(i + 2, j + 1), v = p[field];
    assert.equal(c.value, v !== null && field.endsWith('_centavos') ? v / 100 : v, `${p.numero_processo}: ${header}`);
    if (v !== null && field.endsWith('_centavos')) {
      assert.equal(c.type, ExcelJS.ValueType.Number);
      assert.equal(Math.round(c.value * 100), v);
    }
  }));
  // Diferencia zero conhecido nas vitórias e lacunas em dados não confirmados.
  assert.equal(processos.filter(p => p.valor_atualizado_centavos === 0).length, 2);
  assert.equal(processos.filter(p => p.valor_atualizado_centavos === null).length, 3);
});

test('S2.6: resumo XLSX mantém todos os indicadores, denominadores e totais independentes', async () => {
  const ws = (await book()).getWorksheet('Resumo');
  assert.equal(rows(ws).length, Object.keys(resumo).length);
  const values = Object.fromEntries(rows(ws).map(r => [r[1], r[2]]));
  for (const [field, value] of Object.entries(resumo)) {
    assert.equal(values[field], field.endsWith('_centavos') ? value / 100 : value);
  }
  assert.equal(values.passivo_parcial, true);
  assert.equal(resumo.passivo_centavos, 1657946);
  assert.equal(resumo.custo_recursos_centavos, 320000);
  assert.equal(resumo.beneficio_esperado_recursos_centavos, 6420);
  assert.equal(resumo.processos_com_valor_atualizado + resumo.processos_sem_valor_atualizado, 7);
  assert.equal(resumo.decisoes_concluidas + resumo.decisoes_pendentes, 7);
  const sum = (list, field) => list.reduce((a, p) => a + (p[field] ?? 0), 0);
  assert.equal(resumo.passivo_centavos, sum(processos, 'valor_atualizado_centavos'));
  const recommended = processos.filter(p => p.decisao_recurso === 'recorrer');
  assert.equal(recommended.length, 1);
  assert.equal(resumo.custo_recursos_centavos, sum(recommended, 'custo_recurso_centavos'));
  assert.equal(resumo.beneficio_esperado_recursos_centavos, sum(recommended, 'beneficio_esperado_centavos'));
});

test('S2.6: aba de pendências preserva cada código, mensagem e estado', async () => {
  const actual = rows((await book()).getWorksheet('Pendencias')).map(r => r.slice(1));
  const expected = processos.flatMap(p => p.problemas.map(e => [p.numero_processo, p.status_processamento, e.codigo, e.mensagem]));
  assert.deepEqual(actual, expected);
  assert.equal(new Set(actual.map(r => r[0])).size, 4);
  assert.ok(actual.some(r => r[1] === 'erro' && r[2] === 'FALHA_TRANSPORTE'));
});

test('S2.6: auditoria XLSX preserva todas as folhas, tentativas e frações sem fórmulas', async () => {
  const b = await book(), actual = rows(b.getWorksheet('Auditoria')).map(r => [r[1], r[2] ?? null, r[3] ?? null]);
  const expected = [];
  function leaves(id, field, value) {
    if (value === null || typeof value !== 'object') { expected.push([id, field || null, value]); return; }
    const entries = Object.entries(value);
    if (!entries.length) { expected.push([id, field || null, Array.isArray(value) ? '[]' : '{}']); return; }
    for (const [key, v] of entries) leaves(id, Array.isArray(value) ? `${field}[${key}]` : [field, key].filter(Boolean).join('.'), v);
  }
  for (const a of auditoria) for (const [field, v] of Object.entries(a)) {
    if (field === 'numero_processo') continue;
    if (field === 'extracao') for (const [key, value] of Object.entries(v)) leaves(a.numero_processo, key === 'evidencias' ? '' : `extracao.${key}`, value);
    else leaves(a.numero_processo, field === 'memoria' && v !== null ? '' : field, v);
  }
  assert.deepEqual(actual, expected);
  assert.deepEqual(auditoria.map(a => a.numero_processo), processos.map(p => p.numero_processo));
  assert.deepEqual(auditoria.map(a => a.historico_tentativas.length), [1, 1, 3, 1, 3, 3, 1]);
  assert.ok(actual.some(r => r[1] === 'total_numerador' && typeof r[2] === 'string'));
  for (const ws of b.worksheets) ws.eachRow(r => r.eachCell(c => assert.notEqual(c.type, ExcelJS.ValueType.Formula)));
});

test('S2.6: Markdown reconcilia linhas, totais, cobertura e listas exatas de exclusões', () => {
  const lines = report.split('\n');
  const table = lines.filter(l => /^\| \d{7}-/.test(l));
  assert.equal(table.length, 7);
  processos.forEach((p, i) => assert.equal(table[i],
    `| ${p.numero_processo} | ${p.status_processamento} | ${brl(p.valor_atualizado_centavos)} | ${p.decisao_recurso} | ${p.problemas.map(e => e.codigo).join(', ') || 'nenhum'} |`));
  assert.ok(lines.includes('Passivo parcial conhecido: **R$ 16.579,46**.'));
  assert.ok(lines.includes('Recursos recomendados: 1; custo: R$ 3.200,00; benefício líquido esperado: R$ 64,20.'));
  assert.ok(lines.includes('Cobertura financeira: 4/7 valores atualizados conhecidos; 3 excluídos. Cobertura decisória: 3/7 decisões concluídas; 4 pendentes.'));
  for (const [prefix, ids] of [
    ['Excluídos do passivo por valor desconhecido', processos.filter(p => p.valor_atualizado_centavos === null)],
    ['Excluídos da decisão econômica por pendência', processos.filter(p => p.decisao_recurso === 'pendente')],
  ]) assert.ok(lines.includes(`${prefix}: ${ids.map(p => p.numero_processo).join(', ')}.`));
  assert.match(report, /estimativas sob reversão integral, não economia realizada/);
  assert.match(report, /não representa a carteira completa/);
  assert.doesNotMatch(report, /NaN|undefined/);
});
