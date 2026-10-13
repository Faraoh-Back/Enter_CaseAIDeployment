# Plano de execução — Rivet e API Node.js

**Estado:** S0–S3 implementadas e validadas localmente, com 150 testes aprovados. Execução real: 100 aptos, 48 vitórias e 52 condenações; auditoria sem divergências. Aceite visual S3 V0 confirmado pelo candidato. S4.1 em desenvolvimento; S5 pendente. [Validação S3](validacao/S3_VALIDACAO.md).

**Entrega externa:** 16/10/2026, 23:59, conforme convite; fuso não informado.

**Meta interna:** ZIP reproduzível em 15/10; revisão, ensaio e envio antecipado em 16/10.

## Regras de execução

1. O enunciado prevalece sobre preferências de arquitetura. Toda a análise fica no projeto Rivet.
2. Cada fatia produz resultados observáveis, com teste primeiro, implementação mínima e refatoração. Registrar evidências reais do ciclo; não fabricar histórico TDD.
3. Testes determinísticos usam casos fixos e outputs capturados. Chamadas reais à LLM compõem uma avaliação separada, com consumo e resultado registrados.
4. A suíte principal observa contratos de entrada/saída do grafo e da API, sem depender de funções internas da implementação.
5. Manter a branch principal verde. A aceitação exige os critérios da [matriz](validacao/MATRIZ_VALIDACAO.md), não somente código sem erro.
6. A API facilita a execução; não pode consumir o tempo reservado à qualidade dos entregáveis obrigatórios.

## Rodadas, prazo e critérios de saída

As datas são metas de organização e os esforços são estimativas, a revisar após a primeira execução. Se houver atraso, retirar refinamentos opcionais antes de reduzir a validação do essencial.

| Fatia | Meta | Esforço inicial | Resultado demonstrável |
| --- | --- | --- | --- |
| S0 — compatibilidade e contratos | 11/10 | 1–2h | Projeto-base abre; um grafo mínimo executa pela Rivet e pelo SDK; versões e modelo testados. |
| S1 — uma condenação completa | 12/10 | 4–6h | Texto vira linha XLSX, cálculo auditável, decisão e resumo pelo fluxo Rivet. |
| S2 — variações e falhas | 13/10 | 4–6h | Quatro resultados, danos variados e falhas representados corretamente nos outputs. |
| S3 — carteira e relatório | 14/10 | 4–6h | 100 casos reconciliados, avaliação reservada e relatório executivo consistente. |
| S4 — POST, consulta e download | 15/10 | 2–3h | API usa o mesmo executor e entrega os mesmos artefatos do comando local. |
| S5 — pacote e defesa | 15–16/10 | 3–4h | Reprodução a partir do ZIP e explicação segura de decisões, números e limites. |

## S0 — compatibilidade e preparação mínima

- [x] **S0.1** — Preparar cópia de trabalho do `.rivet-project`, preservando os originais em `case/`.
- [x] **S0.2** — Fixar uma versão compatível do Node e das dependências em arquivo de versão e lockfile.
- [x] **S0.3** — Configurar a credencial fora do Git; testar uma chamada mínima e registrar modelo e parâmetros efetivamente aceitos.
- [x] **S0.4** — Rodar um Code Node com cálculo racional e serialização no aplicativo e no SDK; conferir que nenhuma biblioteca externa é exigida no grafo.
- [x] **S0.5** — Confirmar o caminho de outputs Rivet até XLSX; o exportador apenas formata dados já analisados.
- [x] **S0.6** — Validar o schema de extração e implementar validação equivalente no grafo, com os mesmos exemplos válidos/inválidos.
- [x] **S0.7** — Selecionar 12 casos estratificados para desenvolvimento e 12 casos disjuntos reservados para avaliação. Incluir os quatro resultados, composição dos danos e níveis de subsídios; reservar também casos perto do limiar econômico quando existentes.
- [x] **S0.8** — Anotar os gabaritos a partir dos documentos originais e registrar como foram conferidos. Não escolher apenas os primeiros processos do arquivo.

Os outputs de `s0_calculo`, `s0_validacao` e `s0_llm` no aplicativo foram enviados pelo candidato e conferem com os resultados esperados. A [evidência do aplicativo](output/s0-aplicativo.json) encerra a S0. A revisão dos gabaritos foi assistida por IA, com origem e limites declarados em [fixtures](../tests/fixtures/README.md).

O candidato também enviou uma execução do **resumo-base** no aplicativo: os 100 identificadores/resultados e os 52 valores nominais conferiram. Essa saída tem seu próprio [registro de conferência](validacao/REVISAO_EXECUCAO_APLICATIVO.md); o fechamento da S0 usa os três grafos específicos acima.

**Saída:** incertezas de integração resolvidas antes de construir a API; schema e exemplos revisáveis. Se a integração falhar, registrar a causa e ajustar o modo de execução mantendo as regras no grafo.

## S1 — uma condenação do texto ao documento

Execução em tarefas separadas, com revisão e commits feitos pelo candidato. [Escopo de cada tarefa](desenvolvimento/S1_TASKS.md). Parar ao concluir a tarefa da rodada.

- [x] **S1.1 — Vermelho:** teste externo do caso `3871230-78.2024.8.26.0002`, incluindo extração simulada, evidências, dinheiro, decisão e artefato; conferir os valores esperados da matriz. Duas falhas observadas por funcionalidades ausentes; S0 permanece verde.
- [x] **S1.2 — Verde:** formalizar schemas de processo/resumo; ler as referências no grafo, extrair a sentença, validar dados, calcular em Code Nodes, decidir e produzir resumo e Markdown. Avaliar a extração completa em chamada real separada.
- [x] **S1.3 — XLSX:** exportar uma planilha real `.xlsx`, reabri-la e comparar as células com os outputs; adicionar trilha de cálculo e justificativa.
- [x] **S1.4 — Execução local:** expor comando que execute o projeto e grave o diretório de execução; conferir grafo e exportação integrados. Registrar comando real no README após verificação.
- [x] **S1.5 — Refatorar:** separar subgrafos por responsabilidade e atualizar contratos se o experimento identificar lacunas; incorporar os testes S1 verdes à suíte padrão. **Refatoração e suíte local concluídas; aceite visual informado pelo candidato e arquivos locais reconferidos**, conforme [S1_5_VALIDACAO.md](validacao/S1_5_VALIDACAO.md).

**Saída:** uma condenação produz os artefatos de ponta a ponta. Não basta entregar um JSON de extração.

## S2 — resultados diferentes e tratamento de incerteza

Execução por tarefas, conforme [S2_TASKS.md](desenvolvimento/S2_TASKS.md). S2.1 registrou o vermelho. A S2.2 normalizou os quatro resultados: 13/13 cenários S2 aprovados e incorporados à suíte padrão, agora com 56 testes. S2.3 define 20 cenários de incerteza: 5 aprovados e 15 falhas observadas. A S2.4 implementou esses contratos: 20/20 verdes e oito testes adicionais de transporte; suíte padrão com 84 testes. [Validação e roteiro do aplicativo](validacao/S2_4_VALIDACAO.md).

- [x] **S2.1 — Vermelho:** casos de procedência, parcial procedência, improcedência e extinção, danos materiais isolados e combinados, valores de pedidos usados como distração em fixtures sintéticas.
- [x] **S2.2 — Verde:** normalizar os quatro resultados, tratar vitórias sem simular recurso e incorporar a aceitação à suíte padrão.
- [x] **S2.3 — Vermelho:** datas ausentes/inválidas/futuras, índice ausente, CNJ divergente, subsídio desconhecido, saída malformada e duplicação de processos.
- [x] **S2.4 — Verde:** normalização, retentativas limitadas e estados de pendência/erro; impedir recomendações baseadas em valores incompletos.
- [x] **S2.5 — Fronteiras e cobertura:** cobrir meses completos, fronteiras de arredondamento e benefício positivo, negativo e exatamente zero; manter uma linha por processo inclusive nas falhas, com totais e cobertura mostrando exclusões.
- [x] **S2.6 — Refatorar e integrar:** responsabilidades revisadas e JSON, planilha e relatório reconciliados; 128 testes verdes. **Aceite local concluído; aplicativo parcialmente validado (plugin, calendário, consolidação, extração real e cenário sem subsídio; falta conferir os arquivos visualmente)**, conforme [S2_6_VALIDACAO.md](validacao/S2_6_VALIDACAO.md).

A S2.5 acrescenta 25 testes de fronteiras e 13 de cobertura, além de uma prova offline de lote misto: [validação e limites](validacao/S2_5_VALIDACAO.md).

**Saída:** todos os casos do conjunto de desenvolvimento e os testes determinísticos passam. Evidência textual é conferida no documento, além de validar a forma do JSON.

## S3 — carteira completa e comunicação ao cliente

Execução autorizada das sete tarefas, com commits separados. [Estado e contratos S3](desenvolvimento/S3_TASKS.md).

Registrar na avaliação que os 12 reservados já apareceram na execução preliminar do resumo-base enviada pelo candidato. O novo extrator ainda não foi executado nesse conjunto; não descrever sua avaliação futura como primeira exposição dos documentos à LLM.

- [x] **S3.1** — Processar os 100 casos; reconciliar identidades e referências, sem limites fixos de 100 no código de produção.
- [x] **S3.2** — Aplicar o conjunto reservado sem novos ajustes de prompt. Se houver falha, registrar o resultado; uma nova rodada deverá declarar que o conjunto já foi visto.
- [x] **S3.3** — Auditar os valores, datas e decisões dos 52 casos condenatórios contra os insumos; conferir classificação dos 100 dispositivos. Priorizar também maiores valores, limiares e todas as retentativas.
- [x] **S3.4** — Gerar abas `Processos`, `Resumo`, `Auditoria` e `Pendencias`; adicionar filtros, cabeçalhos, moeda, data-base e identificação da execução.
- [x] **S3.5** — Produzir relatório com síntese, êxito, passivo, estratégia de recursos, associações e limitações. Cálculos e texto-base são produzidos no grafo.
- [x] **S3.6** — Conferir correlação versus causalidade, denominadores, probabilidades assumidas e benefício esperado versus economia realizada.
- [x] **S3.7** — Medir tempo, falhas, retentativas e tokens disponíveis; registrar custo somente se houver informação verificável de preço/consumo.

**Validação local:** execução real e auditoria concluídas; [evidências e roteiro visual](validacao/S3_VALIDACAO.md).

**Saída:** critérios obrigatórios atendidos; pendências resolvidas para o lote fornecido ou explicitamente reportadas como limitações, sem declarar a entrega validada integralmente.

## S4 — interface HTTP mínima

Desenvolvimento por tarefa, com testes de contrato primeiro e commits separados, conforme [S4_TASKS.md](desenvolvimento/S4_TASKS.md).

- [x] **S4.1** — **Vermelho:** dez testes de contrato HTTP para POST, consulta de estado, download, concorrência, falhas e reinício. Vermelho observado por módulo ausente; asserções HTTP aguardam implementação.
- [ ] **S4.2** — **Verde:** uma aplicação Node e um executor compartilhado com o comando local; uma execução ativa por vez.
- [ ] **S4.3** — Gravar manifesto antes do `202`; publicar apenas arquivos completos. Testar interrupção e estado após reinício.
- [ ] **S4.4** — Conferir que a API não contém fórmulas financeiras, classificação de sentenças ou cálculo de indicadores.
- [ ] **S4.5** — Documentar comandos reais e uma sequência `curl` executada com sucesso. Testar tratamento de configuração ausente sem expor credenciais.


**Saída:** execução por POST e reprodução local geram resultados equivalentes para os mesmos outputs de extração capturados.

## S5 — pacote final e defesa

- [ ] **S5.1** — Escrever `racional.md` em até duas páginas, revisado e assumido pelo candidato. Explicar as escolhas, o uso de IA, a validação e as limitações efetivas.
- [ ] **S5.2** — Registrar resultados medidos em `validacao.md`, com distinção entre testes offline, avaliação LLM e execução final.
- [ ] **S5.3** — Abrir a planilha e o relatório como destinatário final; verificar clareza e consistência dos números.
- [ ] **S5.4** — Montar ZIP por lista explícita: projeto Rivet, cinco inputs, XLSX, relatório executivo, racional, README, código necessário, schemas, lockfile e `.env.example`.
- [ ] **S5.5** — Incluir evidências e outputs auditáveis; excluir credenciais, `.env`, dependências instaladas e arquivos temporários.
- [ ] **S5.6** — Extrair o ZIP em outro diretório e executar seguindo apenas suas instruções, configurando a credencial por ambiente.
- [ ] **S5.7** — Abrir o projeto no aplicativo Rivet e demonstrar onde acontecem extração, cálculo, decisão e consolidação.
- [ ] **S5.8** — Ensaiar a defesa com um caso individual e a visão da carteira; explicar meses completos, arredondamento, probabilidades e hipóteses.
- [ ] **S5.9** — Conferir horário/fuso do envio e enviar com margem. O envio é uma ação do candidato; este plano não o automatiza.

- [ ] **S5.10 — Relatório executivo em PDF:** adaptar a apresentação ao modelo que o candidato selecionar, preservar os dados e cálculos vindos do Rivet, gerar PDF e conferir reconciliação, legibilidade e paginação. Concluir antes da revisão S5.3 e do ZIP S5.4. Markdown permanece fonte auditável.

**Saída:** arquivo final reproduzível, entregáveis revisados e racional compreendido pelo candidato.

## Refinamentos condicionados ao tempo

Sensibilidade do benefício esperado, comparação adicional de modelos, cache versionado e depuração remota só entram após os critérios obrigatórios. O acabamento visual das tabelas deve reforçar a leitura do cliente sem atrasar a conferência dos números.
