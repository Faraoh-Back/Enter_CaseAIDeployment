# S5 — apresentação, pacote e defesa

Revisei o enunciado, a implementação, os entregáveis e a documentação antes do fechamento. Nesta rodada executei S5.1 e S5.2, preparei S5.5 e avancei na implementação de S5.10 e na conferência técnica S5.3. Mantive ZIP, reprodução após extração e demonstração final como tarefas a executar pelo roteiro, conforme o escopo que defini para esta etapa.

| Tarefa | Resultado |
| --- | --- |
| S5.1 | Racional de 680 palavras, em primeira pessoa, com decisões, uso de IA, resultados e limites. Conferência de até duas páginas em PDF de teste. |
| S5.2 | Validação consolidada, preservando reprovação inicial, repetição de conjunto já visto e métricas da execução real. |
| S5.10 | Renderizador HTML/PDF monocromático, gráficos, tabelas e conclusões produzidas no Rivet. Exportação opcional pela CLI/API; fonte final validada por nome. Modelo e Times New Roman ainda pendentes. |
| S5.3 | Reabertura da planilha, 100 linhas × 23 campos, e inspeção da prévia PDF de quatro páginas. Aceite da versão final pendente. |
| S5.5 | Lista positiva, scanner de credenciais, integridade de cópias e preparação de diretório sem ZIP; recusa prévias e PDFs divergentes. |
| S5.4, S5.6 e S5.7 | Instruções completas em [REPRODUCAO.md](../entrega/REPRODUCAO.md); execução final ainda não registrada. |

## Revisão da proposta

Corrigi documentação que ainda tratava carteira, falhas e API como futuras. A arquitetura agora descreve entradas textuais no aplicativo, execução sequencial e limites efetivos. Não implementei o antigo grafo separado de leitura de arquivos nem as duas chamadas simultâneas inicialmente sugeridas. Mantive essas escolhas coerentes com o executor testado.

Troquei referências a duas pessoas por uma única voz na documentação autoral. Preservei os bytes de capturas históricas para não invalidar hashes. O enunciado e o guia recebidos continuam originais. Declarei o apoio de IA no racional e mantive limites de avaliação explícitos.

## PDF e revisão

O renderizador apresenta os outputs, sem calcular condenações ou decisões. O texto foi reconsolidado no Rivet, com menos repetição e conclusões; processos, resumo e auditoria continuam iguais à S3. Os artefatos S5 têm manifesto próprio, com zero novas chamadas à LLM.

A primeira prévia tinha uma página quase vazia por um parágrafo isolado. Ajustei o texto-base no grafo e conferi nova prévia com quatro páginas. Uso preto e branco, tabelas compactas e barras com valores explícitos. Não apresento Liberation Serif como Times New Roman: a versão final exige a fonte correta e a adaptação ao modelo que escolhi.

`npm run render` verifica os hashes da origem. `--pdf` na CLI/API verifica fonte e Chromium antes da análise e publica o arquivo no manifesto. Uma falha de PDF conserva os artefatos anteriores e não anuncia PDF concluído. O download verifica MIME, arquivo e hash.

## Verificação

A suíte atual reúne 188 cenários aprovados, com 13 verificações finais S5. Os testes adicionais cobrem conteúdo extraído do PDF real, páginas, fonte incorporada, HTML escapado, origem adulterada, limite de extensão do racional, publicação e corrupção HTTP, falha de renderização, lista positiva, caminhos, symlinks e credenciais. Usei fonte substituta explicitamente identificada nos testes, sem novas chamadas pagas.

Concentrei resultados e pendências em [validação final](../entrega/validacao.md) e [evidência S5](../output/s5/revisao.json). A tarefa de preparação recusa um PDF de prévia; não monto o pacote final enquanto apresentação e origem não estiverem conferidas.
