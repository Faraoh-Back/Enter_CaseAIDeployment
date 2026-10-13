import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {exportarXlsx} from '../src/exportar-xlsx.mjs';
const data=JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json')).outputs;
test('S3.4: XLSX identifica execução/data-base nas quatro abas e conserva células/filtros',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'enter-s3-xlsx-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'processos.xlsx');
 await exportarXlsx(data,file,{execucao_id:'exec-s3-teste',data_referencia:'2026-05-31'});
 const b=new ExcelJS.Workbook();await b.xlsx.readFile(file);assert.match(b.subject,/exec-s3-teste/);
 assert.deepEqual(b.worksheets.map(w=>w.name),['Processos','Resumo','Auditoria','Pendencias']);
 for(const ws of b.worksheets){assert.match(ws.headerFooter.oddHeader,/exec-s3-teste/);assert.match(ws.headerFooter.oddHeader,/2026-05-31/);assert.ok(ws.autoFilter);assert.equal(ws.views[0].ySplit,1);}
 const ws=b.getWorksheet('Processos');assert.equal(ws.getCell(2,ws.getRow(1).values.indexOf('Valor atualizado (R$)')).value,6673.14);
 assert.ok(b.getWorksheet('Resumo').getSheetValues().some(r=>r?.[1]==='execucao_id'&&r[2]==='exec-s3-teste'));
});
test('S3.4: contexto com data-base divergente não grava planilha',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'enter-s3-xlsx-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'processos.xlsx');
 await assert.rejects(exportarXlsx(data,file,{execucao_id:'exec',data_referencia:'2026-04-30'}),/data-base divergente/);
 await assert.rejects(readFile(file),{code:'ENOENT'});
});
