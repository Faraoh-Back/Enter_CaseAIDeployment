import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';

const captured = JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json', 'utf8')).outputs;
async function setup(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'enter-xlsx-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return path.join(dir, 'processos.xlsx');
}
async function exportAndRead(data, file) {
  const { exportarXlsx } = await import('../src/exportar-xlsx.mjs');
  await exportarXlsx(data, file);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(file);
  return book;
}
function cell(sheet, header, row = 2) {
  const col = sheet.getRow(1).values.indexOf(header);
  assert.ok(col > 0, header);
  return sheet.getCell(row, col);
}
test('XLSX: captura real preserva centavos, índices, evidências e resumo sem recalcular', async t => {
  const file = await setup(t);
  const data = structuredClone(captured);
  // Valor deliberadamente diferente da linha: o exportador não consolida indicadores.
  data.resumo.passivo_centavos = 123456;
  const before = structuredClone(data);
  const book = await exportAndRead(data, file);
  assert.deepEqual(data, before);
  const p = book.getWorksheet('Processos');
  assert.equal(cell(p, 'Processo').type, ExcelJS.ValueType.String);
  assert.equal(cell(p, 'Valor atualizado (R$)').value, 6673.14);
  assert.equal(cell(p, 'Benefício esperado (R$)').value, -2532.69);
  const summary = book.getWorksheet('Resumo').getSheetValues().filter(Boolean);
  assert.ok(summary.some(r => r[1] === 'passivo_centavos' && r[2] === 1234.56 && r[3] === 'R$'));
  const audit = book.getWorksheet('Auditoria').getSheetValues().filter(Boolean);
  assert.ok(audit.some(r => r[2] === 'indice_base' && r[3] === '1086.2922'));
  assert.ok(audit.some(r => r[2] === 'total_numerador' && r[3] === '724898454210000'));
  assert.ok(audit.some(r => r[2] === 'data_citacao' && r[3] === data.auditoria[0].extracao.evidencias.data_citacao));
});
test('XLSX: nulo fica vazio, zero é numérico e pendências são copiadas', async t => {
  const data = structuredClone(captured), p = data.processos[0];
  p.status_processamento = 'pendente_revisao'; p.decisao_recurso = 'pendente';
  p.valor_atualizado_centavos = null; p.juros_centavos = 0;
  p.problemas = [{ codigo: 'DADO_AUSENTE', mensagem: 'Revisar data.' }];
  const book = await exportAndRead(data, await setup(t));
  assert.equal(cell(book.getWorksheet('Processos'), 'Valor atualizado (R$)').value, null);
  assert.equal(cell(book.getWorksheet('Processos'), 'Juros (R$)').value, 0);
  const rows = book.getWorksheet('Pendencias').getSheetValues().filter(Boolean);
  assert.equal(rows.length, 2);
  assert.deepEqual(rows[1].slice(1), [p.numero_processo, 'pendente_revisao', 'DADO_AUSENTE', 'Revisar data.']);
});
test('XLSX: textos semelhantes a fórmulas permanecem texto literal', async t => {
  const data = structuredClone(captured);
  data.processos[0].tema = '=1+1';
  data.auditoria[0].extracao.evidencias.tema = '@SUM(A1:A2)';
  const book = await exportAndRead(data, await setup(t));
  assert.equal(cell(book.getWorksheet('Processos'), 'Tema').value, '=1+1');
  assert.equal(cell(book.getWorksheet('Processos'), 'Tema').type, ExcelJS.ValueType.String);
  for (const sheet of book.worksheets) sheet.eachRow(row => row.eachCell(c => assert.notEqual(c.type, ExcelJS.ValueType.Formula)));
});
for (const [name, change] of [
  ['centavo fracionário', d => { d.processos[0].juros_centavos = 1.1; }],
  ['limite de precisão do Excel', d => { d.processos[0].juros_centavos = Number.MAX_SAFE_INTEGER; }],
  ['texto acima do limite da célula', d => { d.auditoria[0].resposta_original = 'a'.repeat(32768); }],
]) test(`XLSX: rejeita ${name} antes de gravar`, async t => {
  const { exportarXlsx } = await import('../src/exportar-xlsx.mjs');
  const file = await setup(t), data = structuredClone(captured); change(data);
  await assert.rejects(exportarXlsx(data, file), /XLSX/);
  await assert.rejects(readFile(file), { code: 'ENOENT' });
});
test('XLSX: destino existente é preservado e erro de escrita é propagado', async t => {
  const { exportarXlsx } = await import('../src/exportar-xlsx.mjs');
  const file = await setup(t);
  await exportarXlsx(captured, file);
  const before = await readFile(file);
  await assert.rejects(exportarXlsx(captured, file), { code: 'EEXIST' });
  assert.deepEqual(await readFile(file), before);
  await assert.rejects(exportarXlsx(captured, path.join(file, 'invalido.xlsx')), { code: 'ENOTDIR' });
});
