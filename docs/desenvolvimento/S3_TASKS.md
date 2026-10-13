# S3 — carteira e relatório por tarefa

Todas as sete tarefas autorizadas nesta rodada, com um commit por tarefa. A avaliação reservada será executada antes da execução real dos 100 processos; o prompt permanece congelado. Aceite visual dos entregáveis fica para o final.

| Tarefa | Estado e entrega |
| --- | --- |
| S3.1 | Executor implementado; 100 identidades e 52 condenações reconciliadas em replay de anotações. Execução real prevista após a avaliação reservada. |
| S3.2 | Primeira avaliação real preservada: 4/12 aptos, 6/12 com campos críticos corretos; reprovada. Prompt/gabaritos permaneceram congelados. |
| S3.3 | Auditor implementado e testado contra oráculo Fraction; execução sobre a carteira real prevista na consolidação final. |
| S3.4 | Implementada identificação por execução/data-base nas quatro abas, com dois testes novos e sete regressões do exportador verdes. |
| S3.5 | Implementado relatório executivo no grafo, com distribuições no resumo e três testes verdes. |
| S3.6 | Pendente: conferir denominadores, associações, premissas e benefício esperado. |
| S3.7 | Pendente: métricas reais e evidências finais, roteiro visual. |

## S3.1 — execução e interrupções

`src/executar-carteira.mjs` chama `analisar_lote`; interpretação, segmentação e cálculos permanecem no projeto Rivet. Lê os cinco insumos, grava snapshots, hashes, manifesto e checkpoint por identidade concluída. Interrupções preservam o checkpoint e a lista de não processados. Não oferece retomada automática: replay ou nova execução são explícitos.

Cinco testes novos passam: lote de 100 anotações, incompatibilidade de captura, HTTP 401 após primeiro caso, cancelamento e exportador indisponível. Replay não mede acurácia da LLM. `tests/fixtures/carteira-referencia.json` contém pré-anotações dos 100 dispositivos e oráculo independente Fraction, gerados sem modificar os 24 gabaritos anteriores; exige revisão assistida na auditoria S3.3 e não constitui segunda revisão humana.

O timeout global da carteira é 30 minutos; por sentença permanecem os limites do plugin S2 (3 tentativas, 10 segundos por tentativa, 40 segundos de extração). Não há tamanho de lote fixado no executor. O CLI trata SIGINT/SIGTERM e retorna o diretório mesmo em falha.

```bash
npm run test:s3:execucao
node --env-file=.env scripts/executar-carteira.mjs --real
```

Replay requer captura com respostas por identidade e hashes de todas as entradas. O modo real utiliza a credencial local e pode consumir até três chamadas por sentença. O manifesto só anuncia arquivos completos. Custo não medido permanece `null`.

## S3.2 — primeira avaliação reservada

Três testes do avaliador aprovados. A primeira rodada real processou os 12 reservados sem ajustes de prompt: 27 chamadas, 41.928 tokens informados, quatro aptos e oito pendências. Identidade e resultado corretos em 12/12; componentes corretos em 6/12, datas aplicáveis em 6/6. O reservado já havia participado do resumo-base preliminar; não é avaliação cega.

A meta não foi atingida. [Rodada inicial preservada](../output/s3.2-reservado-inicial.json). Mudanças posteriores serão testadas em desenvolvimento e qualquer repetição será rotulada como conjunto já visto, sem substituir silenciosamente a rodada original. Custo não medido permanece null.

## S3.3 — auditoria documental

O auditor compara todas as identidades, classificação, componentes, datas, meses, índices por memória, valores atualizados, subsídios, custos e decisões contra a referência preparada dos dispositivos e CSVs. Frações são comparadas por multiplicação cruzada com as frações Python. Evidências devem continuar literais; ausências, duplicatas e valores adulterados geram divergências por identidade.

Dois testes aprovados, incluindo adulteração de data, centavo, decisão e fração. A referência automática é uma ferramenta de revisão assistida, não revisão humana independente. A lista de maiores exposições, proximidade ao limiar e todas as retentativas orientará a conferência da execução real.

```bash
npm run s3:auditar -- --execucao outputs/s3/<execucao_id>
```

### Correção após a primeira avaliação

A orientação passou a explicitar zero nas vitórias, null somente nos campos não aplicáveis, preservação de pontuação/quebras e escolha de trechos contínuos sem anexar frases de rejeição. A descrição do tema também passou a pedir a causa completa. Nenhuma fórmula, referência ou schema foi flexibilizado.

A avaliação real de desenvolvimento passou em 12/12 completos e críticos, com 16 chamadas. [Evidência](../output/s3.2-desenvolvimento-correcao.json). A próxima rodada reservada será uma reavaliação de conjunto já visto, identificada por `--reavaliacao`.

## S3.4 — planilha identificada

As quatro abas mantêm filtros, cabeçalhos congelados, moeda e células tipadas. O exportador recebe somente contexto de apresentação: ID da execução e data-base. A identificação aparece em propriedades da pasta de trabalho, linha de Resumo e cabeçalho de impressão de cada aba, sem deslocar as linhas de processos. Contexto com data divergente falha antes de gravar. Dois testes novos e sete regressões do exportador aprovados.

### Reavaliação reservada

A reavaliação passou em 12/12 completos e campos críticos, sem alteração durante a própria rodada. [Evidência](../output/s3.2-reservado-reavaliacao.json). Resultado válido para este conjunto já visto; não desfaz a primeira reprovação nem comprova generalização. Fundamentos foram conferidos por literalidade e regras semânticas do grafo, sem segunda revisão humana independente.

## S3.5 — relatório executivo

O grafo produz síntese, distribuição por resultado/subsídio/tema/comarca/tribunal, estratégia de recursos, maiores exposições, exclusões e premissas. As distribuições são publicadas em `resumo.distribuicoes`, propriedade opcional para preservar a análise individual. O exportador apenas materializa as folhas desses dados na aba Resumo. Três testes verificam fechamento de grupos, dinheiro e apresentação.

A associação de subsídio usa resultados conhecidos como denominador; resultados desconhecidos aparecem separadamente. Não interpreta diferenças como efeitos causais. Probabilidades do CSV são cenários, não estimativas calibradas; benefício é esperado sob reversão integral, não economia realizada.
