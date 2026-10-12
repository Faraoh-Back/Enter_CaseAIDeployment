import { readFile, writeFile } from 'node:fs/promises';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import standalone from 'ajv/dist/standalone/index.js';
import { build } from 'esbuild';
import { globalRivetNodeRegistry, loadProjectFromFile, serializeProject } from '@ironclad/rivet-node';
import { entradasS1 } from './s1-fixture.mjs';

const extractionSchema = JSON.parse(await readFile('schemas/extracao.schema.json', 'utf8'));
async function compile(schema, name) {
  const ajv = new Ajv({ allErrors: true, code: { source: true } });
  addFormats(ajv);
  ajv.addSchema(extractionSchema, 'extracao.schema.json');
  const validator = schema === extractionSchema ? ajv.getSchema('extracao.schema.json') : ajv.compile(schema);
  const bundled = await build({ stdin: { contents: standalone(ajv, validator), resolveDir: process.cwd(), sourcefile: 'schema.cjs' },
    bundle: true, write: false, platform: 'browser', format: 'iife', globalName: name, target: 'es2020' });
  return bundled.outputFiles[0].text;
}
const validation = await compile(extractionSchema, 'validateSchema')
  + `\nfunction validarSemanticaS0(inputs) {\n${await readFile('rivet/code/validacao-s0.js', 'utf8')}\n}\n`
  + await readFile('rivet/code/s1/validar.js', 'utf8');
const consolidation = await compile(JSON.parse(await readFile('schemas/processo.schema.json', 'utf8')), 'validateProcesso')
  + await compile(JSON.parse(await readFile('schemas/resumo.schema.json', 'utf8')), 'validateResumo')
  + await readFile('rivet/code/s1/consolidar.js', 'utf8');
// Schema de transporte derivado, com a estrutura estrita. Restrições completas são aplicadas pelo Ajv no grafo.
function transportSchema(value) {
  if (Array.isArray(value)) return value.map(transportSchema);
  if (value === null || typeof value !== 'object') return value;
  const omit = new Set(['$schema', 'title', 'description', 'minLength', 'minimum', 'maximum', 'pattern', 'format']);
  const result = Object.fromEntries(Object.entries(value).filter(([k]) => !omit.has(k)).map(([k, v]) => [k, transportSchema(v)]));
  if (result.enum && !result.type) result.type = result.enum.includes(null) ? ['string','null'] : 'string';
  return result;
}
function node(type, id, data, x, y, title = id) {
  const n = globalRivetNodeRegistry.createDynamic(type);
  return { ...n, id, title, visualData: { x, y, width: 320 }, data: { ...n.data, ...data } };
}
const inputs = await entradasS1();
const nodes = Object.entries(inputs).map(([id, defaultValue], index) => node('graphInput', id, { id, dataType: 'string', defaultValue }, 0, index * 180));
const connections = [];
function connect(from, outputId, to, inputId) { connections.push({ outputNodeId: from, outputId, inputNodeId: to, inputId }); }
nodes.push(node('code', 's1_preparar', { inputNames: Object.keys(inputs), outputNames: ['preparado','sentenca'], code: await readFile('rivet/code/s1/preparar.js', 'utf8') }, 440, 300, '1. Conferir sentença e referências'));
for (const id of Object.keys(inputs)) connect(id, 'data', 's1_preparar', id);
nodes.push(node('prompt', 's1_prompt', { promptText: await readFile('rivet/prompts/extracao-s1.txt', 'utf8'), type: 'user' }, 840, 0, '2. Instruções de extração'));
connect('s1_preparar', 'sentenca', 's1_prompt', 'sentenca');
nodes.push(node('object', 's1_schema', { jsonTemplate: JSON.stringify(transportSchema(extractionSchema), null, 2) }, 840, 500, 'Schema da resposta'));
nodes.push(node('graphInput', 'modelo', { id: 'modelo', dataType: 'string', defaultValue: 'gpt-4.1-mini-2025-04-14' }, 840, 800, 'Modelo da extração'));
nodes.push(node('chat', 's1_extrair', { model: 'gpt-4.1-mini-2025-04-14', useModelInput: true,
  temperature: 0, maxTokens: 2500, responseFormat: 'json_schema', responseSchemaName: 'extracao_sentenca',
  outputUsage: true, cache: false, useAsGraphPartialOutput: false, useServerTokenCalculation: true }, 1240, 0, '3. Extrair sentença (OpenAI)'));
connect('modelo', 'data', 's1_extrair', 'model');
connect('s1_schema', 'output', 's1_extrair', 'responseSchema');
connect('s1_prompt', 'output', 's1_extrair', 'prompt');
nodes.push(node('code', 's1_validar', { inputNames: ['preparado','resposta'], outputNames: ['base','extracao','parametros'], code: validation }, 1640, 300, '4. Validar evidências e preparar cálculo'));
connect('s1_preparar', 'preparado', 's1_validar', 'preparado');
connect('s1_extrair', 'response', 's1_validar', 'resposta');
nodes.push(node('code', 's1_calcular', { inputNames: ['parametros'], outputNames: ['resultado'], code: await readFile('rivet/code/calculo-s0.js', 'utf8') }, 2040, 0, '5. Calcular e decidir (BigInt)'));
connect('s1_validar', 'parametros', 's1_calcular', 'parametros');
nodes.push(node('code', 's1_consolidar', { inputNames: ['base','extracao','calculo','preparado','resposta','uso','modelo'],
  outputNames: ['processos','resumo','auditoria','relatorio_markdown'], code: consolidation }, 2440, 300, '6. Consolidar e redigir relatório'));
for (const field of ['base','extracao']) connect('s1_validar', field, 's1_consolidar', field);
connect('s1_calcular', 'resultado', 's1_consolidar', 'calculo');
connect('s1_preparar', 'preparado', 's1_consolidar', 'preparado');
connect('s1_extrair', 'response', 's1_consolidar', 'resposta');
connect('s1_extrair', 'usage', 's1_consolidar', 'uso');
connect('modelo', 'data', 's1_consolidar', 'modelo');
for (const [index, [id, dataType]] of Object.entries({ processos: 'object[]', resumo: 'object', auditoria: 'object[]', relatorio_markdown: 'string' }).entries()) {
  nodes.push(node('graphOutput', id, { id, dataType }, 2860, index * 240));
  connect('s1_consolidar', id, id, 'value');
}
const file = 'rivet/analise_sentencas.rivet-project';
const project = await loadProjectFromFile(file);
project.graphs.analisar_carteira = { metadata: { id: 'analisar_carteira', name: 'analisar_carteira',
  description: 'S1.2: uma sentença condenatória por execução. Defaults do caso de desenvolvimento. Run faz uma chamada à OpenAI. Lotes e pendências serão tratados em S2/S3.' }, nodes, connections };
project.metadata.mainGraphId = 'analisar_carteira';
await writeFile(file, serializeProject(project));
console.log('Grafo S1 gerado. Grafo-base preservado; nenhuma chamada à LLM durante o build.');
