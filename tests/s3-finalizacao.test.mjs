import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {hash} from '../src/executar-carteira.mjs';
import {finalizarCarteira} from '../scripts/finalizar-carteira.mjs';
import {loteMisto} from './helpers/s2-lote.mjs';
async function setup(t) {
 const root=await mkdtemp(path.join(tmpdir(),'enter-s3-final-'));t.after(()=>rm(root,{recursive:true,force:true}));const source=path.join(root,'origem');await mkdir(source);
 const data=JSON.parse(await readFile('docs/output/s2.6-validacao.json')).outputs,raw=(await loteMisto()).raw;
 const json=v=>JSON.stringify(v,null,2)+'\n';
 for(const name of ['processos','auditoria','resumo'])await writeFile(`${source}/${name}.json`,json(data[name]));
 await writeFile(`${source}/entradas.json`,json(raw));await writeFile(`${source}/metricas.json`,'{}');await writeFile(`${source}/auditoria-documental.json`,'{}');
 const m={estado:'concluida_com_pendencias',execucao_id:'origem-s3-teste',identidades:data.processos.map(p=>p.numero_processo),resumo:data.resumo,modelo_solicitado:'gpt-4.1-mini-2025-04-14',artefatos:[]};
 for(const name of ['processos.json','auditoria.json','resumo.json'])m.artefatos.push({nome:name,sha256:hash(await readFile(`${source}/${name}`))});
 await writeFile(`${source}/manifest.json`,json(m));return {root,source,data};
}
test('S3.7: reconsolidação preserva processos e histórico, atualiza relatório sem rede e identifica origem',async t=>{
 const {root,source,data}=await setup(t);let calls=0;t.mock.method(globalThis,'fetch',()=>{calls++;throw new Error('Rede não esperada');});
 const r=await finalizarCarteira(source,path.join(root,'final'));assert.equal(calls,0);
 for(const name of ['processos','auditoria'])assert.deepEqual(JSON.parse(await readFile(`${r.diretorio}/${name}.json`)),data[name]);
 const m=JSON.parse(await readFile(`${r.diretorio}/manifest.json`));assert.equal(m.chamadas_reais_nesta_consolidacao,0);assert.equal(m.execucao_id,'origem-s3-teste');
 for(const item of m.artefatos)assert.equal(hash(await readFile(`${r.diretorio}/${item.nome}`)),item.sha256);
 assert.match(await readFile(`${r.diretorio}/relatorio.md`,'utf8'),/Relatório executivo/);
});
test('S3.7: artefato adulterado na origem impede reconsolidação',async t=>{
 const {root,source}=await setup(t);await writeFile(`${source}/processos.json`,'[]');
 await assert.rejects(finalizarCarteira(source,path.join(root,'final')),/Integridade/);
});
