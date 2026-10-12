# S0 — evidências e conferência no aplicativo

**Estado:** S0 concluída. As provas passaram pelo SDK e os outputs dos três grafos executados no aplicativo foram enviados pelo candidato e conferidos. Os registros do SDK preservam seus timestamps em UTC; a hora da execução no aplicativo não foi informada.

Na S0, as peças foram testadas separadamente: `s0_calculo` calcula com parâmetros de exemplo; `s0_llm` lê uma sentença e identifica processo e resultado; `s0_validacao` confere uma extração de exemplo já preenchida. A S1 conectará a extração completa da sentença, a validação, o cálculo e a geração dos documentos no mesmo fluxo.

## O que existe e foi executado

| Verificação | Resultado observado |
| --- | --- |
| Cópia de trabalho | `rivet/analise_sentencas.rivet-project`, preservada; originais em `case/` não editados. |
| Runtime e dependências | Node 20.20.2; `@ironclad/rivet-node` 1.25.0; ExcelJS 4.4.0; lockfile. Ajv 8.20.0, ajv-formats 3.0.1 e esbuild 0.19.12 apenas na preparação/testes. |
| Projeto de prova | `rivet/s0_compatibilidade.rivet-project`, carregado pelo SDK, com três grafos. Inputs padrão embutidos; nenhuma dependência de caminhos Windows/Linux. |
| Testes offline | **14 aprovados**. Incluem schema, evidências, limite de inteiro, arredondamento, decisão antes de arredondar e comparação com gabaritos independentes. |
| XLSX | `outputs/s0/prova.xlsx` gerado e reaberto com ExcelJS; quatro valores monetários e decisão conferidos contra o Graph Output. |
| OpenAI pelo Rivet | HTTP 200, uma chamada bem-sucedida; `gpt-4.1-mini-2025-04-14`, temperatura 0, `max_tokens=256`, JSON object. **378 tokens de entrada + 38 de saída = 416**; 865 ms medidos nessa execução. |
| Gabaritos | 12 de desenvolvimento + 12 reservados; disjuntos, estratificados e com hashes dos cinco insumos. [Método e limites](../../tests/fixtures/README.md). |
| Instalação limpa | `npm ci --ignore-scripts` em diretório temporário sem `.env`; build com hash idêntico, 14 testes aprovados e XLSX reaberto. |
| Aplicativo Rivet 1.11.3, versão informada pelo candidato | `s0_calculo`: resultado e memória iguais aos do SDK; `s0_validacao`: schema válido, apto e sem problemas; `s0_llm`: identidade e classificação corretas, 416 tokens e 1.591 ms. Outputs recebidos e conferidos. |

Evidências preservadas em [docs/output](../output/README.md): [s0-offline.json](../output/s0-offline.json), [s0-llm.json](../output/s0-llm.json), [s0-reproducao.json](../output/s0-reproducao.json) e [s0-aplicativo.json](../output/s0-aplicativo.json). Os comandos locais produzem novas evidências em `outputs/s0/`; não alteram esses registros históricos. A antiga indicação de desktop pendente no registro offline corresponde ao momento daquela execução; o registro do aplicativo documenta seu fechamento posterior.

A prova de LLM ocorreu antes de um ajuste do reconhecimento textual de extinções no validador. Por isso os hashes do projeto nos dois registros diferem; o grafo `s0_llm` permaneceu igual. A primeira tentativa de rede no ambiente restrito falhou sem resposta HTTP; a chamada após liberação da rede foi bem-sucedida. Essa prova não avaliou os 100 processos. Posteriormente, o candidato enviou o resumo-base da carteira: [conferência e limites dessa execução](REVISAO_EXECUCAO_APLICATIVO.md).

## Como reproduzir pelo terminal

Na raiz do repositório, com a versão de `.nvmrc`:

```bash
nvm use
npm ci --ignore-scripts
npm run s0:build
npm test
npm run s0:check
```

O projeto `.rivet-project` gerado é versionável e já contém o código necessário aos nós. O build incorpora o schema compilado e seus auxiliares, sem exigir `require`, `fetch`, acesso a processo ou bibliotecas externas dentro dos Code Nodes. Se modificar `schemas/` ou `rivet/code/`, regenerar o projeto antes dos testes.

Para repetir a chamada real, configure `OPENAI_API_KEY` no `.env` local e execute:

```bash
npm run s0:llm
```

Esse comando usa `LLM_MODEL` quando preenchido; caso contrário, usa o snapshot testado acima. Limita-se a uma requisição de rede, 256 tokens de saída e 30 segundos totais. A chave não entra no projeto ou nos registros. `npm test` e `s0:check` não consomem tokens.

## Como reproduzir a conferência no Rivet

1. Abra `rivet/s0_compatibilidade.rivet-project` pelo menu de abertura de projeto do aplicativo. Mantenha sua cópia `analise_sentencas.rivet-project` para a construção da solução.
2. Selecione o grafo `s0_calculo` e clique em **Run**, usando as entradas padrão.
3. Confira o Graph Output `resultado`: principal **647878**, juros **19436**, total **667314**, benefício **-253269**, decisão **`nao_recorrer`**. Os valores estão em centavos; total R$ 6.673,14.
4. Execute `s0_validacao`. O output `validacao` deve mostrar `schema_valido: true`, `apto_calculo: true` e `problemas: []`.
5. Compare com [s0-aplicativo.json](../output/s0-aplicativo.json), que preserva os resultados já enviados pelo candidato. A conferência foi aprovada e o item está concluído no plano.

O candidato também executou `s0_llm` no aplicativo com `gpt-4.1-mini-2025-04-14`: a resposta trouxe o processo `3871230-78.2024.8.26.0002` e `parcial_procedencia`, como esperado. O `cost: 0` exibido não comprova gratuidade; a cobrança não foi verificada e o custo confirmado permanece `null`. O aplicativo usa sua própria configuração de chave; ele não lê automaticamente o `.env` do comando Node. Repetir esse grafo fará outra chamada real.

## Decisões e limites da prova

- O SDK 1.25.0 reconhece as famílias `o1`, `o3` e `o4` ao escolher parâmetros de modelos de raciocínio. O grafo-base usa `gpt-5-mini`, para o qual esse SDK selecionaria `max_tokens` e temperatura. O modelo 4.1 mini foi escolhido para provar compatibilidade sem alterar a cópia principal. A qualidade de extração será avaliada em S1–S3. Referências: [ChatNodeBase do SDK instalado](../../node_modules/@ironclad/rivet-core/dist/esm/model/nodes/ChatNodeBase.js) e [documentação oficial do modelo testado](https://developers.openai.com/api/docs/models/gpt-4.1-mini).
- `s0_calculo` recebe os parâmetros já preparados. A leitura dos CSVs, o cálculo de meses e o tratamento de vitórias/pendências no fluxo completo ainda serão implementados nas fatias seguintes. Não há cálculo financeiro no exportador.
- `s0_validacao` compila o schema canônico e acrescenta verificações iniciais de suporte textual para a redação deste lote. `apto_calculo` nessa prova significa extração local coerente; referências externas ainda não são cruzadas. O gate completo de aptidão e as variações sintéticas pertencem a S1/S2.
- A chamada real extrai somente identidade e resultado. Não comprova a acurácia do contrato completo. Não há estimativa de custo monetário: o registro contém tokens medidos e custo `null`.
- O SDK tem retentativas internas extensas; o script S0 impõe um limite de transporte. Antes do lote real, implementar e testar o limite de tentativas e a interrupção descritos nos contratos.
- O histórico observado foi: dez testes falhando pela ausência do projeto; implementação; depois ampliação para 14 testes aprovados. Não se afirma que todos os testes adicionais tiveram um ciclo vermelho isolado.

O próximo resultado funcional é S1: uma condenação saindo do texto até o XLSX e o resumo pelo grafo. A API HTTP permanece em S4.
