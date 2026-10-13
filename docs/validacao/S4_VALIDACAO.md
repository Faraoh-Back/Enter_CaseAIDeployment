# S4 — API HTTP, persistência e reprodução

Registro da etapa indicada no título. Contagens de testes e pendências descrevem aquela rodada; mantenho o estado atual em [validação final](../entrega/validacao.md).
**S4.1–S4.5 concluídas. 175 testes aprovados, sem skips; 25 testes novos de HTTP, integração, persistência e processos CLI.** Nenhuma chamada à OpenAI nesta etapa. [Evidência final](../output/s4/validacao-final.json) e [sequência curl executada](../output/s4/curl.json).

## Resultado verificável

| Verificação | Resultado |
| --- | --- |
| POST / consulta / downloads | 202 / 200 / cinco arquivos com 200 e SHA-256 conferido |
| Replay da carteira | 100 aptos, resumo idêntico à execução real S3 |
| Equivalência API/CLI | JSONs e Markdown idênticos para os mesmos inputs/resposta capturada |
| XLSX | Reaberto no teste integrado; valor atualizado e identificação conferidos |
| Concorrência | Segunda execução ativa retorna 409; nova execução posterior tem ID próprio |
| Persistência | Manifesto antes do 202; falha de gravação não inicia executor |
| Reinício | Job antigo vira interrompida; checkpoint preservado, sem retomada automática |
| Crash do processo real | SIGKILL, novo processo recupera lock e estado sem nova análise |
| Credencial ausente | 503, sem executor; .env não é carregado implicitamente |
| Arquivos | Whitelist, hash e arquivo regular; temporários, adulterados e symlinks recusados |
| Chamadas reais à LLM na S4 | 0 |

O teste inicial da S4.1 teve dez falhas por módulo ausente e não exercitou as asserções HTTP. Após implementar a API, os dez cenários foram executados por sockets reais e ficaram verdes. Três testes usam o executor Rivet real em replay e subprocesso da CLI; dez cobrem persistência/limites; dois iniciam o servidor como processo real. Os 150 anteriores continuam na suíte padrão.

Os sockets foram bloqueados pelo sandbox (`listen EPERM`); os testes foram executados com autorização fora desse bloqueio. Não se substituiu HTTP por chamadas diretas aos handlers. O replay usa respostas reais finais capturadas na S3, mas não representa nova avaliação da LLM nem reproduz seu histórico de retries/consumo. A execução S3 e seus artefatos históricos permanecem preservados.

## Arquitetura e limites

API e CLI compartilham `executarCarteira` e `analisar_lote`. API aloca o ID/manifesto antes de responder; o executor verifica essa alocação e grava seus snapshots/outputs no mesmo diretório. O corpo do POST permite somente `dataset=case`; caminhos, captura e modo são configuração do operador. JSON malformado retorna 400, contrato inválido 422 e corpo acima de 8192 bytes 413.

A API não calcula dinheiro, classifica ou totaliza carteira. [Revisão de responsabilidades](S4_4_REVISAO.md). O adaptador de transporte fica no plugin, sem substituir globalmente o fetch dos clientes HTTP. S1 e carteira compartilham exclusão de execução no processo. No aplicativo, o plugin mantém fetch nativo por padrão; atualizar seus arquivos locais antes de próxima reprodução para usar os mesmos bytes testados.

Uma instância por diretório, com lock local PID/token, e uma execução ativa por instância. Diretório de outra instância viva é recusado antes da recuperação; processo morto permite recuperar o lock. Encerramento aguarda o job abortado e libera o diretório. Não há coordenação distribuída nem retomada automática. O diretório é operado pelo servidor local; não é uma pasta compartilhada entre máquinas. Uma recuperação incompleta que deixe o próprio lock de recuperação exige intervenção do operador, sem remoção automática indiscriminada.

POST não é idempotente: não repetir automaticamente uma solicitação aceita. GET/download são consultas. Arquivos completos já registrados podem ser baixados mesmo quando uma exportação posterior falha, enquanto o estado da execução permanece falhou. JSONs/Markdown/XLSX têm nomes fixos; PDF executivo será incluído na S5.10, quando gerado e validado.

A confirmação HTTP real da S4 foi offline quanto à LLM. O caminho real do executor foi exercitado na S3 e nas regressões com transporte controlado; não foi feita nova chamada paga pelo POST nesta rodada.

## Reprodução offline automatizada

Na raiz, com Node 20.20.2 e dependências instaladas:

```bash
npm test
npm run s4:check
```

`npm test` usa portas locais efêmeras e processos temporários. `s4:check` exige curl instalado: prepara captura, inicia servidor em porta efêmera, faz POST, consulta estado, baixa os cinco artefatos e verifica hashes/resumo. Também confere o 503 sem credencial. Uma repetição anterior expirou na consulta com timeout de cliente de 10 segundos; o diagnóstico foi ajustado para 60 segundos por requisição e repetido com sucesso, sem concluir a causa da lentidão. Encerra seus servidores e informa o diretório `outputs/s4-curl/<id>/`, com evidência, cabeçalhos e downloads. Nenhum desses comandos carrega `.env` ou chama a OpenAI.

## Reprodução manual por curl

Prepare a captura e copie o caminho `captura` informado:

```bash
npm run s4:replay
```

Em um terminal, substitua `<id>` pelo ID retornado:

```bash
npm run api:start -- --replay --captura 'outputs/s4-replay/<id>/captura.json'
```

Por padrão, URL `http://127.0.0.1:3000`. Em outro terminal:

```bash
curl -sS -X POST http://127.0.0.1:3000/execucoes \
  -H 'Content-Type: application/json' \
  --data '{"dataset":"case"}'
```

Copie o `execucao_id` da resposta e consulte:

```bash
curl -sS 'http://127.0.0.1:3000/execucoes/<execucao_id>'
```

Quando o estado for concluida e o artefato estiver disponível:

```bash
curl -sS --fail 'http://127.0.0.1:3000/execucoes/<execucao_id>/artefatos/processos.xlsx' \
  -o processos.xlsx
curl -sS --fail 'http://127.0.0.1:3000/execucoes/<execucao_id>/artefatos/relatorio.md' \
  -o relatorio.md
```

A sequência automatizada preservada fez POST 202, consultas 200 e cinco downloads 200: `processos.json`, `resumo.json`, `auditoria.json`, `relatorio.md`, `processos.xlsx`. O resumo fecha os 100 casos e mantém passivo R$ 309.174,54, 17 recursos, custo R$ 54.400,00 e benefício líquido esperado R$ 24.676,16. Esses resultados são recalculados pelo Rivet a partir das respostas capturadas.

## Execução real deliberada

Configure somente os campos realmente usados em [.env.example](../../.env.example). O programa não lê `.env` sozinho:

```bash
node --env-file=.env scripts/servidor.mjs --real
```

Iniciar o servidor não chama a OpenAI. Um POST aceito aciona nova execução paga da carteira, com até três tentativas por sentença. HOST/PORT configuram o bind, OUTPUT_DIR a persistência e INPUT_DIR opcionalmente a pasta dos cinco insumos. Sem INPUT_DIR, encontra Input em case/. Modelo vem de LLM_MODEL. Grafo/data-base e limites atuais estão fixados pelo case/plugin, sem variáveis fictícias de configuração.

CLI da carteira continua disponível: `node --env-file=.env scripts/executar-carteira.mjs --real`. HTTP e CLI real podem ter extrações diferentes por geração da LLM; equivalência determinística foi provada com o mesmo replay. Credenciais não são gravadas no manifesto ou devolvidas nos diagnósticos HTTP.

## Próxima etapa

S5: racional, registro final de validação, PDF baseado no modelo escolhido, revisão dos entregáveis e ZIP reproduzível. Não foi iniciada renderização PDF nem montagem do pacote nesta rodada. O servidor e os comandos acima estão prontos para sua conferência manual; nenhum frontend foi criado.
