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
// Segmentação única para a sentença e para o lote; nunca truncar silenciosamente.
function segmentarSentencas(value) {
  const text=value.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
  const pieces=text.split(/={20,}\nProcesso nº ([\d.\-]+)\n={20,}\n/);
  if(pieces.length<3 || pieces[0].trim()) fail('Entrada vazia ou sem sentença delimitada');
  const ids=pieces.filter((_,i)=>i%2===1);
  if(new Set(ids).size!==ids.length) fail('Identidade duplicada entre blocos');
  return ids.map((numero,i)=>({numero,sentenca:pieces[2*i+2].trim()}));
}
