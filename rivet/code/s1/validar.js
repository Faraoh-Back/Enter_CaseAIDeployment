// validateSchema e validarSemanticaS0 são incorporados pelo build, sem imports no runtime.
const referencias = inputs.preparado.value;
let extraction;
try { extraction = JSON.parse(inputs.resposta.value); }
catch { throw new Error('EXTRACAO_INVALIDA: resposta não é JSON completo'); }
const validation = validarSemanticaS0({ extracao: { value: extraction }, sentenca: { value: referencias.sentenca } }).validacao.value;
if (!validation.apto_calculo) throw new Error(`EXTRACAO_INVALIDA: ${validation.problemas.join('; ')}`);
if (extraction.numero_processo !== referencias.numero) throw new Error('EXTRACAO_INVALIDA: CNJ divergente da entrada');
const vitoria = ['improcedencia','extincao'].includes(extraction.resultado_sentenca);
const { valor_total_explicito_centavos, ...base } = extraction;
Object.assign(base, { tribunal: referencias.custo.tribunal, status_processamento: 'ok', problemas: [],
  status_subsidios: referencias.status_subsidios, probabilidade_reversao_percentual: referencias.probabilidade });
if (vitoria) {
  Object.assign(base, { valor_condenacao_centavos: 0, meses_completos: null, custo_recurso_centavos: null });
  return { base: { type: 'object', value: base }, extracao: { type: 'object', value: extraction },
    parametros: { type: 'object', value: { sem_condenacao: true } } };
}
const dispositivo = referencias.sentenca.split(/Ante o exposto,/i)[1];
if (!dispositivo) throw new Error('EXTRACAO_INVALIDA: dispositivo não localizado');
// Conferência independente no dispositivo inteiro impede aceitar evidência recortada que omita um dano.
for (const [field, kind] of [['danos_materiais_centavos','materiais'],['danos_morais_centavos','morais']]) {
  const found = [...dispositivo.matchAll(/R\$\s*([\d.]+),(\d{2}) a título de danos (materiais|morais)/g)].filter(m => m[3] === kind);
  if (found.length > 1) throw new Error('EXTRACAO_INVALIDA: composição ambígua');
  const value = found.length ? BigInt(found[0][1].replaceAll('.', '')) * 100n + BigInt(found[0][2]) : 0n;
  if (value !== BigInt(extraction[field])) throw new Error(`EXTRACAO_INVALIDA: ${field} diverge do dispositivo`);
}
// Nesta redação do lote, não há total agregado expresso; a LLM não deve inventar sua soma.
if (extraction.valor_total_explicito_centavos !== null) throw new Error('ESCOPO_S1: total explícito exige revisão; componentes são somados pelo grafo');
const index = referencias.indices[extraction.mes_base_correcao];
if (!index) throw new Error('REFERENCIA_AUSENTE: índice-base');
const [year, month, day] = extraction.data_citacao.split('-').map(Number);
const [refYear, refMonth, refDay] = referencias.referencia.split('-').map(Number);
const meses = 12 * (refYear - year) + refMonth - month - (refDay < day ? 1 : 0);
if (meses < 0) throw new Error('EXTRACAO_INVALIDA: citação posterior à referência');
const total = extraction.danos_materiais_centavos + extraction.danos_morais_centavos;
if (!Number.isSafeInteger(total) || total <= 0) throw new Error('EXTRACAO_INVALIDA: condenação deve ser positiva e segura');
Object.assign(base, { valor_condenacao_centavos: total, meses_completos: meses, custo_recurso_centavos: referencias.custo.centavos });
return {
  base: { type: 'object', value: base },
  extracao: { type: 'object', value: extraction },
  parametros: { type: 'object', value: { condenacao_centavos: total,
    indice_base: BigInt(index.numero_indice.replace('.', '')).toString(),
    indice_final: BigInt(referencias.indices[referencias.referencia.slice(0, 7)].numero_indice.replace('.', '')).toString(),
    meses, probabilidade_percentual: referencias.probabilidade, custo_centavos: referencias.custo.centavos } },
};
