import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { loadProjectFromFile, runGraphInFile } from '../src/rivet-runtime.mjs';
import ExcelJS from 'exceljs';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { sentencesForFixtures } from '../scripts/case-files.mjs';

// Aceitação S1.1: testes vermelhos deliberados, executados por npm run test:s1.
// Apenas o transporte da LLM é simulado. As regras devem rodar no grafo real.
const projectPath = 'rivet/analise_sentencas.rivet-project';
const graphName = 'analisar_carteira';
const numero = '3871230-78.2024.8.26.0002';
const extracao = JSON.parse(await readFile('schemas/extracao.exemplo.json', 'utf8'));
const golden = JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json', 'utf8'))
  .find(record => record.numero_processo === numero);
const schema = JSON.parse(await readFile('schemas/extracao.schema.json', 'utf8'));
const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateExtraction = ajv.compile(schema);

const processoEsperado = {
  numero_processo: numero,
  classe_processual: 'Procedimento Comum Cível', tribunal: 'TJSP', comarca: 'São Paulo',
  tema: extracao.tema, fundamento_decisao: extracao.fundamento_decisao,
  resultado_sentenca: 'parcial_procedencia', status_processamento: 'ok', problemas: [],
  danos_materiais_centavos: 600000, danos_morais_centavos: 30000,
  valor_condenacao_centavos: 630000, mes_base_correcao: '2025-12', data_citacao: '2026-02-27',
  meses_completos: 3, principal_corrigido_centavos: 647878, juros_centavos: 19436,
  valor_atualizado_centavos: 667314, status_subsidios: 'ausentes',
  probabilidade_reversao_percentual: 10, custo_recurso_centavos: 320000,
  beneficio_esperado_centavos: -253269, decisao_recurso: 'nao_recorrer',
  motivo_decisao: 'beneficio_nao_positivo', evidencias: extracao.evidencias,
};
const resumoEsperado = {
  data_referencia: '2026-05-31', total_identificado: 1, vitorias_confirmadas: 0,
  resultados_desconhecidos: 0, condenacoes: 1, processos_aptos: 1, pendencias: 0,
  passivo_centavos: 667314, recursos_recomendados: 0,
  custo_recursos_centavos: 0, beneficio_esperado_recursos_centavos: 0,
};
const auditoriaEsperada = {
  numero_processo: numero, extracao, indice_base: '1086.2922', indice_final: '1117.1189',
  tentativas: 1, versao_extrator: 'simulado-s1.1',
  memoria: {
    principal_numerador: '7037849070000', principal_denominador: '10862922',
    juros_numerador: '21113547210000', juros_denominador: '1086292200',
    total_numerador: '724898454210000', total_denominador: '1086292200',
    beneficio_numerador: '-25326860', beneficio_denominador: '100',
    beneficio_residual_positivo: false,
  },
};

function assertFields(actual, expected) {
  for (const [field, value] of Object.entries(expected)) assert.deepEqual(actual[field], value, field);
}

async function entradasDoCaso() {
  const { dir, raw, sentences } = await sentencesForFixtures();
  const sentenca = sentences.find(s => s.numero === numero)?.texto;
  assert.ok(sentenca, 'A sentença de referência precisa existir nos insumos');
  assert.equal(sentenca, golden.sentenca);
  assert.equal(validateExtraction(extracao), true, JSON.stringify(validateExtraction.errors));
  for (const trecho of Object.values(extracao.evidencias)) {
    if (trecho !== null) assert.ok(sentenca.includes(trecho), `Evidência fora da sentença: ${trecho}`);
  }
  for (const field of ['valor_condenacao_centavos', 'meses_completos', 'principal_corrigido_centavos',
    'juros_centavos', 'valor_atualizado_centavos', 'beneficio_esperado_centavos', 'decisao_recurso']) {
    assert.equal(processoEsperado[field], golden.calculo_esperado[field], `Gabarito independente: ${field}`);
  }
  // Recorta os bytes textuais do bloco original, preservando os delimitadores.
  const blocks = [...raw.matchAll(/={20,}\r?\nProcesso nº ([\d.\-]+)\r?\n={20,}\r?\n/g)];
  const index = blocks.findIndex(m => m[1] === numero);
  assert.ok(index >= 0);
  const processoTexto = raw.slice(blocks[index].index, blocks[index + 1]?.index ?? raw.length);
  const subsidios = (await readFile(path.join(dir, 'status_subsidios.txt'), 'utf8')).trim().split(/\r?\n/);
  const rows = subsidios.slice(1).filter(line => line.split(',')[0] === numero);
  assert.equal(rows.length, 1);
  const inputs = {
    processos_texto: processoTexto, subsidios_texto: `${subsidios[0]}\n${rows[0]}\n`,
    indices_texto: await readFile(path.join(dir, 'tabela_indices.csv'), 'utf8'),
    custos_texto: await readFile(path.join(dir, 'custo_recurso_por_tribunal.csv'), 'utf8'),
    probabilidades_texto: await readFile(path.join(dir, 'subsidios_probabilidade_reversao.csv'), 'utf8'),
    data_referencia: '2026-05-31',
  };
  return { sentenca, inputs: Object.fromEntries(Object.entries(inputs).map(([k, value]) => [k, { type: 'string', value }])) };
}

test('S1: sentença e CSVs viram processo, resumo, auditoria e relatório pelo grafo', { timeout: 15000 }, async t => {
  const { sentenca, inputs } = await entradasDoCaso();
  const project = await loadProjectFromFile(projectPath);
  assert.ok(Object.values(project.graphs).some(g => g.metadata.name === graphName),
    'S1 ainda não implementada: falta o grafo analisar_carteira no projeto de trabalho');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  t.after(() => { clearTimeout(timer); controller.abort(); });
  let requests = 0;
  let transportFailure;
  // Não lê .env, não delega ao fetch original e não envia documentos a um provedor.
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    try {
      assert.equal(String(url), 'https://api.openai.com/v1/chat/completions');
      assert.equal(++requests, 1, 'Uma sentença válida exige uma chamada nesta prova');
      assert.equal(options.method, 'POST');
      const body = JSON.parse(options.body);
      const prompt = body.messages.map(message => typeof message.content === 'string'
        ? message.content : JSON.stringify(message.content)).join('\n');
      // O cabeçalho delimitador pode ser removido; o corpo original deve chegar inteiro.
      const corpoOriginal = sentenca.slice(sentenca.indexOf('PODER JUDICIÁRIO'));
      assert.ok(prompt.includes(corpoOriginal), 'A extração deve receber o corpo completo da sentença');
      const content = JSON.stringify(extracao); // Gabarito pré-anotado, não captura de LLM.
      if (body.stream) {
        const chunks = [
          { choices: [{ index: 0, delta: { role: 'assistant', content }, finish_reason: null }] },
          { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }] },
        ];
        return new Response(chunks.map(c => `data: ${JSON.stringify(c)}\n\n`).join('') + 'data: [DONE]\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } });
      }
      return Response.json({ choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] });
    } catch (error) {
      transportFailure = error;
      controller.abort(); // Evita as retentativas internas extensas do SDK em caso de erro do teste.
      throw error;
    }
  });
  let outputs;
  try {
    outputs = await runGraphInFile(projectPath, { graph: graphName, inputs,
      openAiKey: 'credencial-ficticia-de-teste', openAiOrganization: '',
      openAiEndpoint: 'https://api.openai.com/v1/chat/completions',
      abortSignal: controller.signal, chatNodeTimeout: 5000,
      onNodeError: ({ error }) => t.diagnostic(String(error)) });
  } catch (error) { throw transportFailure ?? error; }
  assert.equal(requests, 1, 'O grafo precisa passar pelo extrator, sem devolver o exemplo fixo');
  for (const name of ['processos', 'resumo', 'auditoria', 'relatorio_markdown']) assert.ok(outputs[name], `Graph Output ausente: ${name}`);
  assert.doesNotThrow(() => JSON.stringify(outputs), 'BigInt deve sair como string na memória');
  const processos = outputs.processos.value;
  assert.equal(processos.length, 1);
  assertFields(processos[0], processoEsperado);
  assertFields(outputs.resumo.value, resumoEsperado);
  const audit = outputs.auditoria.value;
  assert.equal(audit.length, 1);
  assertFields(audit[0], { numero_processo: numero, extracao, indice_base: '1086.2922', indice_final: '1117.1189', tentativas: 1 });
  assert.equal(typeof audit[0].versao_extrator, 'string');
  assert.ok(audit[0].versao_extrator.trim());
  assertFields(audit[0].memoria, auditoriaEsperada.memoria);
  assert.equal(validateExtraction(audit[0].extracao), true);
  for (const trecho of Object.values(processos[0].evidencias)) {
    if (trecho !== null) assert.ok(sentenca.includes(trecho));
  }
  const report = outputs.relatorio_markdown.value;
  assert.equal(typeof report, 'string');
  assert.ok(report.includes(numero));
  assert.match(report, /31\/05\/2026|2026-05-31/);
  assert.match(report, /6\.673,14/);
  assert.match(report, /n[aã]o recorrer/i);
  assert.match(report, /revers[aã]o integral/i);
});

test('S1: exportação preserva os outputs em uma planilha XLSX real e reaberta', async t => {
  // Contrato público do adaptador de apresentação; implementação pertence à S1.3.
  const { exportarXlsx } = await import('../src/exportar-xlsx.mjs');
  const dir = await mkdtemp(path.join(tmpdir(), 'enter-s1-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const destino = path.join(dir, 'processos.xlsx');
  const analysis = { processos: [structuredClone(processoEsperado)], resumo: structuredClone(resumoEsperado),
    auditoria: [structuredClone(auditoriaEsperada)], relatorio_markdown: 'Relatório de referência do teste.' };
  const before = structuredClone(analysis);
  await exportarXlsx(analysis, destino);
  assert.deepEqual(analysis, before, 'O exportador não altera os outputs recebidos');
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(destino);
  for (const name of ['Processos', 'Resumo', 'Auditoria', 'Pendencias']) assert.ok(workbook.getWorksheet(name), `Aba ausente: ${name}`);
  const sheet = workbook.getWorksheet('Processos');
  assert.equal(sheet.actualRowCount, 2, 'Cabeçalho e exatamente um processo');
  function cell(header) {
    const col = sheet.getRow(1).values.indexOf(header);
    assert.ok(col > 0, `Coluna ausente: ${header}`);
    return sheet.getCell(2, col);
  }
  for (const [header, value] of Object.entries({ Processo: numero, Resultado: 'parcial_procedencia',
    Subsídios: 'ausentes', Decisão: 'nao_recorrer', Motivo: 'beneficio_nao_positivo' })) assert.equal(cell(header).value, value);
  const money = { 'Condenação (R$)': 630000, 'Principal corrigido (R$)': 647878, 'Juros (R$)': 19436,
    'Valor atualizado (R$)': 667314, 'Custo do recurso (R$)': 320000, 'Benefício esperado (R$)': -253269 };
  for (const [header, cents] of Object.entries(money)) {
    assert.equal(typeof cell(header).value, 'number', `${header}: célula numérica`);
    assert.equal(Math.round(cell(header).value * 100), cents, `${header}: mesmo centavo do output`);
    assert.match(cell(header).numFmt, /0\.00/);
  }
  assert.equal(workbook.getWorksheet('Pendencias').actualRowCount, 1, 'Somente cabeçalho, sem pendências');
  // As abas auxiliares usam Campo/Valor e Processo/Campo/Valor, respectivamente.
  const summaryRows = workbook.getWorksheet('Resumo').getSheetValues().slice(2).filter(Boolean);
  assert.ok(summaryRows.some(row => row[1] === 'data_referencia' && row[2] === '2026-05-31'));
  assert.ok(summaryRows.some(row => row[1] === 'total_identificado' && row[2] === 1));
  const auditRows = workbook.getWorksheet('Auditoria').getSheetValues().slice(2).filter(Boolean);
  assert.ok(auditRows.some(row => row[1] === numero && row[2] === 'total_numerador' && row[3] === '724898454210000'));
  assert.ok(auditRows.some(row => row[1] === numero && row[2] === 'data_citacao' && row[3] === extracao.evidencias.data_citacao));
});
