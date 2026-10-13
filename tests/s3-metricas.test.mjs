import test from 'node:test';
import assert from 'node:assert/strict';
import {medirCarteira} from '../scripts/metricas-carteira.mjs';
const m={estado:'concluida',identidades:['a'],nao_processados:[],requisicoes_extrator:2,chamadas_reais:2,duracao_ms:100};
const p=[{status_processamento:'ok'}];
const a=[{tentativas:2,historico_tentativas:[{estado:'extracao_invalida',uso:{prompt_tokens:10,completion_tokens:5,total_tokens:15}},{estado:'aprovada',uso:{prompt_tokens:20,completion_tokens:8,total_tokens:28}}]}];
test('S3.7: tokens incluem tentativas rejeitadas e custo não medido permanece null',()=>{
 const r=medirCarteira(m,p,a);assert.equal(r.tokens.total_tokens,43);assert.equal(r.casos_com_retentativa,1);assert.equal(r.primeira_tentativa_aprovada,0);assert.equal(r.custo_monetario,null);
});
test('S3.7: consumo ausente e chamadas sem histórico não viram zero ou total completo',()=>{
 const x=structuredClone(a);x[0].historico_tentativas[0].uso=null;const r=medirCarteira({...m,requisicoes_extrator:3},p,x);
 assert.equal(r.tokens,null);assert.equal(r.tokens_completos,false);assert.equal(r.tokens_parciais_informados.total_tokens,28);assert.equal(r.tentativas_sem_uso_informado,2);
});
