/**
 * Fuel Physical Allocation Engine - Schema
 * 
 * Separa completamente 3 camadas:
 * 1. Camada Fiscal (imutável) - NFe original
 * 2. Camada Física (nova) - Movimentação real do combustível
 * 3. Camada Financeira (derivada) - CMV recalculado
 */

import { mysqlTable, int, varchar, text, decimal, date, timestamp, mysqlEnum } from "drizzle-orm/mysql-core";

// ==================== CAMADA 1: FISCAL (IMUTÁVEL) ====================

/**
 * Staging de NFes importadas
 * Recebe NFes do ACS sem impactar estoque automaticamente
 */
export const nfeStaging = mysqlTable("nfeStaging", {
  id: int("id").autoincrement().primaryKey(),
  
  // Dados fiscais (imutáveis)
  chaveNfe: varchar("chaveNfe", { length: 44 }).notNull().unique(),
  numeroNf: varchar("numeroNf", { length: 50 }).notNull(),
  serieNf: varchar("serieNf", { length: 10 }).notNull(),
  dataEmissao: date("dataEmissao").notNull(),
  
  // Origem fiscal
  cnpjFaturado: varchar("cnpjFaturado", { length: 20 }).notNull(), // CNPJ que emitiu a NF
  postoFiscalId: int("postoFiscalId").notNull(), // Posto que recebeu a NF fiscalmente
  
  // Produto e quantidade
  produtoId: int("produtoId").notNull(),
  quantidade: decimal("quantidade", { precision: 12, scale: 3 }).notNull(),
  custoUnitario: decimal("custoUnitario", { precision: 12, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  
  // Fornecedor
  fornecedorId: int("fornecedorId"),
  fornecedorNome: varchar("fornecedorNome", { length: 200 }),
  
  // Status de alocação
  statusAlocacao: mysqlEnum("statusAlocacao", [
    "pendente",           // Aguardando alocação
    "parcialmente_alocado", // Parte alocada, parte pendente
    "alocado",            // Totalmente alocado
    "cancelado"           // Cancelada
  ]).default("pendente").notNull(),
  
  quantidadePendente: decimal("quantidadePendente", { precision: 12, scale: 3 }).notNull(),
  quantidadeAlocada: decimal("quantidadeAlocada", { precision: 12, scale: 3 }).default("0").notNull(),
  
  // Rastreabilidade
  usuarioImportacaoId: int("usuarioImportacaoId"),
  usuarioImportacaoNome: varchar("usuarioImportacaoNome", { length: 200 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type NfeStaging = typeof nfeStaging.$inferSelect;
export type InsertNfeStaging = typeof nfeStaging.$inferInsert;

// ==================== CAMADA 2: FÍSICA (PRINCIPAL) ====================

/**
 * Alocações Físicas Manuais
 * Usuário define para onde o combustível foi fisicamente descarregado
 */
export const alocacoesFisicas = mysqlTable("alocacoesFisicas", {
  id: int("id").autoincrement().primaryKey(),
  
  // Referência à NFe original
  nfeStagingId: int("nfeStagingId").notNull(),
  chaveNfe: varchar("chaveNfe", { length: 44 }).notNull(),
  
  // Destino físico real
  postoDestinoId: int("postoDestinoId").notNull(), // Posto onde foi descarregado
  tanqueDestinoId: int("tanqueDestinoId").notNull(), // Tanque onde foi descarregado
  
  // Descarga real
  dataDescargaReal: date("dataDescargaReal").notNull(), // Data real da descarga (pode ser diferente da fiscal)
  horaDescargaReal: varchar("horaDescargaReal", { length: 5 }), // HH:MM
  
  // Volume alocado
  volumeAlocado: decimal("volumeAlocado", { precision: 12, scale: 3 }).notNull(),
  
  // Custo unitário aplicado ao lote
  custoUnitarioAplicado: decimal("custoUnitarioAplicado", { precision: 12, scale: 4 }).notNull(),
  
  // Justificativa operacional
  justificativa: text("justificativa"),
  
  // Status
  status: mysqlEnum("status", [
    "pendente",      // Aguardando confirmação
    "confirmado",    // Alocação confirmada
    "cancelado"      // Cancelada
  ]).default("pendente").notNull(),
  
  // Rastreabilidade
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 200 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlocacaoFisica = typeof alocacoesFisicas.$inferSelect;
export type InsertAlocacaoFisica = typeof alocacoesFisicas.$inferInsert;

/**
 * Lotes Físicos
 * Cada descarga gera um lote independente baseado na data real de descarga
 * PEPS é calculado pela data_descarga_real, nunca pela data fiscal
 */
export const lotesFisicos = mysqlTable("lotesFisicos", {
  id: int("id").autoincrement().primaryKey(),
  
  // Origem fiscal (referência)
  nfeStagingId: int("nfeStagingId").notNull(),
  chaveNfe: varchar("chaveNfe", { length: 44 }).notNull(),
  
  // Destino físico
  postoDestinoId: int("postoDestinoId").notNull(),
  tanqueDestinoId: int("tanqueDestinoId").notNull(),
  produtoId: int("produtoId").notNull(),
  
  // Data de descarga real (CRÍTICA para PEPS)
  dataDescargaReal: date("dataDescargaReal").notNull(), // Base para PEPS
  horaDescargaReal: varchar("horaDescargaReal", { length: 5 }),
  
  // Volumes
  volumeOriginal: decimal("volumeOriginal", { precision: 12, scale: 3 }).notNull(),
  volumeDisponivel: decimal("volumeDisponivel", { precision: 12, scale: 3 }).notNull(),
  volumeConsumido: decimal("volumeConsumido", { precision: 12, scale: 3 }).default("0").notNull(),
  
  // Custo
  custoUnitario: decimal("custoUnitario", { precision: 12, scale: 4 }).notNull(),
  custoTotal: decimal("custoTotal", { precision: 14, scale: 2 }).notNull(),
  
  // Ordem PEPS (crítica)
  ordemPeps: int("ordemPeps").notNull(), // Ordem de consumo baseada em dataDescargaReal
  
  // Status
  statusLote: mysqlEnum("statusLote", [
    "ativo",       // Disponível para consumo
    "consumido",   // Totalmente consumido
    "ajustado",    // Ajustado manualmente
    "cancelado"    // Cancelado
  ]).default("ativo").notNull(),
  
  // Rastreabilidade
  usuarioAlocacaoId: int("usuarioAlocacaoId"),
  usuarioAlocacaoNome: varchar("usuarioAlocacaoNome", { length: 200 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type LoteFisico = typeof lotesFisicos.$inferSelect;
export type InsertLoteFisico = typeof lotesFisicos.$inferInsert;

/**
 * Reordenação PEPS
 * Registra quando a ordem de consumo foi alterada (NFe alocada retroativamente)
 */
export const reordenacaoPEPS = mysqlTable("reordenacaoPEPS", {
  id: int("id").autoincrement().primaryKey(),
  
  // Lote afetado
  loteFisicoId: int("loteFisicoId").notNull(),
  
  // Ordem antes e depois
  ordemAnterior: int("ordemAnterior").notNull(),
  ordemNova: int("ordemNova").notNull(),
  
  // Motivo
  motivo: text("motivo"),
  
  // Impacto estimado
  impactoFinanceiroEstimado: decimal("impactoFinanceiroEstimado", { precision: 14, scale: 2 }),
  
  // Rastreabilidade
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 200 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ReordenacaoPEPS = typeof reordenacaoPEPS.$inferSelect;
export type InsertReordenacaoPEPS = typeof reordenacaoPEPS.$inferInsert;

// ==================== CAMADA 3: FINANCEIRA (DERIVADA) ====================

/**
 * Snapshot de CMV
 * Registra CMV antes e depois de recalculos para auditoria
 */
export const snapshotCMV = mysqlTable("snapshotCMV", {
  id: int("id").autoincrement().primaryKey(),
  
  // Venda afetada
  vendaId: int("vendaId").notNull(),
  
  // CMV antes e depois
  cmvAnterior: decimal("cmvAnterior", { precision: 14, scale: 2 }),
  cmvNovo: decimal("cmvNovo", { precision: 14, scale: 2 }).notNull(),
  
  // Diferença
  diferenca: decimal("diferenca", { precision: 14, scale: 2 }),
  percentualDiferenca: decimal("percentualDiferenca", { precision: 5, scale: 2 }),
  
  // Lotes consumidos
  lotesConsumidos: text("lotesConsumidos"), // JSON array de {loteFisicoId, volumeConsumido}
  
  // Motivo do recalculo
  motivoRecalculo: mysqlEnum("motivoRecalculo", [
    "reordenacao_peps",
    "alocacao_retroativa",
    "ajuste_manual",
    "correcao_estoque",
    "outro"
  ]).notNull(),
  
  // Tempo de processamento
  tempoProcessamentoMs: int("tempoProcessamentoMs"),
  
  // Rastreabilidade
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 200 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SnapshotCMV = typeof snapshotCMV.$inferSelect;
export type InsertSnapshotCMV = typeof snapshotCMV.$inferInsert;

/**
 * Consumo de Lotes Físicos
 * Rastreia qual lote físico foi consumido em cada venda
 */
export const consumoLotesFisicos = mysqlTable("consumoLotesFisicos", {
  id: int("id").autoincrement().primaryKey(),
  
  // Venda
  vendaId: int("vendaId").notNull(),
  
  // Lote físico consumido
  loteFisicoId: int("loteFisicoId").notNull(),
  
  // Volume consumido deste lote
  volumeConsumido: decimal("volumeConsumido", { precision: 12, scale: 3 }).notNull(),
  
  // Custo aplicado
  custoUnitarioAplicado: decimal("custoUnitarioAplicado", { precision: 12, scale: 4 }).notNull(),
  custoTotalAplicado: decimal("custoTotalAplicado", { precision: 14, scale: 2 }).notNull(),
  
  // Sequência de consumo
  sequenciaConsumo: int("sequenciaConsumo").notNull(),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ConsumoLoteFisico = typeof consumoLotesFisicos.$inferSelect;
export type InsertConsumoLoteFisico = typeof consumoLotesFisicos.$inferInsert;

/**
 * Auditoria de Fuel Engine
 * Registra todas as operações críticas do módulo
 */
export const auditoriaFuelEngine = mysqlTable("auditoriaFuelEngine", {
  id: int("id").autoincrement().primaryKey(),
  
  // Operação
  operacao: mysqlEnum("operacao", [
    "importar_nfe",
    "alocar_fisicamente",
    "criar_lote_fisico",
    "reordenar_peps",
    "recalcular_cmv",
    "ajustar_lote",
    "cancelar_alocacao"
  ]).notNull(),
  
  // Entidades afetadas
  nfeStagingId: int("nfeStagingId"),
  alocacaoFisicaId: int("alocacaoFisicaId"),
  loteFisicoId: int("loteFisicoId"),
  vendaId: int("vendaId"),
  
  // Dados antes e depois
  dadosAntes: text("dadosAntes"), // JSON
  dadosDepois: text("dadosDepois"), // JSON
  
  // Impacto financeiro
  cmvAnterior: decimal("cmvAnterior", { precision: 14, scale: 2 }),
  cmvNovo: decimal("cmvNovo", { precision: 14, scale: 2 }),
  
  // Vendas recalculadas
  vendasRecalculadas: int("vendasRecalculadas"),
  
  // Tempo de processamento
  tempoProcessamentoMs: int("tempoProcessamentoMs"),
  
  // Justificativa
  justificativa: text("justificativa"),
  
  // Rastreabilidade
  usuarioId: int("usuarioId"),
  usuarioNome: varchar("usuarioNome", { length: 200 }),
  ipAddress: varchar("ipAddress", { length: 45 }),
  
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditoriaFuelEngine = typeof auditoriaFuelEngine.$inferSelect;
export type InsertAuditoriaFuelEngine = typeof auditoriaFuelEngine.$inferInsert;
