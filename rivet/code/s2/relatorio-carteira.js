// Todas as distribuições e recomendações do relatório são produzidas no grafo.
const escapeCell=value=>String(value??'não identificado').replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
function distribuir(campo) {
  const keys=[...new Set(processos.map(p=>p[campo]??'não identificado'))].sort();
  return keys.map(grupo=>{
    const linhas=processos.filter(p=>(p[campo]??'não identificado')===grupo);
    const r=resumirProcessos(linhas,resumo.data_referencia);
    return {grupo,total:r.total_identificado,vitorias:r.vitorias_confirmadas,condenacoes:r.condenacoes,desconhecidos:r.resultados_desconhecidos,
      resultados_conhecidos:r.total_identificado-r.resultados_desconhecidos,valores_conhecidos:r.processos_com_valor_atualizado,
      passivo_centavos:r.passivo_centavos,decisoes_concluidas:r.decisoes_concluidas,recursos_recomendados:r.recursos_recomendados};
  });
}
resumo.distribuicoes={resultados:distribuir('resultado_sentenca'),subsidios:distribuir('status_subsidios'),temas:distribuir('tema'),comarcas:distribuir('comarca'),tribunais:distribuir('tribunal')};
if(!validateResumo(resumo))throw new Error('SAIDA_INVALIDA: distribuições de carteira');
const tabela=linhas=>[
 '| Grupo | Total | Vitórias / resultados conhecidos | Desconhecidos | Passivo conhecido | Cobertura financeira |',
 '| --- | ---: | --- | ---: | ---: | --- |',
 ...linhas.map(g=>`| ${escapeCell(g.grupo)} | ${g.total} | ${g.vitorias}/${g.resultados_conhecidos} | ${g.desconhecidos} | ${reais(g.passivo_centavos)} | ${g.valores_conhecidos}/${g.total} |`),
].join('\n');
const selecionados=processos.filter(p=>p.decisao_recurso==='recorrer').sort((a,b)=>b.beneficio_esperado_centavos-a.beneficio_esperado_centavos||a.numero_processo.localeCompare(b.numero_processo));
const maiores=[...processos].filter(p=>p.valor_atualizado_centavos!==null&&p.valor_atualizado_centavos>0).sort((a,b)=>b.valor_atualizado_centavos-a.valor_atualizado_centavos||a.numero_processo.localeCompare(b.numero_processo)).slice(0,10);
const executivo=[
 '# Relatório executivo — análise de sentenças','',
 '## Síntese e ações','',
 `Data-base: ${resumo.data_referencia}. Processos identificados: ${resumo.total_identificado}.`,
 `Passivo ${resumo.passivo_parcial?'parcial conhecido':'conhecido completo para este lote'}: **${reais(resumo.passivo_centavos)}**.`,
 textoCobertura(resumo),
 `Êxito pela definição do case: ${resumo.vitorias_confirmadas}/${resumo.total_identificado}; resultados desconhecidos: ${resumo.resultados_desconhecidos}.`,
 `Recursos recomendados: ${resumo.recursos_recomendados}; custo: ${reais(resumo.custo_recursos_centavos)}; benefício líquido esperado: ${reais(resumo.beneficio_esperado_recursos_centavos)}.`,
 `Ação: avaliar os ${resumo.recursos_recomendados} recursos selecionados economicamente e revisar ${resumo.decisoes_pendentes} decisões pendentes antes de decidir.`,
 ...(auditoria.some(a=>a.memoria?.beneficio_residual_positivo)?['Há recurso com benefício exato positivo inferior a meio centavo; a apresentação arredondada é zero. A decisão usa o sinal exato registrado na auditoria.']:[]),
 'Custos e benefícios somam apenas recursos recomendados; são estimativas sob reversão integral, não economia realizada.','',
 '## Resultado, subsídios e temas','',
 'Êxito inclui improcedência e extinção conforme o case. Extinção sem mérito não comprova encerramento definitivo da exposição. As tabelas distinguem a carteira total de resultados conhecidos; nenhuma divisão com denominador zero é interpretada como taxa observada.','',
 '### Resultados','',tabela(resumo.distribuicoes.resultados),'',
 '### Subsídios — associação observada','',tabela(resumo.distribuicoes.subsidios),'',
 'As proporções por subsídio são descritivas. Não demonstram que a documentação causou o resultado; tema, composição dos casos e seleção podem explicar diferenças. Resultados desconhecidos são excluídos do denominador condicional e exibidos separadamente.','',
 '### Temas','',tabela(resumo.distribuicoes.temas),'',
 '### Comarcas','',tabela(resumo.distribuicoes.comarcas),'',
 ...(resumo.distribuicoes.comarcas.filter(g=>g.grupo!=='não identificado').length===1?['Há uma única comarca identificada neste lote; não existe contraste entre comarcas para sustentar comparação.','']:[]),
 '### Tribunais','',tabela(resumo.distribuicoes.tribunais),'',
 '## Estratégia econômica de recursos','',
 'Probabilidades são cenários fornecidos: completos 80%, essenciais 50%, ausentes 10%; não são probabilidades calibradas por esta carteira. Benefício esperado = probabilidade × valor atualizado − custo. O sinal exato determina a recomendação, inclusive no empate; o valor apresentado é arredondado.','',
 '| Processo | Subsídios | Probabilidade | Atualizado | Custo | Benefício esperado |',
 '| --- | --- | ---: | ---: | ---: | ---: |',
 ...selecionados.map(p=>`| ${p.numero_processo} | ${escapeCell(p.status_subsidios)} | ${p.probabilidade_reversao_percentual}% | ${reais(p.valor_atualizado_centavos)} | ${reais(p.custo_recurso_centavos)} | ${reais(p.beneficio_esperado_centavos)} |`),
 ...(!selecionados.length?['Nenhum recurso foi selecionado economicamente neste lote.']:[]),'',
 'Recomendações dependem de reversão integral e dos custos informados. Prazo, admissibilidade, reforma parcial e custos adicionais não foram avaliados. Conferir juridicamente antes de agir.','',
 '## Maiores exposições conhecidas','',
 '| Processo | Valor atualizado | Decisão |','| --- | ---: | --- |',
 ...maiores.map(p=>`| ${p.numero_processo} | ${reais(p.valor_atualizado_centavos)} | ${p.decisao_recurso} |`),'',
 '## Cobertura e pendências','',
 `Excluídos do passivo por valor desconhecido: ${excluidosFinanceiros.join(', ')||'nenhum'}.`,
 `Excluídos da decisão econômica por pendência: ${excluidosDecisao.join(', ')||'nenhum'}.`,
 'Zero na soma não substitui um valor desconhecido. Vitórias validadas contribuem com zero conhecido.','',
 '| Processo | Estado | Atualizado | Decisão | Problemas |','| --- | --- | --- | --- | --- |',
 ...processos.map(p=>`| ${p.numero_processo} | ${p.status_processamento} | ${reais(p.valor_atualizado_centavos)} | ${p.decisao_recurso} | ${p.problemas.map(x=>x.codigo).join(', ')||'nenhum'} |`),'',
 'Escopo: somente o lote informado. Um lote de desenvolvimento não representa a carteira completa. Grupos pequenos não sustentam generalização; as associações observadas não são causalidade. A auditoria acompanha evidências, tentativas e frações; campos não confirmados exigem revisão.',
].join('\n');
