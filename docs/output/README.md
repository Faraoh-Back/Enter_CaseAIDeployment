# Outputs e evidências de validação

Esta pasta reúne os registros preservados das verificações do projeto. Os relatórios que os explicam ficam em `docs/`.

| Arquivo | O que registra |
| --- | --- |
| [s0-offline.json](s0-offline.json) | Prova do cálculo, schema e XLSX pelo SDK. |
| [s0-llm.json](s0-llm.json) | Chamada mínima à OpenAI pelo SDK. |
| [s0-reproducao.json](s0-reproducao.json) | Instalação limpa e reprodução das provas. |
| [s0-aplicativo.json](s0-aplicativo.json) | Outputs enviados pelo candidato dos três grafos no aplicativo; encerra a pendência de desktop da S0. |
| [s1.1-vermelho.json](s1.1-vermelho.json) | Falhas observadas nos testes de aceitação S1 antes da implementação; regressão S0 aprovada. |
| [s1.2-llm-rejeitada.json](s1.2-llm-rejeitada.json) | Resposta real rejeitada por citações não literais, preservada como regressão. |
| [s1.2-llm-aprovada.json](s1.2-llm-aprovada.json) | Extração real aprovada após ajuste do prompt, quatro outputs, consumo e hashes. |
| [resumo-aplicativo-recebido.csv](resumo-aplicativo-recebido.csv) | Transcrição normalizada dos 100 resumos do grafo-base. |
| [resumo-aplicativo-conferencia.json](resumo-aplicativo-conferencia.json) | Confronto desses resumos com os insumos originais. |
| [resumo-aplicativo-metricas.json](resumo-aplicativo-metricas.json) | Consumo e anomalia de custo informados no resumo-base. |

Os registros anteriores são históricos: por exemplo, `s0-offline.json` ainda informa que aguardava a conferência no desktop quando foi produzido. A confirmação posterior está em `s0-aplicativo.json` e em [S0_VALIDACAO.md](../S0_VALIDACAO.md).

Execuções dos comandos locais continuam gerando arquivos em `outputs/s0/` e `outputs/s1.2/`, fora do Git. `docs/output/` guarda as evidências selecionadas para revisão, com sua origem declarada; esses arquivos não são sobrescritos pelos comandos locais. A avaliação S1.2 e seus limites estão em [S1_2_VALIDACAO.md](../S1_2_VALIDACAO.md).
