# S2.2 — quatro resultados normalizados

A S2.2 está concluída. Procedência, parcial procedência, improcedência e extinção agora produzem uma linha válida pelos mesmos Graph Outputs públicos. A execução ainda aceita somente uma sentença; lote, dados incompletos e retentativas pertencem às próximas tarefas.

## Mudança implementada

- [validar.js](../rivet/code/s1/validar.js) mantém schema e validação semântica antes de reconhecer uma vitória. Improcedência/extinção válidas recebem total zero, meses/custo nulos e sinalização interna `sem_condenacao`. Não são consultados mês-base ou data de citação para atualizar essas vitórias.
- [calcular.js](../rivet/code/s1/calcular.js) trata a sinalização e retorna principal/juros/atualizado zero, benefício nulo, decisão `nao_recorrer` e memória nula. A fórmula de condenações não é executada nesse caminho. Nas condenações, delega ao código financeiro S0, incorporado sem alterações pelo build.
- [consolidar.js](../rivet/code/s1/consolidar.js) atribui motivo `sem_condenacao`, índices nulos e contagens corretas. Um relatório específico apresenta custo e benefício como não aplicáveis, sem converter `null` em moeda. A extinção traz a ressalva sobre ausência de resolução do mérito.
- O projeto gerado preserva os cinco subgrafos. Os schemas não precisaram mudar; suas propriedades nulas e os quatro resultados já estavam previstos.

| Campo | Vitória válida |
| --- | --- |
| `status_processamento` | `ok` |
| `valor_condenacao_centavos` | 0 |
| `mes_base_correcao`, `data_citacao`, `meses_completos` | `null` |
| Principal corrigido, juros e atualizado | 0 |
| `custo_recurso_centavos`, `beneficio_esperado_centavos` | `null` |
| `decisao_recurso`, `motivo_decisao` | `nao_recorrer`, `sem_condenacao` |
| Auditoria: índices e memória | `null` |
| Resumo: vitórias / condenações / aptos | 1 / 0 / 1 |

Subsídios e probabilidade permanecem como referência do CSV, sem simulação de recurso para a vitória. As verificações globais dos CSVs na preparação permanecem; sua política de falhas será revisada nas tarefas de incerteza.

## Validação

O vermelho S2.1 tinha 7 aprovações e 6 falhas, todas pela restrição a condenações. A implementação foi validada pelos mesmos 13 testes, sem retirar assertions, ignorar cenários ou alterar os gabaritos. Agora todos passam. A suíte foi adicionada ao comando padrão:

```bash
npm test
npm run test:s2
```

`npm test`: **56 aprovados**, sendo os 43 anteriores e os 13 da S2. O teste da S1.5 continua comparando integralmente os quatro outputs do caso de condenação com a captura anterior; essa equivalência foi preservada. O cálculo racional também continua comparado ao oráculo financeiro independente nas seis condenações de desenvolvimento.

[docs/output/s2.2-validacao.json](output/s2.2-validacao.json) contém o hash do projeto, contagens e os quatro outputs de dois exemplos: uma improcedência e uma extinção. As respostas LLM são simuladas a partir dos gabaritos de desenvolvimento e os outputs são produzidos pelo SDK executando o grafo real. Nenhuma chamada paga foi feita; essa evidência não mede acurácia do modelo nos novos resultados. O conjunto reservado não foi utilizado nos testes novos.

O executor local continua usando o caso de desenvolvimento definido na S1; a ampliação dos resultados foi exercitada pelas entradas do grafo nos testes. Esta tarefa não adiciona seleção de outros processos à CLI nem roda a carteira completa.

## Aceite S1.5 e saídas do aplicativo

O candidato informou ter conferido a S1.5 visualmente seguindo o roteiro. Os arquivos locais daquela execução foram reconferidos: hashes, atualizado de R$ 6.673,14, benefício de −R$ 2.532,69, `nao_recorrer`, cobertura e célula XLSX. O [aceite](output/s1.5-aceite.json) distingue o relato visual do candidato da conferência automatizada dos arquivos de replay. A S1.5 foi concluída no plano.

No painel Rivet, este projeto entrega dados nos nós Graph Output. A geração de arquivos acontece no comando Node; ele não importa automaticamente os resultados da execução no painel. `--replay` reproduz uma captura anterior; `--real` faz uma nova chamada e grava seus próprios artefatos. O diretório efetivo é informado no terminal. O aceite da S1.5 não é apresentado como inspeção visual da nova S2.2.

Próxima tarefa: **S2.3**, testes de aceitação das incertezas. Commit sugerido: `feat: normaliza os quatro resultados de sentença no Rivet`.
