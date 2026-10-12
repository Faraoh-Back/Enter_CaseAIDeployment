# S2.4 — pendências e retentativas

Implementação concluída e validada pelo SDK: **84 testes aprovados**, incluindo os 20 contratos da S2.3 e oito testes adicionais de transporte. Uma sentença por execução; carteira, fronteiras de calendário/dinheiro e cobertura de lote ficam nas próximas tarefas. [Evidência desta rodada](../output/s2.4-validacao.json).

## Comportamento entregue

| Situação | Resultado |
| --- | --- |
| Extração válida na primeira chamada | Fluxo anterior preservado, com histórico de uma tentativa. |
| JSON/data/evidência inválida, depois corrigida | Até três chamadas totais; erros objetivos retornam ao prompt e respostas rejeitadas ficam na auditoria. |
| Incerteza persistente | Uma linha `pendente_revisao`, com decisão `pendente`; atualização e benefício desconhecidos ficam `null`. |
| Falha transitória de transporte persistente | Uma linha `erro`, preservando o CNJ da entrada, sem recomendar recurso. |
| Subsídio não localizado | Uma chamada; atualização preservada, subsídio/probabilidade/benefício `null`, decisão pendente. Não converter em categoria `ausentes`. |
| Credencial, quota ou configuração inválidas | Falha global, sem retentar nem publicar outputs finais. |
| Referência global inconsistente ou identidade duplicada | Falha global; antes da LLM quando detectável na preparação. |

Falhas individuais conservam apenas campos verificados independentemente: resultado com evidência literal correspondente e componentes monetários conferidos contra o dispositivo inteiro. Valores não confirmados ficam `null`; o texto original continua na auditoria. Classificação conhecida ainda conta nas condenações, mas o processo com pendência não conta como apto. O relatório identifica exclusões e rotula o passivo conhecido como parcial.

## Decisão de implementação

O Chat Node do SDK fixado em `@ironclad/rivet-node@1.25.0` possui retentativas internas extensas (`ChatNodeBase.js`, configuração de `p-retry`). Não oferece, na configuração utilizada, o orçamento conjunto de três chamadas exigido pela S2.3. Adicionar outro ciclo ao redor dele multiplicaria as chamadas.

Foi criado o plugin local [enter-bounded-extraction](../../rivet/plugins/enter-bounded-extraction/index.js), sem dependências ou alterações em `node_modules`. Ele executa o transporte e chama `s1_validacao` a cada resposta. Os Code Nodes continuam responsáveis por interpretação, diagnóstico, cálculo e consolidação. A mesma validação é repetida na passagem final do grafo, sem nova chamada à API. O principal conserva os cinco subgrafos.

O SDK registra o plugin por [rivet-runtime.mjs](../../src/rivet-runtime.mjs). **O aplicativo precisa carregar esse plugin antes de executar o projeto atualizado.** A API de plugins e a instalação a partir de código local são documentadas pela [Rivet](https://rivet.ironcladapp.com/docs/user-guide/plugins/creating-plugins).

Limites atuais: três chamadas, dez segundos por tentativa incluindo leitura do corpo, quarenta segundos para extração e quarenta e cinco para a execução CLI. Espera transitória de 250/500 ms, elevada por `Retry-After` quando presente. Se a espera não couber com a próxima tentativa, a execução falha com diagnóstico, sem antecipar nova chamada. Cancelamento externo interrompe o grafo.

A API é chamada com `stream_options.include_usage`; o consumo agregado só é informado quando todas as tentativas fornecem contagens válidas. O uso disponível permanece registrado por tentativa. Stream sem finalização é rejeitado. Isso segue o contrato de [Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create); `custo_monetario` continua `null`.

## Auditoria e compatibilidade

`versao_extrator` passa a `s2.4-v1`. Cada item de `historico_tentativas` contém número, estado, problemas, resposta original ou `null`, uso ou `null` e status HTTP ou `null`. `tentativas` inclui falhas de transporte. Respostas inválidas nunca se tornam recomendações válidas somente por existir um JSON.

O manifesto passa a `s2.4-v1`, registra hash/snapshot do plugin, limites efetivos quando a extração termina e estado `concluida_com_pendencias` quando necessário. Os cinco artefatos de saída continuam sendo publicados; nulos são células vazias e a aba `Pendencias` recebe o diagnóstico. Uma falha global continua produzindo manifesto `falhou`.

Os seis testes antigos de extração inválida mantêm os mesmos estímulos e a exigência de impedir cálculo indevido; agora exigem também linha de pendência e três tentativas. A comparação com a captura S1.2 preserva os valores de negócio e o Markdown, alterando explicitamente apenas versão e histórico da auditoria. Evidências históricas não foram reescritas.

## Reproduzir offline

Na raiz do repositório, com Node 20.20.2 e dependências instaladas:

```bash
npm run s1:build
npm test
npm run s1:executar -- --replay
npm run s1:executar -- --replay --captura docs/output/s1.2-llm-rejeitada.json
```

Os dois últimos comandos imprimem diretórios distintos em `outputs/s1.4/`. O primeiro deve terminar `concluida`; o segundo, `concluida_com_pendencias`, com três respostas rejeitadas preservadas. Ambos geram JSONs, XLSX e Markdown. Replay não consome API nem mede qualidade atual do modelo.

Comandos focados:

- `npm run test:s2:incertezas`: 20 cenários do contrato S2.3.
- `npm run test:s2:transporte`: oito cenários, incluindo conexão simulada paralisada até o timeout real, `Retry-After`, consumo de todas as tentativas e cancelamento.
- `npm run test:s1:execucao`: sete cenários de arquivos/manifesto, inclusive XLSX reaberto com pendência.

## Carregar no aplicativo e conferir

**Aceite visual S2.4 ainda pendente.** O aceite anterior da S1.5 não certifica este novo nó. Nenhuma chamada paga foi feita nesta rodada.

1. Abra **Plugins** no Rivet e copie o diretório de instalação exibido no rodapé.
2. No mesmo sistema de arquivos do aplicativo, crie `enter-bounded-extraction-latest/package` dentro desse diretório. Copie para `package` os dois arquivos de `rivet/plugins/enter-bounded-extraction/`: `index.js` e `package.json`.
3. Execute `git init` nessa pasta `package`. O carregador local do Rivet identifica instalações de desenvolvimento pela presença de `.git`. Não é necessário fazer commit nem publicar no npm.
4. Em **Add NPM Plugin**, informe `enter-bounded-extraction`, sem versão. A instalação local deve ser reconhecida. Reinicie o aplicativo depois de atualizar os arquivos do plugin.
5. Abra `rivet/analise_sentencas.rivet-project`, confirme que o nó `s1_extrair` aparece como **Extração limitada** e use o executor Node do aplicativo com sua configuração local da OpenAI.
6. Execute `analisar_carteira`: uma entrada válida deve gerar `status_processamento=ok`, atualizado `667314`, `tentativas=1` e um histórico `aprovada`. Uma LLM real pode precisar de mais tentativas; verifique cada diagnóstico.
7. Para conferir a pendência de referência, no Graph Input `subsidios_texto` mantenha apenas `numero_processo,status_subsidios` e uma quebra de linha. Execute novamente: atualizado `667314`, decisão `pendente`, probabilidade `null`, problema `SUBSIDIO_NAO_LOCALIZADO`. Restaure o valor original depois.

A pasta precisa ser acessível ao sistema que executa o Rivet; se for Windows, copie os arquivos para o diretório Windows mostrado pelo aplicativo. O plugin usa a credencial das configurações do Rivet e não a grava no projeto. Os passos de instalação seguem a [instalação local oficial](https://rivet.ironcladapp.com/docs/user-guide/plugins).

No painel, os outputs continuam nos quatro Graph Output. Arquivos em disco são gerados pelo executor Node, não por apertar Run no painel. Conferência visual, compatibilidade específica do aplicativo instalado e qualidade da LLM real permanecem sem afirmação de aceite nesta rodada.

## Commit sugerido

```text
feat: implementa pendências e retentativas auditáveis da S2.4
```

Próxima tarefa: S2.5. Nenhum commit foi feito pelo assistente.
