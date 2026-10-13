const ids=inputs.identidades.value,resultados=inputs.resultados.value;
if(!Array.isArray(ids) || !ids.length || new Set(ids).size!==ids.length || resultados.length!==ids.length) throw new Error('RECONCILIACAO: quantidade ou identidade inválida');
const processos=[],auditoria=[];
for(let i=0;i<ids.length;i++) {
  const r=resultados[i];
  if(r.processos?.length!==1 || r.auditoria?.length!==1 || r.processos[0].numero_processo!==ids[i] || r.auditoria[0].numero_processo!==ids[i]) throw new Error('RECONCILIACAO: processo ausente, duplicado ou divergente');
  processos.push(r.processos[0]);auditoria.push(r.auditoria[0]);
}
const resumo=resumirProcessos(processos,inputs.data_referencia.value);
const excluidosFinanceiros=processos.filter(p=>p.valor_atualizado_centavos===null).map(p=>p.numero_processo);
const excluidosDecisao=processos.filter(p=>p.decisao_recurso==='pendente').map(p=>p.numero_processo);
//__RELATORIO__
return {processos:{type:'object[]',value:processos},resumo:{type:'object',value:resumo},auditoria:{type:'object[]',value:auditoria},relatorio_markdown:{type:'string',value:executivo}};
