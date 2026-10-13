# S4 — interface HTTP por tarefa

S3 V0 aceita visualmente pelo candidato. S4.1 preserva o vermelho inicial. S4.2 implementada: testes de contrato e integração verdes; tarefas seguintes em andamento.

| Tarefa | Entrega | Estado |
| --- | --- | --- |
| S4.1 | Testes HTTP de POST, estado, downloads, concorrência, falhas e reinício. | Vermelho observado: 0/10 aprovados; módulo da API ausente. |
| S4.2 | Servidor Node e executor compartilhado com CLI; uma execução ativa. | Concluída: 10 testes HTTP + 3 de integração verdes. |
| S4.3 | Manifesto antes do 202, artefatos íntegros e recuperação após reinício. | Concluída: nove testes adicionais verdes. |
| S4.4 | Revisão: API sem classificação, dinheiro ou indicadores de negócio. | Pendente |
| S4.5 | Sequência curl verificada, documentação e configuração segura. | Pendente |

## S4.1 — contrato observável

[tests/s4-http.test.mjs](../../tests/s4-http.test.mjs) define dez cenários com HTTP por sockets reais e executor controlado. A simulação fica somente na execução do lote, evitando chamadas pagas e cálculos de negócio no teste da API. Os testes observam requisições, respostas e arquivos persistidos; não substituem a verificação futura de API/CLI com o mesmo executor Rivet.

A interface programática prevista é `criarApi({destino, apiKey, modelo, executor, lerEntradas})`, exportada de `src/api.mjs`; retorna um servidor Node que o chamador pode escutar em porta local efêmera nos testes. O executor recebe o ID pré-alocado e a raiz de outputs, de forma que o manifesto exista antes do HTTP 202. Esses argumentos são pontos de composição/teste, não campos enviados pelo cliente.

Casos: aceite e persistência antes de 202; estado terminal/download idêntico; concorrência e isolamento; JSON inválido/contrato estrito; configuração/insumos indisponíveis; execução/artefato inexistente e arquivo ainda indisponível; arquivo fora do manifesto; falha do executor; recuperação após reinício; arquivo adulterado. Códigos seguem RFC e CONTRATOS. Disponibilidade exige lista permitida e hash correspondente, não apenas presença no disco.

```bash
npm run test:s4:http
```

Resultado observado: **0 aprovados, 10 falhas**, sem skips. Todos falharam ao importar `src/api.mjs`, que ainda não existe. Não foram invertidas expectativas para aceitar o erro como sucesso. As asserções HTTP não foram alcançadas; a implementação poderá revelar outras lacunas. [Evidência](../output/s4.1-vermelho.json).

A suíte fica fora de `npm test` até ficar verde, como nas fatias anteriores. A referência de regressão é a suíte S3 de 150 testes já preservada; não foi repetida nesta rodada porque não houve alteração de código de produção. S4.2 deverá incorporar os testes HTTP quando aprovados. Sem chamadas à LLM e sem servidor de produção iniciado.

Commit sugerido: `test: define contrato HTTP e registra vermelho da S4.1`.

## S4.2 — servidor e executor compartilhado

`src/api.mjs` usa HTTP nativo do Node, com POST estrito, consulta, downloads restritos e uma execução ativa. Nenhuma dependência foi adicionada. `scripts/servidor.mjs` inicia a API em loopback por padrão, com execução real ou replay configurado pelo operador; o cliente só envia `dataset=case`.

A carteira aceita ID previamente alocado por HTTP e verifica seu manifesto inicial. A CLI continua criando seu próprio ID. S1 e carteira compartilham exclusão de execução no runtime. O transporte de replay/limites passou a ser específico do plugin, evitando interceptar o `fetch` de consultas HTTP concorrentes; no aplicativo, o plugin usa `fetch` nativo quando não há adaptador. As fórmulas e os schemas não foram alterados.

10 testes HTTP e três de integração API/CLI aprovados com sockets locais reais. A comparação usa o grafo e a resposta capturada, sem rede LLM: JSONs/Markdown idênticos, planilha reaberta e downloads íntegros. Replay inválido preserva três tentativas e retorna concluída com pendências. Atualizar a cópia local do plugin antes de próxima conferência no aplicativo.

Os sockets foram bloqueados pelo sandbox (`listen EPERM`); a execução autorizada fora desse bloqueio passou. Não foram substituídos por simulação de requisições. Regressões do executor S1/carteira foram executadas separadamente.

## S4.3 — persistência, publicação e reinício

Nove testes novos aprovados, mais 13 regressões HTTP/integração. Manifesto é gravado atomicamente antes do 202; falha nesse passo não inicia executor, remove a alocação incompleta e libera a próxima solicitação. Erros são sanitizados. Arquivos temporários, adulterados ou symlinks não são servidos; arquivos completos registrados continuam disponíveis se uma exportação posterior falhar.

A API reserva o diretório com lock local por PID/token antes da recuperação, impedindo uma segunda instância de interromper o job do servidor ativo. Lock de processo morto é recuperado com exclusão da recuperação. Estados antigos executando tornam-se interrompida, sem chamar executor. Não é mecanismo distribuído entre máquinas. Encerramento aborta o job, aguarda seu término e libera o diretório; checkpoints são preservados. Não oferece retomada automática.
