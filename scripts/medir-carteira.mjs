import {parseArgs} from 'node:util';
import {readFile,writeFile} from 'node:fs/promises';
import {medirCarteira} from './metricas-carteira.mjs';
const {values:v}=parseArgs({options:{execucao:{type:'string'}},strict:true});if(!v.execucao)throw new Error('Informe --execucao');
const m=JSON.parse(await readFile(`${v.execucao}/manifest.json`)),ps=JSON.parse(await readFile(`${v.execucao}/processos.json`)),as=JSON.parse(await readFile(`${v.execucao}/auditoria.json`));
const metrics=medirCarteira(m,ps,as);await writeFile(`${v.execucao}/metricas.json`,JSON.stringify(metrics,null,2)+'\n');console.log(JSON.stringify(metrics,null,2));
