const blocos=segmentarSentencas(inputs.processos_texto.value);
const ids=blocos.map(b=>b.numero);
const subsidios=csv(inputs.subsidios_texto.value,',',['numero_processo','status_subsidios'],'numero_processo',true);
if(Object.keys(subsidios).some(id=>!ids.includes(id))) fail('Subsídio com identidade fora do lote');
const tarefas=blocos.map(b=>{
  const raw={...inputs,processos_texto:{type:'string',value:`${'='.repeat(30)}\nProcesso nº ${b.numero}\n${'='.repeat(30)}\n${b.sentenca}\n`},
    subsidios_texto:{type:'string',value:'numero_processo,status_subsidios\n'+(subsidios[b.numero]?`${b.numero},${subsidios[b.numero].status_subsidios}\n`:'')}};
  prepararSentenca(raw); // Preflight de TODOS os casos antes de qualquer chamada.
  return raw;
});
return {tarefas:{type:'object[]',value:tarefas},identidades:{type:'string[]',value:ids}};
