import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runGraphInFile} from '../src/rivet-runtime.mjs';
const fixture=JSON.parse(await readFile('docs/output/s2.6-validacao.json')).entrada_aceite_visual;
async function run(values) {
 const types={resultados:'object[]',identidades:'string[]',data_referencia:'string'};
 const r=await runGraphInFile('rivet/analise_sentencas.rivet-project',{graph:'s2_consolidacao_lote',inputs:Object.fromEntries(Object.entries(values).map(([k,value])=>[k,{type:types[k],value}]))});
 return {summary:r.resumo.value,report:r.relatorio_markdown.value};
}
test('S3.6: uma comarca identificada continua sem contraste mesmo com dados de comarca ausentes',async()=>{
 const r=await run(fixture);assert.match(r.report,/uma única comarca identificada/);assert.match(r.report,/não existe contraste entre comarcas/);
 assert.equal(r.summary.distribuicoes.comarcas.length,2);
});
test('S3.6: nenhum resultado conhecido não gera taxa falsa nem divide por zero',async()=>{
 const f=structuredClone(fixture);for(const item of f.resultados) {
  const p=item.processos[0];p.resultado_sentenca=null;p.status_processamento='pendente_revisao';p.decisao_recurso='pendente';
  p.valor_atualizado_centavos=null;p.beneficio_esperado_centavos=null;p.motivo_decisao='revisao_necessaria';
 }
 const r=await run(f);assert.equal(r.summary.resultados_desconhecidos,7);assert.equal(r.summary.passivo_parcial,true);
 assert.equal(r.summary.processos_com_valor_atualizado,0);assert.ok(r.summary.distribuicoes.subsidios.every(g=>g.resultados_conhecidos===0));
 assert.match(r.report,/nenhuma divisão com denominador zero é interpretada como taxa observada/);assert.doesNotMatch(r.report,/NaN|Infinity|undefined/);
});
test('S3.6: pressupostos econômicos e associação descritiva são explícitos, sem ROI inventado',async()=>{
 const {report}=await run(fixture);for(const phrase of ['não são probabilidades calibradas','reversão integral','não economia realizada','Não demonstram que a documentação causou','Resultados desconhecidos são excluídos do denominador condicional','Grupos pequenos não sustentam generalização'])assert.ok(report.includes(phrase),phrase);
 assert.doesNotMatch(report,/ROI\s*[:=]\s*\d|economia realizada\s*[:=]\s*R\$/);
});
