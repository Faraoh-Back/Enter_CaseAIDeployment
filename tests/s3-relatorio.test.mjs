import test, {before} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import ExcelJS from 'exceljs';
import {runGraphInFile} from '../src/rivet-runtime.mjs';
import {exportarXlsx} from '../src/exportar-xlsx.mjs';
let data;
before(async()=>{
 const e=JSON.parse(await readFile('docs/output/s2.6-validacao.json'));
 const types={resultados:'object[]',identidades:'string[]',data_referencia:'string'};
 const r=await runGraphInFile('rivet/analise_sentencas.rivet-project',{graph:'s2_consolidacao_lote',inputs:Object.fromEntries(Object.entries(e.entrada_aceite_visual).map(([k,value])=>[k,{type:types[k],value}]))});
 data=Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.value]));
});
test('S3.5: cada distribuição fecha identidades, resultados e centavos conhecidos',()=>{
 const s=data.resumo;for(const groups of Object.values(s.distribuicoes)){
  assert.equal(groups.reduce((n,g)=>n+g.total,0),7);assert.equal(groups.reduce((n,g)=>n+g.passivo_centavos,0),1657946);
  for(const g of groups){assert.equal(g.vitorias+g.condenacoes+g.desconhecidos,g.total);assert.equal(g.resultados_conhecidos,g.total-g.desconhecidos);}
 }
 assert.equal(s.distribuicoes.comarcas.filter(g=>g.grupo!=='não identificado').length,1);
});
test('S3.5: relatório contém síntese, estratégia, temas, subsídios, exclusões e premissas',()=>{
 const r=data.relatorio_markdown;for(const section of ['Síntese e ações','Subsídios — associação observada','Temas','Comarcas','Estratégia econômica de recursos','Maiores exposições conhecidas','Cobertura e pendências'])assert.ok(r.includes(section));
 assert.match(r,/R\$ 16\.579,46/);assert.match(r,/R\$ 64,20/);assert.match(r,/não demonstram que a documentação causou/i);
 assert.match(r,/não são probabilidades calibradas/);assert.match(r,/não economia realizada/);assert.doesNotMatch(r,/NaN|undefined/);
});
test('S3.5: XLSX materializa distribuições sem recalcular seus valores',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'s3-grupos-'));t.after(()=>rm(dir,{recursive:true,force:true}));const file=path.join(dir,'processos.xlsx');
 await exportarXlsx(data,file);const b=new ExcelJS.Workbook();await b.xlsx.readFile(file);
 const rows=b.getWorksheet('Resumo').getSheetValues().filter(Boolean);
 for(const [kind,groups] of Object.entries(data.resumo.distribuicoes))groups.forEach((g,i)=>{
  assert.ok(rows.some(r=>r[1]===`distribuicoes.${kind}[${i}].grupo`&&r[2]===g.grupo));
  assert.ok(rows.some(r=>r[1]===`distribuicoes.${kind}[${i}].passivo_centavos`&&r[2]===g.passivo_centavos/100&&r[3]==='R$'));
 });
});
