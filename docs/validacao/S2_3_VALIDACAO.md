# S2.3 — aceitação das incertezas

Nesta tarefa foram escritos os contratos observáveis e os testes para a S2.4. O grafo e o executor de produção não foram alterados. [tests/s2-incertezas.test.mjs](../../tests/s2-incertezas.test.mjs) usa o caso de desenvolvimento da S1, mutações sintéticas e respostas HTTP simuladas; nenhuma credencial ou chamada de rede real é utilizada.

## Política exigida pelos testes

| Situação | Comportamento esperado |
| --- | --- |
| JSON ou extração inválida, depois resposta válida | Retentar e produzir processo `ok`, preservando histórico da resposta rejeitada. |
| Extração persistentemente inválida | Até três tentativas totais; uma linha `pendente_revisao`, decisão `pendente` e problema explícito. |
| Data ausente/impossível/futura, componente desconhecido ou evidência inventada | Preservar campos verificáveis, sem preencher com zero o que é desconhecido. Após esgotar tentativas, pendência. |
| CNJ divergente | Preservar identidade da entrada; descartar classificação e valor extraídos de identidade divergente. Pendência após três tentativas. |
| Subsídio não localizado | Não presumir `ausentes`. Preservar cálculo monetário verificável; subsídios, probabilidade e benefício desconhecidos ficam nulos; decisão pendente, sem repetir extração válida por falta de referência individual. |
| HTTP 503 seguido de JSON inválido e resposta válida | Três requisições totais, contando transporte e validação no mesmo limite. |
| HTTP transitório/timeout de transporte persistente | Após três tentativas, uma linha `erro`, identidade preservada e decisão pendente. |
| Credencial inválida ou quota esgotada | Interromper globalmente após uma requisição; não retentar. |
| CSV global duplicado, custo/índice necessário ausente | Falhar a execução, sem anunciar outputs finais; evitar chamadas quando a falha for detectável na preparação. |
| Identidade duplicada entre blocos | Falhar antes de chamar a LLM, com diagnóstico de duplicidade. Não confundir esse caso com uma recusa genérica de lote. |

No cenário de índice-base ausente, a referência necessária só é identificada após extrair a sentença; uma chamada é esperada, sem retentativas para corrigir CSV. Índice final e custo ausentes são detectáveis antes da extração. Esses casos mantêm a política de referências globais inválidas definida no contrato geral.

Os códigos mínimos exigidos para problemas individuais são `EXTRACAO_INVALIDA`, `DADO_AUSENTE`, `DATA_INVALIDA`, `DATA_FUTURA`, `IDENTIDADE_DIVERGENTE`, `SUBSIDIO_NAO_LOCALIZADO` e `FALHA_TRANSPORTE`. Deve existir mensagem não vazia com o diagnóstico.

## Auditoria e cobertura

A S2.4 deverá acrescentar `historico_tentativas` à auditoria dos cenários de recuperação/falha aqui observados. Cada item registra `numero` sequencial, `estado` (`aprovada`, `extracao_invalida` ou `falha_transporte`) e problemas quando não aprovado. Uma resposta de extração rejeitada permanece em `resposta_original`; o teste de reparação confere o conteúdo exato. `tentativas` reflete requisições de transporte, inclusive as que falharam antes de produzir JSON.

Nenhuma linha pode desaparecer por falha individual. Processo e resumo devem passar pelos schemas canônicos, inclusive no caminho de pendência; a resposta original inválida permanece na auditoria. Com resultado verificável e data inválida, a classificação continua contribuindo para a contagem de condenações, mas o caso não conta como totalmente apto. JSON ilegível, identidade divergente ou falha de transporte deixam resultado e principal desconhecidos.

O resumo conta pendências e desconhecidos; o passivo soma apenas valores calculados. Zero nessa soma não afirma que o passivo completo seja zero: o relatório precisa informar cobertura/exclusão e identificar o processo pendente. Com subsídio ausente, o atualizado conhecido permanece R$ 6.673,14; a recomendação fica pendente. Campos específicos de cobertura financeira e decisória, especialmente para lote misto, serão completados na S2.5.

As condições mais estritas dos testes S1 sobre falha terminal por dados individuais inválidos precisarão ser migradas na S2.4 para esse contrato. Preservar a intenção de impedir cálculo indevido e acrescentar a linha de pendência; não retirar cobertura apenas para obter verde. Schemas que precisarem evoluir devem mudar junto com a implementação, antes de publicar o novo contrato de produção.

## Resultado observado

```bash
npm test
npm run test:s2:incertezas
```

- `npm test`: **56 aprovados**, saída 0. Continua representando S0, S1 e os quatro resultados válidos da S2.2.
- `npm run test:s2:incertezas`: **20 cenários, 5 aprovados e 15 falhas**, saída 1. Não há `skip`, `todo` ou inversão para transformar essas falhas em sucesso.

Os cinco aprovados são: HTTP 401 sem retentativa, índice duplicado, custo ausente, índice final ausente e índice-base ausente. Os demais expõem ausência de reparo/pendências, limite de transporte inadequado para os novos requisitos e diagnóstico genérico de duplicidade.

A execução real do SDK mostrou que retries internos de HTTP não substituem o ciclo de validação: o cenário 503 → JSON inválido aborta antes de reparar a extração. Em erros persistentes ou quota, a guarda do teste impede continuar além de três respostas simuladas. O quarto acesso interceptado é contado e interrompido, deixando a violação visível. O timeout simulado é uma exceção de transporte `ETIMEDOUT`; não mede o comportamento de uma conexão real paralisada.

Cada teste usa limite de 12 segundos e aborta acessos além do orçamento. O transporte é totalmente interceptado. Falhas no próprio mock de endpoint/schema são propagadas, sem mascará-las como falha esperada de produção. Os asserts após as falhas precoces ainda não foram exercitados; esta rodada define o vermelho, não comprova o comportamento futuro.

[Evidência da rodada](../output/s2.3-vermelho.json). A suíte permanece fora de `npm test` até a implementação S2.4 ficar verde. Essa separação é explícita e temporária.

## Organização documental

Todos os itens de trabalho do plano agora têm IDs. S2.5 reúne fronteiras e cobertura numa tarefa, mantendo a divisão de seis tarefas S2 já acordada. Documentos foram movidos para `docs/arquitetura/`, `docs/desenvolvimento/` e `docs/validacao/`; o plano central continua em `docs/PLANO_DE_EXECUCAO.md` e os arquivos de evidência continuam em `docs/output/`. Links relativos foram atualizados e verificados. JSONs históricos não foram reescritos.

Sugestões de commits separados para facilitar revisão:

1. `docs: organiza documentação e numera todas as tarefas do plano`
2. `test: define pendências e limite de retentativas da S2`

Nenhum commit foi feito pelo assistente. A próxima tarefa é somente **S2.4**.
