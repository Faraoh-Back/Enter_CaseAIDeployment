# S3 — carteira completa, avaliação e entregáveis

Implementação e validação local das sete tarefas concluídas. **150 testes determinísticos aprovados; execução real dos 100 processos concluída, sem pendências.** Aceite visual dos novos entregáveis ainda pendente.

## Resultados da carteira real

| Medida | Resultado |
| --- | ---: |
| Identidades / auditorias / linhas da planilha | 100 / 100 / 100 |
| Aptos / pendências / erros técnicos | 100 / 0 / 0 |
| Vitórias / condenações | 48 / 52 |
| Improcedências / extinções | 26 / 22 |
| Procedências / parciais | 35 / 17 |
| Passivo atualizado até 31/05/2026 | R$ 309.174,54 |
| Recursos economicamente recomendados | 17 |
| Custo considerado dos recursos | R$ 54.400,00 |
| Benefício líquido esperado | R$ 24.676,16 |
| Primeira tentativa aprovada | 90 / 100 |
| Casos com retentativa / chamadas reais | 10 / 111 |
| Tempo da execução real | 272.249 ms (4min32s) |
| Tokens de entrada / saída / total | 145.716 / 36.753 / 182.469 |
| Divergências na auditoria documental | 0 |

[Planilha](../output/s3/processos.xlsx), [relatório executivo](../output/s3/relatorio.md), [processos](../output/s3/processos.json), [auditoria](../output/s3/auditoria.json), [controle documental](../output/s3/auditoria-documental.json), [métricas](../output/s3/metricas.json) e [manifesto da extração real](../output/s3/manifest-extracao-real.json).

O passivo soma os valores finais por processo. Custo e benefício somam somente os 17 recursos selecionados. As probabilidades são os cenários fornecidos no CSV, sem calibração empírica. Reversão integral, custo informado e política de arredondamento são premissas; o benefício não representa economia realizada. Cabimento, prazo e reforma parcial exigem análise jurídica posterior.

## Avaliação reservada: falha preservada e correção declarada

| Rodada | Aptos / total | Críticos corretos / total | Chamadas | Tokens |
| --- | --- | --- | ---: | ---: |
| Reservado inicial, prompt congelado | 4 / 12 | 6 / 12 | 29 | 41.928 |
| Desenvolvimento após correção | 12 / 12 | 12 / 12 | 16 | 26.579 |
| Reavaliação reservada, conjunto já visto | 12 / 12 | 12 / 12 | 15 | 24.914 |

A primeira reprovação não foi substituída. Seus problemas incluíram componentes monetários nulos em vitórias e evidências não literais. O prompt passou a explicitar zeros, campos não aplicáveis e preservação de pontuação/quebras, sem flexibilizar o validador. A correção foi avaliada em desenvolvimento antes da reavaliação. Os 12 reservados também já haviam participado do resumo-base preliminar; nenhuma rodada é apresentada como avaliação cega ou prova de generalização.

Evidências: [reservado inicial](../output/s3.2-reservado-inicial.json), [desenvolvimento](../output/s3.2-desenvolvimento-correcao.json) e [reavaliação](../output/s3.2-reservado-reavaliacao.json). Os hashes comprovam ausência de alteração de prompt/schema/gabaritos durante cada rodada, e a reavaliação tem flag explícita. Todas as nove propriedades comparadas por igualdade (incluindo tema, classe e comarca) passaram na reavaliação. Fundamentos admitem síntese: literalidade da evidência e regras semânticas do grafo não equivalem a uma segunda revisão humana independente.

Total dessas três rodadas e da carteira: **171 chamadas e 275.890 tokens informados**. Não foi adicionada uma tabela verificável de preços com vigência; custo monetário permanece `null` em vez de estimativa não sustentada.

## Auditoria e método

A referência dos 100 dispositivos foi preparada com regex específica para este corpus e `fractions.Fraction` em Python, sem modificar os 24 gabaritos anteriores. Não é código da análise de produção nem resultado da LLM. O auditor compara identidade, resultado, componentes, datas, meses completos, subsídios, probabilidades, custo, atualização, benefício e decisão em todos os casos. As frações de total/benefício são confrontadas por multiplicação cruzada e as evidências devem ser literais.

Foram identificados os maiores valores e os dez casos mais próximos do limiar, além de todas as retentativas. A inspeção assistida das dez retentativas mostrou problemas de evidência de fundamentação; todos terminaram aprovados. Houve uma sentença com três tentativas e nove com duas. O auditor não encontrou divergência na classificação dos 100 ou nas finanças das 52 condenações. Essa revisão é assistida por IA, sem segundo revisor humano independente; a lista de prioridades permanece disponível para o candidato.

A regra de negócio continua no Rivet. O executor Node lê insumos, transporta chamadas, registra eventos e grava arquivos. Checkpoints preservam identidades concluídas após falha global; não existe retomada automática. Cada sentença conserva três tentativas totais, timeout de 10 segundos por chamada e 40 segundos para extração; carteira tem limite de 30 minutos.

Tempo global é medido no manifesto. Durações individuais dos checkpoints da primeira execução não foram usadas nas métricas: a associação do timestamp ao campo `numero` da preparação foi corrigida para as próximas execuções. Consumo inclui as tentativas rejeitadas; se qualquer chamada não informar uso, o total completo vira `null` e somente o consumo parcial é mostrado.

## Finalização sem novas chamadas

Os artefatos selecionados em `docs/output/s3/` resultam da reconsolidação dos outputs reais no subgrafo `s2_consolidacao_lote`, com o template executivo final. Processos e auditorias são preservados integralmente, inclusive respostas, tokens e histórico. Somas do resumo devem coincidir com a execução original; hashes da origem são verificados antes de gerar os arquivos.

[Manifesto de finalização](../output/s3/manifest.json) registra origem, hashes e zero chamadas novas. [Projeto completo](../output/s3/projeto.rivet-project) tem os cinco insumos reais como defaults, plugin declarado e `analisar_lote` principal. Executá-lo novamente usa a API. [Projeto de aceite offline](../output/s3/aceite-consolidacao.rivet-project) já contém os 100 resultados para conferir somente a consolidação, sem API. Nenhum deles contém a credencial local.

O XLSX tem quatro abas com filtros, cabeçalhos congelados, identificação da execução/data-base em Resumo e cabeçalhos de impressão. Dinheiro continua numérico; desconhecido é vazio e zero conhecido é número. O resumo materializa as distribuições recebidas do grafo. O relatório evita repetir os 100 detalhes da planilha: mostra síntese, grupos, 17 recursos, dez maiores exposições e eventuais pendências.

## Testes e reprodução

```bash
npm test
npm run test:s3:execucao
npm run test:s3:avaliacao
npm run test:s3:auditoria
npm run test:s3:xlsx
npm run test:s3:relatorio
npm run test:s3:premissas
npm run test:s3:metricas
npm run test:s3:finalizacao
```

Testes são offline, sem `.env` ou chamadas pagas. As 22 novas verificações S3 incluem o grafo dos 100 casos com anotações, interrupções, avaliação, auditoria adulterada, planilha, distribuições, premissas, tokens incompletos e reconsolidação de origem íntegra. As 128 anteriores foram mantidas.

Para uma nova execução real deliberada:

```bash
node --env-file=.env scripts/executar-carteira.mjs --real
```

Depois, usando o diretório que o comando informar:

```bash
npm run s3:auditar -- --execucao outputs/s3/<execucao_id>
npm run s3:metricas -- --execucao outputs/s3/<execucao_id>
npm run s3:finalizar -- --execucao outputs/s3/<execucao_id>
```

Auditoria, métricas e finalização não chamam a API. Avaliação reservada real explícita: `node --env-file=.env scripts/avaliar-reservado.mjs --real --reavaliacao`; essa opção declara conjunto já visto. Replay de carteira requer arquivo com `respostas` por identidade, modelo e hashes de todas as entradas; não é avaliação real.

## Aceite visual ao final — pendente

1. Abra [processos.xlsx](../output/s3/processos.xlsx) no Calc: 100 linhas de processos, quatro abas, moeda legível, filtros, identidade e data-base. Confira 48 vitórias, 52 condenações e os três totais da tabela inicial. A aba Pendencias deve conter somente cabeçalho.
2. Abra a prévia de [relatorio.md](../output/s3/relatorio.md): síntese compreensível, 17 recomendações, tabelas legíveis, distinção entre associação e causalidade e entre benefício esperado e economia realizada.
3. Abra [aceite-consolidacao.rivet-project](../output/s3/aceite-consolidacao.rivet-project) no Rivet, com o plugin local atualizado. Execute `s2_consolidacao_lote` sem editar inputs e sem API. Confira 100 processos/auditorias, resumo igual ao JSON e relatório igual ao exemplo. Não execute `analisar_lote` nessa conferência offline.
4. Informe versão do aplicativo e resultado dessas verificações para registrar o aceite visual. Plugin, calendário e dois cenários reais individuais já foram aceitos na S2; isso não substitui a leitura dos novos artefatos da carteira.

API e pacote final pertencem à S4/S5. Esta etapa conclui a implementação e a validação local da S3; não declara antecipadamente o aceite visual ou a reprodução do ZIP final.
