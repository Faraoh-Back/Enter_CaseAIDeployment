# S2.6 — integração e aceite local

**Implementação e aceite local concluídos: 128 testes aprovados, sem chamadas reais. Aceite no aplicativo parcial: plugin e calendário confirmados pelo candidato; quatro outputs da consolidação recebidos e revisados.** A prova de sete processos agora produz JSON, XLSX e Markdown na mesma execução do grafo. [Evidência](../output/s2.6-validacao.json), [planilha](../output/s2.6-processos.xlsx) e [relatório](../output/s2.6-relatorio.md).

## Entrega e contrato

`npm run s2:check` usa o grafo real `analisar_lote`, as anotações de desenvolvimento e falhas simuladas da S2.5. Grava `entradas.json`, `processos.json`, `resumo.json`, `auditoria.json`, `relatorio.md`, `processos.xlsx` e `manifest.json` em um diretório único de `outputs/s2.6/`. O manifesto lista os hashes dos seis artefatos; só é publicado depois da exportação bem-sucedida. O nome interno `scripts/check-s2-5.mjs` foi mantido para compatibilidade com os comandos anteriores.

O exportador usado é o mesmo da CLI individual. Não calcula novos totais nem decide recursos. Foi ajustado apenas o rótulo da auditoria XLSX: quando `memoria` é `null`, a coluna Campo contém `memoria` e a coluna Valor fica vazia. Anteriormente ambas ficavam vazias. As frações existentes continuam como texto, com seus nomes originais. JSON, schemas, plugin, projeto Rivet e regras financeiras não foram alterados nesta tarefa.

O diagnóstico continua sendo uma ferramenta offline de desenvolvimento. Não substitui o executor de produção da carteira: não possui checkpoint, manifesto de falha ou recuperação de lote interrompido. Uma exportação malsucedida encerra o comando com erro e pode deixar JSONs no diretório, sem manifesto final. O executor individual já tem seu próprio tratamento de falhas, coberto pela regressão S1.4.

## Reconciliação observada

| Controle | Resultado |
| --- | --- |
| Identidades no JSON, XLSX, tabela Markdown e auditoria | 7, mesmas identidades e ordem |
| Colunas da aba Processos | 23, comparadas célula a célula com o JSON |
| Aptos / pendências, incluindo erro técnico | 3 / 4 |
| Valores conhecidos / desconhecidos | 4 / 3; inclui duas vitórias com zero numérico |
| Decisões concluídas / pendentes | 3 / 4 |
| Passivo parcial conhecido | R$ 16.579,46 |
| Recursos recomendados / custo / benefício líquido esperado | 1 / R$ 3.200,00 / R$ 64,20 |
| Requisições simuladas por identidade | 1, 1, 3, 1, 3, 3, 1 |
| Chamadas reais | 0 |

Os seis testes de integração reabrem os arquivos efetivamente gravados pela CLI. Conferem hashes, todas as células de processos e resumo, cada problema, as folhas da auditoria (inclusive histórico de tentativas e respostas), ausência de fórmulas e as listas exatas de exclusões do Markdown. As três somas são comparadas tanto a valores esperados fixos quanto às linhas correspondentes. `null` permanece vazio no XLSX; zero conhecido permanece número. O resumo booleano `passivo_parcial` permanece booleano.

O primeiro teste vermelho teve **1 aprovado e 5 falhas**: relatório já consistente, XLSX ausente e manifesto sem o artefato. Após a exportação, a comparação da auditoria revelou a diferença entre string vazia e célula nula; a revisão tornou explícito o nome `memoria` na ausência de cálculo. Resultado final: seis testes novos aprovados, incorporados à suíte padrão de 128 testes. Os testes anteriores não foram removidos nem ignorados.

## Revisão de responsabilidades

| Componente | Responsabilidade confirmada |
| --- | --- |
| Preparação e validação Rivet | Segmentação, referências, identidade, evidências, campos desconhecidos e aptidão. |
| Helpers incorporados em Code Nodes | Calendário civil e resumo compartilhados entre análise individual e lote. |
| Financeiro e consolidação Rivet | Frações, arredondamento, decisão, somas, cobertura, exclusões e texto Markdown. |
| Plugin local | Transporte limitado, histórico e execução sequencial; consulta o validador Rivet. |
| Executor Node | Executar grafo, controlar execução e materializar outputs. |
| Exportador XLSX | Copiar dados e formatar moeda, texto, nulos e auditoria; verificar limites do Excel. |
| Diagnóstico e testes | Simular transporte e confrontar resultados com oráculos; não integram regras de produção. |

Não foram encontradas fórmulas ou decisões de negócio duplicadas no executor/exportador que exigissem migração. A conversão de centavos para reais e a verificação de precisão pertencem à apresentação. A aritmética dos testes serve como controle independente. A separação existente foi mantida, evitando refatoração sem necessidade.

## Reprodução local

Na raiz, com Node 20.20.2 e dependências instaladas:

```bash
npm run test:s2:integracao
npm test
npm run s2:check
```

Os três comandos são offline, não carregam `.env` e não medem qualidade de extração de uma LLM. O último informa o diretório completo da execução. Abra `processos.xlsx` e `relatorio.md` desse mesmo diretório para uma conferência manual. Os exemplos em `docs/output/` são cópias selecionadas; o comando não os sobrescreve.

## Aceite no aplicativo: parcial

Durante o aceite, o candidato encontrou `Unknown node type enterBoundedExtraction`. A inspeção confirmou que a instalação local continha os arquivos corretos, mas o projeto estava serializado com `plugins: []`. O SDK registrava o plugin por código, ocultando essa lacuna. O gerador e o projeto agora declaram a dependência de pacote `enter-bounded-extraction`, tag `latest`. O teste de estrutura foi ampliado: falhou antes da correção e passou depois; as suítes de refatoração (2 testes) e integração (6 testes) foram reexecutadas e aprovadas sem rede. As evidências S2.6 anteriores permanecem históricas, com o hash do projeto daquela rodada.

Feche a cópia antiga no aplicativo e reabra o arquivo atualizado do disco, evitando sobrescrevê-lo com a versão antiga ainda em memória. Não é necessário repetir `git init` ou copiar o plugin, se os arquivos já correspondem ao repositório. Após a reabertura, o candidato confirmou o nó disponível, suas quatro entradas e três saídas. Isso confirma o carregamento, mas ainda não a execução do extrator.

O aceite visual informado para S1.5 não atesta os nós adicionados em S2.4/S2.5. O aceite atual é informado pelo candidato; não houve acesso direto ao aplicativo. Os quatro outputs da consolidação foram posteriormente recebidos e revisados contra a referência; o resumo também foi comparado por código. A evidência distingue essa confirmação dos testes automatizados.

Estado confirmado nesta conversa ([registro](../output/s2-aplicativo-aceite-parcial.json)):

- [x] Plugin carregado; tipo `enterBoundedExtraction` disponível, com quatro entradas e três saídas.
- [x] `s2_calendario`: `2026-01-31` → `2026-02-28` = **0**.
- [x] `s2_calendario`: `2024-02-29` → `2025-02-28` = **11**.
- [x] `s2_calendario`: `2026-02-27` → `2026-05-31` = **3**.
- [x] Execução de `s2_consolidacao_lote` e resumo: output recebido em 13/10/2026, todos os campos iguais à evidência S2.6.
- [x] `processos`, `auditoria` e `relatorio_markdown` recebidos e revisados em 13/10/2026: sete identidades, valores, estados, tentativas, memória e relatório coerentes com a referência. A revisão do conteúdo da conversa não é comparação byte a byte de arquivos.

Essa prova valida a consolidação offline. Os históricos de HTTP/retentativas já estavam nas entradas preenchidas: não representam chamadas novas ao provedor durante essa execução.
- [x] Execução real de `analisar_lote` com uma sentença: extração aprovada na primeira tentativa, HTTP 200, 1.467 tokens. Sete evidências literais conferidas contra a sentença original; financeiro e memória iguais à referência. [Registro](../output/s2-aplicativo-extracao-real.json). Não certifica execução de múltiplos itens ou carteira completa.
- [x] Cenário de subsídio não localizado no aplicativo: atualizado `667314`, decisão pendente, probabilidade/benefício nulos, código `SUBSIDIO_NAO_LOCALIZADO`. Extração aprovada na primeira tentativa, HTTP 200 e 1.467 tokens informados. Memória preserva atualização sem simular benefício. [Outputs recebidos](../output/s2-aplicativo-sem-subsidio.json).
- [ ] Conferência visual dos arquivos exportados.

Para uma conferência **sem chamada à LLM**:

1. Atualize os dois arquivos do plugin e reinicie o Rivet seguindo a [instalação S2.4](S2_4_VALIDACAO.md#carregar-no-aplicativo-e-conferir). Abra `rivet/analise_sentencas.rivet-project` e confira se ambos os tipos de nó do plugin são reconhecidos.
2. Abra `s2_calendario`. Informe `citacao` = `2026-01-31` e `referencia` = `2026-02-28`, como strings; execute somente esse grafo. O output `meses` deve ser `0`.
3. Abra `s2_consolidacao_lote`. Em cada Graph Input, configure o valor padrão a partir de `entrada_aceite_visual` na [evidência S2.6](../output/s2.6-validacao.json): `resultados` e `identidades` são arrays de objetos e strings, respectivamente; `data_referencia` é string. Copie os valores JSON, não o objeto inteiro da evidência.
4. Execute somente esse subgrafo e confira seus quatro Graph Outputs contra `outputs` da evidência. Esperados: sete processos e auditorias, resumo com os números da tabela acima e Markdown idêntico ao exemplo. Não há extrator nesse subgrafo.
5. Preserve os outputs e registre versão do aplicativo, resultado e eventuais erros para concluir esse aceite. Isso confirma a consolidação no desktop; não comprova execução do transporte do plugin nem qualidade da LLM.

Para testar `analisar_lote` inteiro no aplicativo, use as entradas da prova conforme o [roteiro S2.5](S2_5_VALIDACAO.md). Essa execução usa chamadas reais, e as falhas sintéticas de HTTP/JSON do teste offline não são injetadas no painel: não espere igualdade integral de seus resultados. O painel continua mostrando os outputs, sem salvar automaticamente os arquivos do exportador.

Carteira completa, conjunto reservado, CLI de produção do lote e avaliação real ficam em S3; API fica em S4. A implementação local da S2.6 está pronta para revisão e commit, com a pendência visual registrada.

```text
test: reconcilia artefatos e registra aceite local da S2.6
```
