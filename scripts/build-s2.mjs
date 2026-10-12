import {readFile} from 'node:fs/promises';
// Apenas monta o projeto: execução, segmentação e totais permanecem no Rivet.
export async function addS2Graphs({project,node,inputs,preparation,entryHelpers,calendar,summary}) {
  const typedInput=(id,type,value)=>node('graphInput',id,{id,dataType:type,...(value===undefined?{}:{defaultValue:value})},0,0,id);
  const typedOutput=(id,type)=>node('graphOutput',`out_${id}`,{id,dataType:type},1320,0,id);
  const edge=(from,outputId,to,inputId)=>({outputNodeId:from,outputId,inputNodeId:to,inputId});
  const outputs={processos:'object[]',resumo:'object',auditoria:'object[]',relatorio_markdown:'string'};
  project.graphs.s2_calendario={metadata:{id:'s2_calendario',name:'s2_calendario',description:'Função civil compartilhada com a validação; provas de fronteira.'},nodes:[
    typedInput('citacao','string','2026-02-27'),typedInput('referencia','string','2026-05-31'),
    node('code','meses',{inputNames:['citacao','referencia'],outputNames:['meses'],code:calendar+"\nreturn {meses:{type:'number',value:mesesCompletos(inputs.citacao.value,inputs.referencia.value)}};"},440,0),typedOutput('meses','number')],
    connections:[edge('citacao','data','meses','citacao'),edge('referencia','data','meses','referencia'),edge('meses','meses','out_meses','value')]};
  const consolidation=node('code','consolidar_lote',{inputNames:['resultados','identidades','data_referencia'],outputNames:Object.keys(outputs),code:summary+await readFile('rivet/code/s2/consolidar-lote.js','utf8')},440,0,'Consolidar e reconciliar identidades');
  project.graphs.s2_consolidacao_lote={metadata:{id:'s2_consolidacao_lote',name:'s2_consolidacao_lote'},nodes:[
    typedInput('resultados','object[]'),typedInput('identidades','string[]'),typedInput('data_referencia','string','2026-05-31'),consolidation,
    ...Object.entries(outputs).map(([id,type])=>typedOutput(id,type))],connections:[
      ...['resultados','identidades','data_referencia'].map(id=>edge(id,'data','consolidar_lote',id)),
      ...Object.keys(outputs).map(id=>edge('consolidar_lote',id,`out_${id}`,'value'))]};
  const defaults={...inputs,modelo:'gpt-4.1-mini-2025-04-14'};
  const names=Object.keys(defaults);
  project.graphs.analisar_lote={metadata:{id:'analisar_lote',name:'analisar_lote',description:'S2.5: segmentar, conferir todas as entradas, executar sequencialmente e consolidar. Validado em lote pequeno; carteira completa em S3.'},nodes:[
    ...Object.entries(defaults).map(([id,value],i)=>({...typedInput(id,'string',value),visualData:{x:0,y:180*i,width:320}})),
    node('code','preparar_lote',{inputNames:names,outputNames:['tarefas','identidades'],code:entryHelpers+`\nfunction prepararSentenca(inputs){\n${preparation}\n}\n`+await readFile('rivet/code/s2/preparar-lote.js','utf8')},440,0,'Conferir e separar todas as entradas'),
    node('enterSequentialSubgraph','executar_itens',{graphId:'analisar_carteira'},880,0,'Executar o mesmo grafo para cada sentença'),
    node('subGraph','consolidacao_lote',{graphId:'s2_consolidacao_lote',useErrorOutput:false},1320,0,'Consolidar resultados'),
    ...Object.entries(outputs).map(([id,type],i)=>({...typedOutput(id,type),visualData:{x:1760,y:180*i,width:320}}))],
    connections:[...names.map(id=>edge(id,'data','preparar_lote',id)),edge('preparar_lote','tarefas','executar_itens','tarefas'),
      edge('preparar_lote','identidades','consolidacao_lote','identidades'),edge('executar_itens','resultados','consolidacao_lote','resultados'),
      edge('data_referencia','data','consolidacao_lote','data_referencia'),...Object.keys(outputs).map(id=>edge('consolidacao_lote',id,`out_${id}`,'value'))]};
  // Interfaces legíveis no aplicativo, sem nós empilhados na mesma posição.
  for(const id of ['s2_calendario','s2_consolidacao_lote']) {
    for(const type of ['graphInput','graphOutput']) project.graphs[id].nodes.filter(n=>n.type===type).forEach((n,i)=>{n.visualData.y=i*180;});
  }

}
