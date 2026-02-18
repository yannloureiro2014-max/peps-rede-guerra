import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, decimal, date, datetime, uniqueIndex, index } from "drizzle-orm/mysql-core";

// Tabela de usuários (autenticação)
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin_geral", "visualizacao"]).default("user").notNull(),
  postoId: int("postoId"), // FK para postos - permite vincular usuário visualização a posto específico
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// Tabela de Postos
export const postos = mysqlTable("postos", {
  id: int("id").autoincrement().primaryKey(),
  codigoAcs: varchar("codigoAcs", { length: 10 }).notNull().unique(),
  nome: varchar("nome", { length: 200 }).notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  endereco: text("endereco"),
  ativo: int("ativo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Posto = typeof postos.$inferSelect;
export type InsertPosto = typeof postos.$inferInsert;

// Tabela de Produtos (Combustíveis)
export const produtos = mysqlTable("produtos", {
  id: int("id").autoincrement().primaryKey(),
  codigoAcs: varchar("codigoAcs", { length: 20 }).notNull().unique(),
  descricao: varchar("descricao", { length: 200 }).notNull(),
  tipo: varchar("tipo", { length: 10 }).default("C").notNull(),
  ativo: int("ativo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Produto = typeof produtos.$inferSelect;
export type InsertProduto = typeof produtos.$inferInsert;

// Tabela de Fornecedores
export const fornecedores = mysqlTable("fornecedores", {
  id: int("id").autoincrement().primaryKey(),
  codigoAcs: varchar("codigoAcs", { length: 20 }).unique(),
  nome: varchar("nome", { length: 200 }).notNull(),
  cnpj: varchar("cnpj", { length: 20 }),
  ativo: int("ativo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Fornecedor = typeof fornecedores.$inferSelect;
export type InsertFornecedor = typeof fornecedores.$inferInsert;

// Tabela de Tanques
export const tanques = mysqlTable("tanques", {
  id: int("id").autoincrement().primaryKey(),
  postoId: int("postoId").notNull(),
  codigoAcs: varchar("codigoAcs", { length: 10 }).notNull(),
  produtoId: int("produtoId"),
  capacidade: decimal("capacidade", { precision: 12, scale: 3 }).default("0").notNull(),
  estoqueMinimo: decimal("estoqueMinimo", { precision: 12, scale: 3 }).default("1000").notNull(),
  saldoAtual: decimal("saldoAtual", { precision: 12, scale: 3 }).default("0").notNull(),
  ativo: int("ativo").default(1).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Tanque = typeof tanques.$inferSelect;
export type InsertTanque = typeof tanques.$inferInsert;

// Tabela de Lotes (Compras - PEPS/FIFO) - Permite edição manual
export const lotes = mysqlTable("lotes", {
  id: int("id").autoincrement().primaryKey(),
  codigoAcs: varchar("codigoAcs", { length: 50 }).unique(),
  tanqueId: int("tanqueId").notNull(),
  postoId: int("postoId").notNull(),
  produtoId: int("produtoId"),
  fornecedorId: int("fornecedorId"),
  numeroNf: varchar("numeroNf", { length: 50 }),
  serieNf: varchar("serieNf", { length: 10 }),
  chaveNfe: varchar("chaveNfe", { length: 60 }),
  nomeFornecedor: varchar("nomeFornecedor", { length: 300 }),
  nomeProduto: varchar("nomeProduto", { length: 200 }),
  tipoFrete: varchar("tipoFrete", { length: 10 }),
  custoUnitarioProduto: decimal("custoUnitarioProduto", { precision: 12, scale: 4 }),
  custoUnitarioFrete: decimal("custoUnitarioFrete", { precision: 12, scale: 4 }),
  valorFrete: decimal("valorFrete", { precision: 12, scale: 2 }),
  dataEmissao: date("dataEmissao"),
  dataEntrada: date("dataEntrada").notNull(),
  dataLmc: date("dataLmc"),
  quantidadeOriginal: decimal("quantidadeOriginal", { precision: 12, scale: 3 }).notNull(),
  quantidadeDisponivel: decimal("quantidadeDisponivel", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 12, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  ordemConsumo: int("ordemConsumo").default(0).notNull(),
  status: mysqlEnum("status", ["ativo", "consumido", "cancelado"]).default("ativo").notNull(),
  origem: mysqlEnum("origem", ["acs", "manual"]).default("manual").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Lote = typeof lotes.$inferSelect;
export type InsertLote = typeof lotes.$inferInsert;

// Tabela de Vendas
export const vendas = mysqlTable("vendas", {
  id: int("id").autoincrement().primaryKey(),
  codigoAcs: varchar("codigoAcs", { length: 64 }).unique(),
  postoId: int("postoId").notNull(),
  tanqueId: int("tanqueId"),
  produtoId: int("produtoId"),
  dataVenda: date("dataVenda").notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  valorUnitario: decimal("valorUnitario", { precision: 12, scale: 4 }).notNull(),
  valorTotal: decimal("valorTotal", { precision: 14, scale: 2 }).notNull(),
  cmvCalculado: decimal("cmvCalculado", { precision: 14, scale: 2 }).default("0"),
  cmvUnitario: decimal("cmvUnitario", { precision: 12, scale: 4 }).default("0"),
  statusCmv: mysqlEnum("statusCmv", ["pendente", "calculado", "erro"]).default("pendente").notNull(),
  afericao: int("afericao").default(0).notNull(),
  origem: varchar("origem", { length: 20 }).default("acs").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Venda = typeof vendas.$inferSelect;
export type InsertVenda = typeof vendas.$inferInsert;

// Tabela de Consumo de Lotes (relação N:N entre vendas e lotes para PEPS)
export const consumoLotes = mysqlTable("consumoLotes", {
  id: int("id").autoincrement().primaryKey(),
  vendaId: int("vendaId").notNull(),
  loteId: int("loteId").notNull(),
  quantidadeConsumida: decimal("quantidadeConsumida", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 12, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsumoLote = typeof consumoLotes.$inferSelect;
export type InsertConsumoLote = typeof consumoLotes.$inferInsert;

// Tabela de Medições Físicas - Permite edição manual
export const medicoes = mysqlTable("medicoes", {
  id: int("id").autoincrement().primaryKey(),
  codigoAcs: varchar("codigoAcs", { length: 64 }).unique(),
  tanqueId: int("tanqueId").notNull(),
  postoId: int("postoId").notNull(),
  dataMedicao: date("dataMedicao").notNull(),
  horaMedicao: varchar("horaMedicao", { length: 10 }),
  volumeMedido: decimal("volumeMedido", { precision: 12, scale: 3 }).notNull(),
  temperatura: decimal("temperatura", { precision: 5, scale: 2 }),
  estoqueEscritural: decimal("estoqueEscritural", { precision: 12, scale: 3 }).default("0"),
  diferenca: decimal("diferenca", { precision: 12, scale: 3 }).default("0"),
  percentualDiferenca: decimal("percentualDiferenca", { precision: 8, scale: 4 }).default("0"),
  tipoDiferenca: mysqlEnum("tipoDiferenca", ["sobra", "perda", "ok"]).default("ok"),
  observacoes: text("observacoes"),
  origem: mysqlEnum("origem", ["acs", "manual"]).default("manual").notNull(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Medicao = typeof medicoes.$inferSelect;
export type InsertMedicao = typeof medicoes.$inferInsert;

// Tabela de Alertas
export const alertas = mysqlTable("alertas", {
  id: int("id").autoincrement().primaryKey(),
  tipo: mysqlEnum("tipo", ["estoque_baixo", "diferenca_medicao", "cmv_pendente", "sincronizacao", "medicao_faltante", "lote_antigo", "lotes_insuficientes"]).notNull(),
  postoId: int("postoId"),
  tanqueId: int("tanqueId"),
  titulo: varchar("titulo", { length: 200 }).notNull(),
  mensagem: text("mensagem").notNull(),
  dados: text("dados"),
  status: mysqlEnum("status", ["pendente", "visualizado", "resolvido"]).default("pendente").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  resolvedAt: timestamp("resolvedAt"),
});

export type Alerta = typeof alertas.$inferSelect;
export type InsertAlerta = typeof alertas.$inferInsert;

// Tabela de Histórico de Alterações (Auditoria)
export const historicoAlteracoes = mysqlTable("historicoAlteracoes", {
  id: int("id").autoincrement().primaryKey(),
  tabela: varchar("tabela", { length: 50 }).notNull(),
  registroId: int("registroId").notNull(),
  acao: mysqlEnum("acao", ["insert", "update", "delete"]).notNull(),
  camposAlterados: text("camposAlterados"),
  valoresAntigos: text("valoresAntigos"),
  valoresNovos: text("valoresNovos"),
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 200 }),
  justificativa: text("justificativa"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type HistoricoAlteracao = typeof historicoAlteracoes.$inferSelect;
export type InsertHistoricoAlteracao = typeof historicoAlteracoes.$inferInsert;

// Tabela de Configurações
export const configuracoes = mysqlTable("configuracoes", {
  id: int("id").autoincrement().primaryKey(),
  chave: varchar("chave", { length: 100 }).notNull().unique(),
  valor: text("valor"),
  tipo: varchar("tipo", { length: 20 }).default("text").notNull(),
  descricao: text("descricao"),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Configuracao = typeof configuracoes.$inferSelect;
export type InsertConfiguracao = typeof configuracoes.$inferInsert;

// Tabela de Log de Sincronização ACS
export const syncLogs = mysqlTable("syncLogs", {
  id: int("id").autoincrement().primaryKey(),
  tipo: varchar("tipo", { length: 50 }).notNull(),
  dataInicio: timestamp("dataInicio").notNull(),
  dataFim: timestamp("dataFim"),
  registrosProcessados: int("registrosProcessados").default(0),
  registrosInseridos: int("registrosInseridos").default(0),
  registrosIgnorados: int("registrosIgnorados").default(0),
  erros: int("erros").default(0),
  status: mysqlEnum("status", ["executando", "sucesso", "erro"]).default("executando").notNull(),
  mensagem: text("mensagem"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SyncLog = typeof syncLogs.$inferSelect;
export type InsertSyncLog = typeof syncLogs.$inferInsert;

// Tabela de Inicialização Mensal de Lotes (controle de saldos iniciais PEPS)
export const inicializacaoMensalLotes = mysqlTable("inicializacaoMensalLotes", {
  id: int("id").autoincrement().primaryKey(),
  mesReferencia: varchar("mesReferencia", { length: 7 }).notNull(), // Formato: YYYY-MM
  postoId: int("postoId").notNull(),
  produtoId: int("produtoId").notNull(),
  dataInicializacao: timestamp("dataInicializacao").notNull(),
  usuarioAdminId: int("usuarioAdminId").notNull(),
  lotesConfigurados: text("lotesConfigurados"), // JSON com array de lotes e saldos
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  // Unique constraint: apenas uma inicialização por mês/posto/produto
  mesPostoProdutoUnique: uniqueIndex("mes_posto_produto_unique").on(
    table.mesReferencia,
    table.postoId,
    table.produtoId
  ),
}));

export type InicializacaoMensalLote = typeof inicializacaoMensalLotes.$inferSelect;
export type InsertInicializacaoMensalLote = typeof inicializacaoMensalLotes.$inferInsert;


// ============================================
// TABELAS PARA FUEL PHYSICAL ALLOCATION ENGINE
// ============================================

// Tabela de NFes em Staging (importadas do ACS)
export const nfeStaging = mysqlTable("nfeStaging", {
  id: int("id").autoincrement().primaryKey(),
  chaveNfe: varchar("chaveNfe", { length: 44 }).notNull().unique(),
  numeroNf: varchar("numeroNf", { length: 20 }).notNull(),
  serieNf: varchar("serieNf", { length: 10 }).notNull(),
  dataEmissao: date("dataEmissao").notNull(),
  cnpjFaturado: varchar("cnpjFaturado", { length: 20 }).notNull(),
  cnpjFornecedor: varchar("cnpjFornecedor", { length: 20 }).notNull(),
  postoFiscalId: int("postoFiscalId"), // FK para postos (onde foi faturado)
  produtoId: int("produtoId"), // FK para produtos
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  statusAlocacao: mysqlEnum("statusAlocacao", ["pendente", "parcialmente_alocado", "totalmente_alocado"]).default("pendente").notNull(),
  quantidadeAlocada: decimal("quantidadeAlocada", { precision: 12, scale: 3 }).default("0").notNull(),
  observacoes: text("observacoes"),
  importadoEm: timestamp("importadoEm").defaultNow().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  chaveNfeIdx: index("chaveNfe_idx").on(table.chaveNfe),
  statusIdx: index("statusAlocacao_idx").on(table.statusAlocacao),
  dataEmissaoIdx: index("dataEmissao_idx").on(table.dataEmissao),
}));

export type NfeStaging = typeof nfeStaging.$inferSelect;
export type InsertNfeStaging = typeof nfeStaging.$inferInsert;

// Tabela de Alocações Físicas (onde cada compra foi descarregada)
export const alocacoesFisicas = mysqlTable("alocacoesFisicas", {
  id: int("id").autoincrement().primaryKey(),
  nfeStagingId: int("nfeStagingId").notNull(),
  postoDestinoId: int("postoDestinoId").notNull(), // FK para postos (onde foi descarregado)
  tanqueDestinoId: int("tanqueDestinoId").notNull(), // FK para tanques
  dataDescargaReal: date("dataDescargaReal").notNull(), // Data REAL de descarga (pode ser diferente da fiscal)
  horaDescargaReal: varchar("horaDescargaReal", { length: 5 }), // HH:MM
  volumeAlocado: decimal("volumeAlocado", { precision: 12, scale: 3 }).notNull(),
  custoUnitarioAplicado: decimal("custoUnitarioAplicado", { precision: 10, scale: 4 }).notNull(),
  custoTotalAlocado: decimal("custoTotalAlocado", { precision: 14, scale: 2 }).notNull(),
  statusAlocacao: mysqlEnum("statusAlocacao", ["confirmada", "cancelada", "reprocessada"]).default("confirmada").notNull(),
  justificativa: text("justificativa"),
  usuarioId: int("usuarioId").notNull(), // FK para users (quem fez a alocação)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  nfeStagingIdx: index("nfeStagingId_idx").on(table.nfeStagingId),
  postoDestinoIdx: index("postoDestinoId_idx").on(table.postoDestinoId),
  dataDescargaIdx: index("dataDescargaReal_idx").on(table.dataDescargaReal),
  statusIdx: index("statusAlocacao_idx").on(table.statusAlocacao),
}));

export type AlocacaoFisica = typeof alocacoesFisicas.$inferSelect;
export type InsertAlocacaoFisica = typeof alocacoesFisicas.$inferInsert;

// Tabela de Lotes Físicos (criados automaticamente após alocação)
export const lotesFisicos = mysqlTable("lotesFisicos", {
  id: int("id").autoincrement().primaryKey(),
  alocacaoFisicaId: int("alocacaoFisicaId").notNull(), // FK para alocacoesFisicas
  postoId: int("postoId").notNull(), // FK para postos
  tanqueId: int("tanqueId").notNull(), // FK para tanques
  produtoId: int("produtoId").notNull(), // FK para produtos
  dataDescargaReal: date("dataDescargaReal").notNull(), // Base para PEPS (não data fiscal)
  volumeTotal: decimal("volumeTotal", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  ordemPEPS: int("ordemPEPS").notNull(), // Ordem de consumo PEPS (1 = primeiro)
  quantidadeDisponivel: decimal("quantidadeDisponivel", { precision: 12, scale: 3 }).notNull(),
  statusLote: mysqlEnum("statusLote", ["ativo", "consumido", "cancelado"]).default("ativo").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  alocacaoIdx: index("alocacaoFisicaId_idx").on(table.alocacaoFisicaId),
  postoTanqueIdx: index("postoId_tanqueId_idx").on(table.postoId, table.tanqueId),
  ordemPEPSIdx: index("ordemPEPS_idx").on(table.ordemPEPS),
  statusIdx: index("statusLote_idx").on(table.statusLote),
}));

export type LoteFisico = typeof lotesFisicos.$inferSelect;
export type InsertLoteFisico = typeof lotesFisicos.$inferInsert;

// Tabela de Reordenação PEPS (histórico de quando PEPS foi reordenado)
export const reordenacaoPEPS = mysqlTable("reordenacaoPEPS", {
  id: int("id").autoincrement().primaryKey(),
  alocacaoFisicaId: int("alocacaoFisicaId").notNull(), // FK para alocacoesFisicas
  postoId: int("postoId").notNull(), // FK para postos
  tanqueId: int("tanqueId").notNull(), // FK para tanques
  dataDescargaNovaAlocacao: date("dataDescargaNovaAlocacao").notNull(), // Data da alocação que causou reordenação
  motivo: varchar("motivo", { length: 200 }).notNull(), // "Alocação retroativa" ou similar
  lotesAfetados: int("lotesAfetados").notNull(), // Quantos lotes foram reordenados
  impactoFinanceiroCMV: decimal("impactoFinanceiroCMV", { precision: 14, scale: 2 }).notNull(), // Diferença de CMV
  percentualImpacto: decimal("percentualImpacto", { precision: 8, scale: 4 }).notNull(), // % de mudança
  usuarioId: int("usuarioId").notNull(), // FK para users (quem causou a reordenação)
  observacoes: text("observacoes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  alocacaoIdx: index("alocacaoFisicaId_idx").on(table.alocacaoFisicaId),
  postoTanqueIdx: index("postoId_tanqueId_idx").on(table.postoId, table.tanqueId),
  dataDescargaIdx: index("dataDescargaNovaAlocacao_idx").on(table.dataDescargaNovaAlocacao),
}));

export type ReordenacaoPEPS = typeof reordenacaoPEPS.$inferSelect;
export type InsertReordenacaoPEPS = typeof reordenacaoPEPS.$inferInsert;

// Tabela de Consumo de Lotes Físicos (rastreamento de qual lote foi consumido em cada venda)
export const consumoLotesFisicos = mysqlTable("consumoLotesFisicos", {
  id: int("id").autoincrement().primaryKey(),
  vendaId: int("vendaId").notNull(), // FK para vendas
  loteFisicoId: int("loteFisicoId").notNull(), // FK para lotesFisicos
  volumeConsumido: decimal("volumeConsumido", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 10, scale: 4 }).notNull(),
  custoTotalConsumido: decimal("custoTotalConsumido", { precision: 14, scale: 2 }).notNull(),
  ordemConsumo: int("ordemConsumo").notNull(), // Ordem em que foi consumido (1 = primeiro)
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  vendaIdx: index("vendaId_idx").on(table.vendaId),
  loteIdx: index("loteFisicoId_idx").on(table.loteFisicoId),
  ordemIdx: index("ordemConsumo_idx").on(table.ordemConsumo),
}));

export type ConsumoLoteFisico = typeof consumoLotesFisicos.$inferSelect;
export type InsertConsumoLoteFisico = typeof consumoLotesFisicos.$inferInsert;

// Tabela de Auditoria do Fuel Engine (log de todas as operações)
export const auditoriaFuelEngine = mysqlTable("auditoriaFuelEngine", {
  id: int("id").autoincrement().primaryKey(),
  operacao: varchar("operacao", { length: 50 }).notNull(), // "criar_alocacao", "reordenar_peps", "recalcular_cmv"
  alocacaoFisicaId: int("alocacaoFisicaId"), // FK para alocacoesFisicas (pode ser null)
  postoId: int("postoId"), // FK para postos
  tanqueId: int("tanqueId"), // FK para tanques
  usuarioId: int("usuarioId").notNull(), // FK para users
  descricao: text("descricao").notNull(),
  dadosAntigos: text("dadosAntigos"), // JSON com dados antes da operação
  dadosNovos: text("dadosNovos"), // JSON com dados depois da operação
  impactoFinanceiro: decimal("impactoFinanceiro", { precision: 14, scale: 2 }), // Impacto em reais
  statusOperacao: mysqlEnum("statusOperacao", ["sucesso", "erro", "cancelada"]).default("sucesso").notNull(),
  mensagemErro: text("mensagemErro"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({
  operacaoIdx: index("operacao_idx").on(table.operacao),
  alocacaoIdx: index("alocacaoFisicaId_idx").on(table.alocacaoFisicaId),
  postoTanqueIdx: index("postoId_tanqueId_idx").on(table.postoId, table.tanqueId),
  usuarioIdx: index("usuarioId_idx").on(table.usuarioId),
}));

export type AuditoriaFuelEngine = typeof auditoriaFuelEngine.$inferSelect;
export type InsertAuditoriaFuelEngine = typeof auditoriaFuelEngine.$inferInsert;
