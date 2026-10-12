import ExcelJS from 'exceljs';

// Só apresentação: os valores e a decisão vêm prontos do Graph Output.
export async function exportarProvaS0(resultado, destino) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Case Enter — prova S0';
  const sheet = workbook.addWorksheet('Prova S0');
  sheet.columns = [
    { header: 'Principal corrigido (R$)', key: 'principal', width: 26 },
    { header: 'Juros (R$)', key: 'juros', width: 20 },
    { header: 'Total atualizado (R$)', key: 'total', width: 26 },
    { header: 'Benefício esperado (R$)', key: 'beneficio', width: 26 },
    { header: 'Decisão econômica', key: 'decisao', width: 24 },
  ];
  sheet.addRow({ principal: resultado.principal_corrigido_centavos / 100, juros: resultado.juros_centavos / 100,
    total: resultado.valor_atualizado_centavos / 100, beneficio: resultado.beneficio_esperado_centavos / 100, decisao: resultado.decisao_recurso });
  for (let col = 1; col <= 4; col++) sheet.getColumn(col).numFmt = '"R$" #,##0.00;[Red]-"R$" #,##0.00';
  sheet.getRow(1).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = 'A1:E2';
  const audit = workbook.addWorksheet('Memoria');
  audit.columns = [{ header: 'Campo', width: 35 }, { header: 'Valor do grafo', width: 35 }];
  for (const entry of Object.entries(resultado.memoria)) audit.addRow(entry);
  await workbook.xlsx.writeFile(destino);
}
