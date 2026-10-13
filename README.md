# Case Enter — análise de sentenças com Rivet

Construí uma análise auditável dos 100 processos fornecidos. Toda a interpretação, validação, atualização financeira, decisão sobre recurso e consolidação acontecem no projeto Rivet. Uso Node.js para executar esse projeto, gravar arquivos e oferecer uma API local por POST e GET.

A execução real produziu **48 vitórias, 52 condenações e zero pendências**. O passivo atualizado para 31/05/2026 é **R$ 309.174,54**. A regra econômica selecionou **17 recursos**, com custo de **R$ 54.400,00** e benefício líquido esperado de **R$ 24.676,16**, sob a hipótese de reversão integral. Esses números descrevem o lote; não são economia realizada.

## Entregáveis e evidências

| Arquivo | Conteúdo |
| --- | --- |
| [Projeto completo](docs/output/s5/projeto.rivet-project) | `analisar_lote`, com os cinco insumos embutidos e o plugin declarado. Nova execução faz chamadas à API. |
| [Planilha](docs/output/s5/processos.xlsx) | Processos, Resumo, Auditoria e Pendencias. |
| [Relatório fonte](docs/output/s5/relatorio.md) | Síntese, distribuições, recursos e exposições calculados no grafo. |
| [Racional](docs/entrega/racional.md) | Escolhas, premissas, validação, uso de IA e limites. |
| [Validação consolidada](docs/entrega/validacao.md) | Separação entre testes, avaliações reais e execução final. |
| [Roteiro de entrega](docs/entrega/REPRODUCAO.md) | Preparação do ZIP, reprodução e demonstração no Rivet. |

Preservei os insumos e o enunciado em `case/`. O projeto de trabalho está em `rivet/analise_sentencas.rivet-project`; os registros históricos em `docs/output/` conservam os bytes e hashes das respectivas rodadas.

## Requisitos e instalação

Uso Node **20.20.2**, fixado em `.nvmrc`, e dependências fixadas em `package-lock.json`.

```bash
nvm use
npm ci --ignore-scripts --no-audit --no-fund
npm test
```

Os testes usam dados fixos e respostas capturadas, sem credencial ou chamadas pagas. Os testes HTTP abrem sockets locais. O [registro S4](docs/validacao/S4_VALIDACAO.md) documenta os 175 testes aprovados naquela etapa; a validação S5 registra as verificações adicionais.

## Conferência sem novas chamadas

```bash
npm run s4:check
```

Esse comando inicia a API em replay, envia um POST com curl, acompanha a execução e confere os downloads dos 100 casos. Grava uma nova evidência em `outputs/s4-curl/`. Replay verifica execução e consistência; não mede novamente a qualidade da LLM nem reproduz o consumo original.

Para conferir apenas a consolidação no aplicativo, abro [aceite-consolidacao.rivet-project](docs/output/s5/aceite-consolidacao.rivet-project) e executo `s2_consolidacao_lote`. Os defaults já contêm os 100 outputs reais. O painel Rivet mostra Graph Outputs; não grava automaticamente os arquivos no disco.

## Nova execução real

Configuro `OPENAI_API_KEY` no ambiente ou no `.env` local, conforme [`.env.example`](.env.example). O aplicativo Rivet usa sua própria configuração de chave. Não incluo credenciais na entrega.

```bash
node --env-file=.env scripts/executar-carteira.mjs --real
```

Esse comando executa `analisar_lote`, com até três tentativas por sentença, e informa o diretório da execução. Grava snapshots, checkpoint, manifesto, JSONs, Markdown e XLSX. Para auditoria e métricas, uso o diretório retornado:

```bash
npm run s3:auditar -- --execucao outputs/s3/<execucao_id>
npm run s3:metricas -- --execucao outputs/s3/<execucao_id>
```

Esses dois comandos não chamam a LLM. A auditoria usa controles específicos do lote fornecido; não a apresento como revisão humana independente ou auditor geral de outros documentos.

## Apresentação em PDF

Configurei um renderizador monocromático, com gráficos, tabelas e conclusões do grafo. Uso Chromium e Fontconfig no Linux e valido a fonte solicitada, sem substituição silenciosa:

```bash
export REPORT_FONT='/caminho/Times New Roman.ttf'
npm run render
```

O comando informa um novo diretório com PDF, HTML e manifesto. Verifica os hashes dos outputs antes da renderização. Para produzir PDF junto de uma nova execução pela CLI/API, acrescento `--pdf`. Uma prévia com outra fonte é rotulada e não passa no preparo do pacote final.

## API local

```bash
node --env-file=.env scripts/servidor.mjs --real
curl -X POST http://127.0.0.1:3000/execucoes \
  -H 'Content-Type: application/json' -d '{"dataset":"case"}'
```

Consulto a `status_url` retornada pelo POST para acompanhar o estado e obter os links dos arquivos concluídos. O servidor usa `127.0.0.1:3000` e `outputs/api/` por padrão. Para uso sem chamadas pagas, gero a captura com `npm run s4:replay` e inicio `npm run api:start -- --replay --captura <caminho_informado>`.

Mantenho uma execução ativa por instância e um diretório exclusivo. Reinício marca jobs antigos como interrompidos, preservando checkpoint; não há retomada automática, autenticação ou coordenação distribuída. O POST aceita somente `dataset=case`; não recebe uploads nem caminhos arbitrários.

## Organização e limites

Documentei a arquitetura em [RFC](docs/arquitetura/RFC.md) e [contratos](docs/arquitetura/CONTRATOS.md). Organizei o histórico por [desenvolvimento](docs/desenvolvimento/README.md), [validação](docs/validacao/README.md) e [outputs](docs/output/README.md). O [plano](docs/PLANO_DE_EXECUCAO.md) mantém o estado de cada tarefa. O renderizador PDF está implementado; o modelo escolhido e a fonte final ainda precisam ser incorporados.

Usei IA no desenvolvimento e na revisão. Preservei a primeira avaliação reservada, que reprovou, e identifiquei a repetição como conjunto já visto. Probabilidades são cenários do CSV, associações não comprovam causalidade e a recomendação econômica não avalia prazo ou cabimento recursal. Custo monetário da API não confirmado permanece nulo.

O convite informa envio até **16/10/2026, às 23:59**, sem explicitar fuso. Vou confirmar o fuso e enviar com margem após conferir o pacote extraído e a demonstração final.
