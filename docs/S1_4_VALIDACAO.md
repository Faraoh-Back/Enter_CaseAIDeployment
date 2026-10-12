# S1.4 — execução local integrada

O comando local conecta o projeto Rivet ao exportador XLSX e grava uma execução isolada. [src/executar-s1.mjs](../src/executar-s1.mjs) faz transporte, snapshots, manifesto e arquivos; o grafo continua responsável por extração, validação, cálculos, decisão, consolidação e texto do relatório. [scripts/executar-s1.mjs](../scripts/executar-s1.mjs) interpreta argumentos e fornece código de saída 0 no sucesso ou 1 na falha.

## Comando reproduzível

Na raiz do repositório, com as dependências instaladas e Node 20.20.2:

```bash
npm run s1:executar -- --replay
```

Esse comando foi executado com sucesso. O modo `replay` intercepta somente o transporte da LLM e devolve sua resposta textual original capturada na S1.2. O SDK executa novamente o projeto real, suas validações e cálculos; em seguida, o exportador produz o XLSX. Os outputs prontos da captura não são usados como resultado. O comando não lê `.env`, não precisa de chave e não acessa a OpenAI.

A captura deve conter hashes correspondentes às entradas atuais. O manifesto declara `modo: replay`, hash da captura e zero chamadas reais. Tokens da chamada histórica não são apresentados como consumo desta execução. O hash do projeto atual também é registrado; replay após alteração de prompt não mede qualidade de uma nova extração.

Para executar com uma nova chamada real, escolha explicitamente esse modo e forneça a configuração pelo ambiente:

```bash
node --env-file=.env scripts/executar-s1.mjs --real
```

O comando real usa `OPENAI_API_KEY` e, opcionalmente, `LLM_MODEL`. Sem chave, falha antes de criar a execução. A S1.4 não fez nova chamada paga: validou a integração com replay e testou o caminho real com transporte HTTP simulado. A chamada efetiva ao provedor está documentada na S1.2.

`--destino <pasta>` muda a raiz de saída; o programa sempre cria uma subpasta exclusiva por execução. `--captura <arquivo>` é aceito somente junto com `--replay`. Sem escolha de modo, com ambos os modos ou argumentos desconhecidos, o comando falha.

## Arquivos por execução

```text
outputs/s1.4/<timestamp-uuid>/
  manifest.json
  entradas.json
  projeto.rivet-project
  schemas.json
  captura.json              # somente replay
  extracao-resposta.txt      # quando o Chat produziu resposta
  processos.json
  resumo.json
  auditoria.json
  relatorio.md
  processos.xlsx
```

O manifesto começa em `executando` e termina em `concluida` ou `falhou`. Inclui versões, hashes dos insumos/projeto/schemas, modelo e parâmetros enviados, horários, duração, requisições, consumo disponível, resumo fornecido pelo grafo e hashes dos cinco artefatos concluídos. Custo monetário desconhecido fica `null`.

JSON/Markdown e manifesto usam arquivo temporário e renomeação no mesmo diretório. O XLSX é exportado para um temporário e publicado somente após a escrita terminar. A lista `artefatos` inclui apenas arquivos finalizados; na falha do exportador, os JSONs e o Markdown já concluídos permanecem disponíveis, o XLSX parcial é removido e o estado final é `falhou`. A resposta do Chat e seu consumo disponível são preservados mesmo se a validação posterior falhar. A CLI informa o diretório na falha quando ele já existe.

## Testes e evidências

Os cinco testes iniciais falharam antes da implementação. A validação final está em [tests/s1-execucao.test.mjs](../tests/s1-execucao.test.mjs):

- CLI em subprocesso: duas execuções em diretórios distintos, cinco artefatos com hashes corretos, XLSX reaberto e reconciliado com JSON e Markdown.
- Resposta real historicamente rejeitada: nova rejeição pelo grafo, manifesto `falhou`, resposta preservada e nenhum artefato de análise anunciado.
- Ausência de credencial e argumentos desconhecidos: saída 1 sem diretório de execução.
- Falha simulada do exportador: preservação dos resultados de análise e ausência de XLSX parcial publicado.
- Caminho real com HTTP simulado: parâmetros estruturados, uma chamada e consumo registrado.
- HTTP 401 simulado: uma chamada, falha terminal e credencial omitida do manifesto.

| Comando | Resultado |
| --- | --- |
| `npm test` | 14/14 aprovados |
| `npm run test:s1:grafo` | 11/11 aprovados |
| `npm run test:s1` | 2/2 aprovados |
| `npm run test:s1:xlsx` | 7/7 aprovados |
| `npm run test:s1:execucao` | 7/7 aprovados |

A [evidência integrada](output/s1.4-execucao.json) identifica o comando, manifesto e hashes da execução conferida. A [planilha](output/s1.4-processos.xlsx) e o [relatório](output/s1.4-relatorio.md) foram copiados dessa execução para revisão. A conferência é automatizada; não substitui o aceite visual no aplicativo da S1.5.

## Limites desta tarefa

O comando prepara somente o caso de desenvolvimento `3871230-78.2024.8.26.0002`, com referência `2026-05-31`, reutilizando a preparação da S1.2. A API, o lote completo, retentativas semânticas e estados de pendência continuam fora desta fatia.

O transporte da S1 admite uma requisição por execução, timeout de Chat de 30 segundos e sinal de cancelamento após 45 segundos para a etapa do grafo. Não há retentativa automática paga. O SDK usa `fetch` global; o executor impede duas chamadas simultâneas a ele no mesmo processo e restaura o transporte ao terminar. Separar responsabilidades em subgrafos e consolidar a suíte padrão continua em S1.5.

Encerramento forçado do processo pode deixar manifesto `executando` e arquivos temporários. Recuperação após reinício pertence à S4. Renomeação evita anunciar arquivos parcialmente escritos durante falhas tratadas, mas não promete durabilidade contra queda de energia ou falha do disco que impeça atualizar o próprio manifesto.

Commit sugerido: `feat: integra execução local Rivet e geração de artefatos auditáveis`.
