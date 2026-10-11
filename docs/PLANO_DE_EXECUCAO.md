# Plano de Execução: AI Deployment Case (Rivet + Python + SQLite)

**Organização:** Fatias Verticais (*Vertical Slicing*), Ciclos TDD e Entregáveis do Case  
**Ambiente:** Python 3.12, SQLite3, Rivet IDE (`.rivet-project`), Pandas, OpenPyXL  

---

## 0. Diretrizes de Trabalho

1. **Desenvolvimento em Fatias Verticais:** Cada funcionalidade é construída e validada de ponta a ponta (do arquivo `.txt` ao banco de dados e exportação).
2. **Main Sempre Verde:** Validação contínua da leitura e dos scripts antes de avançar de rodada no desenvolvimento.
3. **Persistência Leve:** Uso de SQLite local (`db/contencioso.db`) para garantir execução direta na máquina do avaliador sem dependência de containers.

---

## Visão Geral das Rodadas e Fatias Verticais

| Rodada / Fatia | Foco do Desenvolvimento | Entregável Associado | Est. Horas |
| :--- | :--- | :--- | :--- |
| **R0: Fundação** | Setup do projeto, SQLite e ingestão das tabelas auxiliares | Estrutura de diretórios e DB | ~3.0h |
| **S1: Extração Agêntica** | Fluxo na Rivet e validação em Golden Dataset (10 casos) | Projeto `.rivet-project` parcial | ~4.0h |
| **S2: Motor Financeiro** | Cálculo determinístico de correção monetária e juros em Python | Script de atualização monetária | ~3.0h |
| **S3: Motor de Decisão** | ROI do recurso ($EV$), cruzamento com subsídios e custos | Módulo de inteligência de decisão | ~3.0h |
| **S4: Exportação & Reports** | Geração da planilha `.xlsx` e Síntese Executiva em `.md` | `.xlsx` e Relatório Executivo `.md` | ~3.5h |
| **R5: Lote 100 Casos & Zip** | Rodada completa dos 100 processos, auditoria e pacote `.zip` | Pacote final `.zip` de entrega | ~3.5h |

---

## Detalhamento das Tarefas por Fatia

### Rodada 0: Fundação e Ingestão de Referências (~3h)

- [ ] **T0.1:** Criar estrutura de diretórios do repositório:
  ```text
  ├── app/
  ├── db/
  ├── rivet/
  ├── tests/
  └── outputs/
  ```
- [ ] **T0.2:** Criar o schema SQLite em `db/schema.sql` para armazenar as tabelas de referência e o resultado consolidado dos processos.
- [ ] **T0.3:** Escrever script Python (`app/database/seed_references.py`) para popular o SQLite com os arquivos de insumo:
  - `tabela_indices.csv`
  - `custo_recurso_por_tribunal.csv`
  - `subsidios_probabilidade_reversao.csv`
  - `status_subsidios.txt`

---

### Fatia 1: Extração Agêntica na Rivet e Golden Dataset (~4h)

- [ ] **S1.1 (Vermelho):** Mapear manualmente 10 sentenças em `processos.txt` para formar um *Golden Dataset* de teste de caixa-preta (gabarito exato de valores, datas e resultados).
- [ ] **S1.2 (Verde):** Construir o fluxo agêntico na **Rivet** (`rivet/processamento_sentencas.rivet-project`):
  - Nó de leitura do texto `.txt`.
  - Nó de Prompt com instruções para extrair: Número do Processo, Classe, Resultado, Valor Condenação, Mês-Base e Data de Citação.
  - Nó Chat LLM e Nó de Extração/Validação de Schema JSON.
- [ ] **S1.3 (Refatorar):** Validar a extração contra o *Golden Dataset*. Ajustar o prompt para evitar alucinações no valor da causa em substituição ao valor da condenação.

---

### Fatia 2: Motor Determinístico de Atualização Financeira (~3h)

- [ ] **S2.1 (Vermelho):** Escrever testes unitários em `tests/test_financial_calculator.py` com casos hipotéticos calculados manualmente.
- [ ] **S2.2 (Verde):** Implementar o módulo `app/calculators/financial_engine.py`:
  - Busca do índice no SQLite para o `mes_base` e índice de referência `2026-05` (1117.1189).
  - Cálculo do principal corrigido.
  - Cálculo dos meses completos até 31/05/2026 a partir da `data_citacao`.
  - Aplicação de juros simples de 1% a.m. e soma do `valor_atualizado`.
- [ ] **S2.3 (Refatorar):** Garantir tratamento exato para casos sem condenação monetária (zerando principal e juros).

---

### Fatia 3: Motor de ROI e Decisão Estratégica (~3h)

- [ ] **S3.1 (Vermelho):** Escrever testes unitários em `tests/test_appeal_decision.py` validando casos em que o recurso deve ser recomendado versus rejeitado.
- [ ] **S3.2 (Verde):** Implementar o módulo `app/calculators/decision_engine.py`:
  - Consulta do status dos subsídios para o caso (`completos`, `essenciais`, `ausentes`).
  - Mapeamento da probabilidade de reversão (80%, 50%, 10%).
  - Leitura do custo do recurso no tribunal correspondente em `custo_recurso_por_tribunal.csv`.
  - Aplicação da fórmula de Valor Esperado ($EV$) e definição da recomendação:
    $$EV_{\text{recurso}} = (\text{Probabilidade} \times \text{Valor Atualizado}) - \text{Custo de Recurso}$$
- [ ] **S3.3 (Refatorar):** Ajustar regras defensivas para casos de improcedência e faltas de data.

---

### Fatia 4: Exportação `.xlsx` e Relatório Executivo (~3.5h)

- [ ] **S4.1:** Desenvolver o exportador `app/reports/excel_exporter.py` usando `pandas` e `openpyxl` para gerar a planilha `.xlsx` com todas as colunas obrigatórias.
- [ ] **S4.2:** Desenvolver o gerador de síntese `app/reports/markdown_reporter.py` para consolidar em Markdown (`outputs/relatorio_executivo.md`):
  - Total de processos analisados.
  - Taxa de êxito (%) da carteira.
  - Passivo total original versus Passivo total atualizado em 05/2026.
  - Projeção de economia com a estratégia de recursos ($EV > 0$).
  - Análise de causa-raiz das derrotas (por comarca e disponibilidade de subsídios).

---

### Rodada 5: Processamento do Lote de 100 Casos e Empacotamento Final (~3.5h)

- [ ] **T5.1:** Executar o pipeline agêntico na Rivet para todas as sentenças contidas em `processos.txt`.
- [ ] **T5.2:** Processar todos os JSONs gerados no banco SQLite e rodar as auditorias por amostragem.
- [ ] **T5.3:** Gerar os entregáveis finais na pasta `outputs/`:
  1. `fluxo_agentico.rivet-project`
  2. `processos_estruturados.xlsx`
  3. `relatorio_executivo.md`
  4. `rfc_arquitetura.md` (versão final da RFC)
- [ ] **T5.4:** Compactar todos os arquivos exigidos no pacote final `.zip`.