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
const relatorio=[
  '# Análise de lote de desenvolvimento — S2.5','',`Data-base: ${resumo.data_referencia}. Processos identificados: ${resumo.total_identificado}.`,
  `Passivo ${resumo.passivo_parcial?'parcial conhecido':'conhecido completo para este lote'}: **${reais(resumo.passivo_centavos)}**.`,
  textoCobertura(resumo),
  `Êxito pela definição do case: ${resumo.vitorias_confirmadas}/${resumo.total_identificado}; resultados desconhecidos: ${resumo.resultados_desconhecidos}.`,
  `Recursos recomendados: ${resumo.recursos_recomendados}; custo: ${reais(resumo.custo_recursos_centavos)}; benefício líquido esperado: ${reais(resumo.beneficio_esperado_recursos_centavos)}.`,
  ...(auditoria.some(a=>a.memoria?.beneficio_residual_positivo)?['Há recurso com benefício exato positivo inferior a meio centavo; a apresentação arredondada é zero. A decisão usa o sinal exato registrado na auditoria.']:[]),
  'Custos e benefícios somam apenas recursos recomendados; são estimativas sob reversão integral, não economia realizada.',
  `Excluídos do passivo por valor desconhecido: ${excluidosFinanceiros.join(', ')||'nenhum'}.`,
  `Excluídos da decisão econômica por pendência: ${excluidosDecisao.join(', ')||'nenhum'}.`,
  'Zero na soma não substitui um valor desconhecido. Vitórias validadas contribuem com zero conhecido.','',
  '| Processo | Estado | Atualizado | Decisão | Problemas |','| --- | --- | --- | --- | --- |',
  ...processos.map(p=>`| ${p.numero_processo} | ${p.status_processamento} | ${reais(p.valor_atualizado_centavos)} | ${p.decisao_recurso} | ${p.problemas.map(x=>x.codigo).join(', ')||'nenhum'} |`),
  '',
  'Escopo: lote informado para desenvolvimento; não representa a carteira completa. Extinção sem mérito não comprova encerramento definitivo da exposição. Prazos e admissibilidade não foram avaliados.',
].join('\n');
return {processos:{type:'object[]',value:processos},resumo:{type:'object',value:resumo},auditoria:{type:'object[]',value:auditoria},relatorio_markdown:{type:'string',value:relatorio}};
