import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, open } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import ExcelJS from 'exceljs';
async function setup(t) {
  const dir = await mkdtemp(path.join(tmpdir(), 'enter-execucao-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  return dir;
}
async function cli(dir, args = [], env = process.env) {
  // Arquivos evitam perda de stdout/stderr de subprocessos observada neste ambiente.
  const logs = await mkdtemp(path.join(tmpdir(), 'enter-cli-logs-'));
  const out = await open(path.join(logs,'stdout'),'w'), err = await open(path.join(logs,'stderr'),'w');
  try {
    const child = spawn(process.execPath, ['scripts/executar-s1.mjs', '--destino', dir, ...args],
      { env, stdio:['ignore',out.fd,err.fd], timeout:20000 });
    const code = await new Promise((resolve,reject) => { child.on('error',reject); child.on('close',resolve); });
    const stdout = await readFile(path.join(logs,'stdout'),'utf8'), stderr = await readFile(path.join(logs,'stderr'),'utf8');
    if (code !== 0) throw Object.assign(new Error(stderr || 'CLI interrompida'), {code,stdout,stderr});
    return {stdout,stderr};
  } finally { await out.close(); await err.close(); await rm(logs,{recursive:true,force:true}); }
}
test('S1.4: CLI executa grafo e exportador, grava artefatos íntegros e isola execuções', async t => {
  const root = await setup(t);
  const first = JSON.parse((await cli(root, ['--replay'])).stdout);
  const manifest = JSON.parse(await readFile(path.join(first.diretorio, 'manifest.json')));
  assert.equal(manifest.estado, 'concluida');
  assert.equal(manifest.modo, 'replay');
  assert.equal(manifest.chamadas_reais, 0);
  assert.equal(manifest.requisicoes_extrator, 1);
  assert.equal(manifest.custo_monetario, null);
  assert.equal(manifest.artefatos.length, 5);
  for (const item of manifest.artefatos) {
    const content = await readFile(path.join(first.diretorio, item.nome));
    assert.equal(createHash('sha256').update(content).digest('hex'), item.sha256);
  }
  const [p] = JSON.parse(await readFile(path.join(first.diretorio, 'processos.json')));
  assert.equal(p.valor_atualizado_centavos, 667314);
  const book = new ExcelJS.Workbook();
  await book.xlsx.readFile(path.join(first.diretorio, 'processos.xlsx'));
  const ws = book.getWorksheet('Processos');
  assert.equal(ws.getCell(2, ws.getRow(1).values.indexOf('Valor atualizado (R$)')).value, p.valor_atualizado_centavos / 100);
  assert.match(await readFile(path.join(first.diretorio, 'relatorio.md'), 'utf8'), /6\.673,14/);
  const second = JSON.parse((await cli(root, ['--replay'])).stdout);
  assert.notEqual(first.diretorio, second.diretorio);
  assert.deepEqual(await readFile(path.join(second.diretorio, 'processos.json')), await readFile(path.join(first.diretorio, 'processos.json')));
});
test('S1.4: resposta rejeitada deixa manifesto falhou sem anunciar artefatos', async t => {
  const root = await setup(t);
  await assert.rejects(cli(root, ['--replay', '--captura', 'docs/output/s1.2-llm-rejeitada.json']), e => e.code === 1);
  const [id] = await readdir(root);
  const manifest = JSON.parse(await readFile(path.join(root,id,'manifest.json')));
  assert.equal(manifest.estado,'falhou');
  assert.deepEqual(manifest.artefatos,[]);
  assert.match(JSON.stringify(manifest.erros), /Evidencia inexistente/);
  const response = await readFile(path.join(root,id,'extracao-resposta.txt'));
  assert.equal(createHash('sha256').update(response).digest('hex'),manifest.extracao_resposta_sha256);
});
test('S1.4: modo real sem credencial falha antes de criar execução, sem carregar .env implicitamente', async t => {
  const root = await setup(t);
  await assert.rejects(cli(root, ['--real'], { ...process.env, OPENAI_API_KEY: '' }), e => e.code === 1 && /OPENAI_API_KEY/.test(e.stderr));
  assert.deepEqual(await readdir(root), []);
});
test('S1.4: argumentos desconhecidos não iniciam execução', async t => {
  const root = await setup(t);
  await assert.rejects(cli(root, ['--replay', '--invalido']), e => e.code === 1 && /Unknown option|Argumento/.test(e.stderr));
  assert.deepEqual(await readdir(root), []);
});
test('S1.4: falha do exportador preserva JSONs e não publica XLSX parcial', async t => {
  const { executarS1 } = await import('../src/executar-s1.mjs');
  const { writeFile } = await import('node:fs/promises');
  const root = await setup(t);
  await assert.rejects(executarS1({ destino: root, modo:'replay', exportador: async (_data,file) => {
    await writeFile(file,'incompleto'); throw new Error('Falha de disco simulada');
  }}), /Falha de disco simulada/);
  const [id] = await readdir(root), dir = path.join(root,id);
  const manifest = JSON.parse(await readFile(path.join(dir,'manifest.json')));
  assert.equal(manifest.estado,'falhou');
  assert.equal(manifest.artefatos.length,4);
  assert.ok(manifest.artefatos.every(a => a.nome !== 'processos.xlsx'));
  assert.equal(JSON.parse(await readFile(path.join(dir,'processos.json')))[0].valor_atualizado_centavos,667314);
  assert.ok(!(await readdir(dir)).some(name => name.endsWith('.tmp') || name.endsWith('.xlsx')));
});

test('S1.4: caminho real com transporte simulado registra consumo e limita a chamada', async t => {
  const { executarS1 } = await import('../src/executar-s1.mjs');
  const captured = JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json','utf8'));
  let calls = 0;
  t.mock.method(globalThis,'fetch',async (_url, options) => {
    calls++;
    assert.equal(JSON.parse(options.body).response_format.type,'json_schema');
    const chunks = [{ choices:[{index:0,delta:{content:captured.resposta_llm_original},finish_reason:'stop'}] },
      {choices:[],usage:{prompt_tokens:100,completion_tokens:50,total_tokens:150}}];
    return new Response(chunks.map(c=>`data: ${JSON.stringify(c)}\n\n`).join('')+'data: [DONE]\n\n',
      {headers:{'Content-Type':'text/event-stream'}});
  });
  const result = await executarS1({destino:await setup(t),modo:'real',apiKey:'credencial-ficticia'});
  const manifest = JSON.parse(await readFile(path.join(result.diretorio,'manifest.json')));
  assert.equal(calls,1);
  assert.equal(manifest.chamadas_reais,1); // Requisição ao transporte, simulado neste teste.
  assert.equal(manifest.tokens.total,150);
  assert.equal(manifest.estado,'concluida');
});
test('S1.4: falha HTTP encerra a execução sem retentar nem persistir credencial', async t => {
  const { executarS1 } = await import('../src/executar-s1.mjs');
  const root = await setup(t), key = 'credencial-ficticia-secreta';
  let calls=0;
  t.mock.method(globalThis,'fetch',async () => {
    calls++; return new Response(JSON.stringify({error:{message:key}}),{status:401});
  });
  await assert.rejects(executarS1({destino:root,modo:'real',apiKey:key}));
  const [id] = await readdir(root);
  const text = await readFile(path.join(root,id,'manifest.json'),'utf8');
  assert.ok(!text.includes(key));
  assert.equal(calls,1);
  assert.equal(JSON.parse(text).estado,'falhou');
  assert.equal(JSON.parse(text).http_status,401);
});
