export function medirCarteira(manifest,processos,auditoria) {
 const history=auditoria.flatMap(a=>a.historico_tentativas??[]);
 const usageKnown=history.filter(h=>h.uso&&['prompt_tokens','completion_tokens','total_tokens'].every(k=>Number.isSafeInteger(h.uso[k])&&h.uso[k]>=0));
 const tokens=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,usageKnown.reduce((s,h)=>s+h.uso[k],0)]));
 const completos=history.length===manifest.requisicoes_extrator&&usageKnown.length===history.length;
 return {estado:manifest.estado,identificados:manifest.identidades.length,processados:processos.length,nao_processados:manifest.nao_processados.length,
  aptos:processos.filter(p=>p.status_processamento==='ok').length,pendencias:processos.filter(p=>p.status_processamento==='pendente_revisao').length,erros_tecnicos:processos.filter(p=>p.status_processamento==='erro').length,
  primeira_tentativa_aprovada:auditoria.filter(a=>a.historico_tentativas?.[0]?.estado==='aprovada').length,denominador_primeira_tentativa:auditoria.length,
  casos_com_retentativa:auditoria.filter(a=>a.tentativas>1).length,requisicoes_extrator:manifest.requisicoes_extrator,chamadas_reais:manifest.chamadas_reais,
  duracao_ms:manifest.duracao_ms,tokens_completos:completos,tokens:completos?tokens:null,tokens_parciais_informados:tokens,
  tentativas_com_uso_informado:usageKnown.length,tentativas_sem_uso_informado:manifest.requisicoes_extrator-usageKnown.length,
  custo_monetario:null,motivo_custo_null:'Não foi incorporada uma tabela de preços verificável com vigência; tokens não são custo monetário.'};
}
