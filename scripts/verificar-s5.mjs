import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import ExcelJS from 'exceljs';
import {hash,entradasCarteira} from '../src/executar-carteira.mjs';
import {conferirLista} from './preparar-entrega.mjs';
const base='docs/output/s5';
const m=JSON.parse(await readFile(`${base}/manifest.json`));
for(const a of m.artefatos)assert.equal(hash(await readFile(`${base}/${a.nome}`)),a.sha256,a.nome);
for(const name of ['processos','resumo','auditoria'])assert.deepEqual(JSON.parse(await readFile(`${base}/${name}.json`)),JSON.parse(await readFile(`docs/output/s3/${name}.json`)),`Preservação ${name}`);
const ps=JSON.parse(await readFile(`${base}/processos.json`)),book=new ExcelJS.Workbook();await book.xlsx.readFile(`${base}/processos.xlsx`);
assert.deepEqual(book.worksheets.map(w=>w.name),['Processos','Resumo','Auditoria','Pendencias']);
const fields=['numero_processo','resultado_sentenca','status_processamento','tribunal','comarca','classe_processual','tema','fundamento_decisao','status_subsidios','decisao_recurso','motivo_decisao','danos_materiais_centavos','danos_morais_centavos','valor_condenacao_centavos','mes_base_correcao','data_citacao','meses_completos','principal_corrigido_centavos','juros_centavos','valor_atualizado_centavos','probabilidade_reversao_percentual','custo_recurso_centavos','beneficio_esperado_centavos'];
const ws=book.getWorksheet('Processos');assert.equal(ws.rowCount,ps.length+1);
for(let i=0;i<ps.length;i++)for(let j=0;j<fields.length;j++){
 const field=fields[j],v=ws.getCell(i+2,j+1).value,expected=ps[i][field];
 if(field.endsWith('_centavos')&&expected!==null)assert.equal(Math.round(v*100),expected,`${ps[i].numero_processo}: ${field}`);
 else assert.deepEqual(v,expected,`${ps[i].numero_processo}: ${field}`);
}
assert.equal(book.getWorksheet('Pendencias').rowCount,1);
const {loadProjectFromFile}=await import('../src/rivet-runtime.mjs');
const project=await loadProjectFromFile(`${base}/projeto.rivet-project`),raw=await entradasCarteira();
assert.equal(project.metadata.mainGraphId,'analisar_lote');
for(const n of project.graphs.analisar_lote.nodes.filter(n=>n.type==='graphInput'))if(n.data.id!=='modelo')assert.equal(n.data.defaultValue,raw[n.data.id],n.data.id);
const lista=JSON.parse(await readFile('docs/entrega/arquivos.json')),items=await conferirLista(process.cwd(),lista);
const rational=await readFile('docs/entrega/racional.md','utf8');
const testes=JSON.parse(await readFile(`${base}/testes.json`));
let previa;
try{previa=JSON.parse(await readFile(`${base}/previa-render.json`));}catch(e){if(e.code!=='ENOENT')throw e;}
const record={etapa:'S5',chamadas_llm:0,artefatos_reconsolidados_hashes_conferidos:m.artefatos.length,processos_resumo_auditoria_preservados:true,
 xlsx:{abas:book.worksheets.map(w=>w.name),processos:ps.length,campos_por_linha_conferidos:fields.length,pendencias:0},
 projeto:{grafo:'analisar_lote',defaults_cinco_insumos_conferidos:true,sha256:hash(await readFile(`${base}/projeto.rivet-project`))},
 racional:{palavras:rational.trim().split(/\s+/).length,sha256:hash(rational),extensao_pdf_teste:'até duas páginas A4, corpo 11pt, margem 18mm; fonte controlada de teste'},lista_positiva:{arquivos:items.length,credenciais_detectadas:0,sha256:hash(await readFile('docs/entrega/arquivos.json'))},
 testes:{...testes.suite_atual,registro:'testes.json'},
 relatorio_previa:previa?{paginas:previa.inspecao_visual.paginas,familia:previa.familia,previa:previa.previa,registro:'previa-render.json'}:null,
 pendentes:['modelo e fonte final do PDF','aceite visual do PDF final','S5.4 ZIP','S5.6 reprodução após extrair ZIP','S5.7 demonstração final no aplicativo','S5.8 defesa','S5.9 envio']};
await writeFile(`${base}/revisao.json`,JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify(record,null,2));
