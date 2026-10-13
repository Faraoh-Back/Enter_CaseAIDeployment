# Validação final

Conferi o enunciado contra o projeto, os entregáveis e as evidências. Minha análise está implementada no Rivet; Node materializa os arquivos e oferece a interface HTTP. Mantive os registros originais de cada rodada, inclusive reprovações, sem substituir métricas de extração por métricas de replay.

## Execução real da carteira

| Medida | Resultado |
| --- | ---: |
| Processos identificados / concluídos / aptos | 100 / 100 / 100 |
| Condenações / vitórias | 52 / 48 |
| Procedência / parcial procedência | 35 / 17 |
| Improcedência / extinção | 26 / 22 |
| Pendências / erros técnicos | 0 / 0 |
| Passivo atualizado para 31/05/2026 | R$ 309.174,54 |
| Recursos recomendados | 17 |
| Custo dos recursos recomendados | R$ 54.400,00 |
| Benefício líquido esperado | R$ 24.676,16 |
| Chamadas reais | 111 |
| Aprovação na primeira tentativa | 90/100 |
| Casos com retentativa | 10: nove com duas chamadas, um com três |
| Tempo global | 272.249 ms, aproximadamente 4 min 32 s |
| Tokens de entrada / saída / total | 145.716 / 36.753 / 182.469 |
| Custo monetário da API | Não confirmado; nulo |

A [auditoria documental](../output/s3/auditoria-documental.json) confrontou os 100 resultados e as finanças das 52 condenações com anotações e frações independentes: zero divergência. Esse controle automatizado aproveita a regularidade do material. Usei IA na revisão, sem segundo revisor humano independente. Não uso os tempos individuais da primeira execução como métrica, porque a associação de timestamps exigiu uma correção posterior.

## Avaliações da extração

| Rodada | Aptos | Campos críticos corretos | Chamadas | Tokens | Interpretação |
| --- | ---: | ---: | ---: | ---: | --- |
| Reservada inicial | 4/12 | 6/12 | 29 | 41.928 | Meta reprovada; evidência preservada. |
| Desenvolvimento após correção | 12/12 | 12/12 | 16 | 26.579 | Prompt ajustado e verificado em desenvolvimento. |
| Reservada repetida | 12/12 | 12/12 | 15 | 24.914 | Conjunto já visto, sem alegação de teste cego. |

Os 12 reservados já haviam aparecido no resumo preliminar dos 100 casos. A repetição não desfaz a reprovação inicial nem comprova generalização. Nas quatro rodadas S3, incluindo a carteira, foram **171 chamadas e 275.890 tokens**. [Histórico S3](../validacao/S3_VALIDACAO.md).

## Testes e reprodução técnica

A S4 encerrou com **175 testes aprovados**, sem skips. Verifiquei contratos, calendário, centavos, evidências, estados de falha, reconciliação, planilhas reabertas, HTTP real, concorrência e recuperação após crash. O curl com 100 respostas capturadas produziu os mesmos totais, com zero chamadas pagas. Não fiz uma nova execução paga por POST. [Evidência S4](../output/s4/validacao-final.json).

A suíte atual reúne **188 cenários aprovados**: 175 regressões e 13 verificações finais S5. Registrei os escopos e hashes dos logs em [testes.json](../output/s5/testes.json). Na S5, acrescentei verificações de PDF, preservação dos números, fonte explícita, publicação HTTP e lista positiva do pacote. O registro [S5](../output/s5/revisao.json) registra os resultados efetivamente executados. O PDF de teste/prévia usa uma fonte controlada substituta e está identificado como tal; ele não encerra a exigência de Times New Roman nem a adaptação ao modelo escolhido.

Reconsolidei os outputs reais no Rivet para remover repetições e acrescentar conclusões. Processos, resumo e auditoria permanecem iguais à S3; não fiz novas chamadas à LLM. Os novos artefatos têm [manifesto próprio](../output/s5/manifest.json). Preservei o manifesto histórico S3.

## Conferência dos entregáveis e pendências

Conferi visualmente as quatro abas e o conteúdo executivo V0 na S3. Na S5, reabri a planilha por código para comparar cada campo e inspecionei as páginas rasterizadas da prévia do PDF. Registrei esses métodos separadamente; não apresento uma prévia como aceite visual da versão final.

O racional é um documento separado e curto, que escrevi na primeira pessoa com decisões, uso de IA e limitações. A documentação atual corrige trechos que ainda anunciavam funcionalidades já implementadas. Registros capturados mantêm seus bytes para preservar hashes.

Ainda vou concluir: adaptação ao modelo e fonte final do PDF (S5.10), sua conferência final (parte de S5.3), montagem do ZIP (S5.4), reprodução após extração (S5.6), demonstração final do projeto no aplicativo (S5.7), ensaio da defesa e envio. O roteiro está em [REPRODUCAO.md](REPRODUCAO.md). Não marco essas tarefas antes da prova correspondente.
