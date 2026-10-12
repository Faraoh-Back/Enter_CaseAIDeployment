import { parseArgs } from 'node:util';
import { executarS1 } from '../src/executar-s1.mjs';

try {
  const { values } = parseArgs({ options:{ real:{type:'boolean'}, replay:{type:'boolean'},
    captura:{type:'string'}, destino:{type:'string'} }, allowPositionals:false, strict:true });
  if (Boolean(values.real) === Boolean(values.replay)) throw new Error('Escolha exatamente um modo: --real ou --replay');
  if (values.captura && !values.replay) throw new Error('--captura exige --replay');
  const result = await executarS1({ modo:values.real ? 'real' : 'replay', captura:values.captura, destino:values.destino });
  console.log(JSON.stringify(result,null,2));
} catch (error) {
  console.error(JSON.stringify({erro:error.message, ...(error.diretorio ? {diretorio:error.diretorio} : {})})); process.exitCode = 1;
}
