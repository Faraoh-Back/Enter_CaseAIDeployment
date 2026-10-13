// Auditoria externa contra pré-anotações e frações Python; não integra regras do pipeline.
export function auditarCarteira(records,processos,auditoria) {
 const diffs=[],fields=['resultado_sentenca','danos_materiais_centavos','danos_morais_centavos','mes_base_correcao','data_citacao','classe_processual','comarca'];
 const moneyFields=['valor_condenacao_centavos','status_subsidios','meses_completos','principal_corrigido_centavos','juros_centavos','valor_atualizado_centavos','probabilidade_reversao_percentual','custo_recurso_centavos','beneficio_esperado_centavos','decisao_recurso','motivo_decisao'];
 for(const r of records) {
  const ps=processos.filter(p=>p.numero_processo===r.numero_processo),as=auditoria.filter(a=>a.numero_processo===r.numero_processo),p=ps[0],a=as[0];
  if(ps.length!==1||as.length!==1){diffs.push({numero_processo:r.numero_processo,campo:'identidade',esperado:'uma linha e uma auditoria',recebido:[ps.length,as.length]});continue;}
  const compare=(campo,esperado,recebido)=>{if(esperado!==recebido)diffs.push({numero_processo:r.numero_processo,campo,esperado,recebido:recebido??null});};
  fields.forEach(k=>compare(k,r.extracao_esperada[k],p[k]));moneyFields.forEach(k=>compare(k,r.calculo_esperado[k],p[k]));
  compare('status_processamento','ok',p.status_processamento);
  for(const [k,v] of Object.entries(p.evidencias)) if(v!==null&&!r.sentenca.includes(v))diffs.push({numero_processo:r.numero_processo,campo:`evidencias.${k}`,esperado:'trecho literal',recebido:v});
  const expected=r.calculo_esperado.memoria,actual=a.memoria;
  if(expected) for(const kind of ['total','beneficio']) {
   try {
    if(BigInt(actual[`${kind}_numerador`])*BigInt(expected[`${kind}_exato_denominador`])!==BigInt(expected[`${kind}_exato_numerador`])*BigInt(actual[`${kind}_denominador`]))diffs.push({numero_processo:r.numero_processo,campo:`memoria.${kind}`,esperado:'fração equivalente ao oráculo',recebido:actual});
   } catch {diffs.push({numero_processo:r.numero_processo,campo:`memoria.${kind}`,esperado:'fração válida',recebido:actual});}
  } else compare('memoria',null,actual);
 }
 const ids=new Set(records.map(r=>r.numero_processo));
 for(const p of processos)if(!ids.has(p.numero_processo))diffs.push({numero_processo:p.numero_processo,campo:'identidade_extra'});
 const losses=processos.filter(p=>['procedencia','parcial_procedencia'].includes(p.resultado_sentenca));
 return {estado:diffs.length?'divergencias':'aprovada',referencias:records.length,processos:processos.length,condenacoes:losses.length,divergencias:diffs,
  revisao_prioritaria:{maiores_valores:[...losses].sort((a,b)=>(b.valor_atualizado_centavos??0)-(a.valor_atualizado_centavos??0)).slice(0,10).map(p=>({numero_processo:p.numero_processo,valor_atualizado_centavos:p.valor_atualizado_centavos})),
   perto_do_limiar:[...losses].filter(p=>p.beneficio_esperado_centavos!==null).sort((a,b)=>Math.abs(a.beneficio_esperado_centavos)-Math.abs(b.beneficio_esperado_centavos)).slice(0,10).map(p=>({numero_processo:p.numero_processo,beneficio_esperado_centavos:p.beneficio_esperado_centavos})),
   retentativas:auditoria.filter(a=>a.tentativas>1).map(a=>({numero_processo:a.numero_processo,tentativas:a.tentativas,estados:a.historico_tentativas.map(h=>h.estado)}))},
  limite:'Pré-anotação dos dispositivos e revisão assistida por IA; sem segunda revisão humana independente. Fundamentos e associação de temas exigem avaliação semântica separada.'};
}
