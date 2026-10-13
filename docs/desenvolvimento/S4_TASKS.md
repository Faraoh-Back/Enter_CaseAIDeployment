# S4 — interface HTTP por tarefa

S3 V0 aceita visualmente pelo candidato. Nesta rodada foi concluída somente S4.1: contrato HTTP em testes deliberadamente vermelhos. A API será implementada na S4.2.

| Tarefa | Entrega | Estado |
| --- | --- | --- |
| S4.1 | Testes HTTP de POST, estado, downloads, concorrência, falhas e reinício. | Vermelho observado: 0/10 aprovados; módulo da API ausente. |
| S4.2 | Servidor Node e executor compartilhado com CLI; uma execução ativa. | Pendente |
| S4.3 | Manifesto antes do 202, artefatos íntegros e recuperação após reinício. | Pendente |
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
