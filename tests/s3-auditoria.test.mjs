import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {auditarCarteira} from '../scripts/auditoria-carteira.mjs';
const records=JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json'));
const ps=records.map(r=>({...r.extracao_esperada,...r.calculo_esperado,status_processamento:'ok'}));
const as=records.map(r=>({numero_processo:r.numero_processo,tentativas:1,historico_tentativas:[],memoria:r.calculo_esperado.memoria?{total_numerador:r.calculo_esperado.memoria.total_exato_numerador,total_denominador:r.calculo_esperado.memoria.total_exato_denominador,beneficio_numerador:r.calculo_esperado.memoria.beneficio_exato_numerador,beneficio_denominador:r.calculo_esperado.memoria.beneficio_exato_denominador}:null}));
test('S3.3: auditoria aceita valores e frações equivalentes ao oráculo',()=>assert.equal(auditarCarteira(records,ps,as).estado,'aprovada'));
test('S3.3: data, centavo, decisão e fração adulterados são reportados por identidade',()=>{
 const altered=structuredClone(ps),audit=structuredClone(as);altered[0].data_citacao='2026-02-08';altered[0].valor_atualizado_centavos++;altered[0].decisao_recurso='recorrer';audit[0].memoria.total_numerador='1';
 const d=auditarCarteira(records,altered,audit).divergencias;for(const field of ['data_citacao','valor_atualizado_centavos','decisao_recurso','memoria.total'])assert.ok(d.some(x=>x.campo===field));
});
