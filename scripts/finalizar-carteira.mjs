import {parseArgs} from 'node:util';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {loadProjectFromFile,serializeProject,runGraphInFile} from '../src/rivet-runtime.mjs';
import {exportarXlsx} from '../src/exportar-xlsx.mjs';
import {hash} from '../src/executar-carteira.mjs';

export async function finalizarCarteira(origem,destino='outputs/s3-final') {
 const manifest=JSON.parse(await readFile(`${origem}/manifest.json`));
 if(!['concluida','concluida_com_pendencias'].includes(manifest.estado))throw new Error('ORIGEM_NAO_CONCLUIDA');
 for(const item of manifest.artefatos)assert.equal(hash(await readFile(`${origem}/${item.nome}`)),item.sha256,`Integridade: ${item.nome}`);
 const ps=JSON.parse(await readFile(`${origem}/processos.json`)),as=JSON.parse(await readFile(`${origem}/auditoria.json`));
 assert.deepEqual(ps.map(p=>p.numero_processo),manifest.identidades);assert.deepEqual(as.map(a=>a.numero_processo),manifest.identidades);
 const id=`consolidacao-${randomUUID()}`,dir=path.resolve(destino,id);await mkdir(dir,{recursive:true});
 const values={identidades:manifest.identidades,resultados:ps.map((p,i)=>({processos:[p],auditoria:[as[i]]})),data_referencia:manifest.resumo.data_referencia};
 const project=await loadProjectFromFile('rivet/analise_sentencas.rivet-project');
 for(const node of project.graphs.s2_consolidacao_lote.nodes.filter(n=>n.type==='graphInput')){node.data.defaultValue=values[node.data.id];node.data.useDefaultValueInput=false;}
 project.metadata={...project.metadata,id:randomUUID(),title:'Aceite offline — carteira consolidada',mainGraphId:'s2_consolidacao_lote'};
 const file=`${dir}/aceite-consolidacao.rivet-project`;await writeFile(file,serializeProject(project));
 // Este subgrafo não contém extrator. Bloquear rede também na conferência do arquivo salvo.
 const nativeFetch=globalThis.fetch;globalThis.fetch=()=>{throw new Error('RECONSOLIDACAO_NAO_PODE_CHAMAR_REDE');};let r;
 try{r=await runGraphInFile(file,{graph:'s2_consolidacao_lote'});}finally{globalThis.fetch=nativeFetch;}
 const data=Object.fromEntries(Object.entries(r).map(([k,v])=>[k,v.value]));
 assert.deepEqual(data.processos,ps);assert.deepEqual(data.auditoria,as);
 for(const [k,v] of Object.entries(manifest.resumo).filter(([k])=>k!=='distribuicoes'))assert.deepEqual(data.resumo[k],v,`Resumo: ${k}`);
 const json=v=>JSON.stringify(v,null,2)+'\n';
 for(const k of ['processos','resumo','auditoria'])await writeFile(`${dir}/${k}.json`,json(data[k]));
 await writeFile(`${dir}/relatorio.md`,data.relatorio_markdown);
 await exportarXlsx(data,`${dir}/processos.xlsx`,{execucao_id:manifest.execucao_id,data_referencia:data.resumo.data_referencia});
 // Projeto para execução completa, com as entradas reais e sem segredos.
 const production=await loadProjectFromFile('rivet/analise_sentencas.rivet-project'),raw=JSON.parse(await readFile(`${origem}/entradas.json`));
 for(const node of production.graphs.analisar_lote.nodes.filter(n=>n.type==='graphInput'))node.data.defaultValue=node.data.id==='modelo'?manifest.modelo_solicitado:raw[node.data.id];
 production.metadata={...production.metadata,title:'Carteira Enter — análise completa',mainGraphId:'analisar_lote'};
 await writeFile(`${dir}/projeto.rivet-project`,serializeProject(production));
 for(const name of ['auditoria-documental.json','metricas.json'])await writeFile(`${dir}/${name}`,await readFile(`${origem}/${name}`));
 const record={versao:'s3-final-v1',execucao_id:manifest.execucao_id,consolidacao_id:id,estado:manifest.estado,modo:'reconsolidacao_de_outputs_reais_sem_llm',chamadas_reais_nesta_consolidacao:0,
  origem:{diretorio:path.resolve(origem),manifest_sha256:hash(await readFile(`${origem}/manifest.json`)),projeto_sha256:manifest.projeto_sha256,prompt_sha256:manifest.prompt_sha256},
  projeto_consolidacao_sha256:hash(await readFile(file)),resumo:data.resumo,metricas_origem:JSON.parse(await readFile(`${origem}/metricas.json`)),artefatos:[]};
 for(const name of ['processos.json','resumo.json','auditoria.json','relatorio.md','processos.xlsx','projeto.rivet-project','aceite-consolidacao.rivet-project','auditoria-documental.json','metricas.json'])record.artefatos.push({nome:name,sha256:hash(await readFile(`${dir}/${name}`))});
 await writeFile(`${dir}/manifest.json`,json(record));return {diretorio:dir,resumo:data.resumo};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{const {values:v}=parseArgs({options:{execucao:{type:'string'},destino:{type:'string'}},strict:true});if(!v.execucao)throw new Error('Informe --execucao');console.log(JSON.stringify(await finalizarCarteira(v.execucao,v.destino),null,2));}
 catch(e){console.error(e.message);process.exitCode=1;}
}
