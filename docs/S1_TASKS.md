# S1 — desenvolvimento por tarefa

Uma tarefa por rodada de trabalho. O candidato revisa e faz os commits; o assistente para ao concluir a tarefa solicitada. Nesta rodada foi desenvolvida somente **S1.5**. A refatoração, a validação local e o aceite informado pelo candidato estão concluídos; [registro posterior](output/s1.5-aceite.json). Consulte [implementação e roteiro de aceite](S1_5_VALIDACAO.md).

| Tarefa | Entrega revisável | Estado |
| --- | --- | --- |
| S1.1 — aceitação em vermelho | Testes externos do caso de referência e da planilha; observar a falha antes da implementação. | Concluída |
| S1.2 — grafo de uma condenação | Formalizar schemas de processo/resumo antes de implementar; texto e CSVs entram, extração é validada, cálculo e outputs são produzidos no Rivet. Fazer o primeiro teste passar e avaliar a extração completa em chamada real separada. | Concluída |
| S1.3 — XLSX | Implementar o adaptador de apresentação e fazer o segundo teste passar, reabrindo o arquivo. | Concluída |
| S1.4 — execução local integrada | Executar o grafo e o exportador juntos, gravar JSON/Markdown/XLSX em diretório de execução e registrar o comando reproduzível. | Concluída |
| S1.5 — refatoração e aceite | Separar responsabilidades em subgrafos, revisar contratos e conferir o fluxo integrado no aplicativo e pelo comando local. | Concluída; aceite visual informado pelo candidato |

## S1.1: o que os testes exigem

Arquivo: [tests/s1.test.mjs](../tests/s1.test.mjs). Caso único: `3871230-78.2024.8.26.0002`. O conjunto reservado não é usado.

**Teste do grafo:** chama o projeto real `rivet/analise_sentencas.rivet-project`, grafo público `analisar_carteira`. Envia uma sentença recortada dos originais, a linha correspondente de subsídios, os três CSVs de referência e `data_referencia=2026-05-31`. O recorte só prepara a entrada do teste; a interpretação e os cálculos devem acontecer no grafo.

O teste intercepta `fetch` e devolve o exemplo pré-anotado de `schemas/extracao.exemplo.json` como resposta de Chat Completions. Não lê `.env`, não usa uma credencial real e não delega ao transporte de rede. Exige uma chamada e confere que o prompt contém o corpo completo da sentença. O grafo deverá validar e processar essa resposta. O exemplo é **simulado**, não uma captura de extração completa feita pela LLM; este teste não mede acurácia do modelo.

Verificações após a execução do grafo:

- Uma linha com a identidade correta, parcial procedência, danos materiais de 600000 centavos e morais de 30000, datas e estado `ok`.
- Cruzamentos produzindo TJSP, subsídios ausentes, probabilidade de 10% e custo de 320000 centavos.
- Três meses completos, principal corrigido de 647878, juros de 19436 e total de 667314 centavos.
- Benefício de -253269 centavos e decisão `nao_recorrer`, com motivo `beneficio_nao_positivo`.
- Extração e evidências preservadas na auditoria, índices, tentativas, versão do extrator e frações exatas serializáveis.
- Resumo com denominadores explícitos e Markdown identificando processo, data-base, valor atualizado, recomendação e premissa de reversão integral.

**Teste do artefato:** chama a interface `exportarXlsx(analise, destino)`, exportada por `src/exportar-xlsx.mjs`. `analise` recebe os quatro outputs já desempacotados (`processos`, `resumo`, `auditoria`, `relatorio_markdown`). Neste teste isolado do adaptador, os outputs são dados fixos de referência, não uma execução do grafo. A S1.4 verificará a conexão das duas partes.

O arquivo é gerado em diretório temporário exclusivo, reaberto com ExcelJS e removido ao final. O teste exige uma linha de processo, valores numéricos com apresentação monetária e o mesmo centavo dos outputs, decisão, motivo, data-base e memória de cálculo. Também verifica que o exportador não modifica o objeto recebido.

## Contrato mínimo observável definido nesta tarefa

Os Graph Outputs mantêm os nomes dos [contratos gerais](CONTRATOS.md): `processos` (lista), `resumo` (objeto), `auditoria` (lista) e `relatorio_markdown` (string).

O teste exige os campos de processo já definidos na seção 5 dos contratos. Para tornar o resumo verificável, os nomes mínimos desta fatia são:

| Campo | Esperado no caso único |
| --- | ---: |
| `data_referencia` | `2026-05-31` |
| `total_identificado` | 1 |
| `vitorias_confirmadas` | 0 |
| `resultados_desconhecidos` | 0 |
| `condenacoes` | 1 |
| `processos_aptos` | 1 |
| `pendencias` | 0 |
| `passivo_centavos` | 667314 |
| `recursos_recomendados` | 0 |
| `custo_recursos_centavos` | 0 |
| `beneficio_esperado_recursos_centavos` | 0 |

Os dois últimos campos somam somente os recursos recomendados. O benefício negativo do processo permanece na linha individual; não é somado como benefício de um recurso que não foi recomendado.

Cada item de `auditoria` exige `numero_processo`, `extracao` (schema completo), `indice_base` e `indice_final` como textos decimais, `tentativas`, `versao_extrator` não vazia e `memoria` com as frações no formato usado na S0. Os testes aceitam campos adicionais de processo/resumo/auditoria; os schemas de processo/resumo foram formalizados na S1.2, antes do código de produção. A auditoria mantém o contrato observável descrito acima.

Contrato de apresentação inicial da planilha:

- `Processos`: cabeçalhos `Processo`, `Resultado`, `Subsídios`, `Decisão`, `Motivo`, `Condenação (R$)`, `Principal corrigido (R$)`, `Juros (R$)`, `Valor atualizado (R$)`, `Custo do recurso (R$)` e `Benefício esperado (R$)`. A ordem das colunas e colunas adicionais são livres.
- `Resumo`: colunas `Campo` e `Valor`; incluir `data_referencia` e `total_identificado`.
- `Auditoria`: colunas `Processo`, `Campo` e `Valor`; incluir frações como strings e os trechos de evidência. O teste observa `total_numerador` e a evidência `data_citacao`.
- `Pendencias`: cabeçalho e nenhuma linha de pendência para este caso válido.

Esse é o mínimo de aceitação desta tarefa; os testes não afirmam cobrir ainda todos os campos e cenários do case. A consolidação e o acabamento das quatro abas continuam previstos em S3.

## Registro histórico do vermelho da S1.1

```bash
npm test
npm run test:s1
```

- `npm test`: suíte existente da S0, **14 aprovados**, saída 0.
- `npm run test:s1`: **2 falhas esperadas**, saída 1: ausência do grafo `analisar_carteira` e ausência do módulo `src/exportar-xlsx.mjs`.

O comando S1 termina com erro de verdade; não há `skip`, `todo` ou inversão para transformar falha em sucesso. Está separado da suíte existente para permitir revisar o contrato vermelho em um commit próprio. Enquanto essa separação existir, `npm test` sozinho não representa a aceitação da S1. Ao concluir a implementação, incorporar os testes verdes à suíte padrão.

Na S1.1, os asserts posteriores aos pontos ausentes ainda não haviam sido exercitados contra uma implementação. As falhas observadas comprovam o estágio vermelho, não que o fluxo esteja pronto. As pré-condições do primeiro teste conferiram o exemplo contra o schema, os trechos originais e o gabarito financeiro independente antes da falha por grafo ausente.

Resultado registrado em [s1.1-vermelho.json](output/s1.1-vermelho.json). Sugestão de commit para esta tarefa: `test: define aceitação da S1 para uma condenação`.

## Estado após S1.2

- `npm test`: 14/14 aprovados (S0).
- `npm run test:s1:grafo`: 11/11 aprovados (schemas, cruzamentos e rejeições, incluindo resposta real não literal).
- `npm run test:s1`: teste do grafo aprovado; teste XLSX ainda falha por módulo ausente, aguardando S1.3. Saída 1 intencionalmente preservada.
- Avaliação real: uma resposta rejeitada e, após ajuste do prompt, uma aprovada; detalhes e limites em [S1_2_VALIDACAO.md](S1_2_VALIDACAO.md).

Nenhum commit foi feito pelo assistente. Sugestão: `feat: implementa grafo S1 de uma condenação com validação auditável`.

## Estado após S1.3

O exportador está em `src/exportar-xlsx.mjs`, sem cálculos de negócio. `npm run test:s1` agora passa os dois testes; `npm run test:s1:xlsx` passa sete cenários de exportação. S0 e testes do grafo continuam verdes (14 e 11). Foram gerados um XLSX revisável e evidência de reabertura em `docs/output/` a partir da captura aprovada da S1.2, sem novas chamadas ao modelo.

Detalhes, limitações e reprodução: [S1_3_VALIDACAO.md](S1_3_VALIDACAO.md). A S1.4 ainda conectará grafo e exportador na mesma execução; o aceite atual verifica cada parte separadamente. Nenhum commit foi feito pelo assistente. Sugestão: `feat: exporta análise Rivet em XLSX com trilha de auditoria`.

## Estado após S1.4

`npm run s1:executar -- --replay` executa grafo e exportador juntos e foi conferido com sucesso. Os sete testes de integração passaram, além dos 34 testes anteriores. O manifesto distingue replay de chamada real e registra artefatos concluídos, hashes e falhas. Detalhes em [S1_4_VALIDACAO.md](S1_4_VALIDACAO.md).

Nenhum commit foi feito pelo assistente. Sugestão: `feat: integra execução local Rivet e geração de artefatos auditáveis`.

## Estado após a implementação local da S1.5

O principal delega a cinco subgrafos. `npm test` reúne os 43 testes, todos aprovados, incluindo comparação dos quatro outputs com a captura anterior à refatoração. O replay integrado foi executado novamente e o XLSX reaberto. O aceite no aplicativo permanece pendente, conforme [roteiro](S1_5_VALIDACAO.md); a S1.5 ainda não está integralmente encerrada.

Sugestão de commit: `refactor: organiza pipeline S1 em subgrafos e unifica testes`. Nenhum commit foi feito pelo assistente.

## Fechamento posterior da S1.5

O candidato confirmou a conferência visual pelo roteiro. Os artefatos locais de replay foram reconferidos, incluindo hashes e XLSX. [Aceite registrado com origem explícita](output/s1.5-aceite.json); nenhuma nova captura do aplicativo foi localizada. S1.5 concluída.
