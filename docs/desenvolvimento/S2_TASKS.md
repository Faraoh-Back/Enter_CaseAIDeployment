# S2 — desenvolvimento por tarefa

Uma tarefa por rodada, com revisão e commit pelo candidato. **S2.4 concluída no SDK**: 84 testes aprovados, incluindo os 20 contratos da S2.3. Aceite visual do novo plugin ainda pendente. [Implementação, validação e instalação](../validacao/S2_4_VALIDACAO.md).

| Tarefa | Entrega revisável | Estado |
| --- | --- | --- |
| S2.1 — aceitação dos resultados | Exercitar os 12 gabaritos de desenvolvimento e um pedido sintético maior; registrar as falhas das vitórias antes de implementar. | Concluída |
| S2.2 — normalizar os quatro resultados | Fazer os testes de S2.1 passarem; representar vitórias sem simular recurso, preservar condenações, resumo e relatório; incorporar testes verdes à suíte padrão. | Concluída |
| S2.3 — aceitação das incertezas | Testes de dados ausentes/inválidos/futuros, divergências, duplicatas, JSON inválido, retentativas e falhas HTTP, distinguindo falhas globais de pendências individuais. | Concluída |
| S2.4 — pendências e retentativas | Implementar contratos de S2.3 no Rivet e ajustar limites do executor; até três tentativas totais, diagnóstico auditável e estados terminais. | Concluída no SDK |
| S2.5 — fronteiras e cobertura | Calendário e dinheiro nas fronteiras; pequeno lote misto, uma linha por identidade, totais parciais e exclusões explícitas. | Não iniciada |
| S2.6 — integração e aceite | Reconciliar JSON/XLSX/Markdown, revisar responsabilidades e contratos, reunir suítes verdes e registrar aceite local/aplicativo. | Não iniciada |

Cada tarefa começa verificando seu escopo e termina com resultado e sugestão de commit. Caso os testes revelem uma mudança necessária no contrato, documentá-la na tarefa correspondente antes da implementação. Processamento dos 100 casos e avaliação do conjunto reservado permanecem em S3.

## S2.1 — origem e isolamento

[tests/s2-resultados.test.mjs](../../tests/s2-resultados.test.mjs) executa o projeto real e o grafo público `analisar_carteira`. São 12 execuções individuais, não uma execução de carteira. Cada entrada recorta o bloco original e a linha correspondente de subsídios; índices, custos e probabilidades vêm dos CSVs originais.

Usa somente [golden/desenvolvimento.json](../../tests/fixtures/golden/desenvolvimento.json): três exemplos de cada resultado, condenações com danos materiais isolados e combinados, três níveis de subsídios, decisões econômicas positivas e negativas. Os gabaritos financeiros foram preparados com `fractions.Fraction`, independentemente dos Code Nodes BigInt.

Antes de executar cada caso, o teste verifica o texto contra o original, seu hash, o schema da extração e a literalidade das evidências. Somente `fetch` é simulado, retornando o gabarito anotado como resposta estruturada da LLM. O teste exige uma chamada, endpoint esperado e schema estrito; não usa `.env` nem rede. Uma falha no transporte simulado é propagada, sem permitir que seja confundida com uma funcionalidade ausente.

O décimo terceiro cenário insere, antes do dispositivo do caso S1, este pedido **sintético**:

> A parte autora requereu R$ 50.000,00 a título de danos materiais e R$ 20.000,00 a título de danos morais.

A sentença original em `case/` não é modificada. O dispositivo e a extração simulada continuam concedendo R$ 6.000,00 + R$ 300,00. O teste verifica que o texto modificado chega ao extrator e que os valores finais permanecem os do gabarito. Isso testa o processamento de uma extração correta na presença de distração; **não mede se a LLM real distingue pedido de condenação**. Essa avaliação requer uma rodada real separada.

## Contrato observado

Para todos os resultados: uma linha, identidade e dados fiéis, schema válido, estado `ok`, problemas vazios e auditoria correspondente. Todos os campos financeiros e decisórios do gabarito são comparados; nas condenações, compara-se também o valor racional exato por multiplicação cruzada das frações independentes.

| Aspecto | Condenação apta | Improcedência/extinção válidas |
| --- | --- | --- |
| Componentes e total | Conforme dispositivo | Zero, conforme gabarito |
| Datas e meses | Conforme documento e referência | `null` |
| Principal corrigido, juros, atualizado | Conforme oráculo independente | Zero |
| Subsídios e probabilidade | Conforme CSV | Preservados do CSV como referência, sem simular recurso |
| Custo e benefício de recurso | Conforme cálculo | `null` |
| Decisão / motivo | Regra econômica | `nao_recorrer` / `sem_condenacao` |
| Índices e memória na auditoria | Frações e índices efetivamente usados | `null`, pois não houve atualização |
| Resumo | Uma condenação, zero vitórias | Uma vitória pela definição do case, zero condenações |

Um processo válido e completamente tratado, inclusive uma vitória, conta em `processos_aptos`. Não aplicável não é informação desconhecida nem pendência. O resumo mantém o total identificado e seus denominadores, sem somar custos de recursos não recomendados. O relatório identifica o processo e, nas vitórias, informa ausência de condenação; não pode conter `NaN` ou `undefined`.

Esses testes não afirmam encerramento definitivo de exposição após extinção nem analisam cabimento jurídico de recurso. Usam a convenção econômica do case. As regras de dados desconhecidos serão detalhadas na S2.3.

## Registro histórico da S2.1: vermelho observado

```bash
npm test
npm run test:s2
```

- `npm test`: **43 aprovados**, saída 0; regressão S0/S1 preservada.
- `npm run test:s2`: **7 aprovados e 6 falhas**, saída 1. As seis condenações e o cenário sintético passaram. As três improcedências e três extinções falharam com `ESCOPO_S1: apenas condenações nesta fatia`.

O teste vermelho exige sucesso no tratamento das vitórias; não espera uma exceção como resultado correto. Não há `skip`, `todo` ou inversão das falhas. A suíte fica fora de `npm test` temporariamente, como aconteceu na S1.1, permitindo um commit isolado do contrato; o verde padrão não significa aceite da S2. A S2.2 deverá incluir essa suíte no comando padrão quando estiver verde.

Os asserts posteriores à restrição de escopo ainda não foram exercitados para as seis vitórias. Fazer o grafo aceitar esses resultados poderá revelar outras lacunas na normalização/consolidação. A [evidência da rodada](../output/s2.1-vermelho.json) registra contagens, falhas, hashes e limites. O conjunto reservado não foi usado nos novos testes; a suíte anterior conserva suas verificações de integridade, sem executar nele o novo extrator.

## Commit da S2.1

Sugestão para esta tarefa:

```text
test: define aceitação S2 para os quatro resultados de sentença
```

O próximo trabalho é somente S2.2. Na S2.4, testes S1 que hoje exigem falha terminal por dados individuais inválidos precisarão ser migrados para o contrato de pendência, preservando sua intenção: impedir cálculo e recomendação indevidos. Não manter expectativas contraditórias nem simplesmente remover cobertura.

## S2.2 — resultado atual

A validação normaliza improcedência/extinção sem exigir datas de atualização. O financeiro retorna valores não aplicáveis sem executar as fórmulas de condenação. Auditoria e relatório distinguem ausência de condenação de pendência; o resumo conta as vitórias segundo a convenção do case. Condenações mantêm os outputs anteriores.

`npm run test:s2`: 13/13 aprovados. `npm test`: 56/56 aprovados, incluindo a suíte S2. Nenhum teste foi removido ou marcado como ignorado. Veja [S2_2_VALIDACAO.md](../validacao/S2_2_VALIDACAO.md) e [outputs exemplificativos](../output/s2.2-validacao.json).

Próxima tarefa: **S2.3**, somente os contratos/testes das incertezas. Sugestão de commit desta implementação: `feat: normaliza os quatro resultados de sentença no Rivet`.

## S2.3 — resultado atual

`npm run test:s2:incertezas` executa 20 cenários de dados incompletos, reparo, transporte, quota e falhas globais. Resultado: 5 aprovados, 15 falhas; saída 1. `npm test` permanece verde com os 56 anteriores. Não houve mudança no grafo nem no executor. [Contrato, método e limites](../validacao/S2_3_VALIDACAO.md).

Próxima tarefa: **S2.4**, implementar pendências e orçamento compartilhado de tentativas, migrando as expectativas anteriores de falha terminal sem perder cobertura. Sugestão: `test: define pendências e limite de retentativas da S2`.


## S2.4 — resultado atual

Pendências e falhas técnicas preservam a identidade sem autorizar cálculos desconhecidos. Subsídio não localizado preserva a atualização e bloqueia a decisão. Até três chamadas compartilham o mesmo orçamento, com histórico, reparo orientado pelos erros e tratamento de quota/credencial como falha global.

Um plugin local controla transporte e chama o subgrafo validador. Não foram alteradas fórmulas nem dependências. O executor registra pendências, snapshots/hashes do plugin e arquivos válidos. Testes antigos de rejeição foram migrados, preservando a proteção contra recomendações indevidas. `npm test`: **84 aprovados**, sem skips ou chamadas reais. [Evidência](../output/s2.4-validacao.json).

O aplicativo requer instalar o plugin conforme o [roteiro S2.4](../validacao/S2_4_VALIDACAO.md); esse aceite permanece pendente. Próxima tarefa: **S2.5**. Sugestão de commit: `feat: implementa pendências e retentativas auditáveis da S2.4`.
