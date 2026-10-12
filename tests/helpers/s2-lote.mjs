import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {entradasS1} from '../../scripts/s1-fixture.mjs';
const golden=JSON.parse(await readFile('tests/fixtures/golden/desenvolvimento.json','utf8'));
const block = r => `${'='.repeat(30)}\nProcesso nº ${r.numero_processo}\n${'='.repeat(30)}\n${r.sentenca}\n`;
export async function loteMisto() {
  const losses=golden.filter(r=>r.calculo_esperado.valor_condenacao_centavos>0);
  const rec=losses.find(r=>r.calculo_esperado.decisao_recurso==='recorrer');
  const others=losses.filter(r=>r!==rec);
  const wins=golden.filter(r=>r.extracao_esperada.resultado_sentenca==='improcedencia');
  const ext=golden.find(r=>r.extracao_esperada.resultado_sentenca==='extincao');
  const records=structuredClone([rec,wins[0],others[0],others[1],wins[1],wins[2],ext]);
  const [y,m,d]=records[2].extracao_esperada.data_citacao.split('-');
  records[2].sentenca=records[2].sentenca.replace(`citação (${d}/${m}/${y})`,'citação, sem data informada');
  for(const [k,v] of Object.entries(records[2].extracao_esperada.evidencias)) if(typeof v==='string') records[2].extracao_esperada.evidencias[k]=v.replace(`citação (${d}/${m}/${y})`,'citação, sem data informada');
  records[2].sentenca_original_sha256=records[2].sentenca_sha256;
  records[2].sentenca_sha256=createHash('sha256').update(records[2].sentenca).digest('hex');
  records[2].mutacao_sintetica='Data da citação removida do texto e de suas evidências';
  records[2].extracao_esperada.data_citacao=null;records[2].extracao_esperada.evidencias.data_citacao=null;
  const raw=await entradasS1();
  raw.processos_texto=records.map(block).join('');
  raw.subsidios_texto='numero_processo,status_subsidios\n'+records.filter((_,i)=>i!==3).map(r=>`${r.numero_processo},${r.calculo_esperado.status_subsidios}`).join('\n')+'\n';
  const answers=Object.fromEntries(records.map((r,i)=>[r.numero_processo,i===4?'{':i===5?{http:503}:r.extracao_esperada]));
  return {raw,records,answers,expected:{passivo:rec.calculo_esperado.valor_atualizado_centavos+others[1].calculo_esperado.valor_atualizado_centavos,
    custo:rec.calculo_esperado.custo_recurso_centavos,beneficio:rec.calculo_esperado.beneficio_esperado_centavos}};
}
export {block};
// Duas condenações sintéticas derivadas apenas de documentos de desenvolvimento.
export async function loteMonetario({cents=1,base='2.0000',final='1.0000'}={}) {
  const raw=await entradasS1();
  const template=golden.find(r=>r.numero_processo==='3871230-78.2024.8.26.0002');
  const ids=golden.filter(r=>r.calculo_esperado.valor_condenacao_centavos>0).slice(0,2).map(r=>r.numero_processo);
  const money=`${(BigInt(cents)/100n).toString().replace(/\B(?=(\d{3})+(?!\d))/g,'.')},${(BigInt(cents)%100n).toString().padStart(2,'0')}`;
  const records=ids.map(numero=>{
    const text=template.sentenca.replaceAll(template.numero_processo,numero).replace('R$ 6.000,00',`R$ ${money}`).replace('R$ 300,00','R$ 0,00').replace('27/02/2026','31/05/2026');
    const extraction=JSON.parse(JSON.stringify(template.extracao_esperada).replaceAll(template.numero_processo,numero).replaceAll('R$ 6.000,00',`R$ ${money}`).replaceAll('R$ 300,00','R$ 0,00').replaceAll('27/02/2026','31/05/2026'));
    extraction.data_citacao='2026-05-31';extraction.danos_materiais_centavos=cents;extraction.danos_morais_centavos=0;
    return {numero_processo:numero,sentenca:text,extracao_esperada:extraction};
  });
  raw.processos_texto=records.map(block).join('');
  raw.subsidios_texto='numero_processo,status_subsidios\n'+ids.map(id=>`${id},ausentes`).join('\n')+'\n';
  raw.indices_texto=`mes_referencia,numero_indice\n2025-12,${base}\n2026-05,${final}\n`;
  return {raw,records,answers:Object.fromEntries(records.map(r=>[r.numero_processo,r.extracao_esperada]))};
}
