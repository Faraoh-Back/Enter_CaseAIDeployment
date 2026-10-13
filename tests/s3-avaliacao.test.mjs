import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {avaliarExtracao} from '../scripts/avaliacao.mjs';
const records=JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json'));
const ps=records.map(r=>({numero_processo:r.numero_processo,status_processamento:'ok'}));
const as=records.map(r=>({numero_processo:r.numero_processo,extracao:r.extracao_esperada,tentativas:1}));
test('S3.2: avaliador conta datas aplicáveis e exige campos críticos/completude',()=>{
 const e=avaliarExtracao(records,ps,as);assert.equal(e.aprovacao_critica,true);assert.equal(e.total_avaliado,12);
 assert.equal(e.campos.data_citacao.total,6);assert.equal(e.campos.data_citacao.nao_aplicaveis,6);
 assert.equal(e.campos.resultado_sentenca.corretos,12);
});
test('S3.2: campo crítico incorreto e identidade omitida reprovam sem compensação por médias',()=>{
 const a=structuredClone(as);a[0].extracao.danos_morais_centavos++;
 const e=avaliarExtracao(records,ps.slice(1),a);assert.equal(e.aprovacao_critica,false);assert.equal(e.completos,11);assert.equal(e.criticos_corretos,11);
 assert.equal(e.casos[0].estado,'ausente');
});
test('S3.2: identidade duplicada não é considerada completa',()=>{
 assert.equal(avaliarExtracao(records,[...ps,ps[0]],as).aprovacao_critica,false);
});
