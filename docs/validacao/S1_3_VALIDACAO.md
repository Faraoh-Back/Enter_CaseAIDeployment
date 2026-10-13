# S1.3 — exportação XLSX

Registro da etapa indicada no título. Contagens de testes e pendências descrevem aquela rodada; mantenho o estado atual em [validação final](../entrega/validacao.md).
O adaptador [exportar-xlsx.mjs](../../src/exportar-xlsx.mjs) materializa os outputs desempacotados do Rivet em quatro abas. A interface é `await exportarXlsx(analise, destino)`. O diretório deve existir e o destino não pode existir. O exportador não modifica a entrada nem calcula indicadores, juros ou decisões; converte centavos em reais apenas para apresentação.

## Conteúdo

| Aba | Apresentação |
| --- | --- |
| Processos | Identidade, estado, classificação, fundamento, componentes da condenação, datas ISO, parâmetros e decisão. Dinheiro numérico com duas casas; cabeçalho fixo e filtros. |
| Resumo | Campo, Valor e Unidade. Indicadores copiados do grafo; campos monetários apresentados em reais com unidade explícita. |
| Auditoria | Processo, Campo e Valor. Extração, evidências, resposta original, índices, tentativas, modelo, tokens e frações recebidas. Numeradores e denominadores permanecem textos exatos. |
| Pendencias | Processo, Estado, Código e Mensagem copiados da análise. No caso válido, somente cabeçalho. |

Nulo fica vazio e zero permanece numérico. Textos começando com `=` ou `@` continuam strings, sem fórmulas executáveis. A probabilidade é o percentual recebido (10 significa 10%, conforme o cabeçalho). A planilha mantém os códigos de classificação e decisão usados nos outputs; o acabamento executivo permanece em S3.

Na auditoria, campos da extração usam o prefixo `extracao.`, enquanto evidências e frações usam seus nomes diretos, conforme o teste de aceitação S1.1. Assim, `extracao.data_citacao` contém a data normalizada e `data_citacao` contém a citação literal. Objetos são expandidos em caminhos; números racionais não são convertidos em ponto flutuante.

## Validação executada

Primeiro foram adicionados sete testes, que falharam por ausência do módulo. Depois da implementação:

| Comando | Resultado |
| --- | --- |
| `npm test` | 14/14 S0 aprovados |
| `npm run test:s1:grafo` | 11/11 aprovados |
| `npm run test:s1` | 2/2 aprovados, incluindo o teste XLSX antes vermelho |
| `npm run test:s1:xlsx` | 7/7 aprovados |

Os testes [s1-xlsx.test.mjs](../../tests/s1-xlsx.test.mjs) reabrem arquivos reais com ExcelJS e verificam centavos, benefício negativo, índices e evidências, imutabilidade, indicador de resumo deliberadamente diferente da linha (para detectar recálculo), nulo versus zero, pendências, textos semelhantes a fórmulas, precisão monetária, limite textual, preservação de arquivo existente e propagação de erro de escrita. Os diretórios temporários são removidos após cada teste.

A [planilha revisável](../output/s1.3-processos.xlsx) foi gerada da [captura real aprovada na S1.2](../output/s1.2-llm-aprovada.json), sem nova chamada à OpenAI. A [evidência de reabertura](../output/s1.3-xlsx.json) registra origem, hashes, abas e valores lidos: atualizado **R$ 6.673,14**, benefício **−R$ 2.532,69**. Conferência automatizada com ExcelJS; não foi realizada inspeção visual no Excel/LibreOffice.

## Reprodução isolada

Os quatro comandos de teste acima são offline. Para gerar outro exemplo na raiz do repositório, use um destino novo:

```bash
node --input-type=module <<'JS'
import { readFile, mkdir } from 'node:fs/promises';
import { exportarXlsx } from './src/exportar-xlsx.mjs';
const { outputs } = JSON.parse(await readFile('docs/output/s1.2-llm-aprovada.json', 'utf8'));
await mkdir('outputs/s1.3', { recursive: true });
await exportarXlsx(outputs, `outputs/s1.3/processos-${Date.now()}.xlsx`);
JS
```

## Limites e próxima tarefa

O XLSX é montado em memória antes da gravação. Valores monetários acima de 999.999.999.999.999 centavos, ou que não preservem o centavo na conversão numérica, são rejeitados. Textos acima de 32.767 caracteres também falham explicitamente; não há truncamento. Esses limites são de apresentação, e não alterações nos contratos financeiros do grafo.

A escrita usa criação exclusiva (`wx`), preservando arquivos já existentes. Erros são propagados; não há promessa de escrita transacional em caso de falha de disco. O executor da S1.4 deverá anunciar o artefato somente depois da conclusão e registrar falha se a exportação não terminar.

O teste sintético de pendência verifica somente sua apresentação; o tratamento de falhas no grafo continua em S2. Esta tarefa não implementa CLI integrada, API, geração do Markdown em arquivo ou processamento da carteira completa. A separação das suítes permanece até S1.5, conforme o plano.

Commit sugerido: `feat: exporta análise Rivet em XLSX com trilha de auditoria`.
