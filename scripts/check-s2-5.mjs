import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {runGraphInFile} from '../src/rivet-runtime.mjs';
import {exportarXlsx} from '../src/exportar-xlsx.mjs';
import {loteMisto} from '../tests/helpers/s2-lote.mjs';

// Prova offline de desenvolvimento. O mock fornece anotações; não classifica documentos.
const f=await loteMisto(),calls={},errors=[];
const original=globalThis.fetch,abort=new AbortController();
const timer=setTimeout(()=>abort.abort(),15000);
let outputs;
try {
  globalThis.fetch=async(url,options)=>{
    assert.equal(String(url),'https://api.openai.com/v1/chat/completions');
    const id=JSON.parse(options.body).messages[0].content.match(/Processo nº ([\d.\-]+)/)?.[1];
    assert.ok(Object.hasOwn(f.answers,id));calls[id]=(calls[id]??0)+1;assert.ok(calls[id]<=3);
    const answer=f.answers[id];
    if(answer.http)return new Response(JSON.stringify({error:{code:'server_error'}}),{status:answer.http});
    const content=typeof answer==='string'?answer:JSON.stringify(answer);
    return new Response(`data: ${JSON.stringify({choices:[{index:0,delta:{content},finish_reason:'stop'}]})}\n\ndata: [DONE]\n\n`);
  };
  outputs=await runGraphInFile('rivet/analise_sentencas.rivet-project',{graph:'analisar_lote',openAiKey:'credencial-ficticia',abortSignal:abort.signal,
    inputs:Object.fromEntries(Object.entries(f.raw).map(([k,value])=>[k,{type:'string',value}])),onNodeError:({error})=>errors.push(String(error))});
} catch(error) {throw new Error(errors.join('\n')||error.message);}
finally {globalThis.fetch=original;clearTimeout(timer);abort.abort();}
const data=Object.fromEntries(['processos','resumo','auditoria','relatorio_markdown'].map(k=>[k,outputs[k].value]));
assert.equal(data.processos.length,7);assert.equal(data.resumo.passivo_centavos,f.expected.passivo);
assert.equal(data.resumo.processos_com_valor_atualizado,4);assert.equal(data.resumo.decisoes_concluidas,3);
const dir=`outputs/s2.6/${new Date().toISOString().replace(/[:.]/g,'-')}-${randomUUID()}`;
await mkdir(dir,{recursive:true});
const json=v=>JSON.stringify(v,null,2)+'\n',hash=b=>createHash('sha256').update(b).digest('hex');
await writeFile(`${dir}/entradas.json`,json(f.raw));
for(const name of ['processos','resumo','auditoria'])await writeFile(`${dir}/${name}.json`,json(data[name]));
await writeFile(`${dir}/relatorio.md`,data.relatorio_markdown);
await exportarXlsx(data,`${dir}/processos.xlsx`);
const manifest={etapa:'S2.6',modo:'offline_anotacoes_sinteticas',chamadas_reais:0,requisicoes_simuladas:calls,
  entradas_sha256:Object.fromEntries(Object.entries(f.raw).map(([k,v])=>[k,hash(v)])),
  projeto_sha256:hash(await readFile('rivet/analise_sentencas.rivet-project')),plugin_sha256:hash(await readFile('rivet/plugins/enter-bounded-extraction/index.js')),
  mutacoes:['Data de citação removida do terceiro caso e das evidências correspondentes.','Subsídio do quarto caso removido.','JSON malformado no quinto caso; HTTP 503 no sexto.'],
  resumo:data.resumo,artefatos:[]};
for(const name of ['entradas.json','processos.json','resumo.json','auditoria.json','relatorio.md','processos.xlsx'])manifest.artefatos.push({nome:name,sha256:hash(await readFile(`${dir}/${name}`))});
await writeFile(`${dir}/manifest.json`,json(manifest));
console.log(JSON.stringify({diretorio:dir,resumo:data.resumo,chamadas_reais:0},null,2));
