import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {entradasCarteira,hash} from '../src/executar-carteira.mjs';

export async function prepararReplay(destino='outputs/s4-replay') {
  const raw=await entradasCarteira(),source='docs/output/s3/auditoria.json',manifestFile='docs/output/s3/manifest-extracao-real.json';
  const audits=JSON.parse(await readFile(source)),m=JSON.parse(await readFile(manifestFile));
  for(const [k,v] of Object.entries(raw))assert.equal(hash(v),m.entradas_sha256[k],`Insumo incompatível com captura real: ${k}`);
  assert.deepEqual(audits.map(a=>a.numero_processo),m.identidades);
  const respostas={};for(const a of audits){assert.equal(typeof a.resposta_original,'string');assert.ok(!Object.hasOwn(respostas,a.numero_processo));respostas[a.numero_processo]=a.resposta_original;}
  const dir=path.resolve(destino,randomUUID());await mkdir(dir,{recursive:true});
  const capture={modelo_solicitado:m.modelo_solicitado,entradas_sha256:m.entradas_sha256,respostas,
    origem:{auditoria:source,auditoria_sha256:hash(await readFile(source)),manifest_sha256:hash(await readFile(manifestFile)),modo:'respostas_reais_finais_capturadas',limite:'Replay recalcula outputs no Rivet; não representa novo consumo nem reproduz tentativas históricas.'}};
  await writeFile(path.join(dir,'captura.json'),JSON.stringify(capture,null,2)+'\n');await writeFile(path.join(dir,'entradas.json'),JSON.stringify(raw,null,2)+'\n');
  return {captura:path.join(dir,'captura.json'),entradas:path.join(dir,'entradas.json'),identidades:audits.length,chamadas_reais:0};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{console.log(JSON.stringify(await prepararReplay(),null,2));}catch(error){console.error(error.message);process.exitCode=1;}
}
