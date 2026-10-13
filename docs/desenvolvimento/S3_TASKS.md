# S3 — carteira e relatório por tarefa

Todas as sete tarefas autorizadas nesta rodada, com um commit por tarefa. A avaliação reservada será executada antes da execução real dos 100 processos; o prompt permanece congelado. Aceite visual dos entregáveis fica para o final.

| Tarefa | Estado e entrega |
| --- | --- |
| S3.1 | Executor implementado; 100 identidades e 52 condenações reconciliadas em replay de anotações. Execução real prevista após a avaliação reservada. |
| S3.2 | Pendente: avaliação real de 12 reservados, métricas por campo e hashes. |
| S3.3 | Pendente: auditoria independente da classificação, datas, dinheiro e decisões dos 100 casos. |
| S3.4 | Pendente: planilha identificada por execução e data-base, reabertura e reconciliação. |
| S3.5 | Pendente: relatório executivo com distribuições, recursos e limites. |
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
