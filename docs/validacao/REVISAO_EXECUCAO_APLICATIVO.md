# Revisão do resumo executado no aplicativo Rivet

**Conclusão:** os 100 identificadores, as 100 classificações e os 52 valores nominais enviados pelo candidato conferem com os documentos originais. Esta revisão trata do grafo-base `resumo_sentenca`. Posteriormente, o candidato enviou os outputs dos três grafos específicos S0, também aprovados e registrados em [s0-aplicativo.json](../output/s0-aplicativo.json).

## Evidência e método

O candidato colou na conversa os outputs do nó Chat e do Graph Output. Os dois trechos contêm a mesma lista; não foram tratados como duas execuções ou como validações independentes. O arquivo local `analise_sentencas.rivet-project` conecta diretamente a resposta do Chat ao output `resumo`, em formato string, e seu prompt solicita exatamente os três campos observados.

Os 100 registros da mensagem foram transcritos em [CSV normalizado](../output/resumo-aplicativo-recebido.csv), preservando a ordem. Foram mapeados os quatro rótulos para os enums do contrato; valores em reais foram convertidos para centavos inteiros; `Não aplicável` foi mantido como célula vazia. Esta é uma transcrição da mensagem, não um arquivo exportado diretamente do Rivet.

A conferência offline separou os documentos originais pelos cabeçalhos delimitados, leu `JULGO ...` no dispositivo e somou apenas as verbas expressamente concedidas como danos materiais/morais. Comparou por CNJ exato, incluindo faltantes, extras e duplicados. O [resultado da conferência](../output/resumo-aplicativo-conferencia.json) registra hashes, contagens e divergências. Essa verificação é uma auditoria do output, não código do pipeline de produção.

| Verificação | Resultado |
| --- | --- |
| Identidades recebidas e únicas | 100 / 100 |
| Faltantes, extras, duplicados | 0 / 0 / 0 |
| Classificações concordantes | 100 / 100 |
| Procedências / parciais | 35 / 17 |
| Improcedências / extinções | 26 / 22 |
| Condenações com valor concordante | 52 / 52 |
| Casos sem condenação informada | 48, coerentes com improcedência/extinção |
| Soma do principal nominal | **R$ 254.200,00**, antes de correção e juros |

O processo `3871230-78.2024.8.26.0002` está correto com principal de R$ 6.300,00: R$ 6.000,00 materiais + R$ 300,00 morais. O valor atualizado de referência é R$ 6.673,14. São grandezas distintas; o resumo colado apresenta somente a primeira.

## Consumo e anomalia de custo

A [telemetria transcrita](../output/resumo-aplicativo-metricas.json) informa duração de 60.815 ms e, no bloco `usage`, 28.177 tokens de entrada + 8.898 de saída = **37.075 tokens**. Os 4.672 tokens de raciocínio são um detalhamento da saída e não devem ser somados novamente. Os 28.032 tokens de cache são um detalhamento da entrada. A definição desses campos está na [referência oficial de Chat Completions](https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create).

`responseTokens=6770` e `__hidden_token_count=34947` divergem do `usage`. No SDK inspecionado, a contagem de saída pode ser substituída pela estimativa do tokenizer local quando `useServerTokenCalculation` está desativado; isso é uma explicação compatível com a configuração da cópia, sem comprovar a implementação exata do aplicativo usado. Para o registro de consumo desta execução, foi conservado o bloco `usage` fornecido.

`cost=-162.017732204` é inválido como estimativa de gasto. Não foi interpretado como cobrança ou crédito; o custo monetário adotado é `null`. O SDK acrescenta estimativas de custo ao output, mas a causa exata do valor negativo no aplicativo não foi isolada. A saída colada não identifica o modelo efetivamente atendido: a cópia local está configurada com `gpt-5-mini`, informação insuficiente para atribuir com certeza o modelo/snapshot e recalcular um preço.

## Efeito no plano

A execução confirma uma leitura e um resumo funcionais pelo aplicativo, conforme a evidência enviada. Ainda faltam estrutura do schema completo, componentes separados, datas, evidências literais, cruzamentos com referências, atualização monetária e decisão econômica no fluxo final. O Graph Output apenas repassa a resposta do Chat.

Na conferência posterior, o candidato abriu `rivet/s0_compatibilidade.rivet-project` e enviou os resultados esperados:

- `s0_calculo`: `valor_atualizado_centavos=667314`, `beneficio_esperado_centavos=-253269`, `decisao_recurso=nao_recorrer`.
- `s0_validacao`: `schema_valido=true`, `apto_calculo=true`, `problemas=[]`.
- `s0_llm`: processo e classificação corretos, 416 tokens informados.

Essa evidência posterior encerrou a S0; os passos de reprodução estão em [S0_VALIDACAO.md](S0_VALIDACAO.md).

**Proveniência da avaliação reservada:** esta execução do resumo-base abrange os 100 casos, inclusive os 12 reservados. Logo, esses casos já foram expostos a uma LLM e a seus resultados preliminares. Eles continuam separados para avaliar o novo extrator completo em S3, mas essa rodada não poderá ser descrita como primeira exposição ou avaliação cega. Não houve ajuste de prompt com base nesta conferência; a execução do extrator completo no reservado continua pendente.
