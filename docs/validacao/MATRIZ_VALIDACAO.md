# Matriz de validação e referências do lote

**Estado:** fluxo, carteira real e API implementados e verificados. Mantenho abaixo a relação entre cada requisito e sua evidência atual. A primeira avaliação reservada reprovou; a repetição passou em conjunto já visto. PDF final e pacote ainda dependem das conferências S5.

## 1. Requisitos e evidências de aceite

| ID | Origem | Critério | Evidência atual | Estado |
| --- | --- | --- | --- | --- |
| R01 | Case 3 e 5.1 | Análise inteira no Rivet | Projeto completo, SDK, aceite visual V0; demonstração final no ZIP em S5.7 | Implementado; prova final pendente |
| R02 | Case 5.1 | Uma linha por identidade | Carteira real 100/100, sem omitidos ou duplicados | Verificado |
| R03 | Case 5.1 e 5.2 | Extração fiel às sentenças | Gabaritos, avaliações preservadas e auditoria documental S3 | Verificado neste lote; limites declarados |
| R04 | Case 5.2 | Índices, juros e meses completos | Oráculo independente, fronteiras e 52 condenações auditadas | Verificado |
| R05 | Case 5.3 | Recomendação econômica explicável | Sinal exato, limiares, cenários e nulos nos testes | Verificado |
| R06 | Case 5.4 | Relatório executivo adequado | Texto V0 aceito; PDF e fonte final em S5.10/S5.3 | Conteúdo verificado; apresentação final pendente |
| R07 | Case 5.5 | XLSX real, uma linha por processo | Quatro abas, 100 linhas, conferência visual V0 e reabertura automatizada | Verificado |
| R08 | Case 5.6 | Racional curto e fiel | [Racional](../entrega/racional.md), escolhas e IA declaradas | Escrito; conferência de extensão registrada na S5 |
| R09 | Case 6 | ZIP completo e reproduzível | Lista positiva e roteiro; extração do ZIP em S5.6 | Pendente |
| R10 | Case 7 | Rastreabilidade | Evidências, frações, tentativas e hashes nos manifestos | Verificado |
| R11 | Extra | POST, consulta e download | Sockets reais, curl e equivalência API/CLI S4 | Verificado em replay |
| R12 | Robustez | Falhas explícitas sem valores inventados | Retentativas, desconhecidos, interrupção, exportação e reinício | Verificado |

Centralizei números e limites em [validação final](../entrega/validacao.md). Não uso a API para compensar ausência de um entregável obrigatório.

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

Conferência independente com aritmética decimal de alta precisão: `6300 × 1117.1189 / 1086.2922 × 1.03 = 6673.144244338677...`. Total arredondado para R$ 6.673,14; benefício usa o total final: `0.10 × 6673.14 − 3200 = −2532.686`. Essa conta valida a convenção descrita no [contrato](../arquitetura/CONTRATOS.md), com o mesmo resultado observado na execução real.

O [exemplo de extração](../../schemas/extracao.exemplo.json) registra os valores e trechos dessa sentença. Ele é um gabarito anotado para desenvolvimento, não saída capturada de uma LLM.

## 4. Casos automatizados e medidas de qualidade

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


## 5. Histórico de evolução

Registrei 122 testes na S2.5, 128 na S2.6, 150 na S3 e 175 na S4. Cada documento da etapa conserva o contexto de suas pendências; os estados atuais são os da tabela acima. A execução real, a auditoria e o aceite visual V0 foram concluídos na S3; a API em replay foi concluída na S4. ZIP e apresentação final ficam na S5.
