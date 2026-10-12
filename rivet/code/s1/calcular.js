// Vitória validada não passa pelas fórmulas de atualização ou benefício.
// calcularCondenacao incorpora o Code Node financeiro S0 sem alterar suas regras.
if (inputs.parametros.value.sem_condenacao === true) {
  return { resultado: { type: 'object', value: {
    principal_corrigido_centavos: 0, juros_centavos: 0, valor_atualizado_centavos: 0,
    beneficio_esperado_centavos: null, decisao_recurso: 'nao_recorrer', memoria: null,
  } } };
}
if (inputs.parametros.value.pendente) return {resultado:{type:'object',value:{
  principal_corrigido_centavos:null,juros_centavos:null,valor_atualizado_centavos:null,
  beneficio_esperado_centavos:null,decisao_recurso:'pendente',memoria:null}}};
let resultado;
try {resultado=calcularCondenacao(inputs);}
catch(error) {
  if(error.message!=='Inteiro inseguro') throw error;
  return {resultado:{type:'object',value:{principal_corrigido_centavos:null,juros_centavos:null,valor_atualizado_centavos:null,
    beneficio_esperado_centavos:null,decisao_recurso:'pendente',memoria:null,
    falha_calculo:{codigo:'VALOR_FORA_INTERVALO',mensagem:'Cálculo excede o intervalo seguro de centavos; revisar antes de decidir.'}}}};
}
if (inputs.parametros.value.sem_decisao) {
  resultado.resultado.value.beneficio_esperado_centavos=null;
  resultado.resultado.value.decisao_recurso='pendente';
  for (const key of Object.keys(resultado.resultado.value.memoria)) if (key.startsWith('beneficio_')) delete resultado.resultado.value.memoria[key];
}
return resultado;
