// validateProcesso e validateResumo vêm dos schemas canônicos compilados no build.
const { memoria, ...financeiro } = inputs.calculo.value;
const referencias = inputs.preparado.value;
const extraction = inputs.extracao.value;
const vitoria = ['improcedencia','extincao'].includes(inputs.base.value.resultado_sentenca);
const pendente = inputs.base.value.status_processamento !== 'ok';
const processo = { ...inputs.base.value, ...financeiro,
  motivo_decisao: pendente ? 'revisao_necessaria' : vitoria ? 'sem_condenacao' : financeiro.decisao_recurso === 'recorrer' ? 'beneficio_positivo' : 'beneficio_nao_positivo' };
if (!validateProcesso(processo)) throw new Error(`SAIDA_INVALIDA: processo: ${JSON.stringify(validateProcesso.errors)}`);
const recomendar = processo.decisao_recurso === 'recorrer';
const resumo = { data_referencia: referencias.referencia, total_identificado: 1, vitorias_confirmadas: vitoria ? 1 : 0,
  resultados_desconhecidos: processo.resultado_sentenca===null ? 1 : 0, condenacoes: ['procedencia','parcial_procedencia'].includes(processo.resultado_sentenca)?1:0, processos_aptos: pendente?0:1, pendencias: pendente?1:0,
  passivo_centavos: processo.valor_atualizado_centavos ?? 0, recursos_recomendados: recomendar ? 1 : 0,
  custo_recursos_centavos: recomendar ? processo.custo_recurso_centavos : 0,
  beneficio_esperado_recursos_centavos: recomendar ? processo.beneficio_esperado_centavos : 0 };
if (!validateResumo(resumo)) throw new Error(`SAIDA_INVALIDA: resumo: ${JSON.stringify(validateResumo.errors)}`);
// Não transportar estimativas de custo do SDK como cobrança medida.
const usage = inputs.uso?.value;
const tokens = usage && Number.isSafeInteger(usage.total_tokens) ? {
  entrada: usage.prompt_tokens, saida: usage.completion_tokens, total: usage.total_tokens,
} : null;
const auditoria = [{ numero_processo: processo.numero_processo, extracao: extraction,
  resposta_original: inputs.resposta.value, indice_base: memoria ? referencias.indices[extraction.mes_base_correcao]?.numero_indice ?? null : null,
  indice_final: !memoria ? null : referencias.indices[referencias.referencia.slice(0, 7)].numero_indice,
  tentativas: inputs.controle.value.historico.length, historico_tentativas: inputs.controle.value.historico, versao_extrator: 's2.4-v1', modelo_solicitado: inputs.modelo.value,
  tokens, custo_monetario: null, memoria }];
function reais(cents) {
  const abs = BigInt(cents < 0 ? -cents : cents);
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}R$ ${whole},${(abs % 100n).toString().padStart(2, '0')}`;
}
const report = pendente ? [
  '# Análise de uma sentença — S2', '', `Processo: ${processo.numero_processo}. Data-base: ${resumo.data_referencia}.`,
  `Estado: ${processo.status_processamento}. Decisão pendente de revisão.`,
  ...processo.problemas.map(p=>`${p.codigo}: ${p.mensagem}`),
  `Cobertura: 0/1 processo apto; 1 pendência. Resultados desconhecidos: ${resumo.resultados_desconhecidos}.`,
  `Passivo conhecido: ${reais(resumo.passivo_centavos)}; total parcial. ${processo.valor_atualizado_centavos===null?'Esta sentença foi excluída da soma por atualização desconhecida; zero na soma não significa ausência de exposição.':'Atualização conhecida incluída; decisão de recurso excluída por falta de subsídios.'}`,
  'Recursos recomendados: 0. Custos e benefícios somam apenas recomendações aptas; pendências foram excluídas.',
  'Escopo: uma sentença; revisar dados antes de decidir. Estes números não representam a carteira completa.',
].join('\n') : vitoria ? [
  '# Análise de uma sentença — S2', '',
  `Data-base: ${resumo.data_referencia}. Processo: ${processo.numero_processo}.`, '',
  `Resultado: ${processo.resultado_sentenca}. **Sem condenação** nesta sentença.`,
  'Recomendação econômica segundo o case: **não recorrer**; motivo: sem condenação.',
  'Custo e benefício de recurso: não aplicáveis. Não foi simulado recurso nem calculada atualização monetária.',
  `Subsídios: ${processo.status_subsidios}. A probabilidade da tabela é apenas referência, sem aplicação nesta decisão.`,
  `Passivo desta sentença: **${reais(resumo.passivo_centavos)}**. Recursos recomendados: ${resumo.recursos_recomendados}.`,
  `Cobertura: ${resumo.processos_aptos}/${resumo.total_identificado} processo apto; ${resumo.pendencias} pendências. Êxito pela definição do case: ${resumo.vitorias_confirmadas}/${resumo.total_identificado}; resultados desconhecidos: ${resumo.resultados_desconhecidos}.`,
  ...(extraction.resultado_sentenca === 'extincao' ? ['Extinção sem resolução de mérito não comprova encerramento definitivo de toda exposição.'] : []),
  'Escopo: uma sentença; estes números não representam a carteira completa. Prazos e admissibilidade de recurso não foram avaliados.',
].join('\n') : [
  '# Análise de uma sentença — S1', '',
  `Data-base: ${resumo.data_referencia}. Processo: ${processo.numero_processo}.`, '',
  `Recomendação econômica: **${recomendar ? 'recorrer' : 'não recorrer'}**. Benefício líquido esperado: **${reais(processo.beneficio_esperado_centavos)}**.`, '',
  `Resultado: ${processo.resultado_sentenca}. Condenação original: ${reais(processo.valor_condenacao_centavos)}.`,
  `Principal corrigido: ${reais(processo.principal_corrigido_centavos)}; juros simples (${processo.meses_completos} meses completos): ${reais(processo.juros_centavos)}.`,
  `Passivo atualizado: **${reais(resumo.passivo_centavos)}**.`, '',
  `Subsídios: ${processo.status_subsidios}; probabilidade de reversão: ${processo.probabilidade_reversao_percentual}%; custo do recurso: ${reais(processo.custo_recurso_centavos)}.`,
  `Recursos recomendados: ${resumo.recursos_recomendados}; custo dos recomendados: ${reais(resumo.custo_recursos_centavos)}; benefício esperado dos recomendados: ${reais(resumo.beneficio_esperado_recursos_centavos)}.`, '',
  `Cobertura: ${resumo.processos_aptos}/${resumo.total_identificado} processo apto; ${resumo.pendencias} pendências. Êxito: ${resumo.vitorias_confirmadas}/${resumo.total_identificado}; resultados desconhecidos: ${resumo.resultados_desconhecidos}.`, '',
  'Premissas: reversão integral da condenação; probabilidades e custos fornecidos no case. Benefício esperado é uma estimativa, sem garantia de economia realizada. Prazos, admissibilidade e reforma parcial não são avaliados.',
  'Escopo: uma sentença; estes números não representam a carteira completa.',
  ...(memoria.beneficio_residual_positivo ? ['O benefício exato é positivo, mas inferior a meio centavo; a apresentação arredondada é zero.'] : []),
].join('\n');
return { processos: { type: 'object[]', value: [processo] }, resumo: { type: 'object', value: resumo },
  auditoria: { type: 'object[]', value: auditoria }, relatorio_markdown: { type: 'string', value: report } };
