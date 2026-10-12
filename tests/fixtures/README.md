# Gabaritos S0

Os arquivos em `golden/` são referências de teste, não extrações produzidas pela LLM. Há **12 processos para desenvolvimento e 12 reservados**, sem interseção. Cada conjunto contém três processos de cada resultado, os três níveis de subsídios e condenações com danos materiais isolados e combinados com danos morais.

A seleção usa resultado × subsídio. Não existe `improcedencia / ausentes` no lote: essa vaga foi redistribuída a `completos`, o maior grupo de improcedências. Dentro dos estratos condenatórios, prioriza-se a proximidade do benefício esperado a zero; o desempate usa SHA-256 do CNJ. O processo definido para S1 permanece no desenvolvimento. Não se trata de amostra proporcional para estimar taxas da carteira.

Há decisões positivas e negativas nos dois conjuntos. Entre os exemplos próximos ao limiar estão `7094431-69.2024.8.26.0001`, com benefício de R$ 64,20 no desenvolvimento, e `4892305-63.2025.8.26.0005`, com R$ 99,31 no reservado. Empate e benefícios residuais de frações de centavo são cobertos por casos sintéticos, não apresentados como ocorrências reais do lote.

## Como foram anotados e conferidos

1. `preparar_gabaritos.py` pré-anota diretamente os dispositivos e os parágrafos dos documentos originais, sem chamar a LLM. Conserva texto, trechos literais e hash de cada sentença.
2. O cálculo de referência usa `fractions.Fraction`, da biblioteca padrão Python, independentemente da implementação `BigInt` dos Code Nodes. Aplica os CSVs do case, meses completos e a política de arredondamento dos contratos. Python serve apenas à preparação opcional dos gabaritos; a aplicação e os grafos não dependem dele.
3. Em 11/10/2026, durante esta implementação assistida por IA, foram lidos os dispositivos e fundamentos dos 24 selecionados e confrontados resultado, componentes, mês-base, citação e tema com os campos anotados. Não houve segunda revisão humana independente; recomenda-se ao candidato conferir esses exemplos antes da defesa.
4. `npm test` confere os hashes dos insumos e das fixtures, a identidade do texto original, o schema dos 24 e a presença literal das evidências. Nos 12 de desenvolvimento, também executa o validador Rivet; nas seis condenações desse conjunto, compara os outputs financeiros com o oráculo independente.

`valor_total_explicito_centavos` permanece `null`: as sentenças discriminam componentes, sem declarar um total agregado. A ausência de dano moral é anotada como zero com base no dispositivo integral; nos parciais pertinentes há também rejeição expressa. Improcedências e extinções mantêm datas não aplicáveis e benefício/custo de recurso nulos.

O vocabulário controlado de temas contém as dez descrições encontradas nos insumos e está em `golden/manifest.json`. O fundamento usa o próprio parágrafo como referência semântica; futuras sínteses da LLM devem preservar seu sentido, não necessariamente reproduzir a string inteira.

## Regra do conjunto reservado

Até S3, não executar o novo extrator completo nos processos reservados nem usá-los como exemplos para ajustar prompts. A checagem de integridade das fixtures não mede a qualidade do extrator. A leitura necessária à anotação foi declarada; este conjunto é reservado para avaliação, sem alegação de estudo cego ou de revisão independente.

**Exposição posterior à preparação:** o candidato executou o resumo-base nos 100 processos e compartilhou os resultados. Os 12 reservados estão incluídos, de modo que já houve exposição à LLM e conferência de identidade, resultado e principal. O extrator completo ainda não foi avaliado nesse conjunto. Preservar essa distinção na rodada S3, conforme o [registro da execução](../../docs/REVISAO_EXECUCAO_APLICATIVO.md), sem apresentar os casos como inéditos para a LLM. O manifesto original registra a intenção na preparação; este registro posterior declara o desvio observado.

As fixtures já estão versionáveis. Para regenerá-las deliberadamente, com Python 3 e sem dependências adicionais:

```bash
python3 tests/fixtures/preparar_gabaritos.py
```

Isso reescreve os dois conjuntos e seu manifesto. Depois de iniciar S3, preservar os hashes da rodada avaliada e registrar qualquer revisão; não substituir silenciosamente os gabaritos.
