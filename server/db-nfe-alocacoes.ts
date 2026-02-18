/**
 * Funções de persistência para Alocações SEFAZ
 * Salva NFes buscadas da SEFAZ e alocações manuais no banco de dados
 */

import { getDb } from "./db";
import { lotes, consumoLotes, historicoAlteracoes, alertas } from "../drizzle/schema";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { type InsertLote, type InsertConsumoLote, type InsertHistoricoAlteracao } from "../drizzle/schema";

/**
 * Criar lote a partir de NFe da SEFAZ
 * Quando usuário aloca uma NFe, cria um lote físico no banco
 */
export async function criarLoteDoSEFAZ(dados: {
  chaveNfe: string;
  numeroNf: string;
  serieNf: string;
  dataEmissao: Date;
  dataDescargaReal: Date; // Data de descarga real (não fiscal)
  postoId: number;
  tanqueId: number;
  produtoId: number;
  fornecedorId?: number;
  volumeAlocado: number;
  custoUnitario: number;
  justificativa?: string;
  usuarioId: number;
  // Dados extras da NFe
  nomeFornecedor?: string;
  nomeProduto?: string;
  tipoFrete?: string;
  custoUnitarioProduto?: number;
  custoUnitarioFrete?: number;
  valorFrete?: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const custoTotal = dados.volumeAlocado * dados.custoUnitario;

  // Inserir lote
  const result = await db.insert(lotes).values({
    chaveNfe: dados.chaveNfe,
    numeroNf: dados.numeroNf,
    serieNf: dados.serieNf,
    dataEmissao: dados.dataEmissao,
    dataEntrada: dados.dataDescargaReal, // Data de descarga real
    dataLmc: dados.dataDescargaReal,
    postoId: dados.postoId,
    tanqueId: dados.tanqueId,
    produtoId: dados.produtoId,
    fornecedorId: dados.fornecedorId,
    nomeFornecedor: dados.nomeFornecedor || null,
    nomeProduto: dados.nomeProduto || null,
    tipoFrete: dados.tipoFrete || null,
    custoUnitarioProduto: dados.custoUnitarioProduto?.toString() || null,
    custoUnitarioFrete: dados.custoUnitarioFrete?.toString() || null,
    valorFrete: dados.valorFrete?.toString() || null,
    quantidadeOriginal: dados.volumeAlocado.toString(),
    quantidadeDisponivel: dados.volumeAlocado.toString(),
    custoUnitario: dados.custoUnitario.toString(),
    custoTotal: custoTotal.toString(),
    status: "ativo",
    origem: "manual", // Marcado como manual pois foi alocado manualmente
  } as InsertLote);

  // Registrar auditoria
  await db.insert(historicoAlteracoes).values({
    tabela: "lotes",
    registroId: (result as any).insertId || 0,
    acao: "insert",
    camposAlterados: "chaveNfe, dataEntrada, volumeAlocado, custoUnitario",
    valoresNovos: JSON.stringify({
      chaveNfe: dados.chaveNfe,
      dataEntrada: dados.dataDescargaReal,
      volumeAlocado: dados.volumeAlocado,
      custoUnitario: dados.custoUnitario,
    }),
    usuarioId: dados.usuarioId,
    justificativa: dados.justificativa || "Alocação manual de NFe SEFAZ",
  } as InsertHistoricoAlteracao);

  return (result as any).insertId || 0;
}

/**
 * Listar NFes alocadas em um período
 */
export async function listarNfesAlocadas(filtros: {
  dataInicio?: Date;
  dataFim?: Date;
  postoId?: number;
  status?: string;
}): Promise<
  Array<{
    id: number;
    chaveNfe: string;
    numeroNf: string;
    serieNf: string;
    dataEmissao: Date | null;
    dataEntrada: Date;
    postoId: number;
    tanqueId: number;
    nomePosto: string;
    nomeTanque: string;
    nomeFornecedor: string | null;
    nomeProduto: string | null;
    tipoFrete: string | null;
    custoUnitarioProduto: number;
    custoUnitarioFrete: number;
    valorFrete: number;
    volumeAlocado: number;
    custoUnitario: number;
    custoTotal: number;
    status: string;
  }>
> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  let conditions: any[] = [eq(lotes.origem, "manual")];

  if (filtros.dataInicio && filtros.dataFim) {
    conditions.push(gte(lotes.dataEntrada, filtros.dataInicio));
    conditions.push(lte(lotes.dataEntrada, filtros.dataFim));
  }

  if (filtros.postoId) {
    conditions.push(eq(lotes.postoId, filtros.postoId));
  }

  if (filtros.status) {
    conditions.push(eq(lotes.status, filtros.status as any));
  }

  const resultados = await db
    .select()
    .from(lotes)
    .where(and(...conditions))
    .orderBy(desc(lotes.dataEntrada));

  // Buscar nomes dos postos e tanques
  const { postos: postosTable, tanques: tanquesTable } = await import("../drizzle/schema");
  const todosPostos = await db.select().from(postosTable);
  const todosTanques = await db.select().from(tanquesTable);
  const postosMap = new Map(todosPostos.map((p: any) => [p.id, p.nome]));
  const tanquesMap = new Map(todosTanques.map((t: any) => [t.id, `Tanque ${t.codigoAcs} - ${t.produtoDescricao || 'Sem produto'} (${Number(t.capacidade)?.toLocaleString('pt-BR')}L)`]));

  return resultados.map((r: any) => ({
    id: r.id,
    chaveNfe: r.chaveNfe,
    numeroNf: r.numeroNf,
    serieNf: r.serieNf || '1',
    dataEmissao: r.dataEmissao,
    dataEntrada: r.dataEntrada,
    postoId: r.postoId,
    tanqueId: r.tanqueId,
    nomePosto: postosMap.get(r.postoId) || `Posto ${r.postoId}`,
    nomeTanque: tanquesMap.get(r.tanqueId) || `Tanque ${r.tanqueId}`,
    nomeFornecedor: r.nomeFornecedor || null,
    nomeProduto: r.nomeProduto || null,
    tipoFrete: r.tipoFrete || null,
    custoUnitarioProduto: parseFloat(r.custoUnitarioProduto || '0'),
    custoUnitarioFrete: parseFloat(r.custoUnitarioFrete || '0'),
    valorFrete: parseFloat(r.valorFrete || '0'),
    volumeAlocado: parseFloat(r.quantidadeOriginal),
    custoUnitario: parseFloat(r.custoUnitario),
    custoTotal: parseFloat(r.custoTotal),
    status: r.status,
  }));
}

/**
 * Obter estatísticas de alocações
 */
export async function obterEstatisticasAlocacoes(filtros: {
  dataInicio?: Date;
  dataFim?: Date;
  postoId?: number;
}): Promise<{
  totalAlocacoes: number;
  totalVolume: number;
  custoMedio: number;
  lotesPorStatus: Record<string, number>;
}> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  let conditions: any[] = [eq(lotes.origem, "manual")];

  if (filtros.dataInicio && filtros.dataFim) {
    conditions.push(gte(lotes.dataEntrada, filtros.dataInicio));
    conditions.push(lte(lotes.dataEntrada, filtros.dataFim));
  }

  if (filtros.postoId) {
    conditions.push(eq(lotes.postoId, filtros.postoId));
  }

  const resultados = await db
    .select()
    .from(lotes)
    .where(and(...conditions));

  const totalAlocacoes = resultados.length;
  const totalVolume = resultados.reduce(
    (sum: number, r: any) => sum + parseFloat(r.quantidadeOriginal),
    0
  );
  const totalCusto = resultados.reduce(
    (sum: number, r: any) => sum + parseFloat(r.custoTotal),
    0
  );
  const custoMedio = totalVolume > 0 ? totalCusto / totalVolume : 0;

  const lotesPorStatus: Record<string, number> = {};
  resultados.forEach((r: any) => {
    lotesPorStatus[r.status] = (lotesPorStatus[r.status] || 0) + 1;
  });

  return {
    totalAlocacoes,
    totalVolume,
    custoMedio,
    lotesPorStatus,
  };
}

/**
 * Registrar consumo de lote (PEPS)
 */
export async function registrarConsumoLote(dados: {
  vendaId: number;
  loteId: number;
  volumeConsumido: number;
  custoUnitario: number;
  usuarioId: number;
}): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const custoTotal = dados.volumeConsumido * dados.custoUnitario;

  const result = await db.insert(consumoLotes).values({
    vendaId: dados.vendaId,
    loteId: dados.loteId,
    quantidadeConsumida: dados.volumeConsumido.toString(),
    custoUnitario: dados.custoUnitario.toString(),
    custoTotal: custoTotal.toString(),
  } as InsertConsumoLote);

  await db.insert(historicoAlteracoes).values({
    tabela: "consumoLotes",
    registroId: (result as any).insertId || 0,
    acao: "insert",
    camposAlterados: "vendaId, loteId, quantidadeConsumida",
    valoresNovos: JSON.stringify({
      vendaId: dados.vendaId,
      loteId: dados.loteId,
      volumeConsumido: dados.volumeConsumido,
    }),
    usuarioId: dados.usuarioId,
    justificativa: "Consumo de lote registrado via PEPS",
  } as InsertHistoricoAlteracao);

  return (result as any).insertId || 0;
}

/**
 * Atualizar disponibilidade de lote após consumo
 */
export async function atualizarDisponibilidadeLote(dados: {
  loteId: number;
  volumeConsumido: number;
  usuarioId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const lote = await db
    .select()
    .from(lotes)
    .where(eq(lotes.id, dados.loteId))
    .limit(1);

  if (!lote || lote.length === 0) {
    throw new Error(`Lote ${dados.loteId} não encontrado`);
  }

  const loteAtual = lote[0];
  const novaDisponibilidade =
    parseFloat(loteAtual.quantidadeDisponivel as any) - dados.volumeConsumido;

  await db
    .update(lotes)
    .set({
      quantidadeDisponivel: novaDisponibilidade.toString(),
      status: novaDisponibilidade <= 0 ? "consumido" : "ativo",
    })
    .where(eq(lotes.id, dados.loteId));

  await db.insert(historicoAlteracoes).values({
    tabela: "lotes",
    registroId: dados.loteId,
    acao: "update",
    camposAlterados: "quantidadeDisponivel, status",
    valoresAntigos: JSON.stringify({
      quantidadeDisponivel: loteAtual.quantidadeDisponivel,
      status: loteAtual.status,
    }),
    valoresNovos: JSON.stringify({
      quantidadeDisponivel: novaDisponibilidade,
      status: novaDisponibilidade <= 0 ? "consumido" : "ativo",
    }),
    usuarioId: dados.usuarioId,
    justificativa: `Consumo de ${dados.volumeConsumido}L`,
  } as InsertHistoricoAlteracao);
}

/**
 * Obter lotes disponíveis para consumo PEPS
 */
export async function obterLotesDisponiveisPEPS(filtros: {
  postoId: number;
  tanqueId: number;
  produtoId: number;
}): Promise<
  Array<{
    id: number;
    chaveNfe: string;
    dataEntrada: Date;
    volumeDisponivel: number;
    custoUnitario: number;
  }>
> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const resultados = await db
    .select()
    .from(lotes)
    .where(
      and(
        eq(lotes.postoId, filtros.postoId),
        eq(lotes.tanqueId, filtros.tanqueId),
        eq(lotes.produtoId, filtros.produtoId),
        eq(lotes.status, "ativo" as any)
      )
    )
    .orderBy(lotes.dataEntrada);

  return resultados.map((r: any) => ({
    id: r.id,
    chaveNfe: r.chaveNfe,
    dataEntrada: r.dataEntrada,
    volumeDisponivel: parseFloat(r.quantidadeDisponivel),
    custoUnitario: parseFloat(r.custoUnitario),
  }));
}

/**
 * Criar alerta se houver divergência de estoque
 */
export async function criarAlertaDivergencia(dados: {
  postoId: number;
  tanqueId: number;
  titulo: string;
  mensagem: string;
  divergencia: number;
  percentual: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  await db.insert(alertas).values({
    tipo: "diferenca_medicao",
    postoId: dados.postoId,
    tanqueId: dados.tanqueId,
    titulo: dados.titulo,
    mensagem: dados.mensagem,
    dados: JSON.stringify({
      divergencia: dados.divergencia,
      percentual: dados.percentual,
    }),
    status: "pendente",
  });
}

/**
 * Obter histórico de alocações de um lote
 */
export async function obterHistoricoLote(loteId: number): Promise<
  Array<{
    acao: string;
    dataAlteracao: Date;
    usuarioNome: string;
    justificativa: string;
  }>
> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const resultados = await db
    .select()
    .from(historicoAlteracoes)
    .where(
      and(
        eq(historicoAlteracoes.tabela, "lotes"),
        eq(historicoAlteracoes.registroId, loteId)
      )
    )
    .orderBy(desc(historicoAlteracoes.createdAt));

  return resultados.map((r: any) => ({
    acao: r.acao,
    dataAlteracao: r.createdAt,
    usuarioNome: r.usuarioNome || "Sistema",
    justificativa: r.justificativa || "",
  }));
}

/**
 * Desfazer alocação - deleta o lote completamente para que a NFe volte a aparecer como pendente
 */
export async function desfazerAlocacao(dados: {
  loteId: number;
  justificativa: string;
  usuarioId: number;
}): Promise<{ numeroNf: string; volumeAlocado: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  // Buscar lote antes de deletar para registrar auditoria
  const lote = await db
    .select()
    .from(lotes)
    .where(eq(lotes.id, dados.loteId))
    .limit(1);

  if (!lote || lote.length === 0) {
    throw new Error(`Lote ${dados.loteId} não encontrado`);
  }

  const loteAtual = lote[0] as any;

  // Verificar se o lote já teve consumo (não pode desfazer se já foi consumido parcialmente)
  const consumos = await db
    .select()
    .from(consumoLotes)
    .where(eq(consumoLotes.loteId, dados.loteId));

  if (consumos.length > 0) {
    throw new Error("Não é possível desfazer alocação de um lote que já teve consumo PEPS. Exclua os consumos primeiro.");
  }

  // Registrar auditoria ANTES de deletar
  await db.insert(historicoAlteracoes).values({
    tabela: "lotes",
    registroId: dados.loteId,
    acao: "delete",
    camposAlterados: "lote completo",
    valoresAntigos: JSON.stringify({
      id: loteAtual.id,
      chaveNfe: loteAtual.chaveNfe,
      numeroNf: loteAtual.numeroNf,
      postoId: loteAtual.postoId,
      tanqueId: loteAtual.tanqueId,
      volumeAlocado: loteAtual.quantidadeOriginal,
      custoUnitario: loteAtual.custoUnitario,
      custoTotal: loteAtual.custoTotal,
      nomeFornecedor: loteAtual.nomeFornecedor,
      nomeProduto: loteAtual.nomeProduto,
    }),
    valoresNovos: JSON.stringify({ status: "desfeito" }),
    usuarioId: dados.usuarioId,
    justificativa: dados.justificativa || "Alocação desfeita pelo usuário",
  } as InsertHistoricoAlteracao);

  // Deletar o lote completamente
  await db.delete(lotes).where(eq(lotes.id, dados.loteId));

  return {
    numeroNf: loteAtual.numeroNf,
    volumeAlocado: parseFloat(loteAtual.quantidadeOriginal),
  };
}

/**
 * Cancelar alocação (soft delete - mantém no banco como cancelado)
 * @deprecated Use desfazerAlocacao para deletar completamente
 */
export async function cancelarAlocacao(dados: {
  loteId: number;
  justificativa: string;
  usuarioId: number;
}): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database connection failed");

  const lote = await db
    .select()
    .from(lotes)
    .where(eq(lotes.id, dados.loteId))
    .limit(1);

  if (!lote || lote.length === 0) {
    throw new Error(`Lote ${dados.loteId} não encontrado`);
  }

  const loteAtual = lote[0];

  await db
    .update(lotes)
    .set({ status: "cancelado" })
    .where(eq(lotes.id, dados.loteId));

  await db.insert(historicoAlteracoes).values({
    tabela: "lotes",
    registroId: dados.loteId,
    acao: "update",
    camposAlterados: "status",
    valoresAntigos: JSON.stringify({ status: loteAtual.status }),
    valoresNovos: JSON.stringify({ status: "cancelado" }),
    usuarioId: dados.usuarioId,
    justificativa: dados.justificativa,
  } as InsertHistoricoAlteracao);
}
