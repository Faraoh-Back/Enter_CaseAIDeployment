# S4.4 — revisão de responsabilidades

Revisão assistida de código concluída. A API não contém fórmula monetária, classificação de sentença ou consolidação de indicadores. Os arquivos revisados e hashes estão no [registro](../output/s4.4-revisao.json).

| Componente | Responsabilidade observada |
| --- | --- |
| `src/api.mjs` | Validar dataset/body; reservar execução; retornar estados; verificar whitelist/hashes; servir bytes. `resumo` é copiado do manifesto, sem totalização. |
| `src/armazenamento-api.mjs` | Escrita atômica, exclusão local por diretório e recuperação de lock obsoleto. |
| `scripts/servidor.mjs` | Configuração do operador, bind HTTP e encerramento. Caminhos/captura não são fornecidos no POST. |
| `src/executar-carteira.mjs` | Ler/snapshotar bytes, chamar `analisar_lote`, limitar transporte, registrar eventos e exportar os outputs. O CNJ no prompt associa a requisição ao registro de transporte; não classifica nem calcula. |
| `src/rivet-runtime.mjs` e plugin | Adaptador de transporte, exclusão de execução, retries e validação delegada ao subgrafo. Aplicativo usa transporte nativo por padrão. |
| Code Nodes Rivet | Preparação, referência, evidências, calendário, frações, recomendação, resumo e relatório. |
| Exportador XLSX | Formatação de centavos para reais, limites de precisão e materialização das folhas; não recomenda recurso nem soma carteira. |

A regra econômica continua em `s1_financeiro`; classificação/evidências em `s1_validacao`; agregações/template em `s2_consolidacao_lote`. Esses componentes não dependem da API para analisar o lote. A CLI e a API usam `executarCarteira`; a cópia HTTP não implementa um segundo pipeline.

Prova de integração: mesmos inputs e resposta capturada geram JSONs/Markdown idênticos por CLI e API; XLSX é reaberto, valor atualizado é conferido e os cinco downloads têm hashes correspondentes. O transporte de replay do plugin não intercepta consultas HTTP. O teste de replay inválido mantém a linha pendente e três tentativas sem produzir cálculo indevido. Nenhuma chamada paga nesta revisão.

Limites: instância local, uma execução ativa, sem frontend/banco, sem retomada automática ou coordenação distribuída. API real faz uma nova execução da LLM; GET/download não fazem chamadas. PDF executivo permanece tarefa S5.10 e não é anunciado como artefato disponível nesta versão.
