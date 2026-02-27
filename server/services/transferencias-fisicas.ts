/**
 * Serviço de Transferências Físicas
 * 
 * Permite transferir volume de combustível entre postos/tanques com rastreabilidade completa.
 * Tipos de transferência:
 * - correcao_alocacao: NFe foi alocada no posto errado, corrigir para o correto
 * - transferencia_fisica: Combustível foi fisicamente transferido entre postos
 * - divisao_nfe: NFe dividida entre múltiplos postos/tanques
 * 
 * Após transferência, recalcula CMV apenas do posto afetado a partir da data.
 */

import { eq, and, gte, lte, sql, desc, asc } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  postos,
  tanques,
  produtos,
  lotes,
  vendas,
  consumoLotes,
  alertas,
  transferenciasFisicas,
  bloqueioDre,
  historicoAlteracoes,
} from "../../drizzle/schema";

export interface TransferenciaInput {
  loteOrigemId: number;
  postoDestinoId: number;
  tanqueDestinoId: number;
  volumeTransferido: number;
  dataTransferencia: string; // YYYY-MM-DD
  justificativa: string;
  tipo: "correcao_alocacao" | "transferencia_fisica" | "divisao_nfe";
  usuarioId: number;
  usuarioNome?: string;
  nfeStagingId?: number;
  numeroNf?: string;
}

export interface TransferenciaResult {
  sucesso: boolean;
  transferenciaId?: number;
  loteDestinoId?: number;
  mensagem: string;
  recalculoCMV?: {
    postoOrigem: { recalculadas: number; erros: number };
    postoDestino: { recalculadas: number; erros: number };
  };
}

/**
 * Obtém a conexão com o banco de dados
 */
async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return drizzle(process.env.DATABASE_URL);
}

/**
 * Verifica se o mês está bloqueado para um posto
 */
export async function verificarBloqueioMes(
  postoId: number,
  data: string // YYYY-MM-DD
): Promise<{ bloqueado: boolean; mesReferencia?: string; fechadoPor?: string }> {
  const db = await getDb();
  
  // Extrair mês de referência da data (YYYY-MM)
  const mesReferencia = data.substring(0, 7);
  
  const result = await db
    .select()
    .from(bloqueioDre)
    .where(
      and(
        eq(bloqueioDre.postoId, postoId),
        eq(bloqueioDre.mesReferencia, mesReferencia),
        eq(bloqueioDre.status, "fechado")
      )
    )
    .limit(1);

  if (result.length > 0) {
    return {
      bloqueado: true,
      mesReferencia,
      fechadoPor: result[0].fechadoNome || `Usuário ${result[0].fechadoPor}`,
    };
  }

  return { bloqueado: false };
}

/**
 * Realiza uma transferência física entre postos/tanques
 */
export async function realizarTransferencia(
  input: TransferenciaInput
): Promise<TransferenciaResult> {
  const db = await getDb();

  // 1. Verificar se o mês está bloqueado para os postos envolvidos
  const loteOrigem = await db
    .select()
    .from(lotes)
    .where(eq(lotes.id, input.loteOrigemId))
    .limit(1);

  if (!loteOrigem[0]) {
    return { sucesso: false, mensagem: `Lote de origem ${input.loteOrigemId} não encontrado` };
  }

  const lote = loteOrigem[0];
  const postoOrigemId = lote.postoId;

  // Verificar bloqueio do mês para posto de origem
  const bloqueioOrigem = await verificarBloqueioMes(postoOrigemId, input.dataTransferencia);
  if (bloqueioOrigem.bloqueado) {
    return {
      sucesso: false,
      mensagem: `Mês ${bloqueioOrigem.mesReferencia} está fechado para o posto de origem. Fechado por ${bloqueioOrigem.fechadoPor}. Solicite desbloqueio ao admin.`,
    };
  }

  // Verificar bloqueio do mês para posto de destino
  const bloqueioDestino = await verificarBloqueioMes(input.postoDestinoId, input.dataTransferencia);
  if (bloqueioDestino.bloqueado) {
    return {
      sucesso: false,
      mensagem: `Mês ${bloqueioDestino.mesReferencia} está fechado para o posto de destino. Fechado por ${bloqueioDestino.fechadoPor}. Solicite desbloqueio ao admin.`,
    };
  }

  // 2. Validar volume disponível no lote de origem
  const saldoDisponivel = parseFloat(lote.quantidadeDisponivel || "0");
  if (input.volumeTransferido > saldoDisponivel + 0.001) {
    return {
      sucesso: false,
      mensagem: `Volume solicitado (${input.volumeTransferido.toFixed(3)} L) excede o saldo disponível do lote (${saldoDisponivel.toFixed(3)} L)`,
    };
  }

  // 3. Verificar que destino é diferente da origem
  if (postoOrigemId === input.postoDestinoId && lote.tanqueId === input.tanqueDestinoId) {
    return {
      sucesso: false,
      mensagem: "Posto e tanque de destino devem ser diferentes da origem",
    };
  }

  // 4. Verificar que o tanque de destino existe e está ativo
  const tanqueDestino = await db
    .select()
    .from(tanques)
    .where(and(eq(tanques.id, input.tanqueDestinoId), eq(tanques.ativo, 1)))
    .limit(1);

  if (!tanqueDestino[0]) {
    return { sucesso: false, mensagem: `Tanque de destino ${input.tanqueDestinoId} não encontrado ou inativo` };
  }

  // 5. Realizar a transferência
  const custoUnitario = parseFloat(lote.custoUnitario || "0");
  const custoTotal = input.volumeTransferido * custoUnitario;

  try {
    // 5a. Reduzir saldo do lote de origem
    const novoSaldoOrigem = saldoDisponivel - input.volumeTransferido;
    const novoStatusOrigem = novoSaldoOrigem <= 0.001 ? "consumido" : "ativo";

    await db
      .update(lotes)
      .set({
        quantidadeDisponivel: novoSaldoOrigem.toFixed(3),
        status: novoStatusOrigem as any,
      })
      .where(eq(lotes.id, input.loteOrigemId));

    // 5b. Criar novo lote no destino
    const dataEntrada = new Date(input.dataTransferencia + "T00:00:00Z");
    
    const loteDestinoResult = await db.insert(lotes).values({
      tanqueId: input.tanqueDestinoId,
      postoId: input.postoDestinoId,
      produtoId: lote.produtoId,
      fornecedorId: lote.fornecedorId,
      numeroNf: lote.numeroNf,
      serieNf: lote.serieNf,
      chaveNfe: null, // Não duplicar chaveNfe (unique constraint)
      nomeFornecedor: lote.nomeFornecedor,
      nomeProduto: lote.nomeProduto,
      tipoFrete: lote.tipoFrete,
      custoUnitarioProduto: lote.custoUnitarioProduto,
      custoUnitarioFrete: lote.custoUnitarioFrete,
      valorFrete: null, // Frete não se aplica a transferência
      dataEmissao: lote.dataEmissao,
      dataEntrada: dataEntrada,
      dataLmc: lote.dataLmc,
      quantidadeOriginal: input.volumeTransferido.toFixed(3),
      quantidadeDisponivel: input.volumeTransferido.toFixed(3),
      custoUnitario: custoUnitario.toFixed(4),
      custoTotal: custoTotal.toFixed(2),
      ordemConsumo: 0,
      status: "ativo",
      origem: "manual",
    });

    const loteDestinoId = loteDestinoResult[0]?.insertId;

    // 5c. Registrar transferência
    const transferenciaResult = await db.insert(transferenciasFisicas).values({
      nfeStagingId: input.nfeStagingId || null,
      loteOrigemId: input.loteOrigemId,
      loteDestinoId: loteDestinoId || null,
      postoOrigemId: postoOrigemId,
      postoDestinoId: input.postoDestinoId,
      tanqueOrigemId: lote.tanqueId,
      tanqueDestinoId: input.tanqueDestinoId,
      produtoId: lote.produtoId || 0,
      volumeTransferido: input.volumeTransferido.toFixed(3),
      custoUnitario: custoUnitario.toFixed(4),
      custoTotal: custoTotal.toFixed(2),
      dataTransferencia: dataEntrada,
      numeroNf: input.numeroNf || lote.numeroNf,
      justificativa: input.justificativa,
      tipo: input.tipo,
      status: "confirmada",
      usuarioId: input.usuarioId,
      usuarioNome: input.usuarioNome,
    });

    const transferenciaId = transferenciaResult[0]?.insertId;

    // 5d. Registrar auditoria
    await db.insert(historicoAlteracoes).values({
      tabela: "transferenciasFisicas",
      registroId: transferenciaId || 0,
      acao: "insert",
      camposAlterados: "transferencia_completa",
      valoresAntigos: JSON.stringify({
        loteOrigemId: input.loteOrigemId,
        saldoAnterior: saldoDisponivel,
      }),
      valoresNovos: JSON.stringify({
        loteDestinoId,
        volumeTransferido: input.volumeTransferido,
        custoUnitario,
        custoTotal,
      }),
      usuarioId: input.usuarioId,
      usuarioNome: input.usuarioNome,
      justificativa: input.justificativa,
    });

    // 6. Atualizar saldo dos tanques
    try {
      // Reduzir saldo do tanque de origem
      await db.execute(
        sql`UPDATE tanques SET saldoAtual = GREATEST(0, saldoAtual - ${input.volumeTransferido.toFixed(3)}) WHERE id = ${lote.tanqueId}`
      );
      // Aumentar saldo do tanque de destino
      await db.execute(
        sql`UPDATE tanques SET saldoAtual = saldoAtual + ${input.volumeTransferido.toFixed(3)} WHERE id = ${input.tanqueDestinoId}`
      );
    } catch (err) {
      console.warn("[TRANSFERENCIA] Erro ao atualizar saldo dos tanques:", err);
    }

    // 7. Recalcular CMV seletivamente (apenas postos afetados a partir da data)
    let recalculoCMV;
    try {
      recalculoCMV = await recalcularCMVSeletivo(
        postoOrigemId,
        input.postoDestinoId,
        lote.produtoId || 0,
        input.dataTransferencia
      );
    } catch (err) {
      console.warn("[TRANSFERENCIA] Erro no recálculo de CMV:", err);
    }

    // 8. Revalidar coerência física dos postos afetados
    try {
      const { verificarCoerenciaFisicaPosto } = await import("./coerencia-fisica");
      const dataFim = new Date();
      const dataFimStr = dataFim.toISOString().split("T")[0];
      
      await verificarCoerenciaFisicaPosto(postoOrigemId, input.dataTransferencia, dataFimStr);
      if (input.postoDestinoId !== postoOrigemId) {
        await verificarCoerenciaFisicaPosto(input.postoDestinoId, input.dataTransferencia, dataFimStr);
      }
      console.log(`[TRANSFERENCIA] Coerência revalidada para postos ${postoOrigemId} e ${input.postoDestinoId}`);
    } catch (err) {
      console.warn("[TRANSFERENCIA] Erro ao revalidar coerência:", err);
    }

    console.log(
      `[TRANSFERENCIA] Transferência ${transferenciaId} realizada: ${input.volumeTransferido}L do lote ${input.loteOrigemId} para posto ${input.postoDestinoId}/tanque ${input.tanqueDestinoId}`
    );

    return {
      sucesso: true,
      transferenciaId,
      loteDestinoId,
      mensagem: `Transferência de ${input.volumeTransferido.toFixed(3)} L realizada com sucesso. Lote ${loteDestinoId} criado no destino. CMV recalculado.`,
      recalculoCMV,
    };
  } catch (err) {
    console.error("[TRANSFERENCIA] Erro ao realizar transferência:", err);
    return {
      sucesso: false,
      mensagem: `Erro ao realizar transferência: ${err instanceof Error ? err.message : "Erro desconhecido"}`,
    };
  }
}

/**
 * Recalcula CMV seletivamente para os postos afetados
 * Apenas recalcula vendas a partir da data da transferência
 */
async function recalcularCMVSeletivo(
  postoOrigemId: number,
  postoDestinoId: number,
  produtoId: number,
  dataTransferencia: string
): Promise<{
  postoOrigem: { recalculadas: number; erros: number };
  postoDestino: { recalculadas: number; erros: number };
}> {
  // Importar função de recálculo do db.ts
  const { recalcularCMVRetroativo } = await import("../db");
  
  const dataInicio = new Date(dataTransferencia + "T00:00:00Z");

  // Recalcular posto de origem
  const resultOrigem = await recalcularCMVRetroativo(postoOrigemId, produtoId, dataInicio);

  // Recalcular posto de destino (se diferente)
  let resultDestino = { recalculadas: 0, erros: 0, detalhes: [] as any[] };
  if (postoDestinoId !== postoOrigemId) {
    resultDestino = await recalcularCMVRetroativo(postoDestinoId, produtoId, dataInicio);
  }

  return {
    postoOrigem: { recalculadas: resultOrigem.recalculadas, erros: resultOrigem.erros },
    postoDestino: { recalculadas: resultDestino.recalculadas, erros: resultDestino.erros },
  };
}

/**
 * Lista transferências realizadas com filtros
 */
export async function listarTransferencias(filtros?: {
  postoOrigemId?: number;
  postoDestinoId?: number;
  dataInicio?: string;
  dataFim?: string;
  tipo?: string;
  status?: string;
}): Promise<any[]> {
  const db = await getDb();

  const conditions = [];
  if (filtros?.postoOrigemId) {
    conditions.push(eq(transferenciasFisicas.postoOrigemId, filtros.postoOrigemId));
  }
  if (filtros?.postoDestinoId) {
    conditions.push(eq(transferenciasFisicas.postoDestinoId, filtros.postoDestinoId));
  }
  if (filtros?.dataInicio) {
    conditions.push(gte(transferenciasFisicas.dataTransferencia, new Date(filtros.dataInicio + "T00:00:00Z")));
  }
  if (filtros?.dataFim) {
    conditions.push(lte(transferenciasFisicas.dataTransferencia, new Date(filtros.dataFim + "T23:59:59Z")));
  }
  if (filtros?.tipo) {
    conditions.push(eq(transferenciasFisicas.tipo, filtros.tipo as any));
  }
  if (filtros?.status) {
    conditions.push(eq(transferenciasFisicas.status, filtros.status as any));
  }

  // Usar aliases para os joins de postos
  const postoOrigem = postos;

  const result = await db
    .select({
      id: transferenciasFisicas.id,
      nfeStagingId: transferenciasFisicas.nfeStagingId,
      loteOrigemId: transferenciasFisicas.loteOrigemId,
      loteDestinoId: transferenciasFisicas.loteDestinoId,
      postoOrigemId: transferenciasFisicas.postoOrigemId,
      postoDestinoId: transferenciasFisicas.postoDestinoId,
      tanqueOrigemId: transferenciasFisicas.tanqueOrigemId,
      tanqueDestinoId: transferenciasFisicas.tanqueDestinoId,
      produtoId: transferenciasFisicas.produtoId,
      volumeTransferido: transferenciasFisicas.volumeTransferido,
      custoUnitario: transferenciasFisicas.custoUnitario,
      custoTotal: transferenciasFisicas.custoTotal,
      dataTransferencia: transferenciasFisicas.dataTransferencia,
      numeroNf: transferenciasFisicas.numeroNf,
      justificativa: transferenciasFisicas.justificativa,
      tipo: transferenciasFisicas.tipo,
      status: transferenciasFisicas.status,
      usuarioNome: transferenciasFisicas.usuarioNome,
      createdAt: transferenciasFisicas.createdAt,
      produtoNome: produtos.descricao,
    })
    .from(transferenciasFisicas)
    .leftJoin(produtos, eq(transferenciasFisicas.produtoId, produtos.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transferenciasFisicas.createdAt))
    .limit(500);

  // Buscar nomes dos postos separadamente
  const postoIds = new Set<number>();
  const tanqueIds = new Set<number>();
  for (const r of result) {
    postoIds.add(r.postoOrigemId);
    postoIds.add(r.postoDestinoId);
    tanqueIds.add(r.tanqueOrigemId);
    tanqueIds.add(r.tanqueDestinoId);
  }

  const postosMap = new Map<number, string>();
  const tanquesMap = new Map<number, string>();

  if (postoIds.size > 0) {
    const postosResult = await db.select({ id: postos.id, nome: postos.nome }).from(postos);
    for (const p of postosResult) postosMap.set(p.id, p.nome);
  }

  if (tanqueIds.size > 0) {
    const tanquesResult = await db.select({ id: tanques.id, codigoAcs: tanques.codigoAcs }).from(tanques);
    for (const t of tanquesResult) tanquesMap.set(t.id, t.codigoAcs);
  }

  return result.map((r) => ({
    ...r,
    postoOrigemNome: postosMap.get(r.postoOrigemId) || `Posto ${r.postoOrigemId}`,
    postoDestinoNome: postosMap.get(r.postoDestinoId) || `Posto ${r.postoDestinoId}`,
    tanqueOrigemCodigo: tanquesMap.get(r.tanqueOrigemId) || `Tanque ${r.tanqueOrigemId}`,
    tanqueDestinoCodigo: tanquesMap.get(r.tanqueDestinoId) || `Tanque ${r.tanqueDestinoId}`,
  }));
}

/**
 * Cancelar uma transferência (se possível)
 */
export async function cancelarTransferencia(
  transferenciaId: number,
  usuarioId: number,
  usuarioNome?: string,
  justificativa?: string
): Promise<{ sucesso: boolean; mensagem: string }> {
  const db = await getDb();

  // Buscar transferência
  const transf = await db
    .select()
    .from(transferenciasFisicas)
    .where(eq(transferenciasFisicas.id, transferenciaId))
    .limit(1);

  if (!transf[0]) {
    return { sucesso: false, mensagem: "Transferência não encontrada" };
  }

  if (transf[0].status === "cancelada") {
    return { sucesso: false, mensagem: "Transferência já está cancelada" };
  }

  // Verificar se o lote de destino já teve consumo
  if (transf[0].loteDestinoId) {
    const consumos = await db
      .select({ id: consumoLotes.id })
      .from(consumoLotes)
      .where(eq(consumoLotes.loteId, transf[0].loteDestinoId))
      .limit(1);

    if (consumos.length > 0) {
      return {
        sucesso: false,
        mensagem: "Não é possível cancelar: o lote de destino já teve consumo PEPS. Faça uma transferência reversa.",
      };
    }
  }

  // Verificar bloqueio de mês
  const dataStr = transf[0].dataTransferencia instanceof Date
    ? transf[0].dataTransferencia.toISOString().split("T")[0]
    : String(transf[0].dataTransferencia);

  const bloqueio = await verificarBloqueioMes(transf[0].postoOrigemId, dataStr);
  if (bloqueio.bloqueado) {
    return {
      sucesso: false,
      mensagem: `Mês ${bloqueio.mesReferencia} está fechado. Solicite desbloqueio ao admin.`,
    };
  }

  // Cancelar: restaurar saldo do lote de origem e cancelar lote de destino
  const volumeTransferido = parseFloat(String(transf[0].volumeTransferido || "0"));

  // Restaurar saldo do lote de origem
  const loteOrigem = await db
    .select()
    .from(lotes)
    .where(eq(lotes.id, transf[0].loteOrigemId))
    .limit(1);

  if (loteOrigem[0]) {
    const novoSaldo = parseFloat(loteOrigem[0].quantidadeDisponivel || "0") + volumeTransferido;
    await db
      .update(lotes)
      .set({
        quantidadeDisponivel: novoSaldo.toFixed(3),
        status: "ativo",
      })
      .where(eq(lotes.id, transf[0].loteOrigemId));
  }

  // Cancelar lote de destino
  if (transf[0].loteDestinoId) {
    await db
      .update(lotes)
      .set({ status: "cancelado", quantidadeDisponivel: "0" })
      .where(eq(lotes.id, transf[0].loteDestinoId));
  }

  // Marcar transferência como cancelada
  await db
    .update(transferenciasFisicas)
    .set({ status: "cancelada" })
    .where(eq(transferenciasFisicas.id, transferenciaId));

  // Registrar auditoria
  await db.insert(historicoAlteracoes).values({
    tabela: "transferenciasFisicas",
    registroId: transferenciaId,
    acao: "update",
    camposAlterados: "status",
    valoresAntigos: JSON.stringify({ status: "confirmada" }),
    valoresNovos: JSON.stringify({ status: "cancelada" }),
    usuarioId,
    usuarioNome,
    justificativa: justificativa || "Transferência cancelada",
  });

  return {
    sucesso: true,
    mensagem: `Transferência ${transferenciaId} cancelada. Saldo de ${volumeTransferido.toFixed(3)} L restaurado no lote de origem.`,
  };
}
