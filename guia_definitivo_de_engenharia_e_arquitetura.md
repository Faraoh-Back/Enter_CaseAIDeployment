# Guia Definitivo de Engenharia e Arquitetura: Metodologia Spec-Driven TDD & PDD

Este guia consolida o método completo de engenharia de software utilizado no desenvolvimento do **BaaS PME**. Ele serve como um roteiro prático, detalhado e replicável para construir sistemas financeiros de alta integridade, desde a concepção arquitetural até a defesa técnica perante uma banca examinadora.

## 1. Visão Geral do Método: Spec-Driven & Vertical Slicing

A metodologia baseia-se no princípio de **especificação executável** e desenvolvimento em **fatias verticais (Vertical Slicing)** guiadas por **TDD de caixa-preta**. Em vez de construir o sistema em camadas isoladas (todo o banco, depois todos os controllers), cada funcionalidade é desenvolvida de ponta a ponta — da rota HTTP ao banco de dados — em ciclos curtos e testados.

```
flowchart LR
    A["1. RFC & Contratos\n(Especificação)"] --> B["2. DDL & Modelo\n(PostgreSQL)"]
    B --> C["3. Plano & Fatias\n(Rodadas & Gates)"]
    C --> D["4. TDD Caixa-Preta\n(Red -> Green)"]
    D --> E["5. Arquitetura\n(Camadas Estritas)"]
    E --> F["6. Validação & Evidências\n(Benchmark & CI)"]
    F --> G["7. Defesa Técnica\n(Apresentação)"]

```

## 2. Fase 1: Especificação com RFC (Request for Comments)

Antes de escrever qualquer linha de código de produção, o sistema é inteiramente desenhado e discutido em um documento de proposta técnica (RFC). A RFC garante que as regras de negócio, limites e falhas estejam combinados antes do desenvolvimento.

### 2.1 Estrutura Mandatória da RFC (Modelo 2 Seções)

Para manter o foco e evitar prolixidade, a RFC deve conter estritamente duas seções macros:

1. **Seção 1: Contextualização**

   * **Inspiracional e Problema:** Apresentação do caso de uso real (ex.: PME urbana e seus gargalos de caixa) e inspiração arquitetural (ex.: blockchain e ledger imutável).

   * **Visão Macro e Arquitetura:** Diagrama de blocos mostrando o ecossistema do sistema (API, banco de dados, conectores externos e MockServer).

   * **Alternativas Descartadas com Trade-offs:** Matriz de comparações no formato obrigatório *"descartada porque X, ganharia se Y"*.

2. **Seção 2: Implementação**

   * **Tabela de Rotas e Contratos:** Relação de todos os endpoints HTTP, entradas relevantes, saídas com status HTTP de sucesso/erro e restrições de idempotência integradas na mesma linha.

   * **Modelo de Dados (DER):** Diagrama de Entidades e Relacionamentos vetorial/Mermaid detalhando colunas, chaves, enumerações e restrições (`CHECK`, `UNIQUE`).

   * **Fluxos de Execução:** Passo a passo detalhado do caminho feliz e dos caminhos de falha das operações principais.

   * **Principal Desafio Técnico:** Seção de destaque explicando a maior complexidade do sistema (ex.: concorrência sob disputa em transferências simultâneas) e como a arquitetura a resolve.

### 2.2 Matriz de Alternativas Descartadas

Cada escolha técnica relevante deve ser defendida na RFC com o seu respectivo trade-off:

| Alternativa Descartada | Motivo do Descarte ("Descartada porque...") | Cenário onde Ganharia ("Ganharia se...") | 
| ----- | ----- | ----- | 
| **Lock Otimista (`version_id`)** | Sob disputa intensa na mesma conta, rejeita requisições ou exige reprocessar a transação inteira no cliente. | A disputa por conta fosse rara e repetir a operação fosse uma ação barata. | 
| **Ponto Flutuante / `NUMERIC` Monetário** | `float` introduz imprecisão binária (IEEE 754); `NUMERIC` carrega decimais no JSON com risco de virar `float` no cliente. | O sistema precisasse operar com frações de centavo (ex.: câmbio ou juros diários fracionados). | 
| **Soft Delete (`is_deleted = true`)** | Esconde o registro em vez de preservar a história financeira, quebra restrições `UNIQUE` e não historiza quem/quando alterou. | Houvesse obrigação regulatória de expurgo/anonimização completa de dados pessoais (ex.: LGPD). | 
| **Reajuste por Worker/Cron Agendado** | Roda fora do ciclo da requisição síncrona HTTP e quebra o determinismo dos testes de caixa-preta. | O volume de contratos exigisse processamento em lote assíncrono na madrugada. | 

## 3. Fase 2: Modelagem de Banco de Dados de Alta Integridade

A regra de ouro da modelagem financeira na RFC é: **O banco de dados vem primeiro; o contrato HTTP é consequência do modelo.**

### 3.1 Princípios de Modelagem Financeira

1. **Representação Exclusiva em Centavos Inteiros (`BIGINT`):**

   * Valores monetários são armazenados e processados como números inteiros (ex.: R\$ 100,00 = `10000` centavos). Nenhuma camada manipula valores monetários como `float`.

2. **Modelo Híbrido de Chaves Primárias e Públicas:**

   * **Chave Interna (`id SERIAL/BIGINT`):** Utilizada exclusivamente de forma interna pelo banco para relacionamento de tabelas (Foreign Keys), otimização de índices e ordenação determinística de travas.

   * **Chave Pública (`customer_key`, `account_key` em `CHAR(36)` / `UUID`):** Chave exposta externamente na API e nos payloads para prevenir enumeração de recursos e ataques de IDOR.

3. **Livro-Razão Imutável (Append-Only Ledger):**

   * Cada movimentação gera lançamentos imutáveis na tabela `TRANSACTION`. A coluna `balance` na tabela `ACCOUNT` atua unicamente como um cache materializado atualizado dentro da mesma transação ACID.

### 3.2 Diagrama de Entidades e Relacionamentos (DER)

```
erDiagram
    CUSTOMER ||--o{ ACCOUNT : "possui"
    ACCOUNT_STATUS ||--o{ ACCOUNT : "status atual"
    ACCOUNT ||--o{ ACCOUNT_STATUS_EVENT : "historiza"
    ACCOUNT ||--o{ TRANSACTION : "lança"
    ACCOUNT ||--o{ IDEMPOTENCY_KEY : "deduplica"
    ACCOUNT ||--o{ BILLING_PLAN : "contrata"
    ACCOUNT ||--o{ CREDIT_ADVANCE : "solicita"
    BILLING_PLAN ||--o{ BANK_SLIP : "gera"
    CREDIT_ADVANCE |o--o{ BANK_SLIP : "lastreia"

    CUSTOMER {
        serial id PK
        char36 customer_key UK "UUID Público"
        varchar document_number UK "CPF/CNPJ"
        varchar email UK
    }

    ACCOUNT {
        serial id PK
        char36 account_key UK "UUID Público"
        int customer_id FK
        int status_id FK
        bigint balance "Cache em centavos [CHECK >= 0]"
    }

    TRANSACTION {
        serial id PK
        char36 transaction_key UK
        char36 operation_key "Agrupa lançamentos da mesma op"
        int account_id FK
        varchar type "DEPOSIT, WITHDRAWAL, TRANSFER_OUT..."
        bigint amount "Centavos com sinal (+ / -)"
        bigint balance_after "Saldo reconstruído pós-op"
    }

    IDEMPOTENCY_KEY {
        serial id PK
        int account_id FK
        varchar scope "Rota utilizada"
        varchar idempotency_key "Chave enviada pelo cliente"
        char64 request_hash "SHA-256 do corpo"
        int response_status
        jsonb response_body
    }

    BILLING_PLAN {
        serial id PK
        char36 plan_key UK
        int account_id FK
        bigint base_amount "Centavos por parcela"
    }

    BANK_SLIP {
        serial id PK
        char36 slip_key UK
        int billing_plan_id FK
        int credit_advance_id FK "Vínculo de antecipação"
        int installment_number "Parcela 1 a 24"
        bigint amount "Valor em centavos"
    }

    CREDIT_ADVANCE {
        serial id PK
        char36 credit_advance_key UK
        int account_id FK
        bigint gross_amount "Soma dos boletos"
        bigint fee_amount "Taxa calculada"
        bigint net_amount "Valor líquido creditado"
    }

```

## 4. Fase 3: Plano de Execução por Fatias Verticais e Rodadas

A execução do projeto substitui prazos rígidos por Rodadas de Fatias Verticais (*Vertical Slices*) impulsionadas por TDD.

### 4.1 O Template de uma Fatia Vertical

Toda funcionalidade (ex.: Depósito, Transferência, Antecipação) é desenvolvida individualmente do teste ao banco seguindo a distribuição proporcional de tempo:

```
+-----------------------------------------------------------------------+
|                       FATIA VERTICAL (100% de Tempo)                  |
+-------------------+--------------------------------+------------------+
|   1. VERMELHO     |          2. VERDE              | 3. REFATORAR/RFC |
|   (25% do tempo)  |       (50% do tempo)           |  (25% do tempo)  |
|  Escreve os testes|  Schema -> Resource ->         |  Limpa o código, |
|  de caixa-preta e |  Controller -> Repository      |  confere DTOs e  |
|  confirma a falha.|  Mínimo para passar no teste.  |  atualiza a RFC. |
+-------------------+--------------------------------+------------------+

```

### 4.2 Regras de Trabalho e Histórico no Git

1. **Main Sempre Verde:** Nenhuma alteração é mesclada na branch principal sem que a suíte completa de testes passe localmente.

2. **Commits Separados por Cor do TDD:** O histórico do Git serve como prova formal do ciclo TDD:

   * `test(S3): vermelho - adicionar testes de transferencia`

   * `feat(S3): verde - implementar fluxo de transferencia no controller`

   * `refactor(S3): refatorar DTO e remover duplicacao`

## 5. Fase 4: Arquitetura em Camadas Estrita ("O Restaurante")

A aplicação adota uma arquitetura em camadas unidirecional. A requisição atravessa as camadas sequencialmente e retorna pelo mesmo caminho.

```
flowchart TD
    Client["Cliente HTTP / Test Suite"] --> MW["1. middlewares/\n(Token, Context, Logger, Session)"]
    MW --> Schemas["2. schemas/\n(Validação JSON Schema estrita)"]
    Schemas --> Res["3. resources/\n(Roteamento FastAPI)"]
    Res --> Ctrl["4. controllers/\n(Regras de Domínio, Lock e Commit)"]
    Ctrl --> Repo["5. repositories/\n(Queries SQL & Locks)"]
    Ctrl --> Conn["6. connectors/\n(I/O HTTP Externo)"]
    Repo --> DB[("PostgreSQL")]
    Conn --> ExtAPI[("API Externa / MockServer")]
    Ctrl --> DTO["7. dtos/\n(Serialização de Resposta Pública)"]
    DTO --> Res

```

### 5.1 Tabela de Responsabilidades por Camada

Cada camada responde a uma pergunta específica e possui proibições estritas:

| Camada | Pergunta que Responde | O que FAZ | O que NÃO PODE fazer | 
| ----- | ----- | ----- | ----- | 
| **`middlewares/`** | O que vale para toda requisição? | Gerencia tokens internos, contexto de log e sessão do banco via `ContextVar`. | Conhecer regras de rotas específicas ou tomar decisões de negócio. | 
| **`schemas/`** | O JSON tem a forma certa? | Valida o payload de entrada via JSON Schema (`additionalProperties: false`). | Consultar o banco de dados ou decidir regras. | 
| **`resources/`** | Como isso entra e sai em HTTP? | Recebe a requisição HTTP, chama o Controller e devolve o `JSONResponse` com o DTO. | Conter condicionais (`if`) de negócio ou comandos SQL. | 
| **`controllers/`** | Pode ou não pode? | Decide regras de negócio, calcula taxas, orquestra repositórios e dá o único `session.commit()`. | Escrever queries SQL brutas ou conhecer detalhes de infraestrutura HTTP. | 
| **`repositories/`** | Como busco e guardo no banco? | Executa queries SQLAlchemy e aplica travas pessimistas no PostgreSQL. | Dar `session.commit()`, decidir se a operação é permitida ou lançar status HTTP. | 
| **`connectors/`** | Como falo com um serviço de fora? | Executa chamadas HTTP para APIs externas com timeouts estritos (1s conexão / 5s leitura). | Falar diretamente com o banco da aplicação ou decidir regras de negócio. | 
| **`dtos/`** | O que sai, com que nome? | Esconde IDs numéricos internos e formata a resposta pública com UUIDs e datas. | Buscar dados no banco ou executar lógica de negócio. | 

## 6. Fase 5: Proteções de Concorrência, Idempotência e Segurança

Sistemas financeiros exigem garantias matemáticas contra race conditions, respostas perdidas e acessos indevidos.

### 6.1 Prevenção de Deadlocks e Race Conditions

Para evitar travamentos mútuos (deadlocks) quando duas contas se transferem saldo simultaneamente (A→B e B→A), as contas devem ser travadas em ordem fixa por ID interno crescente usando a cláusula `FOR NO KEY UPDATE`:

```
-- Exemplo de query gerada pelo Repository para transferência entre a conta 10 e a conta 20
SELECT * FROM account
WHERE id IN (10, 20)
ORDER BY id ASC
FOR NO KEY UPDATE;

```

> **Por que `FOR NO KEY UPDATE`?**
>
> Garante que nenhuma outra transação altere o saldo das contas envolvidas, mas evita conflitos de travamento com as verificações de chaves estrangeiras (`KEY SHARE`) das tabelas filhas (ex.: `IDEMPOTENCY_KEY`).

```
sequenceDiagram
    autonumber
    participant ReqA as Requisição 1 (Conta 10 -> Conta 20)
    participant DB as PostgreSQL
    participant ReqB as Requisição 2 (Conta 20 -> Conta 10)

    Note over ReqA, ReqB: Ambas tentam disputar saldo ao mesmo tempo
    ReqA->>DB: SELECT ... WHERE id IN (10, 20) ORDER BY id FOR NO KEY UPDATE
    Note over ReqA, DB: Trava concedida na Conta 10 e Conta 20
    ReqB->>DB: SELECT ... WHERE id IN (10, 20) ORDER BY id FOR NO KEY UPDATE
    Note over ReqB, DB: Aguarda liberação do ID 10 (Fila no Postgres)
    ReqA->>DB: Valida Saldo + Grava Ledger + Commit (Libera Locks)
    Note over ReqB, DB: Trava concedida ao ReqB
    ReqB->>DB: Re-lê saldo atualizado -> Saldo Insuficiente!
    ReqB-->>DB: Rollback

```

### 6.2 Garantia de Idempotência com Hash SHA-256

Operações financeiras mutáveis devem exigir o cabeçalho `Idempotency-Key`. A idempotência é garantida no PostgreSQL pela tabela `IDEMPOTENCY_KEY` com a restrição `UNIQUE(account_id, scope, idempotency_key)`:

1. Cliente envia `POST` com Header `Idempotency-Key: uuid-123` e Corpo JSON.

2. Controller calcula o SHA-256 canônico do corpo JSON (`request_hash`).

3. Tenta inserir na tabela `IDEMPOTENCY_KEY` (`ON CONFLICT DO NOTHING`):

   * **SE CHAVE INÉDITA:**

     * Executa a transação financeira no banco.

     * Salva `response_status` (201) e `response_body` no registro de idempotência.

     * Executa `session.commit()` e devolve `201 Created`.

   * **SE CHAVE JÁ EXISTE (Replay / Retentativa):**

     * Lê a linha gravada na tabela `IDEMPOTENCY_KEY`.

     * Compara o `request_hash` gravado com o `request_hash` atual:

       * **SE MESMO HASH:** Devolve a resposta salva (`201`) + Header `Idempotent-Replayed: true`.

       * **SE HASH DIFERENTE:** Rejeita com `409 Conflict` (`QIT001008`).

### 6.3 Proteção contra IDOR e Janela Noturna

* **Proteção IDOR (Restrição R8):** A busca de um lançamento ou transação pertencente a outra conta deve retornar `404 Not Found` com o mesmo corpo e formato de um recurso inexistente, nunca `403 Forbidden`. Isso impede que atacantes enumerem a existência de dados de terceiros.

* **Janela Noturna Determinística:** Operações de saque e transferência acima de R\$ 1.000 (100.000 centavos) realizadas entre 20h e 06h são recusadas com `422 Unprocessable Entity` (`QIT001007`). O ambiente de testes utiliza variáveis de ambiente (`.env`) e congelamento de horário no container para testar essa regra de forma determinística.

## 7. Fase 6: Suíte de Testes de Caixa-Preta (Restrição R1) e Mocks

A estratégia de testes do projeto exige desacoplamento absoluto entre os testes e o código interno da aplicação.

### 7.1 A Restrição R1 (Caixa-Preta Estrita)

* **Zero Import de `src/`:** Nenhum arquivo dentro da pasta `tests/` pode importar módulos de `src/` (ex.: proibido `from src.models import Account`).

* **Comunicação por HTTP Real:** O `pytest` dispara requisições HTTP reais usando a biblioteca `requests` contra a API em execução no container Docker (`http://localhost:3000`).

* **Teste Guardião AST:** Um teste estático inspeciona a Árvore Sintática Abstrata (AST) de todos os arquivos em `tests/` e falha a suíte de build se encontrar qualquer comando `import src`.

### 7.2 Isolamento com MockServer

Chamadas para conectores externos (ex.: Banco Central para cotação de IPCA ou serviço emissor de boletos) não batem na internet durante a suíte de testes. O `pytest` programa expectativas no container do MockServer antes de disparar o teste HTTP:

```
# Exemplo de teste programando o MockServer sem importar src/
def test_billing_plan_adjustment_success(mock_server_client):
    # 1. Configura expectativa no MockServer para a taxa do Banco Central
    mock_server_client.expect_get("/index/IPCA", response_body={"accumulated_rate": "4.83"})

    # 2. Dispara a chamada HTTP real contra a API
    response = requests.post(f"{BASE_URL}/account/{account_key}/billing-plan/{plan_key}/adjustment", json={"index_code": "IPCA"})

    # 3. Asserts exclusivamente no contrato HTTP retornado
    assert response.status_code == 201
    assert response.json()["installments"]["amount"] == 10483  # R$ 100 base + 4.83%

```

## 8. Fase 7: Artefatos de Entrega e Defesa Técnica

Para considerar o projeto finalizado e pronto para avaliação, a seguinte estrutura de documentação e evidências deve estar presente no repositório público do GitHub:

### 8.1 Checklist de Artefatos Mandatórios

* \[x\] `RFC_FINAL.pdf`: PDF de 2 a 4 páginas nas 2 seções fixas com o DER gráfico vetorial renderizado.

* \[x\] `APRESENTACAO.pdf`: Slides da defesa técnica estruturados para a apresentação de 10 minutos.

* \[x\] `CONTRATO.md`: Contrato estrito do time detalhando convenções, payloads, regras e o catálogo de erros QIT.

* \[x\] `BENCHMARK.md`: Relatório reproduzível de testes de estresse de concorrência financeira (ex.: 200 transferências cruzadas simultâneas sem deadlock).

* \[x\] `MATRIZ_TESTES.md`: Matriz mapeando cada rota e código de erro a pelo menos um teste HTTP automatizado.

* \[x\] `BACKLOG.md`: Registro histórico de rodadas, fatias verticais e backlog.

* \[x\] `README.md`: Guia único de instalação, comandos `docker compose up`, execução da suíte `pytest` e mapa do projeto.

### 8.2 Roteiro de 10 Minutos para Apresentação e Defesa

Ao defender o projeto perante a banca, organize a apresentação seguindo esta divisão de tempo:

```
+-----------------------------------------------------------------------------------+
| ROTEIRO DE APRESENTAÇÃO E DEFESA TÉCNICA (10 MINUTOS TOTAL)                       |
+---------------+-------------------+-----------------------+-----------------------+
| 0:00 - 2:00   | 2:00 - 4:00       | 4:00 - 7:30           | 7:30 - 10:00          |
| O Problema e  | A Arquitetura e   | Os Desafios Técnicos  | Evidências de Teste,  |
| a Proposta    | Camadas           | (Ledger, Concorrência,| Benchmark e Resposta  |
| do BaaS PME.  | ("Restaurante").  | Idempotência e R8).   | a Perguntas da Banca. |
+---------------+-------------------+-----------------------+-----------------------+

```

Este roteiro oferece uma estrutura previsível, auditável e segura para projetar, codificar, testar e defender qualquer aplicação financeira de nível de produção!