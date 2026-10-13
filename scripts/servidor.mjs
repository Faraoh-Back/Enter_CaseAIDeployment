import {parseArgs} from 'node:util';
import {readFile} from 'node:fs/promises';
import {criarApi} from '../src/api.mjs';
import {entradasCarteira} from '../src/executar-carteira.mjs';
let server;
try {
  const {values:v}=parseArgs({options:{real:{type:'boolean'},replay:{type:'boolean'},captura:{type:'string'},entradas:{type:'string'},input:{type:'string'},destino:{type:'string'},host:{type:'string'},port:{type:'string'}},strict:true});
  if(v.real&&v.replay)throw new Error('Escolha apenas --real ou --replay');
  if(v.captura&&!v.replay||v.replay&&!v.captura)throw new Error('--replay e --captura devem ser usados juntos');
  if(v.entradas&&v.input)throw new Error('--entradas e --input são exclusivos');
  const port=Number(v.port??process.env.PORT??3000),host=v.host??process.env.HOST??'127.0.0.1';
  if(!Number.isInteger(port)||port<0||port>65535)throw new Error('PORT_INVALIDA');
  const modo=v.replay?'replay':'real';
  server=await criarApi({modo,captura:v.captura,apiKey:modo==='real'?process.env.OPENAI_API_KEY:'',destino:v.destino??process.env.OUTPUT_DIR??'outputs/api',
    lerEntradas:v.entradas?async()=>JSON.parse(await readFile(v.entradas,'utf8')):()=>entradasCarteira((v.input??process.env.INPUT_DIR)||undefined)});
  server.listen(port,host);await new Promise((r,j)=>{server.once('listening',r);server.once('error',j);});
  console.log(JSON.stringify({url:`http://${host}:${server.address().port}`,modo,estado:'escutando'}));
  let closing=false;
  const close=async()=>{if(closing)return;closing=true;try{await server.encerrar();}catch{process.exitCode=1;}};
  process.once('SIGINT',close);process.once('SIGTERM',close);
}catch(error){console.error(JSON.stringify({erro:error.message}));if(server)await server.encerrar();process.exitCode=1;}
