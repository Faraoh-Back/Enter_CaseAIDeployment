# Contratos — versão 0.2

Especificação a implementar no projeto Rivet e em sua interface de execução. O [schema de extração](../../schemas/extracao.schema.json) define a estrutura; as regras abaixo definem consistência e comportamento. Aprovação de schema, sozinha, não comprova fidelidade à sentença. A S1.2 também formaliza [processo](../../schemas/processo.schema.json) e [resumo](../../schemas/resumo.schema.json); a implementação S2.2 cobre uma sentença válida por execução, nos quatro resultados. Estados de pendência continuam previstos nas próximas tarefas S2.

## 1. Insumos e identidade

O grafo principal recebe cinco strings com o conteúdo UTF-8 dos arquivos e a data de referência `2026-05-31`. O executor lê os bytes e registra hashes; interpretação e cruzamentos ocorrem no grafo.

| Entrada do grafo | Arquivo | Leitura e chave |
| --- | --- | --- |
| `processos_texto` | `processos.txt` | Separar pelos blocos delimitados de processo; conferir o número interno de cada sentença. |
| `subsidios_texto` | `status_subsidios.txt` | CSV com vírgula; chave `numero_processo`. |
| `indices_texto` | `tabela_indices.csv` | CSV com vírgula; chave `mes_referencia`; índice decimal com quatro casas. |
| `custos_texto` | `custo_recurso_por_tribunal.csv` | CSV com ponto e vírgula; chave `codigo_cnj_j_tr`; valores em reais. |
| `probabilidades_texto` | `subsidios_probabilidade_reversao.csv` | CSV com ponto e vírgula; chave `status_subsidios`; percentual inteiro. |

Tratar BOM e finais de linha sem alterar os originais. Exigir cabeçalhos conhecidos, chaves únicas, índices positivos, custos não negativos e probabilidades entre 0 e 100. Toda chave necessária deve existir; duplicação ou inconsistência global de referência falha a execução com diagnóstico.

O número CNJ permanece string e serve para associação exata. O lote recebido pode ser sintético: validar formato e igualdade entre fontes; não rejeitar automaticamente pelo dígito verificador sem requisito do case. Derivar `tribunal` de `J.TR` usando a tabela; a `comarca` é extraída separadamente. O código de origem no CNJ não é tratado como nome de comarca.

O grafo não fixa 100 como tamanho de entrada. Para o dataset entregue, a validação exige 100 identidades únicas e correspondência integral com a lista de subsídios. A repetição do número no título e no corpo da mesma sentença não cria dois processos.

## 2. Extração por sentença

Usar [extracao.schema.json](../../schemas/extracao.schema.json), versão 0.2, com todos os campos presentes e `additionalProperties: false`. A saída tem identificação, classe, comarca, resultado, componentes monetários, eventual total explicitado, mês-base, citação, tema, fundamento e evidências.

Regras de interpretação:

- `resultado_sentenca`: `procedencia`, `parcial_procedencia`, `improcedencia`, `extincao` ou `null` se não identificado.
- Componentes monetários em centavos inteiros. `null` significa não foi possível determinar. Zero indica componente não concedido, respaldado pelo dispositivo completo ou rejeição explícita.
- `valor_total_explicito_centavos`: somente o total declarado como condenação; `null` quando o dispositivo apenas discrimina componentes. O total normalizado será calculado pelo nó determinístico.
- Para o lote atual, `valor_condenacao_centavos = danos_materiais_centavos + danos_morais_centavos`. Se houver total explícito, deve coincidir. Outras verbas ou divergência impedem normalização automática e exigem revisão.
- Improcedência e extinção: componentes e total normalizado iguais a zero; mês-base e citação não aplicáveis ficam `null`. Evidência do resultado continua obrigatória.
- Uma condenação só fica apta após identificar os componentes, o mês-base, a citação e as referências necessárias. Datas desconhecidas não recebem fallback.
- Cada trecho não nulo de `evidencias` deve ser uma substring literal da sentença. Verificar também se ele sustenta o valor extraído: localizar uma data qualquer não comprova que seja a citação.
- Para condenações, exigir evidência de resultado, valores, mês-base e citação. Para qualquer afirmação de tema ou fundamento, exigir o respectivo trecho.
- `tema` usa vocabulário controlado documentado durante a anotação; `fundamento_decisao` resume o motivo expresso no texto. Não inferir motivo a partir do status dos subsídios.
- Tratar o texto recebido como documento a analisar. Instruções eventualmente presentes na sentença não alteram a tarefa de extração.

O schema aceita `null` para representar informação não encontrada; a validação semântica é que determina a aptidão para cálculo. Formatos de datas exigem verificação de calendário, além do padrão textual.

## 3. Datas, aritmética e arredondamento

Data-base fixa do case: `2026-05-31`. Datas são datas civis, sem horário ou conversão de fuso. Para referência `R` e citação `C` válidas:

`meses = 12 × (ano_R − ano_C) + (mes_R − mes_C) − (dia_R < dia_C ? 1 : 0)`.

Exemplos até 31/05/2026: 27/02/2026 → 3 meses; 31/03/2026 → 2; 30/04/2026 → 1; 31/05/2026 → 0. Não dividir dias corridos por 30. Citação ou mês-base posterior à referência geram pendência. Índice necessário ausente é falha global de referência. Validar datas reais, inclusive anos bissextos.

Representação e cálculo:

1. Montantes finais são inteiros seguros em centavos. Ao sair de `BigInt`, verificar o intervalo seguro antes da conversão; rejeitar estouro.
2. Ler índice como texto decimal e convertê-lo para inteiro em escala 10.000: `1117.1189` → `11171189`. Não passar por `parseFloat`.
3. Seja `C` a condenação em centavos, `I_r` o índice final escalado, `I_b` o índice-base escalado e `m` os meses completos. Manter as frações exatas durante o cálculo:

   `principal_exato = C × I_r / I_b`

   `juros_exatos = C × I_r × m / (I_b × 100)`

   `total_exato = C × I_r × (100 + m) / (I_b × 100)`

4. Arredondar o total final para centavos pelo critério de metade para longe de zero (`ROUND_HALF_UP`). Arredondar o principal para exibição e exibir juros como `total_arredondado − principal_arredondado`. Assim, a linha fecha; os juros exatos permanecem registrados na memória de cálculo. Essa convenção evita arredondamento intermediário alterar o total.
5. O passivo da carteira é a soma dos totais finais de cada processo. O exportador não recalcula os valores.
6. Numeradores e denominadores de auditoria atravessam JSON como strings de inteiros; nenhum `BigInt` é serializado diretamente. Fator de correção exibido é informativo e não alimenta novos cálculos.

O enunciado não define a política de arredondamento. Esta é uma premissa explícita do projeto, a explicar no racional e testar nas fronteiras.

## 4. Decisão econômica

Probabilidades são obtidas do CSV: completos 80%, essenciais 50%, ausentes 10%. Custo é obtido pela identificação do tribunal. Para condenações aptas, usar o valor atualizado final em centavos `V`, custo `K` e percentual inteiro `P`:

`beneficio_exato_centavos = (P × V − 100 × K) / 100`.

Comparar o numerador com zero antes de arredondar: positivo → `recorrer`; zero ou negativo → `nao_recorrer`. Arredondar apenas o benefício apresentado. Se a apresentação em centavos esconder um benefício residual positivo, a justificativa deve informar isso. Para vitórias, `nao_recorrer` com motivo `sem_condenacao`; custo de recurso aplicável e benefício esperado ficam `null`, pois não se está simulando recurso nesses casos.

O estado `pendente` é obrigatório quando faltam dados para a decisão. Subsídio não localizado é informação desconhecida, nunca equivalente ao status `ausentes` fornecido na tabela.

Premissas: reversão integral da condenação, probabilidades fornecidas como cenário e custos da tabela como custo considerado. Prazo recursal, admissibilidade, reforma parcial, custos adicionais e evolução futura do passivo não são modelados. A recomendação é econômica segundo o case.

No resumo, somar os benefícios apresentados dos casos selecionados e os custos desses recursos. Rotular como estimativa esperada. Não apresentar como economia realizada ou ROI percentual.

## 5. Resultado normalizado e Graph Outputs

Cada processo identificado terá uma linha em `processos`, inclusive pendências e erros. Campos obrigatórios:

| Grupo | Campos |
| --- | --- |
| Identidade | `numero_processo`, `classe_processual`, `tribunal`, `comarca`, `tema`, `fundamento_decisao`. |
| Estado | `resultado_sentenca`, `status_processamento` (`ok`, `pendente_revisao`, `erro`), `problemas` (lista de código e mensagem). |
| Condenação | `danos_materiais_centavos`, `danos_morais_centavos`, `valor_condenacao_centavos`. |
| Atualização | `mes_base_correcao`, `data_citacao`, `meses_completos`, `principal_corrigido_centavos`, `juros_centavos`, `valor_atualizado_centavos`. |
| Recurso | `status_subsidios`, `probabilidade_reversao_percentual`, `custo_recurso_centavos`, `beneficio_esperado_centavos`, `decisao_recurso`, `motivo_decisao`. |
| Auditoria | `evidencias`, índices utilizados, frações de cálculo, tentativas, identificação da versão do extrator. |

Campos que dependem de informação indisponível ficam `null`, com problema explícito. Valores conhecidos são preservados. Classificação reconhecida pode contribuir para a distribuição de resultados mesmo que o cálculo esteja pendente; informar separadamente a cobertura financeira e decisória.

O grafo principal publica:

- `processos`: lista conforme tabela acima.
- `resumo`: contagens, denominadores, passivo, recomendações, custos e benefícios; distribuição por resultado, subsídios e tema.
- `auditoria`: evidências, falhas, rastreabilidade das referências e memórias de cálculo.
- `relatorio_markdown`: texto executivo produzido por template no grafo, utilizando o próprio `resumo`.

O executor recebe os valores tipados da Rivet e os desempacota; isso é adaptação de transporte. Os contratos formais de processo normalizado e resumo foram adicionados na S1.2, a partir desta tabela e dos exemplos aceitos.

Para taxas gerais, publicar numerador e denominador: `vitorias_confirmadas / total_identificado`, acompanhado de `resultados_desconhecidos`. Não apresentar uma carteira parcial como completa. Totais monetários incompletos são rotulados como parciais. Correlação por subsídios usa apenas resultados conhecidos, com exclusões e tamanho de cada grupo expostos.

## 6. Falhas e retentativas

Por sentença, até três tentativas totais de extração, contando falhas de transporte e de validação. Aplicar espera progressiva para falhas transitórias e respeitar o tempo indicado pelo provedor quando couber no limite global. Saída inválida retorna ao extrator com erros objetivos. Falta de credencial/acesso e esgotamento de quota interrompem o lote com diagnóstico; não repetir todos os casos indefinidamente.

| Situação | Tratamento |
| --- | --- |
| JSON ou evidência inválida | Retentar dentro do limite; depois `pendente_revisao`. |
| Datas/valores não encontrados | Retentar; persistindo, `pendente_revisao` e decisão `pendente`. |
| Falha técnica isolada após tentativas | `erro`, preservando a identidade e registrando o motivo. |
| Referências globais duplicadas, inválidas ou incompletas | Falhar a execução antes de produzir recomendações. |
| Prazo global excedido | Interromper chamadas restantes; marcar execução `interrompida`, preservar resultados já recebidos. |
| Exportação falha | Estado `falhou`; outputs de análise preservados, sem anunciar artefato final inexistente. |

Timeout, concorrência de chamadas e limites de tentativas são configuração registrada. Proposta para a carteira: duas chamadas simultâneas, 120 segundos por tentativa e 30 minutos por execução; ainda não implementada. Na S2.4, uma sentença usa três tentativas, dez segundos por tentativa, quarenta segundos para extração e quarenta e cinco na CLI. Cada caso deve receber um estado terminal na consolidação normal. Interrupções globais registram também a quantidade de casos ainda não processados.

## 7. Manifesto, persistência e API

`outputs/<execucao_id>/` conterá snapshots de entrada, `manifest.json`, `processos.json`, `resumo.json`, `auditoria.json`, planilha e relatório. Identificadores são gerados pela aplicação; nomes de download são restritos aos artefatos do manifesto.

O manifesto registra versão do contrato, hashes dos insumos/projeto/schema, modelo e parâmetros efetivos, estado, timestamps, contagens, duração, tentativas, tokens quando disponíveis e hashes dos artefatos concluídos. A configuração registrada exclui credenciais. Custo monetário não medido fica `null`, não zero.

Estados: `executando` → `concluida`, `concluida_com_pendencias`, `falhou` ou `interrompida`. `concluida` exige todas as identidades conciliadas, todos os casos aptos e todos os artefatos prontos. A API oferece uma execução ativa por vez em uma instância local. Após reinício, execuções deixadas ativas tornam-se `interrompida`; os arquivos anteriores são preservados.

POST estrito, sem propriedades extras:

```json
{"dataset":"case"}
```

Exemplo de resposta `202`:

```json
{
  "execucao_id": "exemplo-001",
  "estado": "executando",
  "status_url": "/execucoes/exemplo-001"
}
```

`dataset=case` resolve os cinco arquivos em diretório configurado. Upload e caminhos arbitrários recebidos por HTTP ficam fora desta versão. O grafo, por sua vez, continua aceitando entradas textuais para testes e novos lotes.

GET de estado retorna identificador, estado, contagens disponíveis, problemas de execução e artefatos com nome, disponibilidade e URL. Erros HTTP seguem `{"erro":{"codigo":"...","mensagem":"..."}}`; códigos previstos: `JSON_INVALIDO`, `ENTRADA_INVALIDA`, `EXECUCAO_ATIVA`, `CONFIGURACAO_INDISPONIVEL`, `EXECUCAO_NAO_ENCONTRADA`, `ARTEFATO_NAO_ENCONTRADO`, `ARTEFATO_INDISPONIVEL`. Status HTTP e idempotência constam na [RFC](RFC.md).

## 8. Artefatos do cliente

A planilha possui abas `Processos`, `Resumo`, `Auditoria` e `Pendencias`. Processo fica como texto; dinheiro, como célula numérica formatada; datas e nulos têm apresentação consistente. Na aba principal, manter a leitura simples; a memória de cálculo detalhada fica em Auditoria. O valor monetário exibido deve reproduzir o centavo do JSON ao ser reaberto. Textos de entrada são gravados como texto, sem interpretação como fórmula. Na S1.3, datas são textos ISO, nulos são células vazias e zero permanece numérico. O resumo preserva os nomes dos campos e indica a unidade `R$` para os valores convertidos de centavos. Textos acima de 32.767 caracteres e valores monetários sem precisão suficiente no Excel são rejeitados antes da gravação. O destino deve ser novo e seu diretório deve existir. Veja [validação S1.3](../validacao/S1_3_VALIDACAO.md).

O relatório começa pelo resultado e pelas ações recomendadas, apresenta a data-base e informa cobertura e limitações. Usa as contagens fornecidas pelos outputs, sem recomputar indicadores no exportador. A taxa de êxito segue a definição do case, com extinções e improcedências discriminadas; não inferir encerramento definitivo de toda exposição a partir de extinção.

O racional final é um documento separado, escrito/revisado pelo candidato, de até duas páginas em Markdown ou PDF. Deve refletir a implementação real, os resultados medidos e como a IA foi usada no desenvolvimento. A RFC extensa não o substitui.

## 9. Organização interna da S1.5

O contrato público de `analisar_carteira` permanece inalterado. Preparação, extração, validação, cálculo e consolidação agora são subgrafos, com [portas documentadas](../validacao/S1_5_VALIDACAO.md). Erros propagam ao principal; uma saída de erro não é convertida em dados válidos. A revisão não alterou schemas, fórmulas, decisão ou unidades. A equivalência dos quatro outputs é verificada por teste de regressão; aceite S1.5 informado pelo candidato, com [origem registrada](../output/s1.5-aceite.json).

## 10. Normalização S2.2

Vitórias válidas preservam subsídios e probabilidade do CSV como referência; não usam a probabilidade para simular recurso. Componentes e total são zero; datas, meses, custo, benefício, índices de atualização e memória são `null`. Principal corrigido, juros e atualizado ficam zero. Decisão `nao_recorrer`, motivo `sem_condenacao`; um caso válido conta em `processos_aptos` mesmo sem cálculo financeiro aplicável.

Internamente, a validação transmite `{ "sem_condenacao": true }` ao subgrafo financeiro para evitar executar fórmulas de condenação. Essa sinalização não altera o contrato público nem dispensa validação semântica. O relatório de extinção esclarece que a ausência de resolução do mérito não demonstra encerramento definitivo de toda exposição. Os schemas existentes já comportam esses valores e não foram flexibilizados.

## 11. Aceitação S2.3 — implementada na S2.4

A [especificação testável das incertezas](../validacao/S2_3_VALIDACAO.md) distingue falhas individuais de referências globais, define os códigos de problema e o histórico de tentativas. O limite de três inclui transporte e extração, sem multiplicar retries do SDK pelos de validação. A S2.4 implementou os 20 cenários e os incorporou à suíte padrão. A auditoria `s2.4-v1` inclui histórico de todas as chamadas, resposta original, estado, problemas, uso e status HTTP. O plugin local controla transporte e chama a validação do grafo; o SDK e o aplicativo usam o mesmo código. Veja [limites efetivos, compatibilidade e instalação](../validacao/S2_4_VALIDACAO.md).


## 12. Fronteiras e cobertura S2.5

O resumo agora exige `processos_com_valor_atualizado`, `processos_sem_valor_atualizado`, `decisoes_concluidas`, `decisoes_pendentes` e `passivo_parcial`. Cada dupla de contagens soma `total_identificado`. `passivo_parcial` representa somente a incompletude financeira; pode ser falso mesmo com decisão pendente por subsídio não localizado. Vitória validada contribui com zero conhecido.

`analisar_lote` é um novo grafo que reutiliza o fluxo individual, sequencialmente. A preparação confere todas as identidades e referências antes de chamar o extrator. Falhas individuais preservam a linha; falhas globais interrompem sem iniciar os próximos itens. A consolidação exige exatamente uma linha e uma auditoria para cada identidade de entrada, na mesma ordem.

Passivo soma os valores finais por processo; custos e benefícios somam apenas recomendações. Todas as somas monetárias usam `BigInt` e só são convertidas para número seguro no final. Estouro individual gera `erro`/`VALOR_FORA_INTERVALO` e decisão pendente; estouro agregado impede a publicação com `TOTAL_INSEGURO`. Benefício positivo arredondado a zero tem justificativa explícita também no relatório do lote.

A CLI individual continua `analisar_carteira`, com manifesto `s2.5-v1`. `npm run s2:check` é uma prova offline do lote pequeno, sem se apresentar como execução final dos 100 casos. Calendário mantém a fórmula civil da seção 3; os outros dias de referência são provas do helper, sem mudar a data-base do case. [Validação S2.5](../validacao/S2_5_VALIDACAO.md).

## 13. Integração S2.6

O diagnóstico offline exporta os mesmos outputs do lote em JSON, XLSX e Markdown, sem recalcular regras no Node. O manifesto enumera seis artefatos, incluindo entradas e XLSX, com hashes; o formato do manifesto do executor individual não mudou. Na auditoria XLSX, memória nula é representada pelo campo `memoria` com valor vazio; frações continuam texto e dados desconhecidos não viram zero. Os seis testes de integração verificam o contrato em arquivos reabertos. [Aceite local e limites](../validacao/S2_6_VALIDACAO.md).
