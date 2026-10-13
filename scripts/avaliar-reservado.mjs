import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {parseArgs} from 'node:util';
import {randomUUID} from 'node:crypto';
import {executarCarteira,entradasCarteira,hash} from '../src/executar-carteira.mjs';
import {avaliarExtracao} from './avaliacao.mjs';
const {values:v}=parseArgs({options:{real:{type:'boolean'},replay:{type:'boolean'},captura:{type:'string'},destino:{type:'string'},reavaliacao:{type:'boolean'},conjunto:{type:'string',default:'reservado'}},strict:true});
if(Boolean(v.real)===Boolean(v.replay))throw new Error('Escolha --real ou --replay');
if(!['reservado','desenvolvimento'].includes(v.conjunto))throw new Error('Conjunto inválido');
const goldenFile=`tests/fixtures/golden/${v.conjunto}.json`;
const records=JSON.parse(await readFile(goldenFile,'utf8'));
const raw=await entradasCarteira();
raw.processos_texto=records.map(r=>`${'='.repeat(30)}\nProcesso nº ${r.numero_processo}\n${'='.repeat(30)}\n${r.sentenca}\n`).join('');
raw.subsidios_texto='numero_processo,status_subsidios\n'+records.map(r=>`${r.numero_processo},${r.calculo_esperado.status_subsidios}\n`).join('');
const hashes=async()=>Object.fromEntries(await Promise.all(['rivet/prompts/extracao-s1.txt','schemas/extracao.schema.json',goldenFile].map(async p=>[p,hash(await readFile(p))])));
const before=await hashes(),dir=v.destino??`outputs/s3-${v.conjunto}/${randomUUID()}`;await mkdir(dir,{recursive:true});
const evidence={etapa:'S3.2',conjunto:v.conjunto,iniciado_em:new Date().toISOString(),modo:v.real?'real':'replay',hashes_congelados:before,
 exposicao_previa:'Os 12 reservados participaram do resumo-base preliminar nos 100; não é avaliação cega ou primeira exposição à LLM.',ajustes_de_prompt_nesta_rodada:0,reavaliacao_conjunto_ja_visto:Boolean(v.reavaliacao),custo_monetario:null};
try {
 const result=await executarCarteira({modo:evidence.modo,destino:dir,entradas:raw,captura:v.captura});
 evidence.execucao=result;
 const ps=JSON.parse(await readFile(`${result.diretorio}/processos.json`)),as=JSON.parse(await readFile(`${result.diretorio}/auditoria.json`));
 evidence.avaliacao=avaliarExtracao(records,ps,as);
 evidence.manifest=JSON.parse(await readFile(`${result.diretorio}/manifest.json`));
 evidence.estado=evidence.avaliacao.aprovacao_critica?'aprovado':'reprovado';
 if(evidence.estado!=='aprovado')process.exitCode=1;
} catch(error) {evidence.estado='falhou';evidence.erro=error.message;evidence.execucao={diretorio:error.diretorio};process.exitCode=1;}
finally {
 evidence.hashes_depois=await hashes();evidence.prompt_e_gabaritos_preservados=JSON.stringify(before)===JSON.stringify(evidence.hashes_depois);
 if(!evidence.prompt_e_gabaritos_preservados){evidence.estado='falhou';process.exitCode=1;}
 evidence.encerrado_em=new Date().toISOString();await writeFile(`${dir}/avaliacao.json`,JSON.stringify(evidence,null,2)+'\n');
 console.log(JSON.stringify({estado:evidence.estado,evidencia:`${dir}/avaliacao.json`,avaliacao:evidence.avaliacao?{completos:evidence.avaliacao.completos,total:evidence.avaliacao.total_avaliado,criticos_corretos:evidence.avaliacao.criticos_corretos}:null,erro:evidence.erro??null},null,2));
}
