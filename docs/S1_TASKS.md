# S1 — desenvolvimento por tarefa

Uma tarefa por rodada de trabalho. O candidato revisa e faz os commits; o assistente para ao concluir a tarefa solicitada. Nesta rodada foi executada somente **S1.1**. Não houve alteração dos grafos, criação do exportador definitivo ou chamada à OpenAI.

| Tarefa | Entrega revisável | Estado |
| --- | --- | --- |
| S1.1 — aceitação em vermelho | Testes externos do caso de referência e da planilha; observar a falha antes da implementação. | Concluída nesta rodada |
| S1.2 — grafo de uma condenação | Formalizar schemas de processo/resumo antes de implementar; texto e CSVs entram, extração é validada, cálculo e outputs são produzidos no Rivet. Fazer o primeiro teste passar e avaliar a extração completa em chamada real separada. | Não iniciada |
| S1.3 — XLSX | Implementar o adaptador de apresentação e fazer o segundo teste passar, reabrindo o arquivo. | Não iniciada |
| S1.4 — execução local integrada | Executar o grafo e o exportador juntos, gravar JSON/Markdown/XLSX em diretório de execução e registrar o comando reproduzível. | Não iniciada |
| S1.5 — refatoração e aceite | Separar responsabilidades em subgrafos, revisar contratos e conferir o fluxo integrado no aplicativo e pelo comando local. | Não iniciada |

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

**Teste do artefato:** chama a interface futura `exportarXlsx(analise, destino)`, exportada por `src/exportar-xlsx.mjs`. `analise` recebe os quatro outputs já desempacotados (`processos`, `resumo`, `auditoria`, `relatorio_markdown`). Neste teste isolado do adaptador, os outputs são dados fixos de referência, não uma execução do grafo. A S1.4 verificará a conexão das duas partes.

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

Cada item de `auditoria` exige `numero_processo`, `extracao` (schema completo), `indice_base` e `indice_final` como textos decimais, `tentativas`, `versao_extrator` não vazia e `memoria` com as frações no formato usado na S0. Os testes aceitam campos adicionais de processo/resumo/auditoria; a estrutura completa será formalizada em schemas na S1.2, antes do código de produção.

Contrato de apresentação inicial da planilha:

- `Processos`: cabeçalhos `Processo`, `Resultado`, `Subsídios`, `Decisão`, `Motivo`, `Condenação (R$)`, `Principal corrigido (R$)`, `Juros (R$)`, `Valor atualizado (R$)`, `Custo do recurso (R$)` e `Benefício esperado (R$)`. A ordem das colunas e colunas adicionais são livres.
- `Resumo`: colunas `Campo` e `Valor`; incluir `data_referencia` e `total_identificado`.
- `Auditoria`: colunas `Processo`, `Campo` e `Valor`; incluir frações como strings e os trechos de evidência. O teste observa `total_numerador` e a evidência `data_citacao`.
- `Pendencias`: cabeçalho e nenhuma linha de pendência para este caso válido.

Esse é o mínimo de aceitação desta tarefa; os testes não afirmam cobrir ainda todos os campos e cenários do case. A consolidação e o acabamento das quatro abas continuam previstos em S3.

## Como revisar e reproduzir o vermelho

```bash
npm test
npm run test:s1
```

- `npm test`: suíte existente da S0, **14 aprovados**, saída 0.
- `npm run test:s1`: **2 falhas esperadas**, saída 1: ausência do grafo `analisar_carteira` e ausência do módulo `src/exportar-xlsx.mjs`.

O comando S1 termina com erro de verdade; não há `skip`, `todo` ou inversão para transformar falha em sucesso. Está separado da suíte existente para permitir revisar o contrato vermelho em um commit próprio. Enquanto essa separação existir, `npm test` sozinho não representa a aceitação da S1. Ao concluir a implementação, incorporar os testes verdes à suíte padrão.

Os asserts posteriores aos pontos ausentes ainda não foram exercitados contra uma implementação. As falhas observadas comprovam o estágio vermelho, não que o fluxo esteja pronto. As pré-condições do primeiro teste conferiram o exemplo contra o schema, os trechos originais e o gabarito financeiro independente antes da falha por grafo ausente.

Resultado registrado em [s1.1-vermelho.json](output/s1.1-vermelho.json). Sugestão de commit para esta tarefa: `test: define aceitação da S1 para uma condenação`.
