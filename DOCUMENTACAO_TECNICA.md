# Documentação Técnica e Funcional Completa
## PEPS - Rede Guerra de Postos

**Versão:** 1.0.0  
**Data:** 27/02/2026  
**Autor:** Manus AI  
**Status:** Produção

---

## 1️⃣ Visão Geral do Sistema

### Objetivo Principal

O **PEPS - Rede Guerra de Postos** é um sistema de gestão integrado de estoque, custo de mercadoria vendida (CMV) e coerência física para uma rede de postos de combustível. O sistema sincroniza dados do ACS (sistema externo de gestão), implementa método PEPS/FIFO para cálculo de CMV, detecta inconsistências de estoque e permite correções via transferências inteligentes.

### Problema que Resolve

Redes de combustível enfrentam desafios críticos:

1. **Divergência entre estoque fiscal e físico** — NFes faturadas em um posto mas descarregadas em outro, causando estoque negativo em um e sobra em outro.
2. **Cálculo incorreto de CMV** — Sem rastreamento de lotes, o custo de venda fica impreciso, afetando a DRE.
3. **Falta de visibilidade de transferências** — Quando uma NFe é movida entre postos, não há log de quem fez, quando e por quê.
4. **Medições ausentes** — Dias sem medição física impedem validação de coerência.
5. **Alterações retroativas sem controle** — Sem bloqueio mensal, usuários podem alterar dados já fechados, comprometendo auditoria.

O PEPS resolve esses problemas automatizando a sincronização, detectando inconsistências, sugerindo correções e mantendo rastreabilidade completa.

### Tipo de Usuário que Utiliza

- **Admin Geral** — Acesso completo ao sistema, pode fechar meses, desbloquear DRE, ver todos os postos.
- **Gerente de Posto** — Acesso limitado ao seu posto, pode alocar NFes, resolver pendências, ver relatórios.
- **Visualização** — Acesso somente leitura, pode consultar dados do seu posto.

### Fluxo Principal de Funcionamento

O fluxo típico de um usuário é:

1. **Sincronização Automática** — A cada 60 minutos, o sistema busca NFes, vendas e medições do ACS e as importa como lotes provisórios.
2. **Verificação de Coerência** — O sistema calcula estoque projetado (medição inicial + compras - vendas) e compara com medição do dia seguinte. Se diferença > 300L, gera alerta.
3. **Visualização de Pendências** — O usuário acessa "Pendências de Estoque" e vê alertas de sobra/falta em tanques específicos.
4. **Sugestão Inteligente** — O motor de sugestão cruza alertas complementares (sobra em A + falta em B) e sugere transferência da NFe provável com volume arredondado para múltiplos de 1.000L.
5. **Resolução via Transferência** — O usuário clica "Resolver" e confirma a transferência. O sistema automaticamente:
   - Move o lote do tanque de origem para o de destino
   - Recalcula CMV de ambos os postos a partir da data da NFe
   - Revalida coerência física
   - Confirma a NFe como "confirmada" se coerência bater
   - Gera log completo da transferência
6. **Fechamento Mensal** — Admin fecha o mês na DRE, travando alterações retroativas. Apenas admin pode desbloquear.

---

## 2️⃣ Arquitetura Técnica

### Linguagens Utilizadas

| Camada | Linguagem | Versão |
|--------|-----------|--------|
| Frontend | TypeScript + React | React 19.2.1, TypeScript 5.9.3 |
| Backend | TypeScript + Node.js | Node.js 22.13.0 |
| Banco de Dados | SQL (MySQL/TiDB) | MySQL 8.0+ |
| Sincronização | TypeScript + PostgreSQL | pg 8.18.0 (leitura do ACS) |

### Frameworks e Bibliotecas Principais

**Frontend:**
- **React 19** — Framework UI com hooks modernos
- **Tailwind CSS 4** — Styling utilitário responsivo
- **shadcn/ui** — Componentes UI acessíveis (Button, Dialog, Card, Table, etc.)
- **tRPC 11** — RPC type-safe entre frontend e backend
- **React Query** — Gerenciamento de cache e estado remoto
- **Wouter** — Roteamento leve
- **Recharts** — Gráficos e visualizações
- **Sonner** — Toast notifications
- **React Hook Form** — Gerenciamento de formulários
- **Zod** — Validação de schemas

**Backend:**
- **Express 4** — Framework HTTP
- **tRPC 11** — RPC type-safe
- **Drizzle ORM** — ORM SQL type-safe
- **MySQL2** — Driver MySQL
- **PostgreSQL (pg)** — Leitura do banco ACS externo
- **Jose** — JWT para sessões
- **AWS SDK S3** — Armazenamento de arquivos
- **Vitest** — Testes unitários

### Estrutura de Pastas do Projeto

```
peps-rede-guerra/
├── client/                          # Frontend React
│   ├── src/
│   │   ├── pages/                   # Páginas principais
│   │   │   ├── Home.tsx             # Dashboard principal
│   │   │   ├── Estoque.tsx          # Gestão de estoque
│   │   │   ├── Vendas.tsx           # Visualização de vendas
│   │   │   ├── DRE.tsx              # Demonstrativo de resultado
│   │   │   ├── CoerenciaFisica.tsx  # Verificação de coerência
│   │   │   ├── PendenciasEstoque.tsx# Hub de resolução de pendências
│   │   │   ├── Transferencias.tsx   # Transferências físicas
│   │   │   ├── BloqueioDRE.tsx      # Bloqueio mensal
│   │   │   ├── AlocacaoNFe.tsx      # Alocação manual (raro)
│   │   │   ├── Alertas.tsx          # Visualização de alertas
│   │   │   ├── Configuracoes.tsx    # Configurações do sistema
│   │   │   └── Usuarios.tsx         # Gestão de usuários
│   │   ├── components/
│   │   │   ├── DashboardLayout.tsx  # Layout com sidebar
│   │   │   ├── Map.tsx              # Integração Google Maps
│   │   │   ├── AIChatBox.tsx        # Chat com IA
│   │   │   └── ui/                  # Componentes shadcn/ui
│   │   ├── lib/
│   │   │   ├── trpc.ts              # Cliente tRPC
│   │   │   └── utils.ts             # Utilitários
│   │   ├── App.tsx                  # Rotas principais
│   │   ├── main.tsx                 # Entry point
│   │   └── index.css                # Estilos globais
│   ├── public/                      # Assets estáticos
│   │   └── logo-rede-super.png      # Logo Rede Super Petróleo
│   └── index.html                   # HTML template
│
├── server/                          # Backend Express + tRPC
│   ├── routers/
│   │   ├── alocacoes-fisicas.ts     # Router de alocações
│   │   └── coerencia-transferencias.ts # Router de coerência/transferências
│   ├── services/
│   │   ├── coerencia-fisica.ts      # Lógica de verificação de coerência
│   │   ├── motor-sugestao.ts        # Motor de sugestão inteligente
│   │   ├── transferencias-fisicas.ts# Lógica de transferências
│   │   ├── bloqueio-dre.ts          # Lógica de bloqueio mensal
│   │   ├── sync-nfes-acs.ts         # Sincronização de NFes
│   │   ├── acs-nfes.ts              # Integração com ACS
│   │   └── sefaz-real.ts            # Integração SEFAZ
│   ├── utils/
│   │   ├── audit-logs.ts            # Logging de auditoria
│   │   ├── cmv-pagination.ts        # Paginação de recálculo CMV
│   │   └── cache.ts                 # Cache em memória
│   ├── _core/
│   │   ├── index.ts                 # Auto-sync e servidor
│   │   ├── context.ts               # Contexto tRPC (auth)
│   │   ├── oauth.ts                 # Autenticação Manus OAuth
│   │   ├── llm.ts                   # Integração LLM
│   │   ├── notification.ts          # Notificações ao owner
│   │   └── env.ts                   # Variáveis de ambiente
│   ├── db.ts                        # Helpers de banco de dados
│   ├── routers.ts                   # Agregador de routers
│   └── *.test.ts                    # Testes unitários
│
├── drizzle/
│   ├── schema.ts                    # Definição de tabelas
│   └── migrations/                  # Histórico de migrações
│
├── storage/
│   └── index.ts                     # Helpers S3
│
├── shared/
│   └── constants.ts                 # Constantes compartilhadas
│
├── package.json                     # Dependências
├── tsconfig.json                    # Configuração TypeScript
├── vite.config.ts                   # Configuração Vite
├── drizzle.config.ts                # Configuração Drizzle
└── todo.md                          # Rastreamento de features
```

### Como o Frontend se Comunica com o Backend

O frontend usa **tRPC** para comunicação type-safe com o backend:

1. **Definição de Procedure** — No backend (`server/routers.ts`), cada endpoint é definido como um tRPC procedure:
   ```typescript
   verificarCoerenciaPosto: protectedProcedure
     .input(z.object({ postoId: z.number(), dataInicio: z.string() }))
     .query(async ({ input, ctx }) => {
       // Lógica aqui
       return resultado;
     })
   ```

2. **Chamada no Frontend** — O frontend chama via hook tRPC:
   ```typescript
   const { data, isLoading } = trpc.coerenciaTransferencias.verificarCoerenciaPosto.useQuery({
     postoId: 1,
     dataInicio: "2026-01-01"
   });
   ```

3. **Serialização Automática** — tRPC + SuperJSON serializam Dates, Decimals e tipos complexos automaticamente.

4. **Autenticação** — Cada request inclui JWT na sessão (cookie), verificado em `context.ts`.

### Serviços Externos Integrados

| Serviço | Propósito | Integração |
|---------|-----------|-----------|
| **ACS (PostgreSQL)** | Sincronização de NFes, vendas, medições | Leitura via `pg` driver em `server/services/acs-nfes.ts` |
| **SEFAZ** | Validação de NFes (opcional) | Via `sefaz-real.ts` |
| **Manus OAuth** | Autenticação de usuários | `server/_core/oauth.ts` |
| **AWS S3** | Armazenamento de arquivos/relatórios | `storage/index.ts` com presigned URLs |
| **Google Maps** | Visualização de localização de postos | `client/src/components/Map.tsx` |
| **LLM (Manus)** | Análise de dados e sugestões | `server/_core/llm.ts` |
| **Notification API (Manus)** | Alertas ao owner | `server/_core/notification.ts` |

### Onde o Sistema está Hospedado

- **Frontend:** Hospedado em Manus (CDN global, auto-scaling)
- **Backend:** Express rodando em Node.js em container Manus
- **Banco de Dados:** MySQL/TiDB em Manus (replicado, backup automático)
- **Banco ACS:** PostgreSQL externo (leitura apenas)
- **URL de Acesso:** `https://pepsrede-gsoityr3.manus.space`

---

## 3️⃣ Banco de Dados (ESSENCIAL)

### Tipo de Banco

**MySQL 8.0+** (ou TiDB compatível com MySQL). Escolhido por:
- Suporte a transações ACID
- Índices eficientes para queries de data/hora
- Compatibilidade com Drizzle ORM
- Backup automático em Manus

### Estrutura Completa das Tabelas

#### **Tabelas de Configuração**

| Tabela | Propósito | Chave Primária |
|--------|-----------|---|
| `users` | Usuários do sistema | `id` |
| `postos` | Postos de combustível | `id` |
| `produtos` | Combustíveis (gasolina, diesel, etc.) | `id` |
| `fornecedores` | Fornecedores de combustível | `id` |
| `tanques` | Tanques de armazenamento | `id` |
| `configuracoes` | Configurações globais do sistema | `id` |

#### **Tabelas de Operação**

| Tabela | Propósito | Chave Primária |
|--------|-----------|---|
| `lotes` | Compras de combustível (PEPS) | `id` |
| `vendas` | Vendas de combustível | `id` |
| `consumoLotes` | Rastreamento qual lote foi consumido em cada venda | `id` |
| `medicoes` | Medições físicas de tanques | `id` |

#### **Tabelas de Coerência e Transferências**

| Tabela | Propósito | Chave Primária |
|--------|-----------|---|
| `verificacaoCoerencia` | Cache de verificações de coerência física | `id` |
| `transferenciasFisicas` | Log de transferências entre postos | `id` |
| `bloqueioDre` | Bloqueio mensal por posto | `id` |
| `alertas` | Alertas gerados pelo sistema | `id` |

#### **Tabelas de Auditoria**

| Tabela | Propósito | Chave Primária |
|--------|-----------|---|
| `historicoAlteracoes` | Log de todas as alterações (insert/update/delete) | `id` |
| `syncLogs` | Log de sincronizações com ACS | `id` |

### Campos de Cada Tabela

#### **users**
```sql
id (INT) - PK
openId (VARCHAR 64) - UNIQUE (ID do Manus OAuth)
name (TEXT)
email (VARCHAR 320)
loginMethod (VARCHAR 64) - "manus"
role (ENUM) - "user" | "admin_geral" | "visualizacao"
postoId (INT) - FK para postos (para usuários de visualização)
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
lastSignedIn (TIMESTAMP)
```

#### **postos**
```sql
id (INT) - PK
codigoAcs (VARCHAR 10) - UNIQUE (ID do ACS)
nome (VARCHAR 200) - "Mãe e Filho", "Palhano", etc.
cnpj (VARCHAR 20)
endereco (TEXT)
ativo (INT) - 1 = ativo, 0 = inativo
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
```

#### **produtos**
```sql
id (INT) - PK
codigoAcs (VARCHAR 20) - UNIQUE (ID do ACS)
descricao (VARCHAR 200) - "Gasolina Comum", "Diesel", etc.
tipo (VARCHAR 10) - "C" (combustível)
ativo (INT)
createdAt (TIMESTAMP)
```

#### **tanques**
```sql
id (INT) - PK
postoId (INT) - FK para postos
codigoAcs (VARCHAR 10) - ID do tanque no ACS
produtoId (INT) - FK para produtos
capacidade (DECIMAL 12,3) - Capacidade em litros
estoqueMinimo (DECIMAL 12,3) - Estoque mínimo (default 1000L)
saldoAtual (DECIMAL 12,3) - Saldo atual em litros
ativo (INT)
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
```

#### **lotes** (Compras - PEPS/FIFO)
```sql
id (INT) - PK
codigoAcs (VARCHAR 50) - UNIQUE (ID no ACS)
tanqueId (INT) - FK para tanques
postoId (INT) - FK para postos
produtoId (INT) - FK para produtos
fornecedorId (INT) - FK para fornecedores
numeroNf (VARCHAR 50) - Número da NFe
serieNf (VARCHAR 10)
chaveNfe (VARCHAR 60) - Chave de acesso da NFe
nomeFornecedor (VARCHAR 300)
nomeProduto (VARCHAR 200)
tipoFrete (VARCHAR 10) - "FOB" | "CIF"
custoUnitarioProduto (DECIMAL 12,4) - Custo do combustível
custoUnitarioFrete (DECIMAL 12,4) - Custo do frete por litro
valorFrete (DECIMAL 12,2) - Valor total do frete
dataEmissao (DATE) - Data fiscal da NFe
dataEntrada (DATE) - Data real de descarga (PEPS usa isso)
dataLmc (DATE) - Data de lançamento no LMC
quantidadeOriginal (DECIMAL 12,3) - Quantidade original da NFe
quantidadeDisponivel (DECIMAL 12,3) - Quantidade ainda disponível
custoUnitario (DECIMAL 12,4) - Custo final (produto + frete)
custoTotal (DECIMAL 14,2) - Custo total
ordemConsumo (INT) - Ordem PEPS (1 = primeiro a consumir)
status (ENUM) - "ativo" | "consumido" | "cancelado"
statusNfe (ENUM) - "provisoria" | "confirmada"
origem (ENUM) - "acs" | "manual" | "transferencia"
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
```

#### **vendas**
```sql
id (INT) - PK
codigoAcs (VARCHAR 64) - UNIQUE (ID no ACS)
postoId (INT) - FK para postos
tanqueId (INT) - FK para tanques
produtoId (INT) - FK para produtos
dataVenda (DATE)
quantidade (DECIMAL 12,3) - Quantidade vendida
valorUnitario (DECIMAL 12,4) - Preço de venda
valorTotal (DECIMAL 14,2) - Valor total da venda
cmvCalculado (DECIMAL 14,2) - Custo da mercadoria vendida
cmvUnitario (DECIMAL 12,4) - CMV por litro
statusCmv (ENUM) - "pendente" | "calculado" | "erro"
afericao (INT) - 1 se foi aferição (medição), 0 se venda normal
origem (VARCHAR 20) - "acs"
createdAt (TIMESTAMP)
```

#### **consumoLotes** (Rastreamento PEPS)
```sql
id (INT) - PK
vendaId (INT) - FK para vendas
loteId (INT) - FK para lotes
quantidadeConsumida (DECIMAL 12,3)
custoUnitario (DECIMAL 12,4)
custoTotal (DECIMAL 14,2)
createdAt (TIMESTAMP)
```

#### **medicoes** (Medições Físicas)
```sql
id (INT) - PK
codigoAcs (VARCHAR 64) - UNIQUE (ID no ACS)
tanqueId (INT) - FK para tanques
postoId (INT) - FK para postos
dataMedicao (DATE)
horaMedicao (VARCHAR 10) - HH:MM
volumeMedido (DECIMAL 12,3) - Volume medido em litros
temperatura (DECIMAL 5,2) - Temperatura (opcional)
estoqueEscritural (DECIMAL 12,3) - Estoque no sistema
diferenca (DECIMAL 12,3) - volumeMedido - estoqueEscritural
percentualDiferenca (DECIMAL 8,4)
tipoDiferenca (ENUM) - "sobra" | "perda" | "ok"
observacoes (TEXT)
origem (ENUM) - "acs" | "manual"
deletedAt (TIMESTAMP) - Soft delete
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
```

#### **verificacaoCoerencia** (Cache de Verificações)
```sql
id (INT) - PK
postoId (INT) - FK para postos
tanqueId (INT) - FK para tanques
produtoId (INT) - FK para produtos
dataVerificacao (DATE) - Dia verificado
medicaoInicial (DECIMAL 12,3) - Medição do dia
vendasDia (DECIMAL 12,3) - Total vendido no dia
comprasDia (DECIMAL 12,3) - Total comprado/alocado no dia
estoqueProjetado (DECIMAL 12,3) - medicaoInicial - vendas + compras
medicaoDiaSeguinte (DECIMAL 12,3) - Medição real do dia seguinte
diferenca (DECIMAL 12,3) - estoqueProjetado - medicaoDiaSeguinte
diferencaAbsoluta (DECIMAL 12,3) - |diferenca|
statusCoerencia (ENUM) - "coerente" | "alerta" | "sem_medicao"
alertaGerado (INT) - 1 se alerta foi gerado
alertaId (INT) - FK para alertas
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
UNIQUE INDEX: (postoId, tanqueId, dataVerificacao)
```

#### **transferenciasFisicas** (Log de Transferências)
```sql
id (INT) - PK
nfeStagingId (INT) - FK para nfeStaging (pode ser NULL)
loteOrigemId (INT) - FK para lotes (lote de origem)
loteDestinoId (INT) - FK para lotes (lote criado no destino)
postoOrigemId (INT) - FK para postos
postoDestinoId (INT) - FK para postos
tanqueOrigemId (INT) - FK para tanques
tanqueDestinoId (INT) - FK para tanques
produtoId (INT) - FK para produtos
volumeTransferido (DECIMAL 12,3)
custoUnitario (DECIMAL 12,4)
custoTotal (DECIMAL 14,2)
dataTransferencia (DATE)
numeroNf (VARCHAR 50) - Número da NFe relacionada
justificativa (TEXT) - Motivo da transferência (OBRIGATÓRIO)
tipo (ENUM) - "correcao_alocacao" | "transferencia_fisica" | "divisao_nfe"
status (ENUM) - "confirmada" | "cancelada"
usuarioId (INT) - FK para users (quem fez)
usuarioNome (VARCHAR 200)
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
```

#### **bloqueioDre** (Bloqueio Mensal)
```sql
id (INT) - PK
mesReferencia (VARCHAR 7) - "2026-02"
postoId (INT) - FK para postos
status (ENUM) - "aberto" | "fechado"
fechadoPor (INT) - FK para users (quem fechou)
fechadoNome (VARCHAR 200)
fechadoEm (TIMESTAMP)
desbloqueadoPor (INT) - FK para users (admin que desbloqueou)
desbloqueadoNome (VARCHAR 200)
desbloqueadoEm (TIMESTAMP)
observacoes (TEXT)
createdAt (TIMESTAMP)
updatedAt (TIMESTAMP)
UNIQUE INDEX: (mesReferencia, postoId)
```

#### **alertas**
```sql
id (INT) - PK
tipo (ENUM) - "estoque_baixo" | "diferenca_medicao" | "cmv_pendente" | 
              "sincronizacao" | "medicao_faltante" | "lote_antigo" | 
              "lotes_insuficientes" | "coerencia_fisica" | "medicao_ausente"
postoId (INT) - FK para postos
tanqueId (INT) - FK para tanques
titulo (VARCHAR 200)
mensagem (TEXT)
dados (TEXT) - JSON com dados adicionais
status (ENUM) - "pendente" | "visualizado" | "resolvido"
createdAt (TIMESTAMP)
resolvedAt (TIMESTAMP)
```

### Relacionamentos Entre Tabelas

```
users
  ├─ postoId → postos.id (opcional, para visualização)
  └─ (N:1)

postos
  ├─ tanques (1:N)
  ├─ lotes (1:N)
  ├─ vendas (1:N)
  ├─ medicoes (1:N)
  ├─ verificacaoCoerencia (1:N)
  ├─ transferenciasFisicas (1:N como origem e destino)
  ├─ bloqueioDre (1:N)
  └─ alertas (1:N)

tanques
  ├─ postoId → postos.id
  ├─ produtoId → produtos.id
  ├─ lotes (1:N)
  ├─ vendas (1:N)
  ├─ medicoes (1:N)
  ├─ verificacaoCoerencia (1:N)
  └─ transferenciasFisicas (1:N como origem e destino)

lotes
  ├─ tanqueId → tanques.id
  ├─ postoId → postos.id
  ├─ produtoId → produtos.id
  ├─ fornecedorId → fornecedores.id
  ├─ consumoLotes (1:N)
  └─ transferenciasFisicas (1:N como origem)

vendas
  ├─ postoId → postos.id
  ├─ tanqueId → tanques.id
  ├─ produtoId → produtos.id
  └─ consumoLotes (1:N)

consumoLotes
  ├─ vendaId → vendas.id
  └─ loteId → lotes.id

medicoes
  ├─ tanqueId → tanques.id
  ├─ postoId → postos.id
  └─ origem (acs ou manual)

verificacaoCoerencia
  ├─ postoId → postos.id
  ├─ tanqueId → tanques.id
  ├─ produtoId → produtos.id
  └─ alertaId → alertas.id

transferenciasFisicas
  ├─ loteOrigemId → lotes.id
  ├─ loteDestinoId → lotes.id
  ├─ postoOrigemId → postos.id
  ├─ postoDestinoId → postos.id
  ├─ tanqueOrigemId → tanques.id
  ├─ tanqueDestinoId → tanques.id
  ├─ produtoId → produtos.id
  └─ usuarioId → users.id

bloqueioDre
  ├─ postoId → postos.id
  ├─ fechadoPor → users.id
  └─ desbloqueadoPor → users.id

alertas
  ├─ postoId → postos.id
  └─ tanqueId → tanques.id
```

### Regras de Negócio Implementadas no Banco

1. **PEPS/FIFO** — Lotes são consumidos em ordem de `dataEntrada` (data real de descarga, não fiscal). Campo `ordemConsumo` rastreia a sequência.

2. **Tolerância de Coerência** — Diferença > 300L gera alerta. Diferença ≤ 300L é considerada coerente.

3. **Bloqueio Mensal** — Após fechar um mês em `bloqueioDre`, nenhuma transferência ou recálculo de CMV pode ser feito naquele mês/posto. Apenas admin pode desbloquear.

4. **Status de NFe** — Lotes começam como "provisoria" (importados do ACS). Após coerência bater por X dias, são marcados como "confirmada".

5. **Soft Delete de Medições** — Medições podem ser deletadas (campo `deletedAt`), mas o histórico é mantido para auditoria.

6. **Rastreabilidade de Transferências** — Toda transferência gera registro em `transferenciasFisicas` com usuário, data, justificativa e impacto financeiro.

7. **Sincronização Idempotente** — Se a mesma NFe for sincronizada duas vezes, não cria duplicata (chave única em `chaveNfe`).

### Como os Dados são Inseridos, Atualizados e Excluídos

#### **Inserção**

**Lotes (via sincronização automática):**
```typescript
// server/services/sync-nfes-acs.ts
const novoLote = await db.insert(lotes).values({
  chaveNfe: nfe.chaveNfe,
  numeroNf: nfe.numeroNf,
  tanqueId: tanqueDestino.id,
  postoId: postoDestino.id,
  quantidadeOriginal: nfe.quantidade,
  quantidadeDisponivel: nfe.quantidade,
  custoUnitario: nfe.custoUnitario,
  dataEntrada: nfe.dataEmissao, // Data fiscal
  statusNfe: "provisoria", // Começa provisória
  origem: "acs"
});
```

**Vendas (via sincronização):**
```typescript
// Vendas são inseridas com statusCmv = "pendente"
// Depois, recálculo de CMV as marca como "calculado"
```

**Medições (via sincronização ou manual):**
```typescript
// Pode vir do ACS ou ser inserida manualmente
// Campo origem rastreia a fonte
```

**Transferências (via resolução de pendência):**
```typescript
// server/services/transferencias-fisicas.ts
const transferencia = await db.insert(transferenciasFisicas).values({
  loteOrigemId: lote.id,
  postoOrigemId: lote.postoId,
  postoDestinoId: postoDestino.id,
  volumeTransferido: volumeSugerido, // Múltiplo de 1000L
  justificativa: "Correção de alocação: NFe faturada em A, descarregada em B",
  tipo: "correcao_alocacao",
  usuarioId: ctx.user.id,
  dataTransferencia: new Date()
});
```

#### **Atualização**

**Lotes após transferência:**
```typescript
// Reduz quantidade disponível do lote de origem
await db.update(lotes)
  .set({ quantidadeDisponivel: sql`quantidadeDisponivel - ${volume}` })
  .where(eq(lotes.id, loteOrigemId));

// Cria novo lote no destino com mesma chaveNfe mas tanqueId diferente
const novoLote = await db.insert(lotes).values({
  ...loteOrigem,
  id: undefined, // Nova PK
  tanqueId: tanqueDestinoId,
  postoId: postoDestinoId,
  quantidadeOriginal: volume,
  quantidadeDisponivel: volume,
  origem: "transferencia"
});
```

**CMV após transferência:**
```typescript
// Recalcula CMV de vendas do posto de origem a partir da data da NFe
// Usa consumoLotes para rastrear qual lote foi consumido
```

**Bloqueio DRE:**
```typescript
// Admin fecha o mês
await db.insert(bloqueioDre).values({
  mesReferencia: "2026-02",
  postoId: 1,
  status: "fechado",
  fechadoPor: adminUserId,
  fechadoEm: new Date()
});

// Verificação antes de qualquer operação:
const bloqueio = await db.select().from(bloqueioDre)
  .where(and(
    eq(bloqueioDre.mesReferencia, mes),
    eq(bloqueioDre.postoId, postoId),
    eq(bloqueioDre.status, "fechado")
  ));
if (bloqueio.length > 0) throw new Error("Mês bloqueado");
```

#### **Exclusão**

**Lotes (cancelamento):**
```typescript
// Nunca deleta fisicamente, apenas marca como cancelado
await db.update(lotes)
  .set({ status: "cancelado" })
  .where(eq(lotes.id, loteId));
```

**Medições (soft delete):**
```typescript
// Marca com deletedAt, não deleta
await db.update(medicoes)
  .set({ deletedAt: new Date() })
  .where(eq(medicoes.id, medicaoId));
```

**Transferências (cancelamento):**
```typescript
// Marca como cancelada, não deleta
await db.update(transferenciasFisicas)
  .set({ status: "cancelada" })
  .where(eq(transferenciasFisicas.id, transferenciId));
```

---

## 4️⃣ Módulos do Sistema

### Módulo 1: Dashboard Principal

**Finalidade:** Visão consolidada da rede de postos com KPIs principais.

**Telas Envolvidas:**
- `Home.tsx` — Dashboard com gráficos e cards de resumo

**Dados Utilizados:**
- Vendas do mês (total em litros e reais)
- Estoque total (por combustível)
- Lucro bruto (vendas - CMV)
- Postos ativos
- Tanques em operação
- Alertas pendentes

**Cálculos Realizados:**
```typescript
// Total de vendas do período
const totalVendas = await db.select({
  quantidade: sql`SUM(quantidade)`,
  valor: sql`SUM(valorTotal)`
}).from(vendas)
  .where(and(
    gte(vendas.dataVenda, dataInicio),
    lte(vendas.dataVenda, dataFim)
  ));

// Lucro bruto = vendas - CMV
const lucroBruto = totalVendas.valor - totalCMV;
```

**Regras de Validação:**
- Apenas dados do mês selecionado
- Exclui vendas com statusCmv = "erro"

**Dependências:**
- Módulo de Vendas (leitura)
- Módulo de CMV (leitura)
- Módulo de Alertas (leitura)

---

### Módulo 2: Gestão de Estoque

**Finalidade:** Visualização e controle de lotes PEPS por tanque.

**Telas Envolvidas:**
- `Estoque.tsx` — Listagem de lotes por posto/tanque

**Dados Utilizados:**
- Lotes ativos (status = "ativo")
- Quantidade disponível
- Custo unitário
- Data de entrada (para PEPS)
- Ordem de consumo

**Cálculos Realizados:**
```typescript
// Valor total em estoque
const valorEstoque = lotes
  .filter(l => l.status === "ativo")
  .reduce((sum, l) => sum + (l.quantidadeDisponivel * l.custoUnitario), 0);

// Ordem PEPS (primeiro a consumir)
const ordemPEPS = lotes
  .filter(l => l.status === "ativo")
  .sort((a, b) => new Date(a.dataEntrada) - new Date(b.dataEntrada))
  .map((l, i) => ({ ...l, ordemConsumo: i + 1 }));
```

**Regras de Validação:**
- Não permite editar lotes consumidos ou cancelados
- Não permite editar se mês está bloqueado

**Dependências:**
- Módulo de Bloqueio DRE (verificação)
- Módulo de Transferências (criação de novos lotes)

---

### Módulo 3: Cálculo de CMV (Custo da Mercadoria Vendida)

**Finalidade:** Calcular CMV retroativo usando método PEPS.

**Telas Envolvidas:**
- `DRE.tsx` — Visualização de CMV por período
- `Configuracoes.tsx` — Botão de recálculo manual

**Dados Utilizados:**
- Vendas (com dataVenda)
- Lotes (com dataEntrada e custoUnitario)
- consumoLotes (rastreamento PEPS)

**Cálculos Realizados:**
```typescript
// Para cada venda, encontrar qual lote foi consumido (PEPS)
for (const venda of vendas) {
  // Buscar lotes ativos na data da venda, ordenados por dataEntrada
  const lotesDisponiveis = await db.select()
    .from(lotes)
    .where(and(
      eq(lotes.postoId, venda.postoId),
      eq(lotes.tanqueId, venda.tanqueId),
      lte(lotes.dataEntrada, venda.dataVenda),
      eq(lotes.status, "ativo")
    ))
    .orderBy(asc(lotes.dataEntrada)); // PEPS: primeiro a entrar

  // Consumir quantidade da venda
  let quantidadeRestante = venda.quantidade;
  for (const lote of lotesDisponiveis) {
    const quantidadeConsumida = Math.min(quantidadeRestante, lote.quantidadeDisponivel);
    
    // Registrar consumo
    await db.insert(consumoLotes).values({
      vendaId: venda.id,
      loteId: lote.id,
      quantidadeConsumida,
      custoUnitario: lote.custoUnitario,
      custoTotal: quantidadeConsumida * lote.custoUnitario
    });

    // Atualizar lote
    await db.update(lotes)
      .set({ quantidadeDisponivel: sql`quantidadeDisponivel - ${quantidadeConsumida}` })
      .where(eq(lotes.id, lote.id));

    quantidadeRestante -= quantidadeConsumida;
    if (quantidadeRestante === 0) break;
  }

  // Atualizar venda com CMV
  const cmvTotal = consumoLotes
    .filter(c => c.vendaId === venda.id)
    .reduce((sum, c) => sum + c.custoTotal, 0);

  await db.update(vendas)
    .set({
      cmvCalculado: cmvTotal,
      cmvUnitario: cmvTotal / venda.quantidade,
      statusCmv: "calculado"
    })
    .where(eq(vendas.id, venda.id));
}
```

**Regras de Validação:**
- Não recalcula se mês está bloqueado
- Recalcula apenas vendas do período especificado
- Se lotes insuficientes, marca statusCmv = "erro"

**Dependências:**
- Módulo de Lotes (leitura)
- Módulo de Vendas (atualização)
- Módulo de Bloqueio DRE (verificação)

---

### Módulo 4: Coerência Física

**Finalidade:** Verificar consistência entre estoque projetado e medição real.

**Telas Envolvidas:**
- `CoerenciaFisica.tsx` — Timeline de verificações por dia/tanque

**Dados Utilizados:**
- Medições (volumeMedido)
- Vendas (quantidade)
- Lotes (quantidadeDisponivel, dataEntrada)

**Cálculos Realizados:**
```typescript
// Para cada dia, cada tanque:
// Estoque Projetado = Medição Inicial + Compras - Vendas

const medicaoInicial = await getMedicao(postoId, tanqueId, dia);
const comprasDia = await getTotalCompras(postoId, tanqueId, dia);
const vendasDia = await getTotalVendas(postoId, tanqueId, dia);

const estoqueProjetado = medicaoInicial + comprasDia - vendasDia;
const medicaoDiaSeguinte = await getMedicao(postoId, tanqueId, dia + 1);
const diferenca = estoqueProjetado - medicaoDiaSeguinte;

// Se |diferença| > 300L, gera alerta
if (Math.abs(diferenca) > 300) {
  await db.insert(alertas).values({
    tipo: "coerencia_fisica",
    postoId,
    tanqueId,
    titulo: `Incoerência Física - ${postoNome}`,
    mensagem: `Diferença de ${Math.abs(diferenca).toFixed(0)}L no tanque ${tanqueCodigo}`,
    status: "pendente"
  });

  await db.insert(verificacaoCoerencia).values({
    postoId,
    tanqueId,
    dataVerificacao: dia,
    medicaoInicial,
    vendasDia,
    comprasDia,
    estoqueProjetado,
    medicaoDiaSeguinte,
    diferenca,
    statusCoerencia: "alerta",
    alertaGerado: 1
  });
}
```

**Regras de Validação:**
- Verificação em ordem cronológica (dia 1, dia 2, dia 3...)
- Se dia N for corrigido, revalida dias N+1 em diante
- Tolerância = 300L (configurável)

**Dependências:**
- Módulo de Medições (leitura)
- Módulo de Vendas (leitura)
- Módulo de Lotes (leitura)
- Módulo de Alertas (criação)

---

### Módulo 5: Motor de Sugestão Inteligente

**Finalidade:** Cruzar alertas complementares (sobra em A + falta em B) e sugerir transferências.

**Telas Envolvidas:**
- `PendenciasEstoque.tsx` — Exibição de sugestões com botão "Resolver"

**Dados Utilizados:**
- Alertas de coerência (tipo = "coerencia_fisica")
- Lotes provisórios (statusNfe = "provisoria")
- Tanques (capacidade, saldoAtual)

**Cálculos Realizados:**
```typescript
// Buscar alertas de sobra e falta
const sobras = alertas.filter(a => a.diferenca > 0);
const faltas = alertas.filter(a => a.diferenca < 0);

// Para cada par (sobra, falta)
for (const sobra of sobras) {
  for (const falta of faltas) {
    // Verificar se datas são próximas (±3 dias)
    const diffDias = Math.abs(sobra.dataVerificacao - falta.dataVerificacao) / (1000 * 60 * 60 * 24);
    if (diffDias > 3) continue;

    // Verificar se volumes são compatíveis (diferença < 20%)
    const volumeSobra = Math.abs(sobra.diferenca);
    const volumeFalta = Math.abs(falta.diferenca);
    const percentualDiferenca = Math.abs(volumeSobra - volumeFalta) / Math.max(volumeSobra, volumeFalta) * 100;
    if (percentualDiferenca > 20) continue;

    // Buscar NFe provisória no posto com sobra
    const nfeCandidata = await db.select()
      .from(lotes)
      .where(and(
        eq(lotes.postoId, sobra.postoId),
        eq(lotes.statusNfe, "provisoria"),
        gte(lotes.dataEntrada, new Date(sobra.dataVerificacao - 3 * 24 * 60 * 60 * 1000))
      ))
      .orderBy(desc(lotes.quantidadeDisponivel))
      .limit(1);

    if (!nfeCandidata) continue;

    // Calcular volume sugerido (múltiplo de 1000L)
    const volumeBruto = Math.min(nfeCandidata.quantidadeDisponivel, volumeSobra, volumeFalta);
    const volumeSugerido = Math.round(volumeBruto / 1000) * 1000;

    // Gerar sugestão
    const sugestao = {
      id: `sug-${sobra.id}-${falta.id}`,
      confianca: percentualDiferenca < 10 ? "alta" : "media",
      postoSobraId: sobra.postoId,
      postoFaltaId: falta.postoId,
      nfeNumero: nfeCandidata.numeroNf,
      volumeSugerido,
      explicacao: `NFe ${nfeCandidata.numeroNf} provavelmente descarregou em ${falta.postoNome}, não em ${sobra.postoNome}`
    };

    sugestoes.push(sugestao);
  }
}
```

**Regras de Validação:**
- Confiança "alta" se statusNfe = "provisoria" E percentualDiferenca < 20% E datas ≤ 1 dia
- Confiança "media" se percentualDiferenca < 30% E datas ≤ 2 dias
- Volume sugerido sempre múltiplo de 1.000L (mínimo 1.000L)

**Dependências:**
- Módulo de Coerência Física (leitura de alertas)
- Módulo de Lotes (leitura)
- Módulo de Transferências (execução)

---

### Módulo 6: Transferências Físicas

**Finalidade:** Executar transferência de NFe entre postos com rastreabilidade completa.

**Telas Envolvidas:**
- `Transferencias.tsx` — Formulário de transferência manual
- `PendenciasEstoque.tsx` — Execução de sugestão

**Dados Utilizados:**
- Lotes (origem)
- Tanques (destino)
- Bloqueio DRE (verificação)

**Cálculos Realizados:**
```typescript
// Validações
if (loteOrigem.quantidadeDisponivel < volumeTransferido) {
  throw new Error("Volume insuficiente no lote");
}

const tanqueDestino = await getTanque(tanqueDestinoId);
if (tanqueDestino.saldoAtual + volumeTransferido > tanqueDestino.capacidade) {
  throw new Error("Transferência estoura capacidade do tanque");
}

// Verificar bloqueio DRE
const bloqueio = await db.select().from(bloqueioDre)
  .where(and(
    eq(bloqueioDre.mesReferencia, getMes(dataTransferencia)),
    eq(bloqueioDre.postoId, postoOrigemId),
    eq(bloqueioDre.status, "fechado")
  ));
if (bloqueio.length > 0) {
  throw new Error("Mês bloqueado, apenas admin pode desbloquear");
}

// Executar transferência
// 1. Reduzir lote de origem
await db.update(lotes)
  .set({ quantidadeDisponivel: sql`quantidadeDisponivel - ${volumeTransferido}` })
  .where(eq(lotes.id, loteOrigemId));

// 2. Criar novo lote no destino
const novoLote = await db.insert(lotes).values({
  ...loteOrigem,
  id: undefined,
  tanqueId: tanqueDestinoId,
  postoId: postoDestinoId,
  quantidadeOriginal: volumeTransferido,
  quantidadeDisponivel: volumeTransferido,
  origem: "transferencia"
});

// 3. Registrar transferência
await db.insert(transferenciasFisicas).values({
  loteOrigemId,
  loteDestinoId: novoLote.id,
  postoOrigemId,
  postoDestinoId,
  tanqueOrigemId,
  tanqueDestinoId,
  volumeTransferido,
  custoUnitario: loteOrigem.custoUnitario,
  custoTotal: volumeTransferido * loteOrigem.custoUnitario,
  dataTransferencia,
  justificativa,
  tipo,
  usuarioId: ctx.user.id,
  usuarioNome: ctx.user.name
});

// 4. Recalcular CMV dos dois postos a partir da data da NFe
await recalcularCMV(postoOrigemId, loteOrigem.dataEntrada);
await recalcularCMV(postoDestinoId, loteOrigem.dataEntrada);

// 5. Revalidar coerência dos dois postos
await verificarCoerenciaFisica(postoOrigemId, loteOrigem.dataEntrada, dataTransferencia);
await verificarCoerenciaFisica(postoDestinoId, loteOrigem.dataEntrada, dataTransferencia);

// 6. Confirmar NFe se coerência bater
if (coerenciaOk) {
  await db.update(lotes)
    .set({ statusNfe: "confirmada" })
    .where(eq(lotes.id, loteOrigemId));
}
```

**Regras de Validação:**
- Volume > 0 e múltiplo de 1.000L
- Lote de origem deve ter status = "ativo"
- Tanque de destino deve ter capacidade suficiente
- Não permite se mês está bloqueado (exceto admin)
- Justificativa obrigatória

**Dependências:**
- Módulo de Lotes (atualização)
- Módulo de CMV (recálculo)
- Módulo de Coerência (revalidação)
- Módulo de Bloqueio DRE (verificação)

---

### Módulo 7: Bloqueio Mensal de DRE

**Finalidade:** Travar alterações retroativas após fechamento mensal.

**Telas Envolvidas:**
- `BloqueioDRE.tsx` — Interface de fechamento/desbloqueio

**Dados Utilizados:**
- bloqueioDre (status por mês/posto)

**Cálculos Realizados:**
```typescript
// Fechar mês
await db.insert(bloqueioDre).values({
  mesReferencia: "2026-02",
  postoId,
  status: "fechado",
  fechadoPor: ctx.user.id,
  fechadoNome: ctx.user.name,
  fechadoEm: new Date(),
  observacoes
});

// Verificação antes de qualquer operação
const bloqueio = await db.select().from(bloqueioDre)
  .where(and(
    eq(bloqueioDre.mesReferencia, getMes(data)),
    eq(bloqueioDre.postoId, postoId),
    eq(bloqueioDre.status, "fechado")
  ));

if (bloqueio.length > 0 && ctx.user.role !== "admin_geral") {
  throw new Error("Mês bloqueado");
}

// Desbloquear (admin only)
await db.update(bloqueioDre)
  .set({
    status: "aberto",
    desbloqueadoPor: ctx.user.id,
    desbloqueadoNome: ctx.user.name,
    desbloqueadoEm: new Date()
  })
  .where(and(
    eq(bloqueioDre.mesReferencia, mes),
    eq(bloqueioDre.postoId, postoId)
  ));
```

**Regras de Validação:**
- Apenas admin_geral pode desbloquear
- Bloqueia todas as operações (transferências, recálculos, alocações)

**Dependências:**
- Módulo de Transferências (verificação)
- Módulo de CMV (verificação)

---

### Módulo 8: Sincronização Automática com ACS

**Finalidade:** Importar NFes, vendas e medições do ACS a cada 60 minutos.

**Telas Envolvidas:**
- `Configuracoes.tsx` — Botão de sincronização manual + status

**Dados Utilizados:**
- ACS (PostgreSQL externo): compras, vendas, medições

**Cálculos Realizados:**
```typescript
// server/services/sync-nfes-acs.ts
export async function sincronizarNfes() {
  const db = await getDb();
  const acsDb = getAcsDb(); // PostgreSQL externo

  // Buscar NFes do ACS que não estão no sistema
  const nfesAcs = await acsDb.query(`
    SELECT * FROM compras 
    WHERE data_emissao >= DATE_SUB(NOW(), INTERVAL 90 DAY)
    AND cancelado = 'N'
  `);

  const nfesExistentes = await db.select({ chaveNfe: lotes.chaveNfe })
    .from(lotes);

  const chaveNfesExistentes = new Set(nfesExistentes.map(n => n.chaveNfe));

  for (const nfe of nfesAcs) {
    if (chaveNfesExistentes.has(nfe.chave_nfe)) continue;

    // Mapear CNPJ para posto
    const posto = await db.select()
      .from(postos)
      .where(eq(postos.cnpj, nfe.cnpj_faturado))
      .limit(1);

    if (!posto) {
      // Gerar alerta: NFe não pode ser mapeada
      await db.insert(alertas).values({
        tipo: "sincronizacao",
        titulo: `NFe ${nfe.numero_nf} não pode ser mapeada`,
        mensagem: `CNPJ ${nfe.cnpj_faturado} não encontrado no sistema`,
        status: "pendente"
      });
      continue;
    }

    // Mapear produto
    const produto = await db.select()
      .from(produtos)
      .where(eq(produtos.codigoAcs, nfe.codigo_produto))
      .limit(1);

    if (!produto) continue;

    // Buscar tanque do produto no posto
    const tanque = await db.select()
      .from(tanques)
      .where(and(
        eq(tanques.postoId, posto.id),
        eq(tanques.produtoId, produto.id)
      ))
      .limit(1);

    if (!tanque) continue;

    // Criar lote provisório
    await db.insert(lotes).values({
      chaveNfe: nfe.chave_nfe,
      numeroNf: nfe.numero_nf,
      tanqueId: tanque.id,
      postoId: posto.id,
      produtoId: produto.id,
      quantidadeOriginal: nfe.quantidade,
      quantidadeDisponivel: nfe.quantidade,
      custoUnitario: nfe.custo_unitario,
      dataEntrada: nfe.data_emissao,
      statusNfe: "provisoria",
      origem: "acs"
    });
  }

  // Log da sincronização
  await db.insert(syncLogs).values({
    tipo: "nfes",
    dataInicio: new Date(),
    dataFim: new Date(),
    registrosProcessados: nfesAcs.length,
    registrosInseridos: nfesAcs.length - chaveNfesExistentes.size,
    status: "sucesso"
  });
}
```

**Regras de Validação:**
- Idempotente (não duplica se rodar duas vezes)
- Busca apenas NFes dos últimos 90 dias
- Ignora NFes canceladas no ACS
- Gera alerta se não conseguir mapear

**Dependências:**
- Conexão com ACS (PostgreSQL)
- Módulo de Lotes (criação)
- Módulo de Alertas (criação)

---

### Módulo 9: Relatórios e DRE

**Finalidade:** Gerar DRE (Demonstrativo de Resultado do Exercício) com CMV calculado.

**Telas Envolvidas:**
- `DRE.tsx` — Visualização de DRE por período

**Dados Utilizados:**
- Vendas (valorTotal, cmvCalculado)
- Lotes (custoTotal)

**Cálculos Realizados:**
```typescript
// DRE = Receita - CMV - Despesas
const receita = await db.select({ total: sql`SUM(valorTotal)` })
  .from(vendas)
  .where(and(
    gte(vendas.dataVenda, dataInicio),
    lte(vendas.dataVenda, dataFim)
  ));

const cmv = await db.select({ total: sql`SUM(cmvCalculado)` })
  .from(vendas)
  .where(and(
    gte(vendas.dataVenda, dataInicio),
    lte(vendas.dataVenda, dataFim),
    eq(vendas.statusCmv, "calculado")
  ));

const lucroBruto = receita.total - cmv.total;
const margemBruta = (lucroBruto / receita.total) * 100;
```

**Regras de Validação:**
- Apenas vendas com statusCmv = "calculado"
- Exclui vendas com statusCmv = "erro"
- Período deve ser completo (mês inteiro)

**Dependências:**
- Módulo de Vendas (leitura)
- Módulo de CMV (leitura)

---

### Módulo 10: Gestão de Usuários e Permissões

**Finalidade:** Controlar acesso por papel (role) e post (para visualização).

**Telas Envolvidas:**
- `Usuarios.tsx` — Listagem e criação de usuários

**Dados Utilizados:**
- users (role, postoId)

**Cálculos Realizados:**
```typescript
// Verificação de permissão
function podeAcessarPosto(user: User, postoId: number): boolean {
  if (user.role === "admin_geral") return true; // Acesso total
  if (user.role === "visualizacao" && user.postoId === postoId) return true; // Acesso ao seu posto
  return false;
}

function podeDesbloquearDre(user: User): boolean {
  return user.role === "admin_geral"; // Apenas admin
}
```

**Regras de Validação:**
- user: Acesso ao seu posto apenas
- admin_geral: Acesso total
- visualizacao: Acesso somente leitura ao seu posto

**Dependências:**
- Autenticação Manus OAuth

---

## 5️⃣ Fluxos Automatizados

### Fluxo 1: Sincronização Automática (A cada 60 minutos)

**Processo:**
1. Servidor inicia auto-sync em `server/_core/index.ts`
2. Busca NFes do ACS via `sync-nfes-acs.ts`
3. Busca vendas do ACS via `etl-acs.ts`
4. Busca medições do ACS via `etl-acs.ts`
5. Importa como lotes provisórios, vendas pendentes, medições
6. Registra resultado em `syncLogs`
7. Gera alertas se houver problemas

**Código:**
```typescript
// server/_core/index.ts
setInterval(async () => {
  try {
    await sincronizarNfes();
    await sincronizarVendas();
    await sincronizarMedicoes();
  } catch (err) {
    console.error("Auto-sync error:", err);
  }
}, 60 * 60 * 1000); // 60 minutos
```

---

### Fluxo 2: Verificação de Coerência Física (Sob demanda ou agendado)

**Processo:**
1. Usuário clica em "Verificar Coerência" ou sistema roda automaticamente
2. Para cada posto, cada tanque:
   - Busca medições do período
   - Calcula estoque projetado (medição + compras - vendas)
   - Compara com medição do dia seguinte
   - Se diferença > 300L, gera alerta
3. Salva resultado em `verificacaoCoerencia`
4. Exibe na página de Coerência Física

**Código:**
```typescript
// server/services/coerencia-fisica.ts
export async function verificarCoerenciaFisicaTodosPostos(
  dataInicio: string,
  dataFim: string,
  tolerancia: number = 300
): Promise<ResultadoVerificacao[]> {
  const db = await getDb();
  const postos = await db.select().from(postos).where(eq(postos.ativo, 1));
  
  const resultados: ResultadoVerificacao[] = [];
  for (const posto of postos) {
    const resultado = await verificarCoerenciaFisicaPosto(
      posto.id,
      dataInicio,
      dataFim,
      tolerancia
    );
    resultados.push(resultado);
  }
  
  return resultados;
}
```

---

### Fluxo 3: Motor de Sugestão (Sob demanda)

**Processo:**
1. Usuário acessa "Pendências de Estoque"
2. Sistema busca alertas de coerência (tipo = "coerencia_fisica")
3. Cruza alertas complementares (sobra + falta)
4. Para cada par, busca NFe provisória candidata
5. Calcula volume sugerido (múltiplo de 1000L)
6. Exibe sugestões com confiança (alta/media/baixa)
7. Usuário clica "Resolver" para executar transferência

**Código:**
```typescript
// server/services/motor-sugestao.ts
export async function buscarPendenciasEstoque(
  dataInicio: string,
  dataFim: string
): Promise<PendenciaEstoque[]> {
  const db = await getDb();
  
  // Buscar alertas
  const alertas = await db.select()
    .from(verificacaoCoerencia)
    .where(and(
      eq(verificacaoCoerencia.statusCoerencia, "alerta"),
      gte(verificacaoCoerencia.dataVerificacao, new Date(dataInicio)),
      lte(verificacaoCoerencia.dataVerificacao, new Date(dataFim))
    ));
  
  // Gerar sugestões
  const sugestoes = await gerarSugestoes(db, alertas);
  
  return sugestoes;
}
```

---

### Fluxo 4: Recálculo de CMV (Sob demanda ou após transferência)

**Processo:**
1. Usuário clica em "Recalcular CMV" ou sistema roda após transferência
2. Para cada venda do período:
   - Busca lotes disponíveis na data (ordem PEPS)
   - Aloca quantidade da venda ao lote mais antigo
   - Registra consumo em `consumoLotes`
   - Calcula CMV = quantidade consumida × custo unitário
3. Atualiza venda com CMV e statusCmv = "calculado"
4. Se lotes insuficientes, marca statusCmv = "erro"

**Código:**
```typescript
// server/db.ts
export async function recalcularCMV(postoId: number, dataInicio: Date) {
  const db = await getDb();
  
  // Buscar vendas do período
  const vendas = await db.select()
    .from(vendas)
    .where(and(
      eq(vendas.postoId, postoId),
      gte(vendas.dataVenda, dataInicio)
    ));
  
  for (const venda of vendas) {
    // Buscar lotes em ordem PEPS
    const lotes = await db.select()
      .from(lotes)
      .where(and(
        eq(lotes.postoId, postoId),
        eq(lotes.tanqueId, venda.tanqueId),
        lte(lotes.dataEntrada, venda.dataVenda),
        eq(lotes.status, "ativo")
      ))
      .orderBy(asc(lotes.dataEntrada));
    
    // Consumir quantidade
    let quantidadeRestante = venda.quantidade;
    let cmvTotal = 0;
    
    for (const lote of lotes) {
      const quantidadeConsumida = Math.min(quantidadeRestante, lote.quantidadeDisponivel);
      const custoConsumido = quantidadeConsumida * lote.custoUnitario;
      
      // Registrar consumo
      await db.insert(consumoLotes).values({
        vendaId: venda.id,
        loteId: lote.id,
        quantidadeConsumida,
        custoUnitario: lote.custoUnitario,
        custoTotal: custoConsumido
      });
      
      cmvTotal += custoConsumido;
      quantidadeRestante -= quantidadeConsumida;
      
      if (quantidadeRestante === 0) break;
    }
    
    // Atualizar venda
    await db.update(vendas)
      .set({
        cmvCalculado: cmvTotal,
        cmvUnitario: cmvTotal / venda.quantidade,
        statusCmv: quantidadeRestante > 0 ? "erro" : "calculado"
      })
      .where(eq(vendas.id, venda.id));
  }
}
```

---

### Fluxo 5: Bloqueio Mensal (Sob demanda - admin)

**Processo:**
1. Admin acessa "Bloqueio DRE"
2. Seleciona mês e posto
3. Clica "Fechar Mês"
4. Sistema insere registro em `bloqueioDre` com status = "fechado"
5. A partir daí, nenhuma transferência ou recálculo pode ser feito naquele mês/posto
6. Apenas admin pode desbloquear clicando "Desbloquear"

**Código:**
```typescript
// server/routers/coerencia-transferencias.ts
fecharMes: adminOnlyProcedure
  .input(z.object({
    postoId: z.number(),
    mesReferencia: z.string(), // "2026-02"
    observacoes: z.string().optional()
  }))
  .mutation(async ({ input, ctx }) => {
    const db = await getDb();
    
    await db.insert(bloqueioDre).values({
      mesReferencia: input.mesReferencia,
      postoId: input.postoId,
      status: "fechado",
      fechadoPor: ctx.user.id,
      fechadoNome: ctx.user.name,
      fechadoEm: new Date(),
      observacoes: input.observacoes
    });
    
    return { sucesso: true, mensagem: "Mês fechado com sucesso" };
  })
```

---

## 6️⃣ Sistema de Permissões e Usuários

### Tipos de Usuários

| Tipo | Descrição | Acesso |
|------|-----------|--------|
| **admin_geral** | Administrador do sistema | Todos os postos, todas as operações, pode desbloquear DRE |
| **user** | Gerente de posto | Seu posto apenas, pode alocar NFes, resolver pendências |
| **visualizacao** | Consultor | Seu posto apenas, somente leitura |

### Níveis de Acesso

| Operação | admin_geral | user | visualizacao |
|----------|-------------|------|--------------|
| Ver Dashboard | ✅ | ✅ (seu posto) | ✅ (seu posto) |
| Ver Estoque | ✅ | ✅ (seu posto) | ✅ (seu posto) |
| Fazer Transferência | ✅ | ✅ (seu posto) | ❌ |
| Recalcular CMV | ✅ | ❌ | ❌ |
| Fechar Mês | ✅ | ❌ | ❌ |
| Desbloquear Mês | ✅ | ❌ | ❌ |
| Criar Usuário | ✅ | ❌ | ❌ |
| Sincronização Manual | ✅ | ❌ | ❌ |

### Regras de Autorização

```typescript
// server/_core/context.ts
export async function createContext(opts: {
  req: Request;
  res: Response;
}): Promise<TrpcContext> {
  const user = await verifyAuth(opts.req);
  
  return {
    user,
    req: opts.req,
    res: opts.res
  };
}

// server/_core/trpc.ts
export const protectedProcedure = baseProcedure
  .use(({ ctx, next }) => {
    if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED" });
    return next({ ctx });
  });

export const adminOnlyProcedure = protectedProcedure
  .use(({ ctx, next }) => {
    if (ctx.user.role !== "admin_geral") {
      throw new TRPCError({ code: "FORBIDDEN" });
    }
    return next({ ctx });
  });

// Verificação de acesso a posto específico
export function verificarAcessoPosto(user: User, postoId: number): boolean {
  if (user.role === "admin_geral") return true;
  if (user.role === "user" || user.role === "visualizacao") {
    return user.postoId === postoId;
  }
  return false;
}
```

---

## 7️⃣ Pontos Críticos do Sistema

### Limitações Atuais

1. **Sincronização com ACS é apenas leitura** — O sistema não consegue atualizar dados no ACS, apenas importa. Se houver erro na sincronização, precisa ser corrigido manualmente no ACS.

2. **Sem integração com SEFAZ em tempo real** — O sistema não valida NFes contra SEFAZ automaticamente. Validação é manual ou via `sefaz-real.ts` (não implementado).

3. **Sem suporte a múltiplos combustíveis por tanque** — Cada tanque é dedicado a um combustível. Não suporta tanques compartilhados.

4. **Sem suporte a transferências entre redes** — Só funciona dentro da mesma rede de postos. Transferências para terceiros não são rastreadas.

5. **Sem suporte a múltiplas moedas** — Tudo em BRL. Não funciona para operações internacionais.

### Gargalos de Performance

1. **Recálculo de CMV retroativo é lento** — Para 90 dias com 1000+ vendas, pode levar 30+ segundos. Solução: paginação em chunks de 7 dias.

2. **Verificação de coerência para todos os postos é lenta** — Para 6 postos × 17 tanques × 90 dias = 9.180 verificações. Solução: paralelização ou cache.

3. **Sincronização com ACS pode travar** — Se ACS ficar lento, auto-sync fica bloqueado. Solução: timeout e retry com backoff exponencial.

4. **Índices no banco não otimizados** — Queries de data/hora podem ser lentas sem índices. Solução: adicionar índices em `dataVenda`, `dataEntrada`, `dataMedicao`.

### Possíveis Riscos de Erro

1. **Divisão por zero em cálculos de margem** — Se receita = 0, margemBruta = undefined. Solução: validar antes.

2. **Estoque negativo se lotes forem cancelados** — Se um lote é cancelado mas já foi consumido, saldo fica negativo. Solução: impedir cancelamento de lotes consumidos.

3. **CMV incorreto se vendas forem deletadas** — Se uma venda é deletada, consumoLotes fica órfão. Solução: soft delete de vendas, não delete físico.

4. **Coerência incorreta se medição for deletada** — Se medição do dia N é deletada, verificação do dia N+1 fica inválida. Solução: revalidar coerência após deletar medição.

5. **Transferência incompleta se servidor cair** — Se servidor cai no meio de uma transferência, lote fica em estado inconsistente. Solução: usar transações ACID.

### Partes Mais Complexas do Código

1. **Motor de Sugestão** (`server/services/motor-sugestao.ts`) — Cruza múltiplos alertas, busca NFes candidatas, calcula confiança. Complexidade: O(n²) onde n = número de alertas.

2. **Recálculo de CMV** (`server/db.ts`) — Implementa PEPS/FIFO com rastreamento de consumo. Complexidade: O(n × m) onde n = vendas, m = lotes.

3. **Verificação de Coerência** (`server/services/coerencia-fisica.ts`) — Calcula estoque projetado em ordem cronológica, revalida dias posteriores se dia anterior for corrigido. Complexidade: O(n) onde n = dias.

4. **Sincronização Idempotente** (`server/services/sync-nfes-acs.ts`) — Precisa verificar duplicatas sem bloquear. Usa chaveNfe como chave única.

---

## 8️⃣ Como Fazer Alterações no Sistema

### Como Adicionar um Novo Módulo

**Passo 1: Definir tabelas no schema**
```typescript
// drizzle/schema.ts
export const novoModulo = mysqlTable("novoModulo", {
  id: int("id").autoincrement().primaryKey(),
  // ... campos
});
```

**Passo 2: Executar migração**
```bash
pnpm db:push
```

**Passo 3: Criar serviço**
```typescript
// server/services/novo-modulo.ts
export async function operacaoNovoModulo() {
  const db = await getDb();
  // ... lógica
}
```

**Passo 4: Criar router**
```typescript
// server/routers/novo-modulo.ts
export const novoModuloRouter = router({
  listar: protectedProcedure.query(async () => {
    // ... implementação
  })
});
```

**Passo 5: Agregar router**
```typescript
// server/routers.ts
export const appRouter = router({
  // ... outros routers
  novoModulo: novoModuloRouter
});
```

**Passo 6: Criar página frontend**
```typescript
// client/src/pages/NovoModulo.tsx
export default function NovoModulo() {
  const { data } = trpc.novoModulo.listar.useQuery();
  // ... JSX
}
```

**Passo 7: Adicionar rota**
```typescript
// client/src/App.tsx
<Route path="/novo-modulo" component={NovoModulo} />
```

**Passo 8: Adicionar menu**
```typescript
// client/src/components/DashboardLayout.tsx
{ label: "Novo Módulo", href: "/novo-modulo", icon: IconComponent }
```

---

### Como Alterar Regras de Cálculo

**Exemplo: Alterar tolerância de coerência de 300L para 500L**

1. Localizar constante em `server/services/coerencia-fisica.ts`:
```typescript
const TOLERANCIA_LITROS = 500; // Era 300
```

2. Atualizar defaults em `server/routers/coerencia-transferencias.ts`:
```typescript
tolerancia: z.number().optional().default(500),
```

3. Atualizar frontend em `client/src/pages/CoerenciaFisica.tsx`:
```typescript
d.diferenca !== null && Math.abs(d.diferenca) > 500 ? "text-red-600" :
```

4. Atualizar testes:
```typescript
// server/coerencia-transferencias.test.ts
tolerancia: 500,
```

5. Testar e fazer checkpoint:
```bash
pnpm test
pnpm db:push
```

---

### Como Alterar Banco de Dados

**Exemplo: Adicionar campo de observação em lotes**

1. Editar schema:
```typescript
// drizzle/schema.ts
export const lotes = mysqlTable("lotes", {
  // ... campos existentes
  observacoes: text("observacoes"), // Novo campo
});
```

2. Executar migração:
```bash
pnpm db:push
```

3. Atualizar código que usa lotes:
```typescript
// server/db.ts
const lote = await db.select().from(lotes).where(...);
console.log(lote.observacoes); // Novo campo disponível
```

4. Atualizar testes se necessário.

---

### Como Fazer Deploy

**Passo 1: Criar checkpoint**
```bash
# No Management UI, clique em "Publish"
# Ou via CLI (se disponível)
```

**Passo 2: Verificar build**
```bash
pnpm build
```

**Passo 3: Testar em staging**
```bash
pnpm test
```

**Passo 4: Publicar**
- Clique em "Publish" no Management UI
- Sistema faz deploy automático

**Passo 5: Verificar em produção**
- Acesse `https://pepsrede-gsoityr3.manus.space`
- Teste fluxos críticos

---

## 9️⃣ Código Importante (Resumido)

### Autenticação

**Arquivo:** `server/_core/oauth.ts`

```typescript
// Verifica JWT da sessão
export async function verifyAuth(req: Request): Promise<User | null> {
  const token = getCookie(req, "session");
  if (!token) return null;

  try {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET!);
    const verified = await jwtVerify(token, secret);
    return verified.payload as User;
  } catch (err) {
    return null;
  }
}

// Redireciona para Manus OAuth
export function getLoginUrl(returnPath?: string): string {
  const state = encodeState({
    origin: window.location.origin,
    returnPath: returnPath || "/"
  });
  return `${process.env.VITE_OAUTH_PORTAL_URL}?state=${state}`;
}
```

---

### Leitura de Dados

**Arquivo:** `server/db.ts`

```typescript
// Buscar lotes de um tanque
export async function getLotesAtivos(postoId: number, tanqueId: number) {
  const db = await getDb();
  return await db.select()
    .from(lotes)
    .where(and(
      eq(lotes.postoId, postoId),
      eq(lotes.tanqueId, tanqueId),
      eq(lotes.status, "ativo")
    ))
    .orderBy(asc(lotes.dataEntrada)); // PEPS
}

// Buscar vendas de um período
export async function getVendasPeriodo(postoId: number, dataInicio: Date, dataFim: Date) {
  const db = await getDb();
  return await db.select()
    .from(vendas)
    .where(and(
      eq(vendas.postoId, postoId),
      gte(vendas.dataVenda, dataInicio),
      lte(vendas.dataVenda, dataFim)
    ))
    .orderBy(asc(vendas.dataVenda));
}
```

---

### Cálculos Principais

**Arquivo:** `server/services/coerencia-fisica.ts`

```typescript
// Calcular estoque projetado
const estoqueProjetado = medicaoInicial + comprasDia - vendasDia;

// Comparar com medição real
const diferenca = estoqueProjetado - medicaoDiaSeguinte;

// Gerar alerta se necessário
if (Math.abs(diferenca) > TOLERANCIA_LITROS) {
  statusCoerencia = "alerta";
}
```

---

### Integração com Banco

**Arquivo:** `server/db.ts`

```typescript
// Conexão com MySQL
export async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return drizzle(process.env.DATABASE_URL);
}

// Transação (para operações críticas)
export async function transferirLote(origem: number, destino: number, volume: number) {
  const db = await getDb();
  
  return await db.transaction(async (tx) => {
    // Reduzir lote de origem
    await tx.update(lotes)
      .set({ quantidadeDisponivel: sql`quantidadeDisponivel - ${volume}` })
      .where(eq(lotes.id, origem));

    // Criar novo lote no destino
    const novoLote = await tx.insert(lotes).values({
      // ... dados
    });

    // Se alguma operação falhar, tudo é revertido
    return novoLote;
  });
}
```

---

## 🔟 Sugestões do Próprio Manus

### Melhorias Técnicas Recomendadas

#### 1. **Otimização de Performance**

- **Adicionar índices no banco:**
  ```sql
  CREATE INDEX idx_vendas_data ON vendas(dataVenda);
  CREATE INDEX idx_lotes_data ON lotes(dataEntrada);
  CREATE INDEX idx_medicoes_data ON medicoes(dataMedicao);
  CREATE INDEX idx_verificacao_data ON verificacaoCoerencia(dataVerificacao);
  ```

- **Implementar paginação em recálculo de CMV:**
  ```typescript
  // Recalcular em chunks de 7 dias, não 90 dias de uma vez
  for (let i = 0; i < 90; i += 7) {
    await recalcularCMVChunk(postoId, dataInicio + i, dataInicio + i + 7);
  }
  ```

- **Cachear verificações de coerência:**
  ```typescript
  // Cache em memória por 1 hora
  const cache = new Map();
  const cacheKey = `coerencia-${postoId}-${tanqueId}-${data}`;
  if (cache.has(cacheKey)) return cache.get(cacheKey);
  ```

#### 2. **Escalabilidade**

- **Separar read replicas** — Queries de leitura (Dashboard, Relatórios) podem ir para réplica, escrevendo na master.

- **Implementar message queue** — Auto-sync e recálculos podem ficar em fila (Redis/RabbitMQ) para não bloquear requisições.

- **Sharding por posto** — Se crescer muito, dados de cada posto podem ficar em banco separado.

#### 3. **Confiabilidade**

- **Implementar circuit breaker** — Se ACS ficar indisponível, auto-sync falha gracefully sem travar.

- **Retry com backoff exponencial** — Sincronizações falhadas tentam novamente com delay crescente.

- **Alertas de saúde** — Notificar admin se auto-sync não rodar por 2+ horas.

#### 4. **Segurança**

- **Rate limiting** — Limitar requisições por usuário para evitar abuse.

- **Auditoria completa** — Já existe em `historicoAlteracoes`, mas adicionar logs de acesso (quem viu o quê).

- **Criptografia de dados sensíveis** — CNPJ, endereço podem ser criptografados em repouso.

- **Validação de entrada** — Usar Zod em todos os endpoints (já está parcialmente implementado).

#### 5. **Observabilidade**

- **Logging estruturado** — Usar Winston/Pino em vez de console.log.

- **Tracing distribuído** — Rastrear requisição desde frontend até banco.

- **Métricas** — Prometheus para monitorar latência, erros, throughput.

- **Alertas** — PagerDuty/Slack para alertas críticos.

#### 6. **Qualidade de Código**

- **Aumentar cobertura de testes** — Atualmente ~60%, objetivo 80%+.

- **Implementar E2E tests** — Testar fluxos completos (sincronização → coerência → transferência).

- **Code review** — Implementar PR review antes de merge.

- **Linting** — ESLint + Prettier já configurados, adicionar pre-commit hooks.

#### 7. **Documentação**

- **API docs** — Gerar OpenAPI/Swagger automaticamente do tRPC.

- **Runbooks** — Guias de operação (como resolver erro X, como escalar Y).

- **Diagramas** — Arquitetura, fluxos de dados, modelo ER.

#### 8. **UX/UI**

- **Dark mode** — Já tem suporte via next-themes, apenas ativar.

- **Responsividade mobile** — Testar em celular, adicionar breakpoints se necessário.

- **Acessibilidade** — WCAG 2.1 AA (shadcn/ui já ajuda, mas validar).

- **Notificações em tempo real** — WebSocket para alertas instantâneos.

#### 9. **Integrações**

- **Integração com SEFAZ** — Validar NFes automaticamente.

- **Integração com ERP** — Sincronizar dados com SAP/Oracle.

- **Integração com WhatsApp** — Alertas via WhatsApp para gerentes.

- **Integração com Slack** — Notificações de alertas críticos.

#### 10. **Funcionalidades Futuras**

- **Previsão de estoque** — ML para prever quando vai faltar combustível.

- **Otimização de rotas** — Sugerir melhor rota para transferências.

- **Análise de margem** — Comparar margem por combustível, por período.

- **Simulador de cenários** — "E se" aumentar preço do combustível?

---

## Conclusão

O **PEPS - Rede Guerra de Postos** é um sistema robusto de gestão de estoque e CMV para redes de combustível. Implementa PEPS/FIFO, detecção automática de inconsistências, sugestões inteligentes de correção e rastreabilidade completa. O código é type-safe (TypeScript), testado (Vitest), e pronto para produção (Manus hosting).

As recomendações acima focam em escalabilidade, confiabilidade e observabilidade para suportar crescimento futuro. Priorize as otimizações de performance (índices, paginação, cache) e confiabilidade (circuit breaker, retry) primeiro.

---

**Documento gerado por Manus AI em 27/02/2026**  
**Versão:** 1.0.0  
**Status:** Produção
