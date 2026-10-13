import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {caminhoPermitido,conferirLista,prepararEntrega} from '../scripts/preparar-entrega.mjs';
async function root(t){const dir=await mkdtemp(path.join(tmpdir(),'enter-s5-pacote-'));t.after(()=>rm(dir,{recursive:true,force:true}));return dir;}
test('S5.5: lista positiva inclui fontes, cinco inputs e evidências sem dependências ou credenciais',async()=>{
 const list=JSON.parse(await readFile('docs/entrega/arquivos.json'));const result=await conferirLista(process.cwd(),list);
 assert.equal(result.filter(a=>a.destino.startsWith('case/Input/')).length,5);
 for(const required of ['projeto.rivet-project','processos.xlsx','racional.md','README.md','package-lock.json','rivet/plugins/enter-bounded-extraction/index.js','docs/output/s3.2-reservado-inicial.json'])assert.ok(result.some(a=>a.destino===required),required);
 assert.ok(result.every(a=>a.sha256.length===64));
});
test('S5.5: caminhos arbitrários, temporários e diretórios privados são recusados',()=>{
 for(const name of ['../.env','/tmp/file','a/../../x','a/.git/config','node_modules/x','outputs/x','a/x.log','a/.env.local','a\\b'])assert.equal(caminhoPermitido(name),false,name);
 assert.equal(caminhoPermitido('.env.example'),true);
});
test('S5.5: symlinks diretos e em diretórios, destino duplicado e credencial são recusados',async t=>{
 const dir=await root(t);await writeFile(path.join(dir,'a.txt'),'normal');await symlink('a.txt',path.join(dir,'b.txt'));
 await assert.rejects(conferirLista(dir,[{origem:'b.txt',destino:'b.txt'}]),/ARQUIVO_INVALIDO/);
 await mkdir(path.join(dir,'real'));await writeFile(path.join(dir,'real','a.txt'),'normal');await symlink('real',path.join(dir,'link'));
 await assert.rejects(conferirLista(dir,[{origem:'link/a.txt',destino:'a.txt'}]),/ARQUIVO_INVALIDO/);
 await assert.rejects(conferirLista(dir,[{origem:'a.txt',destino:'x'},{origem:'a.txt',destino:'x'}]),/LISTA_INVALIDA/);
 await writeFile(path.join(dir,'secret.txt'),'sk-proj-'+ 'x'.repeat(40));
 await assert.rejects(conferirLista(dir,[{origem:'secret.txt',destino:'secret.txt'}]),/CREDENCIAL/);
});
test('S5.5: preparo recusa PDF ausente ou prévia em vez de empacotar versão incompleta',async t=>{
 await assert.rejects(prepararEntrega({pdf:''}),/PDF_AUSENTE/);
 const dir=await root(t);await writeFile(path.join(dir,'relatorio.pdf'),'%PDF-1.4');await writeFile(path.join(dir,'manifest.json'),JSON.stringify({previa:true,familia:'Liberation Serif'}));
 await assert.rejects(prepararEntrega({pdf:path.join(dir,'relatorio.pdf')}),/PDF_NAO_FINAL/);
});
test('S5.5: preparo copia somente a lista conferida e registra hashes sem criar ZIP',async t=>{
 const dir=await root(t),origin=path.join(dir,'repo'),renderDir=path.join(dir,'render');
 await mkdir(path.join(origin,'docs/output/s5'),{recursive:true});await mkdir(renderDir);
 const {hash}=await import('../src/executar-carteira.mjs');
 const sourceManifest='{"origem":"fixture de cópia"}',pdf=Buffer.from('%PDF-1.4\n% fixture de transporte, não revisão visual\n');
 await writeFile(path.join(origin,'docs/output/s5/manifest.json'),sourceManifest);
 await writeFile(path.join(origin,'README.md'),'entrega');await writeFile(path.join(origin,'nao-listado.txt'),'excluído');
 await writeFile(path.join(origin,'lista.json'),JSON.stringify([{origem:'README.md',destino:'README.md'},{origem:'lista.json',destino:'docs/entrega/arquivos.json'}]));
 await writeFile(path.join(renderDir,'relatorio.pdf'),pdf);
 await writeFile(path.join(renderDir,'manifest.json'),JSON.stringify({versao:'s5-render-v1',familia:'Times New Roman',previa:false,manifest_origem_sha256:hash(sourceManifest),artefatos:[{nome:'relatorio.pdf',sha256:hash(pdf)}]}));
 const result=await prepararEntrega({root:origin,lista:'lista.json',pdf:path.join(renderDir,'relatorio.pdf'),destino:path.join(dir,'pacotes')});
 assert.equal(result.zip_criado,false);assert.equal(await readFile(path.join(result.diretorio,'README.md'),'utf8'),'entrega');
 await assert.rejects(readFile(path.join(result.diretorio,'nao-listado.txt')),/ENOENT/);
 const m=JSON.parse(await readFile(path.join(result.diretorio,'entrega-manifest.json')));
 for(const a of m.arquivos)assert.equal(hash(await readFile(path.join(result.diretorio,a.destino))),a.sha256);
 const portable=JSON.parse(await readFile(path.join(result.diretorio,'docs/entrega/arquivos.json')));
 assert.ok(portable.every(a=>a.origem===a.destino));await conferirLista(result.diretorio,portable);
});
