# Outputs e evidências de validação

Esta pasta reúne os registros preservados das verificações do projeto. Os relatórios que os explicam ficam em `docs/`.

| Arquivo | O que registra |
| --- | --- |
| [s0-offline.json](s0-offline.json) | Prova do cálculo, schema e XLSX pelo SDK. |
| [s0-llm.json](s0-llm.json) | Chamada mínima à OpenAI pelo SDK. |
| [s0-reproducao.json](s0-reproducao.json) | Instalação limpa e reprodução das provas. |
| [s0-aplicativo.json](s0-aplicativo.json) | Outputs enviados por mim dos três grafos no aplicativo; encerra a pendência de desktop da S0. |
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
| [s1.5-aceite.json](s1.5-aceite.json) | Aceite visual informado por mim e reconferência dos arquivos locais de replay. |
| [s2.2-validacao.json](s2.2-validacao.json) | 56 testes aprovados e exemplos de outputs para improcedência e extinção, com LLM simulada. |
| [s2.3-vermelho.json](s2.3-vermelho.json) | 20 cenários de incerteza: 5 aprovados, 15 falhas e regressão anterior verde. |
| [s2.4-validacao.json](s2.4-validacao.json) | 84 testes offline aprovados, hashes e exemplos reais do grafo com transporte simulado; aceite visual pendente. |
| [s2.5-validacao.json](s2.5-validacao.json) | 122 testes, vermelho observado, hashes e lote misto de sete casos com transporte simulado. |
| [s2.5-relatorio.md](s2.5-relatorio.md) | Relatório do lote misto, com exclusões financeiras e decisórias explícitas. |
| [s2-aplicativo-sem-subsidio.json](s2-aplicativo-sem-subsidio.json) | Cenário real sem linha de subsídio: atualização preservada, decisão pendente e uma tentativa aprovada, conforme outputs que registrei. |
| [s2-aplicativo-extracao-real.json](s2-aplicativo-extracao-real.json) | Outputs enviados por mim da extração real no aplicativo: uma sentença, primeira tentativa aprovada, evidências e financeiro conferidos. |
| [s2-aplicativo-aceite-parcial.json](s2-aplicativo-aceite-parcial.json) | Plugin e calendário confirmados por mim; quatro outputs da consolidação recebidos e revisados; demais verificações pendentes. |
| [s2.6-validacao.json](s2.6-validacao.json) | 128 testes, reconciliação integrada, hashes e entradas prontas para aceite offline da consolidação no aplicativo. |
| [s2.6-processos.xlsx](s2.6-processos.xlsx) | Sete processos, resumo, auditoria e pendências exportados na prova S2.6. |
| [s2.6-relatorio.md](s2.6-relatorio.md) | Markdown da mesma execução S2.6, reconciliado com JSON e XLSX. |
| [s3.2-reservado-inicial.json](s3.2-reservado-inicial.json) | Primeira avaliação real reservada reprovada, preservada com hashes e outputs. |
| [s3.2-desenvolvimento-correcao.json](s3.2-desenvolvimento-correcao.json) | Correção de orientação validada nos 12 casos de desenvolvimento. |
| [s3.2-reservado-reavaliacao.json](s3.2-reservado-reavaliacao.json) | Reavaliação explicitamente de conjunto já visto: 12/12 aptos/críticos. |
| [s4/validacao-final.json](s4/validacao-final.json) | 175 testes, hashes, processos CLI e zero chamadas à LLM na S4. |
| [s4/curl.json](s4/curl.json) | Sequência curl real com os 100 casos em replay e cinco downloads íntegros. |
| [s4.4-revisao.json](s4.4-revisao.json) | Responsabilidades e equivalência API/CLI conferidas. |
| [s4.1-vermelho.json](s4.1-vermelho.json) | Dez testes deliberadamente vermelhos para a API ainda não implementada; asserções HTTP não exercitadas nesta rodada. |
| [s3-aceite-visual.json](s3-aceite-visual.json) | Aceite visual V0 da planilha, conteúdo do relatório e consolidação Rivet informado por mim; PDF fica na S5.10. |
| [s3/manifest.json](s3/manifest.json) | Artefatos finais reconsolidados sem LLM, vinculados à execução real. |
| [s3/processos.xlsx](s3/processos.xlsx) | Carteira de 100 linhas com quatro abas e identificação da execução. |
| [s3/relatorio.md](s3/relatorio.md) | Relatório executivo final gerado no grafo. |
| [s3/manifest-extracao-real.json](s3/manifest-extracao-real.json) | Execução real dos 100, hashes, 111 chamadas e duração. |
| [s3/auditoria-documental.json](s3/auditoria-documental.json) | Zero divergências e prioridades de revisão. |
| [s3/metricas.json](s3/metricas.json) | Tempo, tentativas, tokens completos e custo não medido null. |
| [resumo-aplicativo-recebido.csv](resumo-aplicativo-recebido.csv) | Transcrição normalizada dos 100 resumos do grafo-base. |
| [resumo-aplicativo-conferencia.json](resumo-aplicativo-conferencia.json) | Confronto desses resumos com os insumos originais. |
| [resumo-aplicativo-metricas.json](resumo-aplicativo-metricas.json) | Consumo e anomalia de custo informados no resumo-base. |

Os registros anteriores são históricos: por exemplo, `s0-offline.json` ainda informa que aguardava a conferência no desktop quando foi produzido. A confirmação posterior está em `s0-aplicativo.json` e em [S0_VALIDACAO.md](../validacao/S0_VALIDACAO.md).

Execuções dos comandos locais continuam gerando arquivos em `outputs/s0/`, `outputs/s1.2/` `outputs/s1.4/` e `outputs/s2.6/`, fora do Git. `docs/output/` guarda as evidências selecionadas para revisão, com sua origem declarada; esses arquivos não são sobrescritos pelos comandos locais. A avaliação S1.2 e seus limites estão em [S1_2_VALIDACAO.md](../validacao/S1_2_VALIDACAO.md).

## Preservação dos registros

Mantenho os bytes dos JSONs, planilhas, projetos e relatórios capturados nas rodadas anteriores. Referências a participantes dentro desses registros são metadados históricos; reescrevê-los alteraria os hashes que sustentam a auditoria. Minha documentação atual usa uma única voz, sem ocultar o apoio de IA.

## Fechamento S5

Reconsolidei os dados reais em [s5/manifest.json](s5/manifest.json), preservando os JSONs e o histórico S3. A [revisão](s5/revisao.json) confere hashes, defaults e a planilha com 100 linhas × 23 campos. O [relatório fonte](s5/relatorio.md) reduz repetições e acrescenta conclusões. A prévia PDF é somente prova técnica de apresentação; fonte/modelo finais e o pacote ainda não foram aceitos.

Disponibilizei a [prévia monocromática](s5/relatorio-previa.pdf) e seu [registro tipográfico](s5/previa-render.json). A fonte substituta está declarada; não é o PDF final da entrega.
