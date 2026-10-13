// Plugin isomórfico: nenhum import de Node/Rivet e nenhum segredo no projeto.
// A avaliação de domínio é delegada ao subgrafo informado, nunca reimplementada aqui.
export default function initialize(rivet, transport = {}) {
  const object = value => ({type:'object',value});
  const string = value => ({type:'string',value});
  const ports = items => items.map(([id,dataType])=>({id,dataType,title:id,required:true}));
  return {id:'enter-bounded-extraction',name:'Enter — extração com orçamento de tentativas',
    register(register) {register({displayName:'Extração limitada',impl:{
      create:()=>({id:'bounded-extraction',type:'enterBoundedExtraction',title:'Extração limitada',visualData:{x:0,y:0,width:320},data:{validationGraph:'s1_validacao'}}),
      getInputDefinitions:()=>ports([['prompt','chat-message'],['model','string'],['responseSchema','object'],['preparado','object']]),
      getOutputDefinitions:()=>ports([['response','string'],['usage','object'],['controle','object']]),
      getEditors:()=>[],
      getBody:data=>`Máximo: 3 chamadas totais. Validador: ${data.validationGraph}. HTTP 401/quota/configuração interrompem.`,
      getUIData:()=>({contextMenuTitle:'Extração limitada',group:['Advanced'],infoBoxTitle:'Extração limitada',infoBoxBody:'Transporte e validação compartilham até três tentativas; validação no subgrafo.'}),
      async process(data,inputs,context) {
        const endpoint=context.settings.openAiEndpoint || 'https://api.openai.com/v1/chat/completions';
        if (endpoint!=='https://api.openai.com/v1/chat/completions') throw new Error('CONFIGURACAO: endpoint OpenAI não autorizado');
        if (!context.settings.openAiKey) throw new Error('CONFIGURACAO: chave OpenAI ausente');
        const historico=[];
        const limites={tentativas:3,timeout_tentativa_ms:10000,timeout_extracao_ms:40000};
        const deadline=Date.now()+limites.timeout_extracao_ms;
        const prompt=inputs.prompt.value;
        const messages=[{role:prompt.type??'user',content:prompt.message??prompt.content}];
        let resposta='', usage={}, correction=null;
        for (let numero=1;numero<=3;numero++) {
          context.signal.throwIfAborted();
          const controller=new AbortController();
          const abort=()=>controller.abort(context.signal.reason);
          context.signal.addEventListener('abort',abort,{once:true});
          const timer=setTimeout(()=>controller.abort(),Math.min(limites.timeout_tentativa_ms,deadline-Date.now()));
          let transportError=null, currentUsage=null, httpStatus=null, retryDelay=250*numero;
          try {
            const headers={'Content-Type':'application/json',Authorization:`Bearer ${context.settings.openAiKey}`};
            if(context.settings.openAiOrganization) headers['OpenAI-Organization']=context.settings.openAiOrganization;
            const response=await (transport.fetch ?? globalThis.fetch)(endpoint,{method:'POST',headers,signal:controller.signal,body:JSON.stringify({
              model:inputs.model.value,temperature:0,max_tokens:2500,stream:true,stream_options:{include_usage:true},
              response_format:{type:'json_schema',json_schema:{name:'extracao_sentenca',strict:true,schema:inputs.responseSchema.value}},
              messages:correction?[...messages,{role:'user',content:`A extração anterior foi rejeitada. Releia o documento e corrija: ${correction}. Não invente dados ausentes; use null.`}]:messages,
            })});
            httpStatus=response.status;
            if(!response.ok) {
              const after=response.headers.get('Retry-After');
              const retryAfterMs=after!==null && /^\d+(?:\.\d+)?$/.test(after.trim()) ? Number(after)*1000 : Date.parse(after??'')-Date.now();
              if(Number.isFinite(retryAfterMs) && retryAfterMs>0) retryDelay=Math.max(retryDelay,retryAfterMs);
              let code;
              try {const detail=(await response.json()).error;code=detail?.code??detail?.type;} catch {}
              const transient=[408,429].includes(response.status)||response.status>=500;
              if (!transient || code==='insufficient_quota') throw Object.assign(new Error(`FALHA_GLOBAL: HTTP ${response.status}${code==='insufficient_quota'?' — quota esgotada':''}`),{global:true});
              throw new Error(`HTTP ${response.status}`);
            }
            // O corpo fica limitado pelo max_tokens. Só aprovar uma resposta com fim de stream.
            const raw=await response.text();
            let done=false,finish=null; resposta='';
            for (const line of raw.split(/\r?\n/)) {
              if(!line.startsWith('data:')) continue;
              const payload=line.slice(5).trim();
              if(payload==='[DONE]') {done=true;continue;}
              const event=JSON.parse(payload);
              if(event.error) throw new Error('Erro no stream');
              if(event.usage) currentUsage=event.usage;
              for(const choice of event.choices??[]) {
                if(choice.index!==0) continue;
                resposta+=choice.delta?.content??'';
                if(choice.finish_reason) finish=choice.finish_reason;
              }
            }
            if(!done || finish!=='stop') throw new Error('Stream incompleto ou resposta interrompida');
          } catch(error) {
            if(context.signal.aborted) throw context.signal.reason ?? error;
            if(error.global) throw error;
            // Não persistir mensagens arbitrárias de fetch: podem conter credenciais/headers.
            transportError={codigo:'FALHA_TRANSPORTE',mensagem:httpStatus===null?'Falha de rede ou timeout.':`HTTP ${httpStatus}: falha transitória ou stream incompleto.`};
            resposta='';
          } finally {clearTimeout(timer);context.signal.removeEventListener('abort',abort);}
          if(transportError) {
            historico.push({numero,estado:'falha_transporte',problemas:[transportError],resposta_original:null,uso:currentUsage,http_status:httpStatus});
          } else {
            const validator=context.createSubProcessor(data.validationGraph,{signal:context.signal});
            const validated=await validator.processGraph(context,{preparado:inputs.preparado,resposta:string(resposta),controle:object({historico:[]})},context.contextValues);
            const {aprovada,problemas}=validated.avaliacao.value;
            historico.push({numero,estado:aprovada?'aprovada':'extracao_invalida',problemas,resposta_original:resposta,uso:currentUsage,http_status:httpStatus});
            if(aprovada) break;
            correction=problemas.map(p=>`${p.codigo}: ${p.mensagem}`).join(', ');
          }
          if(numero<3 && transportError && Date.now()+retryDelay+limites.timeout_tentativa_ms>deadline) throw new Error('FALHA_GLOBAL: espera do provedor excede orçamento de tempo; executar novamente mais tarde');
          if(numero<3 && transportError) await new Promise((resolve,reject)=>{
            const onAbort=()=>{clearTimeout(wait);reject(new Error('Execução cancelada'));};
            const wait=setTimeout(()=>{context.signal.removeEventListener('abort',onAbort);resolve();},retryDelay);
            context.signal.addEventListener('abort',onAbort,{once:true});
          });
        }
        if(historico.every(h=>h.uso && ['prompt_tokens','completion_tokens','total_tokens'].every(k=>Number.isSafeInteger(h.uso[k])&&h.uso[k]>=0))) {
          usage=Object.fromEntries(['prompt_tokens','completion_tokens','total_tokens'].map(k=>[k,historico.reduce((sum,h)=>sum+h.uso[k],0)]));
        }
        return {response:string(resposta),usage:object(usage),controle:object({historico,limites})};
      },
    }}); register(sequentialDefinition);},
  };
}

// Adaptador genérico de subgrafos: nenhuma classificação ou fórmula financeira.
// Split Run sequencial nativo acumula erros e continua; aqui uma falha global encerra imediatamente.
const sequentialDefinition={displayName:'Subgrafo sequencial com interrupção',impl:{
  create:()=>({id:'sequential-subgraph',type:'enterSequentialSubgraph',title:'Subgrafo sequencial',visualData:{x:0,y:0,width:320},data:{graphId:'analisar_carteira'}}),
  getInputDefinitions:()=>[{id:'tarefas',title:'Entradas tipadas por chamada',dataType:'object[]',required:true}],
  getOutputDefinitions:()=>[{id:'resultados',title:'Resultados',dataType:'object[]'}],
  getEditors:()=>[],getBody:data=>`Subgrafo: ${data.graphId}. Sequencial; falha global interrompe.`,
  getUIData:()=>({contextMenuTitle:'Subgrafo sequencial',group:['Advanced'],infoBoxTitle:'Subgrafo sequencial',infoBoxBody:'Executa entradas tipadas em ordem e propaga falhas sem iniciar as restantes.'}),
  async process(data,inputs,context) {
    const resultados=[];
    for(const tarefa of inputs.tarefas.value) {
      context.signal.throwIfAborted();
      const processor=context.createSubProcessor(data.graphId,{signal:context.signal});
      const output=await processor.processGraph(context,tarefa,context.contextValues);
      resultados.push(Object.fromEntries(Object.entries(output).map(([key,value])=>[key,value.value])));
    }
    return {resultados:{type:'object[]',value:resultados}};
  },
}};
