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
| [s1.3-processos.xlsx](s1.3-processos.xlsx) | Planilha gerada dos outputs reais capturados na S1.2, sem nova chamada ao modelo. |
| [s1.3-xlsx.json](s1.3-xlsx.json) | Reabertura da planilha, valores conferidos, origem e hashes. |
| [s1.4-execucao.json](s1.4-execucao.json) | Manifesto e conferência da execução integrada em replay, com hashes. |
| [s1.4-processos.xlsx](s1.4-processos.xlsx) | Planilha produzida pelo grafo e exportador na mesma execução. |
| [s1.4-relatorio.md](s1.4-relatorio.md) | Relatório produzido pelo grafo nessa execução. |
| [s1.5-validacao.json](s1.5-validacao.json) | Refatoração, suíte completa, replay integrado e status pendente do aceite visual. |
| [s2.1-vermelho.json](s2.1-vermelho.json) | Aceitação dos quatro resultados: 7 aprovados, 6 falhas observadas e regressão S0/S1. |
| [s1.5-aceite.json](s1.5-aceite.json) | Aceite visual informado pelo candidato e reconferência dos arquivos locais de replay. |
| [s2.2-validacao.json](s2.2-validacao.json) | 56 testes aprovados e exemplos de outputs para improcedência e extinção, com LLM simulada. |
| [s2.3-vermelho.json](s2.3-vermelho.json) | 20 cenários de incerteza: 5 aprovados, 15 falhas e regressão anterior verde. |
| [s2.4-validacao.json](s2.4-validacao.json) | 84 testes offline aprovados, hashes e exemplos reais do grafo com transporte simulado; aceite visual pendente. |
| [resumo-aplicativo-recebido.csv](resumo-aplicativo-recebido.csv) | Transcrição normalizada dos 100 resumos do grafo-base. |
| [resumo-aplicativo-conferencia.json](resumo-aplicativo-conferencia.json) | Confronto desses resumos com os insumos originais. |
| [resumo-aplicativo-metricas.json](resumo-aplicativo-metricas.json) | Consumo e anomalia de custo informados no resumo-base. |

Os registros anteriores são históricos: por exemplo, `s0-offline.json` ainda informa que aguardava a conferência no desktop quando foi produzido. A confirmação posterior está em `s0-aplicativo.json` e em [S0_VALIDACAO.md](../validacao/S0_VALIDACAO.md).

Execuções dos comandos locais continuam gerando arquivos em `outputs/s0/`, `outputs/s1.2/` e `outputs/s1.4/`, fora do Git. `docs/output/` guarda as evidências selecionadas para revisão, com sua origem declarada; esses arquivos não são sobrescritos pelos comandos locais. A avaliação S1.2 e seus limites estão em [S1_2_VALIDACAO.md](../validacao/S1_2_VALIDACAO.md).
