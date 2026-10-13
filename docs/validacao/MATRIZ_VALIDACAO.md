# Matriz de validação e referências do lote

**Estado:** S0 concluída, com inspeção dos insumos, 14 testes offline aprovados, XLSX de prova conferido, gabaritos 12 + 12 e chamadas mínimas à LLM. Os outputs dos três grafos no aplicativo também foram enviados pelo candidato e conferidos; [evidências S0](S0_VALIDACAO.md). O fluxo completo, a avaliação do extrator e a execução final continuam pendentes. As referências de carteira abaixo não são resultados do pipeline.

## 1. Requisitos e evidências de aceite

| ID | Origem | Critério verificável | Evidência a produzir | Estado |
| --- | --- | --- | --- | --- |
| R01 | Case 3 e 5.1 | Análise completa definida no projeto Rivet; abertura no aplicativo e execução pelo SDK. | Projeto, versão e registro de execução em ambos os caminhos. | Pendente |
| R02 | Case 5.1 | Uma linha por identidade, sem casos omitidos ou duplicados. | Confronto entre lista de entrada e saída; 100/100 no lote fornecido. | Pendente |
| R03 | Case 5.1 e 5.2 | Resultado, valores e datas correspondem ao documento. | Gabaritos, evidências e acurácia por campo; relatório de divergências. | Pendente |
| R04 | Case 5.2 | Correção, meses completos e juros simples corretos. | Casos de referência independentes e fronteiras monetárias/calendário. | Pendente |
| R05 | Case 5.3 | Decisão corresponde à regra econômica e às referências fornecidas. | Benefícios positivo/negativo/zero, vitórias e pendências. | Pendente |
| R06 | Case 5.4 | Relatório adequado à diretoria, com síntese, êxito, impacto e pontos de atenção. | Revisão editorial e conciliação de todos os números com o output. | Pendente |
| R07 | Case 5.5 | XLSX verdadeiro, com identificação, resultado, condenação, subsídios e recurso. | Reabertura da planilha e conferência de células e contagens. | Pendente |
| R08 | Case 5.6 | Racional próprio em até duas páginas, fiel à implementação. | Markdown/PDF revisado pelo candidato. | Pendente |
| R09 | Case 6 | ZIP inclui projeto, inputs, outputs e tudo que permite executar. | Reprodução em diretório limpo seguindo apenas o README entregue. | Pendente |
| R10 | Case 7 | Auditabilidade: seguir um valor do relatório até a fonte. | Manifesto, hashes, evidências e memória de cálculo. | Pendente |
| R11 | Facilidade de uso | POST inicia, GET acompanha e GET baixa os artefatos. | Testes HTTP reais e sequência curl documentada. | Pendente |
| R12 | Robustez | Falhas não geram valores inventados, omissões silenciosas ou falso sucesso. | Testes de dados ausentes, retentativas, interrupção e exportação. | Pendente |

Os critérios R01–R10 são o centro da entrega. A API e outros refinamentos não compensam falhas no fluxo ou nos documentos obrigatórios.

## 2. Referência da inspeção dos insumos

Método da conferência: separar `processos.txt` pelos cabeçalhos delimitados, identificar o resultado pela expressão do dispositivo (`JULGO ...`), conferir identidades internas e cruzar a lista de subsídios por número exato. A presença de data de citação e mês-base foi conferida nas condenações. Essa inspeção determinística aproveita a regularidade do material e não mede qualidade de extração por LLM.

| Resultado | Quantidade |
| --- | ---: |
| Procedência | 35 |
| Parcial procedência | 17 |
| Improcedência | 26 |
| Extinção | 22 |
| Total | 100 |

- 100 identidades únicas e 100 correspondências na lista de subsídios, sem faltantes ou extras.
- 48 vitórias pela definição do case e 52 condenações; taxa de êxito de 48%.
- Todos os processos têm código de tribunal `8.26` e comarca textual São Paulo. O custo TJSP da tabela é R$ 3.200,00.
- As 52 condenações apresentam mês-base e citação explícitos: ausência na extração exige investigação.
- 34 condenações combinam danos materiais e morais; 18 concedem danos materiais apenas.
- Os primeiros dez processos não incluem procedência total; uma amostra por posição seria insuficiente.

| Subsídios | Processos | Condenações | Taxa de condenação |
| --- | ---: | ---: | ---: |
| Completos | 33 | 10 | 30,3% |
| Essenciais | 38 | 21 | 55,3% |
| Ausentes | 29 | 21 | 72,4% |

As taxas descrevem associação neste lote, não efeito causal dos subsídios. Probabilidade de reversão em recurso é outro dado, fornecido no CSV; não deve ser substituída por essas taxas.

Hashes SHA-256 dos arquivos inspecionados:

| Arquivo | SHA-256 |
| --- | --- |
| `processos.txt` | `71f061fe84188544c663ac9150b2bc53903ed27d923f13de9882f31d961be943` |
| `status_subsidios.txt` | `3a22e20c884d69703ee3acf30eee771f83a132ea824792de56e7f4a9f9dde6c1` |
| `tabela_indices.csv` | `d5d647e87d97ca2f17d1af7445b8fec97611870672a6dfb12be402ed55a7a683` |
| `custo_recurso_por_tribunal.csv` | `6cd9c5075e73163c1a73f4fbac493913899b45c373ceab777d3a0ff6aa074ba7` |
| `subsidios_probabilidade_reversao.csv` | `ad1d915821a6a7ec024225cb251096efc77d44ebbc422a57a03018eaaabefa77` |

Se os insumos mudarem, reavaliar as referências. Não ajustar o pipeline para reproduzir contagens fixas independentemente da entrada.

## 3. Exemplo financeiro independente para S1

Processo `3871230-78.2024.8.26.0002`, parcial procedência. A sentença concede R$ 6.000,00 de danos materiais e R$ 300,00 de danos morais. O total de R$ 6.300,00 é a soma dos componentes. Mês-base: dezembro/2025; citação: 27/02/2026. Subsídios: ausentes; custo TJSP: R$ 3.200,00.

| Item | Resultado esperado |
| --- | ---: |
| Índice-base | 1086.2922 |
| Índice final | 1117.1189 |
| Meses completos até 31/05/2026 | 3 |
| Principal corrigido, exibido | R$ 6.478,78 |
| Juros, exibidos para conciliação | R$ 194,36 |
| Valor atualizado | R$ 6.673,14 |
| Probabilidade do CSV | 10% |
| Benefício líquido esperado, exibido | −R$ 2.532,69 |
| Decisão | Não recorrer |

Conferência independente com aritmética decimal de alta precisão: `6300 × 1117.1189 / 1086.2922 × 1.03 = 6673.144244338677...`. Total arredondado para R$ 6.673,14; benefício usa o total final: `0.10 × 6673.14 − 3200 = −2532.686`. Essa conta valida a convenção descrita no [contrato](../arquitetura/CONTRATOS.md), sem afirmar que o pipeline já a executou.

O [exemplo de extração](../../schemas/extracao.exemplo.json) registra os valores e trechos dessa sentença. Ele é um gabarito anotado para desenvolvimento, não saída capturada de uma LLM.

## 4. Casos a automatizar e medidas de qualidade

| Grupo | Casos mínimos | Verificação |
| --- | --- | --- |
| Segmentação e joins | Número repetido no corpo; ID duplicado entre blocos; ID divergente; referência faltante; delimitadores diferentes nos CSVs. | Identidades preservadas e falhas explícitas. |
| Extração | Quatro resultados; componente rejeitado; material + moral; pedido maior que condenação; evidência que não sustenta o campo. | Confronto de cada campo com o documento; schema não substitui conferência semântica. |
| Calendário | Meses com 28/29/30/31 dias, citação na referência e após referência, data impossível. | Meses completos corretos e rejeições explícitas. |
| Dinheiro | Índice-base igual ao final; fator fracionário; fronteira de meio centavo; totais com várias linhas; estouro. | Exatidão das frações e igualdade dos centavos finais. |
| Decisão | Benefício positivo, negativo e zero; residual inferior a um centavo; três subsídios; vitória; pendência. | Decisão pelo valor exato e apresentação coerente. |
| Retentativa | JSON inválido; timeout; erro transitório; credencial/quota inválida. | Limite total respeitado, diagnóstico correto e ausência de loop infinito. |
| Relatório | Casos desconhecidos; cálculos pendentes; grupos pequenos; comarca única. | Denominadores, cobertura, limites e ausência de alegações causais. |
| API/arquivos | POST concorrente; GET antes/depois; reinício; falha na exportação; arquivo fora da lista. | Estados e HTTP corretos; nenhum falso artefato concluído. |
| Reprodução | Outputs capturados; execução do ZIP; aplicativo versus SDK. | Mesma análise determinística, grafo portável e passos suficientes. |

Metas: identidade e integridade estrutural em 100% dos casos; zero divergência monetária/decisória nos testes determinísticos; acerto de todos os campos críticos no conjunto reservado antes de considerar o extrator aceito. Campo crítico: resultado, valores concedidos, mês-base e citação quando aplicáveis. Falha em uma meta deve ser reportada e corrigida, não arredondada para sucesso.

Medir acurácia por campo, completude por processo, percentual de pendências, sucesso na primeira tentativa, total de chamadas, tempo e tokens disponíveis. Relatar tamanho e composição da amostra. Se houver correção humana, preservar a saída original, o valor corrigido, a evidência e o motivo; não contar a correção como acerto automático.

O registro final deve distinguir: teste offline, avaliação LLM de desenvolvimento, avaliação reservada e execução final dos 100 casos. Uma amostra perfeita não prova perfeição na carteira inteira.


## 5. Progresso de robustez até S2.5

A [S2.5](S2_5_VALIDACAO.md) oferece evidência determinística para R02, R04, R05, R10 e R12: 122 testes verdes, incluindo fronteiras civis/monetárias, sete identidades reconciliadas e exclusões explícitas. R02 ainda exige 100/100 na carteira real; esta prova é 7/7 em desenvolvimento. O aceite final da matriz não foi antecipado: qualidade da LLM, conjunto reservado, carteira completa, aplicativo atualizado e entregáveis finais permanecem pendentes.

## 6. Integração S2.6

A [S2.6](S2_6_VALIDACAO.md) amplia a evidência de integridade dos artefatos: 128 testes aprovados, 7/7 identidades e reconciliação de células, totais, pendências, auditoria e relatório. O XLSX é gerado e reaberto no teste integrado. Aceite local concluído; desktop atualizado, qualidade da LLM e critérios da carteira completa permanecem pendentes.

## 7. Carteira e avaliação S3

A [S3](S3_VALIDACAO.md) concluiu execução real 100/100, com 52 condenações auditadas e zero divergências nos controles estruturais, financeiros e decisórios. A avaliação reservada inicial reprovou; correção testada em desenvolvimento e reavaliação de conjunto já visto passaram em 12/12. Os dois resultados estão preservados, sem alegação de estudo cego. Suíte: 150 testes determinísticos aprovados. Aceite visual V0 dos novos arquivos confirmado pelo candidato; PDF, API e reprodução do ZIP permanecem pendentes.
