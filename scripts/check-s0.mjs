import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { runGraphInFile } from '@ironclad/rivet-node';
import ExcelJS from 'exceljs';
import { exportarProvaS0 } from '../src/exportar-xlsx-s0.mjs';

const project = 'rivet/s0_compatibilidade.rivet-project';
const dir = 'outputs/s0';
await mkdir(dir, { recursive: true });
const outputs = await runGraphInFile(project, { graph: 's0_calculo' });
const validation = await runGraphInFile(project, { graph: 's0_validacao' });
assert.equal(validation.validacao.value.apto_calculo, true);
const result = outputs.resultado.value;
await writeFile(`${dir}/calculo.json`, JSON.stringify(outputs, null, 2) + '\n');
await exportarProvaS0(result, `${dir}/prova.xlsx`);
const reopened = new ExcelJS.Workbook();
await reopened.xlsx.readFile(`${dir}/prova.xlsx`);
const expected = [result.principal_corrigido_centavos, result.juros_centavos, result.valor_atualizado_centavos, result.beneficio_esperado_centavos];
const sheet = reopened.getWorksheet('Prova S0');
expected.forEach((value, i) => {
  assert.equal(typeof sheet.getCell(2, i + 1).value, 'number');
  assert.equal(Math.round(sheet.getCell(2, i + 1).value * 100), value);
});
assert.equal(sheet.getCell('E2').value, result.decisao_recurso);
assert.equal(reopened.getWorksheet('Memoria').getCell('B6').value, result.memoria.total_numerador);
const evidence = { executado_em: new Date().toISOString(), node: process.version,
  sdk: '1.25.0', projeto_sha256: createHash('sha256').update(await readFile(project)).digest('hex'),
  schema_sha256: createHash('sha256').update(await readFile('schemas/extracao.schema.json')).digest('hex'),
  sdk_calculo: 'aprovado', sdk_schema: 'aprovado', xlsx_reaberto: 'aprovado',
  aplicativo_rivet: 'nao_avaliado_por_este_comando', resultado: result,
};
await writeFile(`${dir}/validacao.json`, JSON.stringify(evidence, null, 2) + '\n');
console.log('SDK, schema e XLSX reaberto: aprovados. Evidências em outputs/s0/.');
