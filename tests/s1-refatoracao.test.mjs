import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProjectFromFile } from '../src/rivet-runtime.mjs';
import { executarS1 } from '../src/executar-s1.mjs';

test('S1.5: orquestrador delega às cinco responsabilidades em subgrafos', async () => {
  const project = await loadProjectFromFile('rivet/analise_sentencas.rivet-project');
  assert.deepEqual(project.plugins?.filter(p => p.id === 'enter-bounded-extraction'), [{
    type: 'package', id: 'enter-bounded-extraction', package: 'enter-bounded-extraction', tag: 'latest',
  }], 'O aplicativo precisa da dependência declarada no projeto, além do registro no SDK');
  const main = project.graphs.analisar_carteira;
  const calls = main.nodes.filter(n => n.type === 'subGraph');
  assert.equal(calls.length,5);
  assert.ok(!main.nodes.some(n => ['code','chat'].includes(n.type)));
  for (const call of calls) assert.ok(project.graphs[call.data.graphId]);
  assert.deepEqual(main.nodes.filter(n=>n.type==='graphOutput').map(n=>n.data.id).sort(),
    ['auditoria','processos','relatorio_markdown','resumo']);
});
test('S1.5: quatro outputs permanecem equivalentes à captura anterior à refatoração', async t => {
  const root = await mkdtemp(path.join(tmpdir(),'enter-refatoracao-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const {diretorio} = await executarS1({modo:'replay',destino:root});
  const record = JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json','utf8'));
  const expected = structuredClone(record.outputs);
  // Replay não reporta consumo da chamada histórica como consumo atual.
  expected.auditoria[0].tokens = null;
  expected.auditoria[0].versao_extrator = 's2.4-v1';
  expected.auditoria[0].historico_tentativas=[{numero:1,estado:'aprovada',problemas:[],resposta_original:record.resposta_llm_original,uso:null,http_status:200}];
  Object.assign(expected.resumo,{processos_com_valor_atualizado:1,processos_sem_valor_atualizado:0,decisoes_concluidas:1,decisoes_pendentes:0,passivo_parcial:false});
  expected.relatorio_markdown+='\nCobertura financeira: 1/1 valores atualizados conhecidos; 0 excluídos. Cobertura decisória: 1/1 decisões concluídas; 0 pendentes.';
  for(const name of ['processos','resumo','auditoria']) {
    assert.deepEqual(JSON.parse(await readFile(path.join(diretorio,`${name}.json`))),expected[name]);
  }
  assert.equal(await readFile(path.join(diretorio,'relatorio.md'),'utf8'),expected.relatorio_markdown);
});
