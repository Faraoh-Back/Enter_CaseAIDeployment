import ExcelJS from 'exceljs';
import { writeFile } from 'node:fs/promises';

const MONEY_FORMAT = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
// Excel oferece 15 algarismos significativos; não exportar centavos silenciosamente inexatos.
const MAX_CENTS = 999_999_999_999_999;
function money(value) {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || Math.abs(value) > MAX_CENTS || Math.round((value / 100) * 100) !== value) {
    throw new Error('XLSX: valor monetário fora da precisão suportada');
  }
  return value / 100;
}
function scalar(value) {
  if (value === null) return null;
  if (typeof value === 'string') {
    if (value.length > 32767) throw new Error('XLSX: texto excede 32767 caracteres por célula');
    return value; // ExcelJS recebe string, nunca objeto de fórmula ou hyperlink.
  }
  if (typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))) return value;
  throw new Error('XLSX: célula deve conter texto, número, booleano ou null');
}
function sheet(book, name, columns) {
  const ws = book.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = columns.map(([header, width]) => ({ header, width }));
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF17365D' } };
  return ws;
}
function row(ws, values) {
  const result = ws.addRow(values.map(scalar));
  result.alignment = { vertical: 'top', wrapText: true };
  return result;
}
const columns = [
  ['Processo','numero_processo',30], ['Resultado','resultado_sentenca',24],
  ['Estado','status_processamento',22], ['Tribunal','tribunal',12], ['Comarca','comarca',22],
  ['Classe','classe_processual',28], ['Tema','tema',36], ['Fundamento','fundamento_decisao',55],
  ['Subsídios','status_subsidios',16], ['Decisão','decisao_recurso',18], ['Motivo','motivo_decisao',28],
  ['Danos materiais (R$)','danos_materiais_centavos',22], ['Danos morais (R$)','danos_morais_centavos',22],
  ['Condenação (R$)','valor_condenacao_centavos',22], ['Mês-base','mes_base_correcao',14],
  ['Citação','data_citacao',14], ['Meses completos','meses_completos',18],
  ['Principal corrigido (R$)','principal_corrigido_centavos',25], ['Juros (R$)','juros_centavos',20],
  ['Valor atualizado (R$)','valor_atualizado_centavos',24],
  ['Probabilidade (%)','probabilidade_reversao_percentual',20],
  ['Custo do recurso (R$)','custo_recurso_centavos',24], ['Benefício esperado (R$)','beneficio_esperado_centavos',26],
];

/** Materializa outputs já analisados. O diretório deve existir; não sobrescreve arquivos. */
export async function exportarXlsx(analise, destino) {
  if (!analise || !Array.isArray(analise.processos) || !Array.isArray(analise.auditoria)
      || !analise.resumo || typeof analise.resumo !== 'object' || Array.isArray(analise.resumo)
      || typeof analise.relatorio_markdown !== 'string') throw new Error('XLSX: outputs de análise inválidos');
  const book = new ExcelJS.Workbook();
  book.creator = 'Enter Case AI Deployment';
  const processes = sheet(book, 'Processos', columns.map(([label,,width]) => [label,width]));
  const summary = sheet(book, 'Resumo', [['Campo',42],['Valor',30],['Unidade',16]]);
  const audit = sheet(book, 'Auditoria', [['Processo',30],['Campo',48],['Valor',100]]);
  const pending = sheet(book, 'Pendencias', [['Processo',30],['Estado',22],['Código',30],['Mensagem',80]]);
  for (const process of analise.processos) {
    const r = row(processes, columns.map(([,field]) => field.endsWith('_centavos') ? money(process[field]) : process[field]));
    columns.forEach(([,field], i) => { if (field.endsWith('_centavos')) r.getCell(i + 1).numFmt = MONEY_FORMAT; });
    if (!Array.isArray(process.problemas)) throw new Error('XLSX: problemas deve ser uma lista');
    // Apenas apresenta o estado e os problemas recebidos; não classifica nem decide.
    if (process.status_processamento !== 'ok' && !process.problemas.length) {
      row(pending, [process.numero_processo, process.status_processamento, null, null]);
    }
    for (const problem of process.problemas) row(pending, [process.numero_processo, process.status_processamento, problem.codigo, problem.mensagem]);
  }
  for (const [field, value] of Object.entries(analise.resumo)) {
    const monetary = field.endsWith('_centavos');
    const r = row(summary, [field, monetary ? money(value) : value, monetary ? 'R$' : null]);
    if (monetary) r.getCell(2).numFmt = MONEY_FORMAT;
  }
  function auditValue(numero, field, value) {
    if (value !== null && typeof value === 'object') {
      if (Array.isArray(value)) {
        if (!value.length) row(audit, [numero, field, '[]']);
        value.forEach((item, index) => auditValue(numero, `${field}[${index}]`, item));
      } else {
        if (!Object.keys(value).length) row(audit, [numero, field, '{}']);
        for (const [key, item] of Object.entries(value)) auditValue(numero, field ? `${field}.${key}` : key, item);
      }
    } else row(audit, [numero, field, value]);
  }
  for (const entry of analise.auditoria) {
    for (const [field, value] of Object.entries(entry)) {
      if (field === 'numero_processo') continue;
      if (field === 'memoria') auditValue(entry.numero_processo, '', value);
      else if (field === 'extracao') {
        for (const [key, item] of Object.entries(value)) {
          auditValue(entry.numero_processo, key === 'evidencias' ? '' : `extracao.${key}`, item);
        }
      } else auditValue(entry.numero_processo, field, value);
    }
  }
  for (const ws of book.worksheets) {
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: ws.rowCount, column: ws.columnCount } };
  }
  // Constrói o XLSX completo antes de tocar no destino. Erros são propagados ao chamador.
  const buffer = await book.xlsx.writeBuffer();
  await writeFile(destino, buffer, { flag: 'wx' });
}
