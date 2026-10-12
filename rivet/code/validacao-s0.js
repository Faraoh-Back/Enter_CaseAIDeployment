// validateSchema é compilado do schema canônico e incorporado pelo build.
const data = inputs.extracao.value;
const source = inputs.sentenca.value;
const schemaValido = validateSchema(data);
const problemas = schemaValido ? [] : validateSchema.errors.map(e => `${e.instancePath}: ${e.message}`);
if (schemaValido) {
  const evidence = data.evidencias;
  for (const [field, trecho] of Object.entries(evidence)) {
    if (trecho !== null && !source.includes(trecho)) problemas.push(`Evidencia inexistente: ${field}`);
  }
  if (!evidence.identificacao.includes(data.numero_processo)) problemas.push('Identidade sem suporte');
  const outcomes = {
    procedencia: /JULGO PROCEDENTE/i, parcial_procedencia: /JULGO PARCIALMENTE PROCEDENTE/i,
    improcedencia: /JULGO IMPROCEDENTE/i, extincao: /EXTINTO.*SEM RESOLU[ÇC][ÃA]O (?:DO|DE) M[ÉE]RITO/i,
  };
  if (!data.resultado_sentenca || !outcomes[data.resultado_sentenca].test(evidence.resultado ?? '')) problemas.push('Resultado sem suporte');
  for (const field of ['tema', 'fundamento_decisao']) {
    if (data[field] !== null && evidence[field] === null) problemas.push(`Afirmação sem evidencia: ${field}`);
  }
  const amounts = [data.danos_materiais_centavos, data.danos_morais_centavos];
  if (amounts.some(v => v === null)) problemas.push('Componente monetario desconhecido');
  const sum = amounts.every(v => v !== null) ? amounts[0] + amounts[1] : null;
  if (sum !== null && !Number.isSafeInteger(sum)) problemas.push('Total inseguro');
  if (data.valor_total_explicito_centavos !== null && data.valor_total_explicito_centavos !== sum) problemas.push('Total divergente');
  const condemned = ['procedencia', 'parcial_procedencia'].includes(data.resultado_sentenca);
  if (condemned) {
    for (const field of ['valores', 'mes_base_correcao', 'data_citacao']) {
      if (evidence[field] === null) problemas.push(`Evidencia obrigatoria: ${field}`);
    }
    if (data.mes_base_correcao === null || data.data_citacao === null) problemas.push('Data obrigatoria desconhecida');
    if (data.data_citacao > '2026-05-31' || data.mes_base_correcao > '2026-05') problemas.push('Data futura');
    if (data.data_citacao) {
      const [y, m, d] = data.data_citacao.split('-');
      if (!(evidence.data_citacao ?? '').includes(`citação (${d}/${m}/${y})`)) problemas.push('Citacao sem suporte');
    }
    if (data.mes_base_correcao) {
      const months = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
      const [year, month] = data.mes_base_correcao.split('-');
      if (!(evidence.mes_base_correcao ?? '').includes(`${months[Number(month) - 1]} de ${year} (evento danoso)`)) problemas.push('Mes base sem suporte');
    }
    // Escopo S0: conferir os componentes na redação existente no lote fornecido.
    for (const [field, tipo] of [['danos_materiais_centavos', 'materiais'], ['danos_morais_centavos', 'morais']]) {
      const matches = [...(evidence.valores ?? '').matchAll(/R\$\s*([\d.]+),(\d{2}) a título de danos (materiais|morais)/g)].filter(m => m[3] === tipo);
      const found = matches.map(m => BigInt(m[1].replaceAll('.', '')) * 100n + BigInt(m[2]));
      if (data[field] !== null && (found.length > 1 || (found.length === 1 ? found[0] !== BigInt(data[field]) : data[field] !== 0))) problemas.push(`Componente sem suporte: ${field}`);
    }
  } else if (data.resultado_sentenca !== null) {
    if (sum !== 0 || data.mes_base_correcao !== null || data.data_citacao !== null) problemas.push('Vitoria inconsistente');
  }
}
return { validacao: { type: 'object', value: {
  schema_valido: schemaValido, apto_calculo: schemaValido && problemas.length === 0, problemas,
} } };
