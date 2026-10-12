# S2.5 — fronteiras e cobertura

**Concluída no SDK: 122 testes aprovados**, sem chamadas pagas. A entrega cobre calendário civil, fronteiras monetárias e um lote misto de sete identidades. Carteira de 100 casos, avaliação reservada, API e integração final S2.6 continuam pendentes. [Evidência da rodada](../output/s2.5-validacao.json) e [relatório do lote](../output/s2.5-relatorio.md).

## Contrato entregue

| Campo novo de `resumo` | Significado |
| --- | --- |
| `processos_com_valor_atualizado` | Linhas com atualizado conhecido, incluindo zero nas vitórias validadas. |
| `processos_sem_valor_atualizado` | Linhas excluídas do passivo por atualizado desconhecido. |
| `decisoes_concluidas` | Linhas com decisão econômica concluída, inclusive `nao_recorrer`. |
| `decisoes_pendentes` | Linhas sem decisão; não entram nas recomendações. |
| `passivo_parcial` | Verdadeiro se ao menos uma linha não tem atualizado conhecido. |

Esses campos são obrigatórios no [schema](../../schemas/resumo.schema.json), tanto para uma sentença quanto para o lote. As duas duplas de contagens fecham o total identificado. A cobertura financeira pode ser completa enquanto a decisória está incompleta: falta de subsídio não apaga uma atualização válida. Não somar `null` como se fosse exposição comprovadamente zero.

Os totais somam os centavos finais de cada processo. Custos e benefícios incluem somente recursos recomendados, enquanto a decisão considera o sinal do benefício exato antes do arredondamento. As somas usam `BigInt` e verificam o intervalo seguro antes de converter para JSON. Estouro agregado produz `TOTAL_INSEGURO` e impede publicar um total inexato. Estouro individual produz linha `erro`, problema `VALOR_FORA_INTERVALO`, valores derivados `null` e decisão pendente, sem repetir a extração.

A auditoria do extrator mantém `s2.4-v1`, pois seu protocolo não mudou. O manifesto integrado passa a `s2.5-v1`, identificando o novo contrato de resumo. A regressão S1 compara os valores anteriores e acrescenta explicitamente os cinco campos e a linha de cobertura do relatório. Os arquivos históricos em `docs/output/` foram preservados.

## Calendário e dinheiro

O helper civil é compartilhado pelo validador e pelo grafo `s2_calendario`. Não usa horário, fuso, divisão de dias por 30 ou ajuste artificial do dia para o fim do mês. Segue a fórmula documentada: diferença de meses, descontando um quando o dia da referência é menor que o dia da citação.

Os 14 cenários de calendário incluem meses de 28/29/30/31 dias, citação na referência, virada de ano, anos bissextos (2000 válido, 2100 inválido), data inexistente, referência inválida e citação futura. Exemplos: 31/01 → 28/02 = zero mês completo; 29/02/2024 → 28/02/2025 = 11; 29/02/2024 → 01/03/2025 = 12. A data-base do case continua fixa em 31/05/2026; outras referências são usadas somente na prova do helper.

Os 11 vetores monetários usam [um oráculo Python independente](../../tests/fixtures/gerar-fronteiras.py), com `fractions.Fraction`, sem importar fórmulas do JavaScript. Cobrem abaixo/em/acima de meio centavo, juros sem arredondamento intermediário, benefício positivo/negativo/zero, resíduos subcentavo, índices iguais, probabilidade zero e o limite de inteiro seguro. Numeradores/denominadores exatos também são confrontados por multiplicação cruzada.

A fórmula financeira existente passou nesses vetores sem alteração. O lote acrescenta as provas de soma dos valores finais: dois totais exatos de meio centavo viram um centavo por linha, somando dois centavos; arredondar a soma dos exatos daria um centavo e seria incorreto segundo este contrato. Outro teste demonstra recomendação com benefício positivo que aparece como zero, exigindo explicação no relatório.

## Fluxo do lote no Rivet

`analisar_carteira` continua sendo o fluxo individual com cinco subgrafos; a CLI existente continua processando uma sentença. O novo `analisar_lote` recebe as mesmas sete entradas textuais, segmenta as sentenças, confere identidades e referências de todos os itens e executa o fluxo individual sequencialmente. `s2_consolidacao_lote` exige uma linha e uma auditoria por identidade, na ordem da entrada, antes de consolidar.

Preparação, calendário e resumo compartilham os mesmos [helpers incorporados nos Code Nodes](../../rivet/code/comum/). Nenhuma regra de classificação, cálculo ou totalização foi deslocada ao executor Node.

O plugin local ganhou o nó genérico `enterSequentialSubgraph`. Ele apenas chama subgrafos em ordem e propaga a primeira falha global; não contém regra de negócio. A alternativa nativa Split Run sequencial, no SDK 1.25.0 inspecionado, acumula erros e continua os próximos itens; isso repetiria chamadas após credencial inválida. O teste de HTTP 401 no primeiro item exige exatamente uma chamada e nenhuma execução dos demais. Não há truncamento por quantidade fixa; a prova desta etapa usa um lote pequeno, sem certificar operação da carteira completa.

Falhas individuais terminam em linhas de pendência/erro e permitem continuar. Duplicatas, entrada vazia, subsídio extra e referências globais inválidas abortam. Um índice-base ausente, conhecido apenas depois da extração, também é falha global. Interrupção global ainda não oferece checkpoint de carteira ou artefatos parciais recuperáveis; essa operação não foi implementada nesta tarefa.

## Resultado do lote de desenvolvimento

São sete identidades retiradas somente dos gabaritos de desenvolvimento. Uma data e sua evidência foram removidas de forma sintética; uma linha de subsídio foi retirada; duas respostas foram substituídas por JSON inválido e HTTP 503. Os documentos originais de `case/` não foram alterados.

| Medida | Resultado |
| --- | ---: |
| Identidades de entrada/saída/auditoria | 7 / 7 / 7 |
| Aptos / pendências, incluindo erro técnico | 3 / 4 |
| Vitórias / condenações / resultados desconhecidos | 2 / 3 / 2 |
| Cobertura financeira | 4 / 7 |
| Cobertura decisória | 3 / 7 |
| Passivo parcial conhecido | R$ 16.579,46 |
| Recursos recomendados | 1 |
| Custo dos recursos recomendados | R$ 3.200,00 |
| Benefício líquido esperado dos recomendados | R$ 64,20 |
| Requisições simuladas / chamadas reais | 13 / 0 |

O relatório lista as identidades excluídas de cada cálculo. Esses números descrevem um cenário de desenvolvimento com falhas simuladas, não o resultado final da carteira nem a qualidade atual da LLM.

## Testes, reprodução e limites

A primeira execução registrou 30 testes novos: 11 aprovados (aritmética existente) e 19 falhas por grafos ausentes. Depois da implementação, a fixture de data ausente foi corrigida para atualizar também a evidência longa de resultado que continha a data removida. Os testes complementares foram acrescentados durante a revisão; não são apresentados como parte do vermelho inicial.

Resultado final: 84 regressões anteriores + 25 testes de fronteiras + 13 de cobertura = **122 aprovados**, sem skips. Os testes de cobertura também recusam linha omitida/duplicada e auditoria divergente, distinguem cobertura financeira/decisória e verificam as falhas de intervalo seguro.

```bash
npm run s1:build
npm run test:s2:fronteiras
npm run test:s2:cobertura
npm test
npm run s2:check
```

`s2:check` usa anotações e falhas simuladas, sem `.env` ou rede. Informa um diretório único em `outputs/s2.5/`, com entradas, processos, resumo, auditoria, Markdown e manifesto com hashes. Não é uma nova CLI de produção da carteira. Para regenerar os vetores financeiros, opcionalmente execute `python3 tests/fixtures/gerar-fronteiras.py`; Python não é dependência do runtime Node.

**Aplicativo:** atualize os dois arquivos do plugin já instalado a partir de `rivet/plugins/enter-bounded-extraction/` e reinicie o Rivet, conforme [instalação S2.4](S2_4_VALIDACAO.md#carregar-no-aplicativo-e-conferir). Abra o projeto atualizado; confira `s2_calendario` sem API. Para conferir o lote no painel, copie os campos de `entradas.json` gerados por `s2:check` para os Graph Inputs de `analisar_lote`. Run no painel fará chamadas reais, até três por sentença; falhas HTTP/JSON sintéticas não são reproduzidas automaticamente nesse caminho. O painel continua mostrando outputs, sem gravar arquivos no disco.

Não houve novo aceite visual, avaliação paga de LLM, avaliação reservada ou execução dos 100 casos nesta rodada. A reconciliação ampliada de JSON/XLSX/relatório e o aceite S2 ficam na S2.6. A API continua em S4.

## Commit sugerido

```text
feat: cobre fronteiras e consolida lote misto na S2.5
```

Nenhum commit feito pelo assistente. Próxima tarefa: S2.6.
