/**
 * Serviço de Bloqueio Mensal de DRE
 * 
 * Gerencia o fechamento/abertura de meses para cada posto.
 * Quando um mês está "fechado", nenhuma alteração de alocação, transferência
 * ou recálculo de CMV pode ser feita para aquele posto/mês.
 * 
 * Apenas admin pode desbloquear um mês fechado.
 */

import { eq, and, sql, desc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  postos,
  bloqueioDre,
  historicoAlteracoes,
} from "../../drizzle/schema";

export interface StatusBloqueio {
  postoId: number;
  postoNome: string;
  mesReferencia: string;
  status: "aberto" | "fechado";
  fechadoPor?: string;
  fechadoEm?: Date | null;
  desbloqueadoPor?: string;
  desbloqueadoEm?: Date | null;
  observacoes?: string;
}

/**
 * Obtém a conexão com o banco de dados
 */
async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return drizzle(process.env.DATABASE_URL);
}

/**
 * Fechar mês de DRE para um posto
 */
export async function fecharMesDRE(
  postoId: number,
  mesReferencia: string, // YYYY-MM
  usuarioId: number,
  usuarioNome?: string,
  observacoes?: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const db = await getDb();

  // Verificar se já está fechado
  const existente = await db
    .select()
    .from(bloqueioDre)
    .where(
      and(
        eq(bloqueioDre.postoId, postoId),
        eq(bloqueioDre.mesReferencia, mesReferencia)
      )
    )
    .limit(1);

  if (existente[0] && existente[0].status === "fechado") {
    return {
      sucesso: false,
      mensagem: `Mês ${mesReferencia} já está fechado para este posto.`,
    };
  }

  const agora = new Date();

  if (existente[0]) {
    // Atualizar registro existente
    await db
      .update(bloqueioDre)
      .set({
        status: "fechado",
        fechadoPor: usuarioId,
        fechadoNome: usuarioNome,
        fechadoEm: agora,
        desbloqueadoPor: null,
        desbloqueadoNome: null,
        desbloqueadoEm: null,
        observacoes,
      })
      .where(eq(bloqueioDre.id, existente[0].id));
  } else {
    // Criar novo registro
    await db.insert(bloqueioDre).values({
      postoId,
      mesReferencia,
      status: "fechado",
      fechadoPor: usuarioId,
      fechadoNome: usuarioNome,
      fechadoEm: agora,
      observacoes,
    });
  }

  // Registrar auditoria
  await db.insert(historicoAlteracoes).values({
    tabela: "bloqueioDre",
    registroId: postoId,
    acao: "update",
    camposAlterados: "status",
    valoresAntigos: JSON.stringify({ status: "aberto" }),
    valoresNovos: JSON.stringify({ status: "fechado", mesReferencia }),
    usuarioId,
    usuarioNome,
    justificativa: observacoes || `Mês ${mesReferencia} fechado`,
  });

  // Buscar nome do posto
  const posto = await db.select({ nome: postos.nome }).from(postos).where(eq(postos.id, postoId)).limit(1);

  return {
    sucesso: true,
    mensagem: `DRE de ${mesReferencia} fechada para ${posto[0]?.nome || `Posto ${postoId}`}. Nenhuma alteração será permitida até desbloqueio.`,
  };
}

/**
 * Desbloquear mês de DRE (apenas admin)
 */
export async function desbloquearMesDRE(
  postoId: number,
  mesReferencia: string,
  usuarioId: number,
  usuarioNome?: string,
  observacoes?: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const db = await getDb();

  const existente = await db
    .select()
    .from(bloqueioDre)
    .where(
      and(
        eq(bloqueioDre.postoId, postoId),
        eq(bloqueioDre.mesReferencia, mesReferencia)
      )
    )
    .limit(1);

  if (!existente[0] || existente[0].status === "aberto") {
    return {
      sucesso: false,
      mensagem: `Mês ${mesReferencia} já está aberto para este posto.`,
    };
  }

  const agora = new Date();

  await db
    .update(bloqueioDre)
    .set({
      status: "aberto",
      desbloqueadoPor: usuarioId,
      desbloqueadoNome: usuarioNome,
      desbloqueadoEm: agora,
      observacoes: observacoes || `Desbloqueado por ${usuarioNome}`,
    })
    .where(eq(bloqueioDre.id, existente[0].id));

  // Registrar auditoria
  await db.insert(historicoAlteracoes).values({
    tabela: "bloqueioDre",
    registroId: postoId,
    acao: "update",
    camposAlterados: "status",
    valoresAntigos: JSON.stringify({ status: "fechado", mesReferencia }),
    valoresNovos: JSON.stringify({ status: "aberto", mesReferencia }),
    usuarioId,
    usuarioNome,
    justificativa: observacoes || `Mês ${mesReferencia} desbloqueado`,
  });

  const posto = await db.select({ nome: postos.nome }).from(postos).where(eq(postos.id, postoId)).limit(1);

  return {
    sucesso: true,
    mensagem: `DRE de ${mesReferencia} desbloqueada para ${posto[0]?.nome || `Posto ${postoId}`}. Alterações permitidas novamente.`,
  };
}

/**
 * Listar status de bloqueio de todos os postos para um mês
 */
export async function listarStatusBloqueio(
  mesReferencia?: string
): Promise<StatusBloqueio[]> {
  const db = await getDb();

  // Buscar postos ativos
  const postosAtivos = await db
    .select({ id: postos.id, nome: postos.nome })
    .from(postos)
    .where(eq(postos.ativo, 1))
    .orderBy(postos.nome);

  // Buscar bloqueios
  const conditions = [];
  if (mesReferencia) {
    conditions.push(eq(bloqueioDre.mesReferencia, mesReferencia));
  }

  const bloqueios = await db
    .select()
    .from(bloqueioDre)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  // Mapear bloqueios por posto+mês
  const bloqueioMap = new Map<string, typeof bloqueios[0]>();
  for (const b of bloqueios) {
    bloqueioMap.set(`${b.postoId}-${b.mesReferencia}`, b);
  }

  const resultado: StatusBloqueio[] = [];

  if (mesReferencia) {
    // Para um mês específico, listar todos os postos
    for (const posto of postosAtivos) {
      const bloqueio = bloqueioMap.get(`${posto.id}-${mesReferencia}`);
      resultado.push({
        postoId: posto.id,
        postoNome: posto.nome,
        mesReferencia,
        status: bloqueio?.status === "fechado" ? "fechado" : "aberto",
        fechadoPor: bloqueio?.fechadoNome || undefined,
        fechadoEm: bloqueio?.fechadoEm || null,
        desbloqueadoPor: bloqueio?.desbloqueadoNome || undefined,
        desbloqueadoEm: bloqueio?.desbloqueadoEm || null,
        observacoes: bloqueio?.observacoes || undefined,
      });
    }
  } else {
    // Sem filtro de mês, listar todos os bloqueios existentes
    for (const b of bloqueios) {
      const posto = postosAtivos.find((p) => p.id === b.postoId);
      resultado.push({
        postoId: b.postoId,
        postoNome: posto?.nome || `Posto ${b.postoId}`,
        mesReferencia: b.mesReferencia,
        status: b.status as "aberto" | "fechado",
        fechadoPor: b.fechadoNome || undefined,
        fechadoEm: b.fechadoEm || null,
        desbloqueadoPor: b.desbloqueadoNome || undefined,
        desbloqueadoEm: b.desbloqueadoEm || null,
        observacoes: b.observacoes || undefined,
      });
    }
  }

  return resultado;
}

/**
 * Fechar mês para TODOS os postos de uma vez
 */
export async function fecharMesTodosPostos(
  mesReferencia: string,
  usuarioId: number,
  usuarioNome?: string,
  observacoes?: string
): Promise<{ sucesso: boolean; mensagem: string; detalhes: string[] }> {
  const db = await getDb();

  const postosAtivos = await db
    .select({ id: postos.id, nome: postos.nome })
    .from(postos)
    .where(eq(postos.ativo, 1));

  const detalhes: string[] = [];

  for (const posto of postosAtivos) {
    const resultado = await fecharMesDRE(posto.id, mesReferencia, usuarioId, usuarioNome, observacoes);
    detalhes.push(`${posto.nome}: ${resultado.mensagem}`);
  }

  return {
    sucesso: true,
    mensagem: `Mês ${mesReferencia} fechado para ${postosAtivos.length} postos.`,
    detalhes,
  };
}

/**
 * Verificar se um mês está bloqueado para um posto específico
 */
export async function isMesBloqueado(
  postoId: number,
  mesReferencia: string
): Promise<boolean> {
  const db = await getDb();

  const result = await db
    .select({ status: bloqueioDre.status })
    .from(bloqueioDre)
    .where(
      and(
        eq(bloqueioDre.postoId, postoId),
        eq(bloqueioDre.mesReferencia, mesReferencia),
        eq(bloqueioDre.status, "fechado")
      )
    )
    .limit(1);

  return result.length > 0;
}
