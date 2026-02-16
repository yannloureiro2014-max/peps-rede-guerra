/**
 * Logs de Auditoria Detalhados - Versão Simplificada
 * Registra todas as operações críticas com contexto completo
 */

import { getDb } from "../db";
import { historicoAlteracoes } from "../../drizzle/schema";

export interface AuditLogEntry {
  tabela: string;
  registroId: number;
  acao: "insert" | "update" | "delete";
  usuarioId?: number;
  usuarioNome?: string;
  mudancas?: Record<string, any>;
  justificativa?: string;
}

export async function registrarAuditLog(entrada: AuditLogEntry): Promise<boolean> {
  try {
    const db = await getDb();
    if (!db) return false;

    await db.insert(historicoAlteracoes).values({
      tabela: entrada.tabela,
      registroId: entrada.registroId,
      acao: entrada.acao,
      usuarioId: entrada.usuarioId || null,
      usuarioNome: entrada.usuarioNome || null,
      camposAlterados: entrada.mudancas ? Object.keys(entrada.mudancas).join(",") : null,
      valoresAntigos: null,
      valoresNovos: entrada.mudancas ? JSON.stringify(entrada.mudancas) : null,
      justificativa: entrada.justificativa || null,
    });

    console.log(`[AUDIT] ${entrada.acao} em ${entrada.tabela}(${entrada.registroId})`);
    return true;
  } catch (error) {
    console.error("[AUDIT] Erro:", error);
    return false;
  }
}

export async function auditarCriacao(
  tabela: string,
  registroId: number,
  dados: Record<string, any>,
  contexto: any
): Promise<boolean> {
  return registrarAuditLog({
    tabela,
    registroId,
    acao: "insert",
    usuarioId: contexto.usuarioId,
    usuarioNome: contexto.usuarioNome,
    mudancas: dados,
  });
}

export async function auditarAtualizacao(
  tabela: string,
  registroId: number,
  mudancas: Record<string, any>,
  contexto: any
): Promise<boolean> {
  return registrarAuditLog({
    tabela,
    registroId,
    acao: "update",
    usuarioId: contexto.usuarioId,
    usuarioNome: contexto.usuarioNome,
    mudancas,
  });
}

export async function auditarExclusao(
  tabela: string,
  registroId: number,
  dados: Record<string, any>,
  contexto: any
): Promise<boolean> {
  return registrarAuditLog({
    tabela,
    registroId,
    acao: "delete",
    usuarioId: contexto.usuarioId,
    usuarioNome: contexto.usuarioNome,
    mudancas: dados,
  });
}
