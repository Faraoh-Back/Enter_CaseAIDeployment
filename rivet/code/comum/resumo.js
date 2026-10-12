function resumirProcessos(processos, referencia) {
  const ids=new Set();
  for(const p of processos) {
    if(!validateProcesso(p)) throw new Error(`SAIDA_INVALIDA: processo: ${JSON.stringify(validateProcesso.errors)}`);
    if(ids.has(p.numero_processo)) throw new Error('SAIDA_INVALIDA: identidade duplicada');
    ids.add(p.numero_processo);
    if(p.status_processamento!=='ok' && p.decisao_recurso!=='pendente') throw new Error('SAIDA_INVALIDA: pendência com decisão concluída');
  }
  const soma = (linhas, campo) => {
    const total=linhas.reduce((acc,p)=>acc+BigInt(p[campo]),0n);
    if(total>BigInt(Number.MAX_SAFE_INTEGER) || total<0n) throw new Error(`TOTAL_INSEGURO: ${campo}`);
    return Number(total);
  };
  const conhecidas=processos.filter(p=>p.valor_atualizado_centavos!==null);
  const decisoes=processos.filter(p=>p.decisao_recurso!=='pendente');
  const recomendados=processos.filter(p=>p.decisao_recurso==='recorrer');
  for(const p of recomendados) if(p.custo_recurso_centavos===null || p.beneficio_esperado_centavos===null) throw new Error('SAIDA_INVALIDA: recomendação incompleta');
  const count=predicate=>processos.filter(predicate).length;
  const resumo={data_referencia:referencia,total_identificado:processos.length,
    vitorias_confirmadas:count(p=>['improcedencia','extincao'].includes(p.resultado_sentenca)),
    resultados_desconhecidos:count(p=>p.resultado_sentenca===null),condenacoes:count(p=>['procedencia','parcial_procedencia'].includes(p.resultado_sentenca)),
    processos_aptos:count(p=>p.status_processamento==='ok'),pendencias:count(p=>p.status_processamento!=='ok'),
    passivo_centavos:soma(conhecidas,'valor_atualizado_centavos'),recursos_recomendados:recomendados.length,
    custo_recursos_centavos:soma(recomendados,'custo_recurso_centavos'),beneficio_esperado_recursos_centavos:soma(recomendados,'beneficio_esperado_centavos'),
    processos_com_valor_atualizado:conhecidas.length,processos_sem_valor_atualizado:processos.length-conhecidas.length,
    decisoes_concluidas:decisoes.length,decisoes_pendentes:processos.length-decisoes.length,passivo_parcial:conhecidas.length!==processos.length};
  if(!validateResumo(resumo)) throw new Error(`SAIDA_INVALIDA: resumo: ${JSON.stringify(validateResumo.errors)}`);
  return resumo;
}
function textoCobertura(r) {
  return `Cobertura financeira: ${r.processos_com_valor_atualizado}/${r.total_identificado} valores atualizados conhecidos; ${r.processos_sem_valor_atualizado} excluídos. Cobertura decisória: ${r.decisoes_concluidas}/${r.total_identificado} decisões concluídas; ${r.decisoes_pendentes} pendentes.`;
}
function reais(cents) {
  if(cents===null) return 'desconhecido';
  const abs=BigInt(cents<0?-cents:cents);
  const whole=(abs/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.');
  return `${cents<0?'-':''}R$ ${whole},${(abs%100n).toString().padStart(2,'0')}`;
}
