// Executado dentro do Code Node; índices já escalados por 10.000.
const p = inputs.parametros.value;
for (const field of ['condenacao_centavos', 'meses', 'probabilidade_percentual', 'custo_centavos']) {
  if (!Number.isSafeInteger(p[field]) || p[field] < 0) throw new Error(`Parametro invalido: ${field}`);
}
if (p.probabilidade_percentual > 100) throw new Error('Probabilidade maior que 100');
for (const field of ['indice_base', 'indice_final']) {
  if (typeof p[field] !== 'string' || !/^[1-9][0-9]*$/.test(p[field])) throw new Error(`Indice invalido: ${field}`);
}
function rounded(n, d) {
  const sign = n < 0n ? -1n : 1n;
  const abs = n < 0n ? -n : n;
  const value = sign * (abs / d + (2n * (abs % d) >= d ? 1n : 0n));
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < BigInt(Number.MIN_SAFE_INTEGER)) throw new Error('Inteiro inseguro');
  return Number(value);
}
const principalN = BigInt(p.condenacao_centavos) * BigInt(p.indice_final);
const principalD = BigInt(p.indice_base);
const totalN = principalN * (100n + BigInt(p.meses));
const totalD = principalD * 100n;
const principal = rounded(principalN, principalD);
const total = rounded(totalN, totalD);
const beneficioN = BigInt(p.probabilidade_percentual) * BigInt(total) - 100n * BigInt(p.custo_centavos);
return { resultado: { type: 'object', value: {
  principal_corrigido_centavos: principal,
  juros_centavos: total - principal,
  valor_atualizado_centavos: total,
  beneficio_esperado_centavos: rounded(beneficioN, 100n),
  decisao_recurso: beneficioN > 0n ? 'recorrer' : 'nao_recorrer',
  memoria: {
    principal_numerador: principalN.toString(), principal_denominador: principalD.toString(),
    juros_numerador: (principalN * BigInt(p.meses)).toString(), juros_denominador: totalD.toString(),
    total_numerador: totalN.toString(), total_denominador: totalD.toString(),
    beneficio_numerador: beneficioN.toString(), beneficio_denominador: '100',
    beneficio_residual_positivo: beneficioN > 0n && rounded(beneficioN, 100n) === 0,
  },
} } };
