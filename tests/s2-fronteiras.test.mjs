import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {runGraphInFile} from '../src/rivet-runtime.mjs';
const project='rivet/analise_sentencas.rivet-project';
const calendars=[
  ['2026-02-28','2026-05-31',3],['2026-04-30','2026-05-31',1],['2026-03-31','2026-05-31',2],
  ['2026-05-31','2026-05-31',0],['2026-01-31','2026-02-28',0],['2026-01-30','2026-03-29',1],
  ['2024-02-29','2025-02-28',11],['2024-02-29','2025-03-01',12],['2000-02-29','2000-03-29',1],
];
for(const [citacao,referencia,meses] of calendars) test(`S2.5: meses civis ${citacao} → ${referencia}`,async()=>{
  const output=await runGraphInFile(project,{graph:'s2_calendario',inputs:{citacao:{type:'string',value:citacao},referencia:{type:'string',value:referencia}}});
  assert.equal(output.meses.value,meses);
});
for(const [date,ref] of [['2026-02-29','2026-05-31'],['2100-02-29','2100-03-31'],['2026-04-31','2026-05-31'],['2026-06-01','2026-05-31'],['2026-01-01','2026-02-30']]) {
  test(`S2.5: calendário rejeita ${date} / ${ref}`,async()=>{
    const errors=[];
    await assert.rejects(runGraphInFile(project,{graph:'s2_calendario',inputs:{citacao:{type:'string',value:date},referencia:{type:'string',value:ref}},onNodeError:({error})=>errors.push(String(error))}));
    assert.match(errors.join('\n'),/DATA_INVALIDA|DATA_FUTURA/);
  });
}
const vectors=JSON.parse(await readFile('tests/fixtures/fronteiras-financeiras.json','utf8'));
for(const v of vectors.casos) test(`S2.5: ${v.nome}`,async()=>{
  const output=await runGraphInFile(project,{graph:'s1_financeiro',inputs:{parametros:{type:'object',value:v.parametros}}});
  const actual=output.resultado.value;
  for(const [k,value] of Object.entries(v.esperado)) assert.equal(actual[k],value,k);
  assert.equal(actual.principal_corrigido_centavos+actual.juros_centavos,actual.valor_atualizado_centavos);
  const mem=actual.memoria;
  assert.equal(BigInt(mem.total_numerador)*BigInt(v.total_exato.denominador),BigInt(v.total_exato.numerador)*BigInt(mem.total_denominador));
  assert.equal(mem.beneficio_residual_positivo,v.residual_positivo);
});
