// Datas civis: sem fuso horário, Date.parse, dias/30 ou clamping de fim de mês.
function mesesCompletos(citacao, referencia) {
  function partes(texto) {
    if(typeof texto!=='string' || !/^\d{4}-\d{2}-\d{2}$/.test(texto)) throw new Error('DATA_INVALIDA: formato civil esperado');
    const [ano,mes,dia]=texto.split('-').map(Number);
    const bissexto=ano%4===0 && (ano%100!==0 || ano%400===0);
    const dias=[31,bissexto?29:28,31,30,31,30,31,31,30,31,30,31];
    if(ano<1 || mes<1 || mes>12 || dia<1 || dia>dias[mes-1]) throw new Error('DATA_INVALIDA: data inexistente');
    return [ano,mes,dia];
  }
  const [yc,mc,dc]=partes(citacao),[yr,mr,dr]=partes(referencia);
  if(citacao>referencia) throw new Error('DATA_FUTURA: citação posterior à referência');
  return 12*(yr-yc)+mr-mc-(dr<dc?1:0);
}
