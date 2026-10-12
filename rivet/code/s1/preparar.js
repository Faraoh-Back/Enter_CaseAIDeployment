// Todas as interpretações e associações das referências ocorrem neste Code Node.
function fail(message) { throw new Error(`ENTRADA_INVALIDA: ${message}`); }
function csv(value, delimiter, headers, key, allowEmpty = false) {
  const text = value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const rows = []; let row = [], cell = '', quoted = false, closed = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (char === '"') { quoted = false; closed = true; }
      else cell += char;
    } else if (char === delimiter || char === '\n') {
      row.push(cell); cell = ''; closed = false;
      if (char === '\n') { if (row.some(v => v !== '')) rows.push(row); row = []; }
    } else if (char === '"' && cell === '' && !closed) quoted = true;
    else if (closed || char === '"') fail('CSV com aspas inválidas');
    else cell += char;
  }
  if (quoted) fail('CSV com aspas abertas');
  if (cell !== '' || row.length || closed) { row.push(cell); rows.push(row); }
  if (JSON.stringify(rows.shift()) !== JSON.stringify(headers)) fail(`Cabeçalho esperado: ${headers.join(delimiter)}`);
  const map = {};
  for (const values of rows) {
    if (values.length !== headers.length) fail('CSV com quantidade de colunas divergente');
    const item = Object.fromEntries(headers.map((h, i) => [h, values[i].trim()]));
    const id = item[key];
    if (!id || Object.hasOwn(map, id) || ['__proto__', 'constructor', 'prototype'].includes(id)) fail(`Chave vazia ou duplicada: ${id}`);
    map[id] = item;
  }
  if (!allowEmpty && !Object.keys(map).length) fail('Referência vazia');
  return map;
}
const text = inputs.processos_texto.value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
const pieces = text.split(/={20,}\nProcesso nº ([\d.\-]+)\n={20,}\n/);
const blockIds = pieces.filter((_, i) => i % 2 === 1);
if (new Set(blockIds).size !== blockIds.length) fail('Identidade duplicada entre blocos');
if (pieces.length !== 3 || pieces[0].trim()) fail('S1 aceita exatamente uma sentença delimitada; nenhum lote será truncado');
const numero = pieces[1], sentenca = pieces[2].trim();
if (!/^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$/.test(numero)) fail('Formato CNJ inválido');
const identities = [...sentenca.matchAll(/Processo nº ([\d.\-]+)/g)].map(m => m[1]);
if (!identities.length || identities.some(id => id !== numero)) fail('Identidade interna divergente');
const referencia = inputs.data_referencia.value;
if (referencia !== '2026-05-31') fail('Data de referência do case deve ser 2026-05-31');
const indices = csv(inputs.indices_texto.value, ',', ['mes_referencia', 'numero_indice'], 'mes_referencia');
for (const [month, row] of Object.entries(indices)) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d+\.\d{4}$/.test(row.numero_indice)) fail('Índice ou mês inválido');
  if (BigInt(row.numero_indice.replace('.', '')) <= 0n) fail('Índice não positivo');
}
if (!indices[referencia.slice(0, 7)]) fail('Índice final ausente');
const custos = csv(inputs.custos_texto.value, ';', ['tribunal','uf','tr_cnj','codigo_cnj_j_tr','media_custos_totais'], 'codigo_cnj_j_tr');
for (const row of Object.values(custos)) {
  if (!/^\d\.\d{2}$/.test(row.codigo_cnj_j_tr) || !row.tribunal || !row.uf || !/^\d+$/.test(row.tr_cnj) || Number(row.codigo_cnj_j_tr.split('.')[1]) !== Number(row.tr_cnj)) fail('Identificação de tribunal inválida');
  if (!/^\d+(?:\.\d{1,2})?$/.test(row.media_custos_totais)) fail('Custo inválido');
  const [whole, fraction = ''] = row.media_custos_totais.split('.');
  const cents = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  if (cents > BigInt(Number.MAX_SAFE_INTEGER)) fail('Custo fora do intervalo seguro');
  row.centavos = Number(cents);
}
const probabilidades = csv(inputs.probabilidades_texto.value, ';', ['status_subsidios','probabilidade_reversao'], 'status_subsidios');
for (const [status, row] of Object.entries(probabilidades)) {
  if (!['completos','essenciais','ausentes'].includes(status) || !/^\d{1,3}%$/.test(row.probabilidade_reversao)) fail('Probabilidade inválida');
  row.percentual = Number(row.probabilidade_reversao.slice(0, -1));
  if (row.percentual > 100) fail('Probabilidade acima de 100%');
}
const subsidios = csv(inputs.subsidios_texto.value, ',', ['numero_processo','status_subsidios'], 'numero_processo', true);
if (Object.keys(subsidios).some(id => id !== numero)) fail('Subsídios devem corresponder exatamente à sentença recebida');
const status = subsidios[numero]?.status_subsidios ?? null;
if (status !== null && !probabilidades[status]) fail('Subsídio ou probabilidade desconhecidos');
const tribunal = numero.split('.').slice(2, 4).join('.');
if (!custos[tribunal]) fail('Custo do tribunal ausente');
return {
  sentenca: { type: 'string', value: sentenca },
  preparado: { type: 'object', value: { numero, sentenca, referencia, indices, custo: custos[tribunal],
    status_subsidios: status, probabilidade: status === null ? null : probabilidades[status].percentual } },
};
