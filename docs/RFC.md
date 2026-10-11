# RFC: Arquitetura do Pipeline Agêntico e Motor Determinístico de Decisão Jurídica

**Projeto:** AI Deployment Case — Contencioso Jurídico

**Autor:** Candidato (AI Deployment Engineer)

**Versão:** 0.1 (Draft Vivo)

**Formato do Entregável Final:** Relatório de Racional em Markdown (`.md`)

## SEÇÃO 1: CONTEXTUALIZAÇÃO

### 1.1 Entendendo o Problema

O setor jurídico de uma empresa cliente da Enter administra uma carteira com cerca de **100 processos judiciais** e necessita de uma leitura consolidada e automatizada. A análise manual de sentença por sentença é um processo lento, susceptível a erros humanos e impossível de escalar.

A aplicação deve responder de forma precisa e auditável:

1. **Taxa de Êxito:** Quantos processos resultaram em vitória (*Improcedentes* ou *Extintos sem resolução de mérito*) versus derrotas (*Procedentes* ou *Parcialmente Procedentes*).

2. **Passivo Financeiro Corrigido:** Qual o valor real atualizado das condenações para a data-base de **Maio/2026**, aplicando índice de correção monetária e juros de mora simples de 1% ao mês desde a data de citação.

3. **Decisão Estratégica de Recurso:** Avaliação automatizada sobre a viabilidade econômica e jurídica de recorrer da decisão para a 2ª instância.

### 1.2 Visão Macro & Arquitetura da Solução

A solução combina a capacidade de extração agêntica e interpretação de texto não estruturado da **Rivet** com a precisão matemática e a leveza do **Python + SQLite local** para o processamento de dados:

```
flowchart TD
    subgraph INGESTION ["1. Ingestão de Insumos"]
        A1["Sentenças (.txt)"] --> B1["Rivet Pipeline Input"]
        A2["status_subsidios.txt"] --> B2["SQLite DB (subsidios)"]
        A3["tabela_indices.csv"] --> B2
        A4["custo_recurso_por_tribunal.csv"] --> B2
        A5["subsidios_probabilidade_reversao.csv"] --> B2
    end

    subgraph RIVET_AGENTIC ["2. Extração Agêntica (Rivet Workflow)"]
        B1 --> C1["Prompt Extrator de Sentenças"]
        C1 --> C2["LLM Node (GPT-4o)"]
        C2 --> C3["Schema Validator (Output JSON)"]
    end

    subgraph PYTHON_ENGINE ["3. Motor Determinístico (Python + SQLite)"]
        C3 --> D1["JSON Parser & SQLite Ingestion"]
        B2 --> D2["Calculadora Financeira (Índice + Juros)"]
        D1 --> D2
        D2 --> D3["Motor de ROI do Recurso (Valor Esperado EV)"]
        D3 --> D4["Persistência & Queries Analíticas"]
    end

    subgraph OUTPUTS ["4. Artefatos de Saída (.zip)"]
        D4 --> E1["Planilha Estruturada (.xlsx)"]
        D4 --> E2["Relatório Executivo (.md)"]
    end

```

### 1.3 Matriz de Alternativas Descartadas (Trade-offs)

| Alternativa Descartada | Motivo do Descarte ("Descartada porque...") | Cenário onde Ganharia ("Ganharia se...") | 
| ----- | ----- | ----- | 
| **Cálculo Financeiro via Prompt Direto na LLM** | LLMs cometem falhas de aritmética binária (IEEE 754) e não garantem determinismo no cálculo dos juros. | Se o cálculo fosse uma estimativa qualitativa e não um valor contábil rigoroso. | 
| **Docker + PostgreSQL Externo** | Adiciona dependência de infraestrutura e corre risco de quebrar a execução direta na máquina do avaliador. | Se a aplicação rodasse em um ambiente de produção cloud com múltiplos serviços concorrentes. | 
| **Regra de Recurso por Valor Fixo de Condenação** | Ignora a assimetria do custo de recursos por tribunal regional (ex: TJSE R\$ 4.800 vs TJAL R$ 1.300). | Se todos os tribunais do país cobrassem uma taxa fixa padronizada para apelação. | 
| **Pontos Flutuantes (`float`) para Dinheiro** | Provoca erros de arredondamento em operações financeiras e somatórios acumulados. | Se estivéssemos trabalhando com dados meramente estatísticos sem necessidade de conciliação. | 

## SEÇÃO 2: IMPLEMENTAÇÃO

### 2.1 Contrato do JSON Schema de Extração (Rivet LLM Output)

Para cada sentença processada, a Rivet extrai obrigatoriamente a seguinte estrutura estrita:

```
{
  "numero_processo": "3871230-78.2024.8.26.0002",
  "classe_processual": "Procedimento Comum Cível",
  "resultado_sentenca": "parcial_procedencia",
  "valor_condenacao_bruto": 6300.00,
  "danos_materiais": 6000.00,
  "danos_morais": 300.00,
  "mes_base_correcao": "2025-12",
  "data_citacao": "2026-02-27",
  "comarca_tribunal": "TJSP"
}

```

### 2.2 Motor Financeiro Determinístico

A atualização do valor fixado na sentença segue estritamente as fórmulas consolidadas do case:

1. **Fator de Correção Monetária:**
   

   $$
   \text{Fator} = \frac{\text{Índice}[05/2026]}{\text{Índice}[\text{Mês-Base}]}
   $$

   
   *Onde o índice de Maio/2026 é fixado em* $1117.1189$ *segundo a `tabela_indices.csv`.*

2. **Principal Corrigido:**
   

   $$
   \text{Principal Corrigido} = \text{Valor Condenação Bruto} \times \text{Fator}
   $$

3. **Juros de Mora** (1% ao mês simples a contar da data de citação até 31/05/2026):
   

   $$
   \text{Juros} = \text{Principal Corrigido} \times 0{,}01 \times \text{nº de meses completos até 31/05/2026}
   $$

4. **Valor Atualizado Total:**
   

   $$
   \text{Valor Atualizado} = \text{Principal Corrigido} + \text{Juros}
   $$

### 2.3 Calculadora de ROI e Motor de Decisão de Recurso

A recomendação de recurso é orientada pela teoria do Valor Esperado Financeiro ($EV$):

$$
\text{Probabilidade de Reversão} = f(\text{status\_subsidios}) = \begin{cases} 80\% & \text{se Completos} \\ 50\% & \text{se Essenciais} \\ 10\% & \text{se Ausentes} \end{cases}
$$

$$
EV_{\text{recurso}} = (\text{Probabilidade de Reversão} \times \text{Valor Atualizado}) - \text{Custo de Recurso do Tribunal}
$$

* **Regra de Decisão:**

  * Se $EV_{\text{recurso}} > 0$: **Recomenda-se Recorrer** (o ganho provável compensa as custas).

  * Se $EV_{\text{recurso}} \le 0$: **Recomenda-se Aceitar a Sentença** (o risco financeiro não compensa o custo do tribunal).

  * Se **Resultado = Improcedência ou Extinção**: **Recomenda-se Manter Decisão / Não Recorrer** (vitória do cliente).

### 2.4 Immediate Candor: Limitações Conhecidas e Tratamento Defensivo

* **Casos de Extinção ou Improcedência:** O valor da condenação é fixado em R\$ 0,00 e o cálculo de juros/correção é zerado automaticamente.

* **Sentenças sem Data de Citação Explícita:** Se a LLM não identificar a data de citação no texto `.txt`, o sistema adota a data da sentença como fallback defensivo e marca a flag `requer_auditoria_manual = True`.

* **Diferenciação entre Valor da Causa e Valor da Condenação:** O prompt proíbe explicitamente a extração do valor da causa ou do pedido inicial quando o juiz fixa um valor condicional ou inferior na sentença.