# Racional — análise de sentenças com Rivet

Construí o fluxo para responder às três perguntas do case: quantos processos terminaram favoravelmente ao réu, qual é a exposição financeira e em quais condenações o recurso tem benefício econômico esperado positivo. Mantive a análise inteira no Rivet. A aplicação Node lê arquivos, executa o projeto e exporta seus outputs; a API é uma conveniência, sem regras jurídicas ou financeiras próprias.

## Insumos e desenho

Preservei os cinco insumos originais. No grafo, separo as sentenças pelos delimitadores, confiro a identidade interna e cruzo as referências pelo número do processo. Leio os CSVs com seus delimitadores específicos e verifico chaves, índices, custos e probabilidades antes de iniciar a extração. Não fixei o tamanho do lote em 100.

Escolhi extrair uma sentença por chamada, com resposta JSON estruturada e trechos literais de evidência. Isso permite localizar falhas e repetir somente o caso necessário. Uso `gpt-4.1-mini-2025-04-14`, testado neste conjunto, e um plugin local para limitar o transporte a três tentativas totais por sentença. Preparação, extração, validação, cálculo e consolidação ficam em subgrafos. O fluxo sequencial reduz a complexidade de execução e auditoria para este volume.

Não deleguei aritmética ao modelo. Além do schema, verifico se as evidências pertencem ao documento e sustentam resultado, valores e datas. Uso o dispositivo da sentença, sem confundir pedido ou valor da causa com condenação. Improcedências e extinções validadas recebem zero conhecido; informação não confirmada fica nula, com pendência explícita. Cada identidade conserva uma linha, inclusive em falhas individuais.

## Cálculos e recomendação

Atualizo as condenações para **31/05/2026** pela razão entre índice final e índice do mês-base. Aplico juros simples de 1% por mês completo desde a citação sobre o principal corrigido. Calculo meses pelo calendário civil, sem dividir dias por 30. Uso frações com `BigInt` e arredondo o total final para centavos, com metade para longe de zero. Exibo o principal arredondado e os juros como diferença para o total, preservando as frações na auditoria.

Minha regra é `benefício esperado = probabilidade × valor atualizado − custo`. Recomendo recurso somente quando o sinal exato é positivo; empate implica não recorrer. Uso as probabilidades do CSV: 80% com subsídios completos, 50% com essenciais e 10% com ausentes. Subsídio não localizado não equivale à categoria “ausentes”. A recomendação pressupõe reversão integral, considera apenas os custos fornecidos e exige conferência jurídica de prazo e cabimento.

## Validação e resultados

Preparei gabaritos estratificados de desenvolvimento e avaliação, além de controles independentes de calendário e dinheiro. A primeira avaliação reservada reprovou: apenas 4 de 12 casos ficaram aptos. Corrigi o prompt no conjunto de desenvolvimento e preservei a reprovação. A repetição passou em 12 de 12, mas é uma reavaliação de conjunto já visto; os documentos também haviam aparecido no resumo preliminar. Não apresento esse resultado como estudo cego.

A execução real concluiu os 100 processos: 48 vitórias, 52 condenações e nenhuma pendência. A auditoria automatizada dos documentos encontrou zero divergência nos resultados e nos cálculos das 52 condenações. O passivo atualizado é **R$ 309.174,54**; os 17 recursos selecionados custam **R$ 54.400,00**, com benefício líquido esperado de **R$ 24.676,16**. A execução levou 272.249 ms, consumiu 182.469 tokens e fez 111 chamadas. Não confirmei o custo monetário da API.

## Entrega e limites

Gero a planilha com quatro abas e mantenho JSONs, evidências, tentativas, hashes e memória de cálculo. O texto executivo e as distribuições são produzidos no Rivet; a apresentação externa apenas formata esses resultados. API e CLI usam o mesmo executor, validado por HTTP e replay. Os arquivos de cada execução ficam separados, com checkpoint e publicação por integridade; não implementei retomada automática.

Usei IA para apoiar modelagem, implementação, testes, documentação e revisão dos gabaritos. Conferi o fluxo e os artefatos no aplicativo. A auditoria foi assistida por IA e controles determinísticos, sem segundo revisor humano independente. O lote é regular, de uma comarca e um tribunal; as associações por subsídios ou tema não demonstram causalidade. Extinção segue a definição de vitória do case, sem provar encerramento definitivo da exposição. Benefício esperado é cenário, não economia realizada nem previsão calibrada para outros processos.
