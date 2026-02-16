/**
 * Fuel Physical Allocation Engine - Funções de Banco de Dados
 * 
 * Implementa lógica de:
 * - Staging de NFes
 * - Alocação física manual
 * - Geração de lotes físicos
 * - Reordenação PEPS
 * - Recalculo de CMV
 */

import { getDb } from "./db";
import {
  nfeStaging,
  alocacoesFisicas,
  lotesFisicos,
  reordenacaoPEPS,
  snapshotCMV,
  consumoLotesFisicos,
  auditoriaFuelEngine,
} from "../drizzle/fuel-engine-schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

// ==================== STAGING DE NFes ====================

/**
 * Importa NFe para staging (não impacta estoque)
 */
export async function importarNfeStaging(dados: {
  chaveNfe: string;
  numeroNf: string;
  serieNf: string;
  dataEmissao: Date;
  cnpjFaturado: string;
  postoFiscalId: number;
  produtoId: number;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  fornecedorId?: number;
  fornecedorNome?: string;
  usuarioId?: number;
  usuarioNome?: string;
}): Promise<{ id: number; statusAlocacao: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Validar se NFe já existe
  const existente = await db
    .select()
    .from(nfeStaging)
    .where(eq(nfeStaging.chaveNfe, dados.chaveNfe))
    .execute();

  if (existente.length > 0) {
    throw new Error(`NFe ${dados.chaveNfe} já foi importada`);
  }

  // Inserir em staging
  const resultado = await db
    .insert(nfeStaging)
    .values({
      chaveNfe: dados.chaveNfe,
      numeroNf: dados.numeroNf,
      serieNf: dados.serieNf,
      dataEmissao: dados.dataEmissao,
      cnpjFaturado: dados.cnpjFaturado,
      postoFiscalId: dados.postoFiscalId,
      produtoId: dados.produtoId,
      quantidade: dados.quantidade,
      custoUnitario: dados.custoUnitario,
      custoTotal: dados.custoTotal,
      fornecedorId: dados.fornecedorId || null,
      fornecedorNome: dados.fornecedorNome || null,
      quantidadePendente: dados.quantidade,
      quantidadeAlocada: 0,
      statusAlocacao: "pendente",
      usuarioImportacaoId: dados.usuarioId || null,
      usuarioImportacaoNome: dados.usuarioNome || null,
    })
    .execute();

  console.log(`[FUEL-ENGINE] NFe ${dados.chaveNfe} importada para staging`);

  return {
    id: resultado[0].insertId as number,
    statusAlocacao: "pendente",
  };
}

/**
 * Lista NFes em staging
 */
export async function listarNfesStaging(filtros?: {
  statusAlocacao?: string;
  postoFiscalId?: number;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(nfeStaging);

  if (filtros?.statusAlocacao) {
    query = query.where(eq(nfeStaging.statusAlocacao, filtros.statusAlocacao));
  }

  if (filtros?.postoFiscalId) {
    query = query.where(eq(nfeStaging.postoFiscalId, filtros.postoFiscalId));
  }

  return await query.execute();
}

// ==================== ALOCAÇÃO FÍSICA MANUAL ====================

/**
 * Aloca NFe fisicamente para um posto/tanque
 */
export async function alocarFisicamente(dados: {
  nfeStagingId: number;
  chaveNfe: string;
  postoDestinoId: number;
  tanqueDestinoId: number;
  dataDescargaReal: Date;
  horaDescargaReal?: string;
  volumeAlocado: number;
  custoUnitarioAplicado: number;
  justificativa?: string;
  usuarioId?: number;
  usuarioNome?: string;
}): Promise<{ alocacaoId: number; loteFisicoId: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // 1. Buscar NFe em staging
  const nfe = await db
    .select()
    .from(nfeStaging)
    .where(eq(nfeStaging.id, dados.nfeStagingId))
    .execute();

  if (nfe.length === 0) {
    throw new Error(`NFe staging ${dados.nfeStagingId} não encontrada`);
  }

  const nfeData = nfe[0];

  // 2. Validar volume
  if (dados.volumeAlocado > nfeData.quantidadePendente) {
    throw new Error(
      `Volume alocado (${dados.volumeAlocado}L) excede quantidade pendente (${nfeData.quantidadePendente}L)`
    );
  }

  // 3. Criar alocação física
  const alocacao = await db
    .insert(alocacoesFisicas)
    .values({
      nfeStagingId: dados.nfeStagingId,
      chaveNfe: dados.chaveNfe,
      postoDestinoId: dados.postoDestinoId,
      tanqueDestinoId: dados.tanqueDestinoId,
      dataDescargaReal: dados.dataDescargaReal,
      horaDescargaReal: dados.horaDescargaReal || null,
      volumeAlocado: dados.volumeAlocado,
      custoUnitarioAplicado: dados.custoUnitarioAplicado,
      justificativa: dados.justificativa || null,
      status: "confirmado",
      usuarioId: dados.usuarioId || null,
      usuarioNome: dados.usuarioNome || null,
    })
    .execute();

  const alocacaoId = alocacao[0].insertId as number;

  // 4. Criar lote físico
  const loteFisico = await db
    .insert(lotesFisicos)
    .values({
      nfeStagingId: dados.nfeStagingId,
      chaveNfe: dados.chaveNfe,
      postoDestinoId: dados.postoDestinoId,
      tanqueDestinoId: dados.tanqueDestinoId,
      produtoId: nfeData.produtoId,
      dataDescargaReal: dados.dataDescargaReal,
      horaDescargaReal: dados.horaDescargaReal || null,
      volumeOriginal: dados.volumeAlocado,
      volumeDisponivel: dados.volumeAlocado,
      volumeConsumido: 0,
      custoUnitario: dados.custoUnitarioAplicado,
      custoTotal: dados.volumeAlocado * dados.custoUnitarioAplicado,
      ordemPeps: 0, // Será calculado depois
      statusLote: "ativo",
      usuarioAlocacaoId: dados.usuarioId || null,
      usuarioAlocacaoNome: dados.usuarioNome || null,
    })
    .execute();

  const loteFisicoId = loteFisico[0].insertId as number;

  // 5. Atualizar status da NFe em staging
  const novaQuantidadePendente =
    nfeData.quantidadePendente - dados.volumeAlocado;
  const novaQuantidadeAlocada = nfeData.quantidadeAlocada + dados.volumeAlocado;

  const novoStatus =
    novaQuantidadePendente === 0
      ? "alocado"
      : novaQuantidadePendente < nfeData.quantidadePendente
        ? "parcialmente_alocado"
        : "pendente";

  await db
    .update(nfeStaging)
    .set({
      quantidadePendente: novaQuantidadePendente,
      quantidadeAlocada: novaQuantidadeAlocada,
      statusAlocacao: novoStatus,
    })
    .where(eq(nfeStaging.id, dados.nfeStagingId))
    .execute();

  console.log(
    `[FUEL-ENGINE] NFe ${dados.chaveNfe} alocada: ${dados.volumeAlocado}L para Posto ${dados.postoDestinoId}`
  );

  return { alocacaoId, loteFisicoId };
}

/**
 * Lista alocações físicas
 */
export async function listarAlocacoesFisicas(filtros?: {
  postoDestinoId?: number;
  status?: string;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(alocacoesFisicas);

  if (filtros?.postoDestinoId) {
    query = query.where(eq(alocacoesFisicas.postoDestinoId, filtros.postoDestinoId));
  }

  if (filtros?.status) {
    query = query.where(eq(alocacoesFisicas.status, filtros.status));
  }

  return await query.execute();
}

// ==================== LOTES FÍSICOS ====================

/**
 * Lista lotes físicos
 */
export async function listarLotesFisicos(filtros?: {
  postoDestinoId?: number;
  tanqueDestinoId?: number;
  statusLote?: string;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  let query = db.select().from(lotesFisicos);

  if (filtros?.postoDestinoId) {
    query = query.where(eq(lotesFisicos.postoDestinoId, filtros.postoDestinoId));
  }

  if (filtros?.tanqueDestinoId) {
    query = query.where(eq(lotesFisicos.tanqueDestinoId, filtros.tanqueDestinoId));
  }

  if (filtros?.statusLote) {
    query = query.where(eq(lotesFisicos.statusLote, filtros.statusLote));
  }

  return await query.execute();
}

/**
 * Obtém lote físico por ID
 */
export async function obterLoteFisicoById(id: number): Promise<any> {
  const db = await getDb();
  if (!db) return null;

  const resultado = await db
    .select()
    .from(lotesFisicos)
    .where(eq(lotesFisicos.id, id))
    .execute();

  return resultado[0] || null;
}

/**
 * Atualiza ordem PEPS de um lote
 */
export async function atualizarOrdemPeps(
  loteFisicoId: number,
  novaOrdem: number
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  await db
    .update(lotesFisicos)
    .set({ ordemPeps: novaOrdem })
    .where(eq(lotesFisicos.id, loteFisicoId))
    .execute();
}

// ==================== REORDENAÇÃO PEPS ====================

/**
 * Registra reordenação PEPS
 */
export async function registrarReordenacaoPEPS(dados: {
  loteFisicoId: number;
  ordemAnterior: number;
  ordemNova: number;
  motivo?: string;
  impactoFinanceiroEstimado?: number;
  usuarioId?: number;
  usuarioNome?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const resultado = await db
    .insert(reordenacaoPEPS)
    .values({
      loteFisicoId: dados.loteFisicoId,
      ordemAnterior: dados.ordemAnterior,
      ordemNova: dados.ordemNova,
      motivo: dados.motivo || null,
      impactoFinanceiroEstimado: dados.impactoFinanceiroEstimado || null,
      usuarioId: dados.usuarioId || null,
      usuarioNome: dados.usuarioNome || null,
    })
    .execute();

  return resultado[0].insertId as number;
}

/**
 * Obtém histórico de reordenações
 */
export async function obterHistoricoReordenacao(
  loteFisicoId: number
): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(reordenacaoPEPS)
    .where(eq(reordenacaoPEPS.loteFisicoId, loteFisicoId))
    .orderBy(desc(reordenacaoPEPS.createdAt))
    .execute();
}

// ==================== SNAPSHOT CMV ====================

/**
 * Registra snapshot de CMV
 */
export async function registrarSnapshotCMV(dados: {
  vendaId: number;
  cmvAnterior?: number;
  cmvNovo: number;
  lotesConsumidos?: any[];
  motivoRecalculo: string;
  tempoProcessamentoMs?: number;
  usuarioId?: number;
  usuarioNome?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const diferenca = dados.cmvAnterior
    ? dados.cmvNovo - dados.cmvAnterior
    : null;
  const percentualDiferenca =
    dados.cmvAnterior && dados.cmvAnterior !== 0
      ? ((dados.cmvNovo - dados.cmvAnterior) / dados.cmvAnterior) * 100
      : null;

  const resultado = await db
    .insert(snapshotCMV)
    .values({
      vendaId: dados.vendaId,
      cmvAnterior: dados.cmvAnterior || null,
      cmvNovo: dados.cmvNovo,
      diferenca: diferenca,
      percentualDiferenca: percentualDiferenca,
      lotesConsumidos: dados.lotesConsumidos
        ? JSON.stringify(dados.lotesConsumidos)
        : null,
      motivoRecalculo: dados.motivoRecalculo,
      tempoProcessamentoMs: dados.tempoProcessamentoMs || null,
      usuarioId: dados.usuarioId || null,
      usuarioNome: dados.usuarioNome || null,
    })
    .execute();

  return resultado[0].insertId as number;
}

// ==================== CONSUMO DE LOTES ====================

/**
 * Registra consumo de lote físico
 */
export async function registrarConsumoLote(dados: {
  vendaId: number;
  loteFisicoId: number;
  volumeConsumido: number;
  custoUnitarioAplicado: number;
  sequenciaConsumo: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const resultado = await db
    .insert(consumoLotesFisicos)
    .values({
      vendaId: dados.vendaId,
      loteFisicoId: dados.loteFisicoId,
      volumeConsumido: dados.volumeConsumido,
      custoUnitarioAplicado: dados.custoUnitarioAplicado,
      custoTotalAplicado: dados.volumeConsumido * dados.custoUnitarioAplicado,
      sequenciaConsumo: dados.sequenciaConsumo,
    })
    .execute();

  return resultado[0].insertId as number;
}

/**
 * Obtém consumo de lotes de uma venda
 */
export async function obterConsumoVenda(vendaId: number): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  return await db
    .select()
    .from(consumoLotesFisicos)
    .where(eq(consumoLotesFisicos.vendaId, vendaId))
    .orderBy(consumoLotesFisicos.sequenciaConsumo)
    .execute();
}

// ==================== AUDITORIA ====================

/**
 * Registra auditoria do Fuel Engine
 */
export async function registrarAuditoriaFuelEngine(dados: {
  operacao: string;
  nfeStagingId?: number;
  alocacaoFisicaId?: number;
  loteFisicoId?: number;
  vendaId?: number;
  dadosAntes?: any;
  dadosDepois?: any;
  cmvAnterior?: number;
  cmvNovo?: number;
  vendasRecalculadas?: number;
  tempoProcessamentoMs?: number;
  justificativa?: string;
  usuarioId?: number;
  usuarioNome?: string;
  ipAddress?: string;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const resultado = await db
    .insert(auditoriaFuelEngine)
    .values({
      operacao: dados.operacao,
      nfeStagingId: dados.nfeStagingId || null,
      alocacaoFisicaId: dados.alocacaoFisicaId || null,
      loteFisicoId: dados.loteFisicoId || null,
      vendaId: dados.vendaId || null,
      dadosAntes: dados.dadosAntes ? JSON.stringify(dados.dadosAntes) : null,
      dadosDepois: dados.dadosDepois ? JSON.stringify(dados.dadosDepois) : null,
      cmvAnterior: dados.cmvAnterior || null,
      cmvNovo: dados.cmvNovo || null,
      vendasRecalculadas: dados.vendasRecalculadas || null,
      tempoProcessamentoMs: dados.tempoProcessamentoMs || null,
      justificativa: dados.justificativa || null,
      usuarioId: dados.usuarioId || null,
      usuarioNome: dados.usuarioNome || null,
      ipAddress: dados.ipAddress || null,
    })
    .execute();

  return resultado[0].insertId as number;
}

/**
 * Obtém auditoria do Fuel Engine
 */
export async function obterAuditoriaFuelEngine(filtros?: {
  operacao?: string;
  usuarioId?: number;
  dataInicio?: Date;
  dataFim?: Date;
}): Promise<any[]> {
  const db = await getDb();
  if (!db) return [];

  const resultado = await db
    .select()
    .from(auditoriaFuelEngine)
    .execute();

  // Filtrar em memória
  return resultado.filter((r: any) => {
    const operacaoOk = !filtros?.operacao || r.operacao === filtros.operacao;
    const usuarioOk = !filtros?.usuarioId || r.usuarioId === filtros.usuarioId;
    const dataOk =
      !filtros?.dataInicio || !filtros?.dataFim ||
      (r.createdAt >= filtros.dataInicio && r.createdAt <= filtros.dataFim);

    return operacaoOk && usuarioOk && dataOk;
  }).sort((a: any, b: any) => b.createdAt - a.createdAt);
}
