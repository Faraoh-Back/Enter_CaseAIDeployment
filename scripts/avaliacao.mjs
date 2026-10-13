// Avaliação externa: compara anotações, sem participar da análise de produção.
export const camposCriticos=['numero_processo','resultado_sentenca','danos_materiais_centavos','danos_morais_centavos','mes_base_correcao','data_citacao'];
export function avaliarExtracao(records,processos,auditoria) {
 const fields=[...camposCriticos,'classe_processual','comarca','tema'];
 const metrics=Object.fromEntries(fields.map(k=>[k,{corretos:0,total:0,nao_aplicaveis:0}]));
 const casos=records.map(r=>{
  const ps=processos.filter(p=>p.numero_processo===r.numero_processo),as=auditoria.filter(a=>a.numero_processo===r.numero_processo);
  const p=ps.length===1?ps[0]:null,a=as.length===1?as[0]:null,expected=r.extracao_esperada;
  const comparacoes=[];
  for(const field of fields) {
   // Datas em vitórias não são aplicáveis; zero de componentes continua sendo validado.
   if(['mes_base_correcao','data_citacao'].includes(field)&&expected[field]===null){metrics[field].nao_aplicaveis++;continue;}
   const value=a?.extracao?.[field];const correto=value===expected[field];metrics[field].total++;if(correto)metrics[field].corretos++;
   comparacoes.push({campo:field,esperado:expected[field],recebido:value??null,correto});
  }
  return {numero_processo:r.numero_processo,estado:p?.status_processamento??'ausente',tentativas:a?.tentativas??0,
   completo:ps.length===1&&as.length===1&&p.status_processamento==='ok',criticos_corretos:comparacoes.filter(c=>camposCriticos.includes(c.campo)).every(c=>c.correto),comparacoes};
 });
 const extras=processos.filter(p=>!records.some(r=>r.numero_processo===p.numero_processo)).map(p=>p.numero_processo);
 return {total_avaliado:records.length,completos:casos.filter(c=>c.completo).length,criticos_corretos:casos.filter(c=>c.criticos_corretos).length,
  aprovacao_critica:extras.length===0&&casos.every(c=>c.completo&&c.criticos_corretos),extras,campos:metrics,casos,
  limite_fundamento:'Fundamentos podem ser sintetizados: revisão semântica humana necessária; igualdade textual não é métrica de qualidade semântica.'};
}
