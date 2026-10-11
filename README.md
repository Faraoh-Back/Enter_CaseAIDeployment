# Enter_CaseAIDeployment
Solução de AI Deployment para contencioso de grande escala. Integração de extração por LLM (Rivet) com motor determinístico (Python/SQLite) e relatórios executivos.

\# ⚖️ AI Legal Case Deployment Pipeline 

&gt; Pipeline agêntico end-to-end desenvolvido para automação, análise determinística e tomada de decisão estratégica sobre carteiras de contencioso cível em escala. 

---

### 📌 Visão Geral 
Este repositório contém a solução do \*\*Case de AI Deployment da [link suspeito removido]\*\*. A aplicação combina a capacidade agêntica da \*\*Rivet\*\* para extração de dados não estruturados de sentenças judiciais com um \*\*motor determinístico em Python + SQLite\*\* responsável pelos cálculos de atualização monetária, juros de mora e cálculo do \*\*Valor Esperado (ROI)\*\* para recomendação de recursos. 

### 🛠️ Tech Stack &amp; Arquitetura 
\* \*\*Orquestração Agêntica:\*\* [Rivet IDE]([suspicious link removed]) (\`.rivet-project\`) \* \*\*Linguagem &amp; Motor Determinístico:\*\* Python 3.12 \* \*\*Persistência Leve:\*\* SQLite 3 (sem dependência de infraestrutura externa) \* \*\*Manipulação de Dados &amp; Relatórios:\*\* Pandas, OpenPyXL (Geração de \`.xlsx\`) \* \*\*Metodologia:\*\* Spec-Driven (RFC), Vertical Slicing e TDD de Caixa-Preta em Golden Dataset