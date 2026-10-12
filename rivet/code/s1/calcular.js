// Vitória validada não passa pelas fórmulas de atualização ou benefício.
// calcularCondenacao incorpora o Code Node financeiro S0 sem alterar suas regras.
if (inputs.parametros.value.sem_condenacao === true) {
  return { resultado: { type: 'object', value: {
    principal_corrigido_centavos: 0, juros_centavos: 0, valor_atualizado_centavos: 0,
    beneficio_esperado_centavos: null, decisao_recurso: 'nao_recorrer', memoria: null,
  } } };
}
return calcularCondenacao(inputs);
