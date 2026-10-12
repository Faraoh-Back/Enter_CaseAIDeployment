// validateProcesso e validateResumo vêm dos schemas canônicos compilados no build.
const { memoria, ...financeiro } = inputs.calculo.value;
const referencias = inputs.preparado.value;
const extraction = inputs.extracao.value;
const processo = { ...inputs.base.value, ...financeiro,
  motivo_decisao: financeiro.decisao_recurso === 'recorrer' ? 'beneficio_positivo' : 'beneficio_nao_positivo' };
if (!validateProcesso(processo)) throw new Error(`SAIDA_INVALIDA: processo: ${JSON.stringify(validateProcesso.errors)}`);
const recomendar = processo.decisao_recurso === 'recorrer';
const resumo = { data_referencia: referencias.referencia, total_identificado: 1, vitorias_confirmadas: 0,
  resultados_desconhecidos: 0, condenacoes: 1, processos_aptos: 1, pendencias: 0,
  passivo_centavos: processo.valor_atualizado_centavos, recursos_recomendados: recomendar ? 1 : 0,
  custo_recursos_centavos: recomendar ? processo.custo_recurso_centavos : 0,
  beneficio_esperado_recursos_centavos: recomendar ? processo.beneficio_esperado_centavos : 0 };
if (!validateResumo(resumo)) throw new Error(`SAIDA_INVALIDA: resumo: ${JSON.stringify(validateResumo.errors)}`);
// Não transportar estimativas de custo do SDK como cobrança medida.
const usage = inputs.uso?.value;
const tokens = usage && Number.isSafeInteger(usage.total_tokens) ? {
  entrada: usage.prompt_tokens, saida: usage.completion_tokens, total: usage.total_tokens,
} : null;
const auditoria = [{ numero_processo: processo.numero_processo, extracao: extraction,
  resposta_original: inputs.resposta.value, indice_base: referencias.indices[extraction.mes_base_correcao].numero_indice,
  indice_final: referencias.indices[referencias.referencia.slice(0, 7)].numero_indice,
  tentativas: 1, versao_extrator: 's1.2-v1', modelo_solicitado: inputs.modelo.value,
  tokens, custo_monetario: null, memoria }];
function reais(cents) {
  const abs = BigInt(cents < 0 ? -cents : cents);
  const whole = (abs / 100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${cents < 0 ? '-' : ''}R$ ${whole},${(abs % 100n).toString().padStart(2, '0')}`;
}
const report = [
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
