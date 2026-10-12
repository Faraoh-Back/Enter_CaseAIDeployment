function validarCompleto(inputs) {
// validateSchema e validarSemanticaS0 são incorporados pelo build, sem imports no runtime.
const referencias = inputs.preparado.value;
let extraction;
try { extraction = JSON.parse(inputs.resposta.value); }
catch { throw new Error('EXTRACAO_INVALIDA: resposta não é JSON completo'); }
if (extraction?.numero_processo !== referencias.numero) throw new Error('IDENTIDADE_DIVERGENTE: CNJ divergente da entrada');
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
const meses = mesesCompletos(extraction.data_citacao, referencias.referencia);
const total = extraction.danos_materiais_centavos + extraction.danos_morais_centavos;
if (!Number.isSafeInteger(total) || total <= 0) throw new Error('EXTRACAO_INVALIDA: condenação deve ser positiva e segura');
Object.assign(base, { valor_condenacao_centavos: total, meses_completos: meses, custo_recurso_centavos: referencias.custo.centavos });
return {
  base: { type: 'object', value: base },
  extracao: { type: 'object', value: extraction },
  parametros: { type: 'object', value: { condenacao_centavos: total,
    indice_base: BigInt(index.numero_indice.replace('.', '')).toString(),
    indice_final: BigInt(referencias.indices[referencias.referencia.slice(0, 7)].numero_indice.replace('.', '')).toString(),
    meses, probabilidade_percentual: referencias.probabilidade ?? 0, custo_centavos: referencias.custo.centavos } },
};

}
const referencias = inputs.preparado.value;
const historico = inputs.controle?.value?.historico ?? [];
let resultado;
try {
  resultado = validarCompleto(inputs);
} catch (error) {
  if (error.message.startsWith('REFERENCIA_AUSENTE:')) throw error;
  let original;
  try { original = JSON.parse(inputs.resposta.value); } catch { original = null; }
  if (!original || typeof original!=='object' || Array.isArray(original)) original=null;
  const identidade = original?.numero_processo === referencias.numero;
  const fonte = referencias.sentenca;
  const literal = value => typeof value === 'string' && value.length > 0 && fonte.includes(value);
  const evidence = original?.evidencias;
  const patterns = {procedencia:/JULGO PROCEDENTE/i,parcial_procedencia:/JULGO PARCIALMENTE PROCEDENTE/i,
    improcedencia:/JULGO IMPROCEDENTE/i,extincao:/EXTINTO.*SEM RESOLUÇÃO|EXTINGO.*SEM RESOLUÇÃO/i};
  const resultadoConhecido = identidade && literal(evidence?.resultado) && patterns[original?.resultado_sentenca]?.test(evidence.resultado);
  const base = {numero_processo:referencias.numero, classe_processual:null,comarca:null,resultado_sentenca:resultadoConhecido?original.resultado_sentenca:null,
    danos_materiais_centavos:null,danos_morais_centavos:null,mes_base_correcao:null,data_citacao:null,tema:null,fundamento_decisao:null,
    evidencias:{identificacao:`Processo nº ${referencias.numero}`,resultado:resultadoConhecido?evidence.resultado:null,valores:null,
      mes_base_correcao:null,data_citacao:null,tema:null,fundamento_decisao:null},
    tribunal:referencias.custo.tribunal,status_processamento:'pendente_revisao',problemas:[],
    status_subsidios:referencias.status_subsidios,probabilidade_reversao_percentual:referencias.probabilidade,
    valor_condenacao_centavos:null,meses_completos:null,custo_recurso_centavos:referencias.custo.centavos};
  // Preserva dinheiro somente quando cada componente coincide com o dispositivo inteiro
  // e com uma evidência literal. Um resultado válido não autoriza confiar nos demais campos.
  const dispositivo = fonte.split(/Ante o exposto,/i)[1] ?? '';
  if (resultadoConhecido && literal(evidence?.valores)) {
    for (const [field,kind] of [['danos_materiais_centavos','materiais'],['danos_morais_centavos','morais']]) {
      const matches = [...dispositivo.matchAll(/R\$\s*([\d.]+),(\d{2}) a título de danos (materiais|morais)/g)].filter(m=>m[3]===kind);
      const amount = matches.length===1 ? BigInt(matches[0][1].replaceAll('.',''))*100n+BigInt(matches[0][2]) : 0n;
      if (matches.length<=1 && Number.isSafeInteger(original[field]) && original[field]>=0 && BigInt(original[field])===amount
          && (!matches.length || evidence.valores.includes(matches[0][0]))) base[field]=original[field];
    }
    if (base.danos_materiais_centavos!==null && base.danos_morais_centavos!==null &&
        Number.isSafeInteger(base.danos_materiais_centavos+base.danos_morais_centavos)) {
      base.valor_condenacao_centavos=base.danos_materiais_centavos+base.danos_morais_centavos;
      base.evidencias.valores=evidence.valores;
    }
  }
  let codigo='EXTRACAO_INVALIDA';
  if (original && !identidade) codigo='IDENTIDADE_DIVERGENTE';
  else if (identidade) {
    validateSchema(original);
    if (validateSchema.errors?.some(e=>['format','pattern'].includes(e.keyword) && ['/data_citacao','/mes_base_correcao'].includes(e.instancePath))) codigo='DATA_INVALIDA';
    else if (original.data_citacao>referencias.referencia || original.mes_base_correcao>referencias.referencia.slice(0,7)) codigo='DATA_FUTURA';
    else if (['data_citacao','mes_base_correcao','danos_materiais_centavos','danos_morais_centavos'].some(k=>original[k]==null)) codigo='DADO_AUSENTE';
  }
  if (historico.at(-1)?.estado==='falha_transporte') {codigo='FALHA_TRANSPORTE';base.status_processamento='erro';}
  base.problemas=[{codigo,mensagem:codigo==='FALHA_TRANSPORTE'?'Limite de tentativas de transporte atingido.':error.message}];
  resultado={base:{type:'object',value:base},extracao:{type:'object',value:original??{}},parametros:{type:'object',value:{pendente:true}}};
}
if (resultado.base.value.status_processamento==='ok' && referencias.status_subsidios===null && !resultado.parametros.value.sem_condenacao) {
  resultado.base.value.status_processamento='pendente_revisao';
  resultado.base.value.problemas=[{codigo:'SUBSIDIO_NAO_LOCALIZADO',mensagem:'Não há linha de subsídios para esta identidade; decisão econômica pendente.'}];
  resultado.parametros.value.sem_decisao=true;
}
resultado.avaliacao={type:'object',value:{aprovada:resultado.parametros.value.pendente!==true,
  problemas:resultado.parametros.value.pendente===true?resultado.base.value.problemas:[]}};
return resultado;
