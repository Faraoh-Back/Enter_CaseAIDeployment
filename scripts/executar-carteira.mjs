import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {executarCarteira,entradasCarteira} from '../src/executar-carteira.mjs';
const controller=new AbortController();
process.once('SIGINT',()=>controller.abort(new Error('SIGINT')));
process.once('SIGTERM',()=>controller.abort(new Error('SIGTERM')));
try {
 const {values:v}=parseArgs({options:{real:{type:'boolean'},replay:{type:'boolean'},captura:{type:'string'},destino:{type:'string'},entradas:{type:'string'},input:{type:'string'}},strict:true});
 if(Boolean(v.real)===Boolean(v.replay))throw new Error('Escolha exatamente --real ou --replay');
 if(v.real&&v.captura)throw new Error('--captura exige --replay');
 if(v.entradas&&v.input)throw new Error('--entradas e --input são exclusivos');
 const entradas=v.entradas?JSON.parse(await readFile(v.entradas,'utf8')):v.input?await entradasCarteira(v.input):undefined;
 console.log(JSON.stringify(await executarCarteira({modo:v.real?'real':'replay',captura:v.captura,destino:v.destino,entradas,signal:controller.signal}),null,2));
} catch(error) {console.error(JSON.stringify({erro:error.message,diretorio:error.diretorio}));process.exitCode=1;}
