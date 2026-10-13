import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {relatorioHtml,markdownHtml,carregarFonte,exportarPdf,exportarRacionalPdf} from '../src/relatorio-pdf.mjs';
import {render} from '../scripts/render.mjs';
const exec=promisify(execFile);
const data={resumo:JSON.parse(await readFile('docs/output/s5/resumo.json')),relatorio_markdown:await readFile('docs/output/s5/relatorio.md','utf8')};
const preview={fonte:'/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf',familia:'Liberation Serif',previa:true};
test('S5.10: HTML conserva síntese, 17 recursos e desconhecidos sem executar instruções do documento',()=>{
 const html=relatorioHtml(data,{fontData:'AA=='});
 assert.match(html,/309\.174,54/);assert.match(html,/24\.676,16/);assert.match(html,/7094431-69\.2024\.8\.26\.0001/);
 assert.match(html,/111?\.233,13|11\.233,13/);assert.match(html,/não economia realizada/);
 const escaped=markdownHtml('# <script>alert(1)</script>\n\n| Campo | Valor |\n| --- | --- |\n| & | desconhecido |');
 assert.ok(!escaped.includes('<script>'));assert.match(escaped,/&lt;script&gt;/);assert.match(escaped,/desconhecido/);
});
test('S5.10: fonte ausente, substituta ou com nome divergente não passa como Times New Roman',async()=>{
 await assert.rejects(carregarFonte({fonte:'',familia:'Times New Roman'}),/PDF_FONTE_AUSENTE/);
 await assert.rejects(carregarFonte({...preview,familia:'Times New Roman'}),/PDF_FONTE_DIVERGENTE/);
 await assert.rejects(carregarFonte({...preview,previa:false}),/PDF_FONTE_FINAL/);
});
test('S5.10: PDF real contém texto, tabelas, fonte incorporada e quatro páginas legíveis',async t=>{
 const root=await mkdtemp(path.join(tmpdir(),'enter-s5-pdf-test-'));t.after(()=>rm(root,{recursive:true,force:true}));
 const pdf=path.join(root,'relatorio.pdf');await exportarPdf(data,pdf,preview);
 const {stdout:text}=await exec('pdftotext',['-layout',pdf,'-']);
 for(const v of ['309.174,54','54.400,00','24.676,16','3186394-32.2024.8.26.0003','7094431-69.2024.8.26.0001','Desconhecidos','Prévia tipográfica'])assert.ok(text.includes(v),v);
 assert.equal(text.split('\f').filter(p=>p.trim()).length,4);
 const {stdout:fonts}=await exec('pdffonts',[pdf]);assert.match(fonts,/LiberationSerif.*yes\s+yes/);
 await assert.rejects(exportarPdf(data,pdf,preview),/EEXIST/);
});
test('S5.10: adulteração da fonte auditável impede renderização',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'enter-s5-render-test-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const m=JSON.parse(await readFile('docs/output/s5/manifest.json'));
 await writeFile(path.join(dir,'manifest.json'),JSON.stringify(m));await writeFile(path.join(dir,'resumo.json'),'{}');
 await assert.rejects(render({origem:dir,destino:dir,...preview}),/RENDER_ORIGEM_DIVERGENTE/);
});

test('S5.1: racional cabe em até duas páginas A4 sem omitir decisões, IA ou limites',async t=>{
 const dir=await mkdtemp(path.join(tmpdir(),'enter-s5-racional-'));t.after(()=>rm(dir,{recursive:true,force:true}));
 const md=await readFile('docs/entrega/racional.md','utf8'),file=path.join(dir,'racional.pdf');
 await exportarRacionalPdf(md,file,preview);
 const {stdout:text}=await exec('pdftotext',[file,'-']);
 const pages=text.split('\f').filter(p=>p.trim()).length;assert.ok(pages>=1&&pages<=2,pages);
 for(const phrase of ['BigInt','Usei IA','272.249','reavaliação de conjunto já visto','segundo revisor humano'])assert.ok(text.replace(/\s+/g,' ').includes(phrase),phrase);
});
test('S5.10: CLI e servidor recusam --pdf sem fonte antes de iniciar execução paga',async()=>{
 for(const file of ['scripts/executar-carteira.mjs','scripts/servidor.mjs']){
  try{await exec(process.execPath,[file,'--real','--pdf'],{env:{...process.env,REPORT_FONT:'',OPENAI_API_KEY:'credencial-controlada-de-teste'}});assert.fail('Deveria recusar configuração');}
  catch(e){assert.equal(e.code,1);assert.match(e.stderr,/PDF_FONTE_AUSENTE/);assert.equal(e.stdout,'');}
 }
});
