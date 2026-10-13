import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
const exec=promisify(execFile);
const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=v=>v===null?'Desconhecido':new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v/100);
const labels={procedencia:'Procedência',parcial_procedencia:'Parcial procedência',improcedencia:'Improcedência',extincao:'Extinção',completos:'Completos',essenciais:'Essenciais',ausentes:'Ausentes',recorrer:'Recorrer',nao_recorrer:'Não recorrer',pendente:'Pendente'};

// Markdown limitado ao template produzido pelo Rivet. Entrada sempre escapada, sem HTML remoto.
function inline(s){return escape(s).replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>');}
export function markdownHtml(md){
 const lines=md.split(/\r?\n/);let result='';
 for(let i=0;i<lines.length;i++){
  const l=lines[i];if(!l.trim())continue;
  if(l.startsWith('|')&&lines[i+1]?.match(/^\|[\s:|\-]+\|$/)){
   const cells=x=>x.trim().slice(1,-1).split('|').map(c=>inline(labels[c.trim()]??c.trim()));
   result+='<table><thead><tr>'+cells(l).map(c=>`<th>${c}</th>`).join('')+'</tr></thead><tbody>';i++;
   while(lines[i+1]?.startsWith('|')){result+='<tr>'+cells(lines[++i]).map(c=>`<td>${c}</td>`).join('')+'</tr>';}
   result+='</tbody></table>';continue;
  }
  const heading=l.match(/^(#{1,3})\s+(.+)$/);
  result+=heading?`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`:`<p>${inline(l)}</p>`;
 }
 return result;
}
function bars(groups,value,label){
 const maximum=Math.max(1,...groups.map(g=>g[value]));
 const height=groups.length*25+12;
 return `<svg role="img" aria-label="${escape(label)}" viewBox="0 0 650 ${height}">`+groups.map((g,i)=>{
  const y=i*25+16,v=g[value],text=value.endsWith('_centavos')?money(v):String(v);
  return `<text x="0" y="${y}">${escape(labels[g.grupo]??g.grupo)}</text><rect x="310" y="${y-10}" width="${v/maximum*210}" height="12" fill="#333"/><text x="535" y="${y}">${escape(text)}</text>`;
 }).join('')+'</svg>';
}
export function relatorioHtml(analise,{fontData,familia='Times New Roman',previa=false}={}){
 const {resumo:r,relatorio_markdown:md}=analise;
 if(!r||typeof md!=='string'||!r.distribuicoes||!fontData)throw new Error('PDF_OUTPUT_INVALIDO');
 // Escala geométrica e apresentação apenas: os indicadores/texto são outputs do Rivet.
 const chunks=md.split(/(?=^## )/m),get=name=>chunks.find(s=>s.startsWith(`## ${name}`))??'';
 const groups=get('Resultado, subsídios e temas');
 const topics=groups.slice(groups.indexOf('### Temas'));
 const early=groups.slice(0,groups.indexOf('### Temas'));
 return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Relatório executivo — carteira</title><style>
 @font-face{font-family:Relatorio;src:url(data:font/ttf;base64,${fontData})}*{box-sizing:border-box}body{font-family:Relatorio,serif;color:#111;background:white;font-size:9pt;line-height:1.28;margin:0}
 @page{size:A4;margin:13mm 12mm}h1{font-size:21pt;font-weight:normal;line-height:1.1;margin:0 0 4mm}h2{font-size:14pt;font-weight:normal;border-bottom:1px solid #222;padding-bottom:2mm;margin:5mm 0 2mm}h3{font-size:11pt;margin:3mm 0 2mm}p{margin:2mm 0}table{width:100%;border-collapse:collapse;font-size:8pt;margin:3mm 0;table-layout:auto}th{font-weight:bold;border-bottom:1px solid #222;text-align:left}th,td{padding:1.5mm 1mm;vertical-align:top}td{border-bottom:.3pt solid #ccc}tr{break-inside:avoid}thead{display:table-header-group}th:not(:first-child),td:not(:first-child){text-align:right}section{break-before:page}section:first-of-type{break-before:auto}.kpis{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid;border-bottom:1px solid;padding:3mm 0;margin:3mm 0}.kpi span{display:block;font-size:8pt}.kpi strong{display:block;font-size:14pt;font-weight:normal;margin-top:1mm}.eyebrow{font-size:8pt;text-transform:uppercase;letter-spacing:.8pt}.caption{font-size:8pt;color:#333}.chart{margin:3mm 0}svg{width:100%;font-family:Relatorio,serif;font-size:12px}footer{font-size:8pt;border-top:1px solid;margin-top:4mm;padding-top:2mm}h2,h3{break-after:avoid}strong{font-weight:bold}
 </style></head><body data-font="${escape(familia)}" data-previa="${previa}">
 <section><p class="eyebrow">Carteira judicial · Data-base ${escape(r.data_referencia)}</p><h1>Relatório executivo</h1>
 ${previa?'<p><strong>Prévia tipográfica — fonte substituta. Não é a versão final solicitada.</strong></p>':''}
 <div class="kpis">${[['Processos',r.total_identificado],['Vitórias',`${r.vitorias_confirmadas}/${r.total_identificado}`],['Passivo conhecido',money(r.passivo_centavos)],['Recursos selecionados',r.recursos_recomendados]].map(([l,v])=>`<div class="kpi"><span>${escape(l)}</span><strong>${escape(v)}</strong></div>`).join('')}</div>
 ${markdownHtml(get('Síntese e ações'))}<div class="chart"><h3>Distribuição dos resultados · processos</h3>${bars(r.distribuicoes.resultados,'total','Quantidade por resultado')}</div>${markdownHtml(early)}
 </section><section>${markdownHtml(topics)}<div class="chart"><h3>Exposição por subsídios · reais atualizados</h3>${bars(r.distribuicoes.subsidios,'passivo_centavos','Passivo conhecido por subsídios')}</div>
 </section><section>${markdownHtml(get('Estratégia econômica de recursos'))}
 </section><section>${markdownHtml(get('Conclusões'))}${markdownHtml(get('Maiores exposições conhecidas'))}${markdownHtml(get('Cobertura e pendências'))}<footer>Fonte: outputs do projeto Rivet. Data-base ${escape(r.data_referencia)}. Valores esperados dependem das premissas descritas; a planilha e os JSONs preservam o detalhamento por processo.</footer></section></body></html>`;
}
export async function carregarFonte({fonte=process.env.REPORT_FONT,familia='Times New Roman',previa=false}={}){
 if(!fonte)throw new Error('PDF_FONTE_AUSENTE: informe REPORT_FONT com o arquivo Times New Roman .ttf');
 const {stdout}=await exec('fc-scan',['--format','%{family}',fonte]);
 if(!stdout.split(',').map(s=>s.trim()).includes(familia))throw new Error(`PDF_FONTE_DIVERGENTE: arquivo não contém ${familia}`);
 if(familia!=='Times New Roman'&&!previa)throw new Error('PDF_FONTE_FINAL: versão final exige Times New Roman');
 return {fontData:(await readFile(fonte)).toString('base64'),familia,previa};
}
async function imprimirHtml(html,destino,chromium=process.env.CHROMIUM_BIN||'chromium'){
 const dir=await mkdtemp(path.join(tmpdir(),'enter-pdf-'));
 try{
  const input=path.join(dir,'relatorio.html'),pdf=path.join(dir,'relatorio.pdf');await writeFile(input,html);
  await exec(chromium,['--headless','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--no-pdf-header-footer',`--user-data-dir=${dir}/perfil`,`--print-to-pdf=${pdf}`,pathToFileURL(input).href],{timeout:60000,maxBuffer:2*1024*1024});
  const bytes=await readFile(pdf);if(bytes.subarray(0,5).toString()!=='%PDF-')throw new Error('PDF_INVALIDO');
  await writeFile(destino,bytes,{flag:'wx'});
 }finally{await rm(dir,{recursive:true,force:true});}
}

export async function verificarPdf(options={}){
 await carregarFonte(options);
 await exec(options.chromium||process.env.CHROMIUM_BIN||'chromium',['--version'],{timeout:10000});
}
export async function exportarPdf(analise,destino,options={}){
 const font=await carregarFonte(options),html=relatorioHtml(analise,font);
 await imprimirHtml(html,destino,options.chromium);return {html,familia:font.familia,previa:font.previa};
}
export async function exportarRacionalPdf(md,destino,options={}){
 const font=await carregarFonte(options);
 const html=`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><style>
 @font-face{font-family:Racional;src:url(data:font/ttf;base64,${font.fontData})}
 @page{size:A4;margin:18mm}body{font-family:Racional,serif;font-size:11pt;line-height:1.3;color:#111}
 h1{font-size:16pt}h2{font-size:12pt;margin:4mm 0 2mm;break-after:avoid}p{margin:2mm 0}
 </style></head><body>${markdownHtml(md)}</body></html>`;
 await imprimirHtml(html,destino,options.chromium);
}
