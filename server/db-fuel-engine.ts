/**
 * Funções de banco de dados para Fuel Physical Allocation Engine
 * Persistência de alocações, lotes físicos e histórico de reordenação
 */

import { getDb } from "./db";
import {
  nfeStaging,
  alocacoesFisicas,
  lotesFisicos,
  reordenacaoPEPS,
  consumoLotesFisicos,
  auditoriaFuelEngine,
  InsertNfeStaging,
  InsertAlocacaoFisica,
  InsertLoteFisico,
  InsertReordenacaoPEPS,
  InsertConsumoLoteFisico,
  InsertAuditoriaFuelEngine,
} from "../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";

/**
 * Importar NFe do ACS para staging
 */
export async function importarNfeParaStaging(nfe: InsertNfeStaging) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(nfeStaging).values(nfe).onDuplicateKeyUpdate({
    set: {
      statusAlocacao: nfe.statusAlocacao,
      quantidadeAlocada: nfe.quantidadeAlocada,
      updatedAt: new Date(),
    },
  });
}

/**
 * Listar NFes pendentes de alocação
 */
export async function listarNfesPendentes(
  dataInicio?: string,
  dataFim?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [eq(nfeStaging.statusAlocacao, "pendente")];

  if (dataInicio && dataFim) {
    conditions.push(
      and(
        gte(nfeStaging.dataEmissao, new Date(dataInicio)),
        lte(nfeStaging.dataEmissao, new Date(dataFim))
      )
    );
  }

  const whereCondition = conditions.length === 1 ? conditions[0] : and(...conditions);
  return await (db
    .select()
    .from(nfeStaging)
    .where(whereCondition) as any);
}

/**
 * Criar alocação física
 */
export async function criarAlocacaoFisica(alocacao: InsertAlocacaoFisica) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const result = await db.insert(alocacoesFisicas).values(alocacao);

  // Atualizar status da NFe
  if (alocacao.nfeStagingId) {
    const nfe = await db
      .select()
      .from(nfeStaging)
      .where(eq(nfeStaging.id, alocacao.nfeStagingId))
      .limit(1);

    if (nfe.length > 0) {
      const novaQuantidadeAlocada =
        (parseFloat(nfe[0].quantidadeAlocada?.toString() || "0") || 0) +
        parseFloat(alocacao.volumeAlocado?.toString() || "0");

      const statusNovo =
        novaQuantidadeAlocada >= parseFloat(nfe[0].quantidade?.toString() || "0")
          ? "totalmente_alocado"
          : "parcialmente_alocado";

      await db
        .update(nfeStaging)
        .set({
          quantidadeAlocada: novaQuantidadeAlocada.toString(),
          statusAlocacao: statusNovo,
          updatedAt: new Date(),
        })
        .where(eq(nfeStaging.id, alocacao.nfeStagingId));
    }
  }

  return result;
}

/**
 * Criar lote físico automaticamente após alocação
 */
export async function criarLoteFisico(lote: InsertLoteFisico) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Buscar próxima ordem PEPS para este tanque
  const ultimoLote = await db
    .select()
    .from(lotesFisicos)
    .where(
      and(
        eq(lotesFisicos.postoId, lote.postoId),
        eq(lotesFisicos.tanqueId, lote.tanqueId)
      )
    )
    .orderBy(desc(lotesFisicos.ordemPEPS))
    .limit(1);

  const proximaOrdem = (ultimoLote[0]?.ordemPEPS || 0) + 1;

  return await db.insert(lotesFisicos).values({
    ...lote,
    ordemPEPS: proximaOrdem,
  });
}

/**
 * Registrar reordenação PEPS
 */
export async function registrarReordenacaoPEPS(
  reordenacao: InsertReordenacaoPEPS
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(reordenacaoPEPS).values(reordenacao);
}

/**
 * Registrar consumo de lote físico
 */
export async function registrarConsumoLote(
  consumo: InsertConsumoLoteFisico
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // Registrar consumo
  await db.insert(consumoLotesFisicos).values(consumo);

  // Atualizar quantidade disponível do lote
  const lote = await db
    .select()
    .from(lotesFisicos)
    .where(eq(lotesFisicos.id, consumo.loteFisicoId))
    .limit(1);

  if (lote.length > 0) {
    const novaQuantidade =
      parseFloat(lote[0].quantidadeDisponivel?.toString() || "0") -
      parseFloat(consumo.volumeConsumido?.toString() || "0");

    const statusLote = novaQuantidade <= 0 ? "consumido" : "ativo";

    await db
      .update(lotesFisicos)
      .set({
        quantidadeDisponivel: Math.max(0, novaQuantidade).toString(),
        statusLote,
        updatedAt: new Date(),
      })
      .where(eq(lotesFisicos.id, consumo.loteFisicoId));
  }
}

/**
 * Registrar auditoria do Fuel Engine
 */
export async function registrarAuditoria(
  auditoria: InsertAuditoriaFuelEngine
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return await db.insert(auditoriaFuelEngine).values(auditoria);
}

/**
 * Listar alocações realizadas
 */
export async function listarAlocacoesRealizadas(
  postoId?: number,
  dataInicio?: string,
  dataFim?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];

  if (postoId) {
    conditions.push(eq(alocacoesFisicas.postoDestinoId, postoId));
  }

  if (dataInicio && dataFim) {
    conditions.push(
      and(
        gte(alocacoesFisicas.dataDescargaReal, new Date(dataInicio)),
        lte(alocacoesFisicas.dataDescargaReal, new Date(dataFim))
      )
    );
  }

  const whereCondition = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  
  let query = db.select().from(alocacoesFisicas);
  if (whereCondition) {
    query = (query.where(whereCondition) as any);
  }

  return await query.orderBy(desc(alocacoesFisicas.createdAt));
}

/**
 * Listar lotes físicos
 */
export async function listarLotesFisicos(
  postoId?: number,
  tanqueId?: number,
  statusLote?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];

  if (postoId) {
    conditions.push(eq(lotesFisicos.postoId, postoId));
  }

  if (tanqueId) {
    conditions.push(eq(lotesFisicos.tanqueId, tanqueId));
  }

  if (statusLote) {
    conditions.push(eq(lotesFisicos.statusLote, statusLote as any));
  }

  const whereCondition = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  
  let query = db.select().from(lotesFisicos);
  if (whereCondition) {
    query = (query.where(whereCondition) as any);
  }

  return await query.orderBy(lotesFisicos.ordemPEPS);
}

/**
 * Listar histórico de reordenação PEPS
 */
export async function listarReordenacoesPEPS(
  postoId?: number,
  tanqueId?: number,
  dataInicio?: string,
  dataFim?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];

  if (postoId) {
    conditions.push(eq(reordenacaoPEPS.postoId, postoId));
  }

  if (tanqueId) {
    conditions.push(eq(reordenacaoPEPS.tanqueId, tanqueId));
  }

  if (dataInicio && dataFim) {
    conditions.push(
      and(
        gte(reordenacaoPEPS.dataDescargaNovaAlocacao, new Date(dataInicio)),
        lte(reordenacaoPEPS.dataDescargaNovaAlocacao, new Date(dataFim))
      )
    );
  }

  const whereCondition = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  
  let query = db.select().from(reordenacaoPEPS);
  if (whereCondition) {
    query = (query.where(whereCondition) as any);
  }

  return await query.orderBy(desc(reordenacaoPEPS.createdAt));
}

/**
 * Listar auditoria do Fuel Engine
 */
export async function listarAuditoria(
  operacao?: string,
  postoId?: number,
  dataInicio?: string,
  dataFim?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const conditions: any[] = [];

  if (operacao) {
    conditions.push(eq(auditoriaFuelEngine.operacao, operacao));
  }

  if (postoId) {
    conditions.push(eq(auditoriaFuelEngine.postoId, postoId));
  }

  if (dataInicio && dataFim) {
    conditions.push(
      and(
        gte(auditoriaFuelEngine.createdAt, new Date(dataInicio)),
        lte(auditoriaFuelEngine.createdAt, new Date(dataFim))
      )
    );
  }

  const whereCondition = conditions.length === 0 ? undefined : conditions.length === 1 ? conditions[0] : and(...conditions);
  
  let query = db.select().from(auditoriaFuelEngine);
  if (whereCondition) {
    query = (query.where(whereCondition) as any);
  }

  return await query.orderBy(desc(auditoriaFuelEngine.createdAt));
}

/**
 * Obter estatísticas de alocações
 */
export async function obterEstatisticasAlocacoes(
  dataInicio: string,
  dataFim: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const alocacoes = await db
    .select()
    .from(alocacoesFisicas)
    .where(
      and(
        gte(alocacoesFisicas.dataDescargaReal, new Date(dataInicio)),
        lte(alocacoesFisicas.dataDescargaReal, new Date(dataFim))
      )
    );

  const reordenacoes = await db
    .select()
    .from(reordenacaoPEPS)
    .where(
      and(
        gte(reordenacaoPEPS.dataDescargaNovaAlocacao, new Date(dataInicio)),
        lte(reordenacaoPEPS.dataDescargaNovaAlocacao, new Date(dataFim))
      )
    );

  const totalVolume = alocacoes.reduce(
    (sum, a) => sum + parseFloat(a.volumeAlocado?.toString() || "0"),
    0
  );

  const totalCusto = alocacoes.reduce(
    (sum, a) => sum + parseFloat(a.custoTotalAlocado?.toString() || "0"),
    0
  );

  const impactoFinanceiro = reordenacoes.reduce(
    (sum, r) => sum + parseFloat(r.impactoFinanceiroCMV?.toString() || "0"),
    0
  );

  return {
    totalAlocacoes: alocacoes.length,
    totalReordenacoes: reordenacoes.length,
    totalVolume,
    totalCusto,
    custoMedio: totalVolume > 0 ? totalCusto / totalVolume : 0,
    impactoFinanceiro,
  };
}
