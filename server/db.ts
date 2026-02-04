import { eq, desc, and, gte, lte, sql, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  users, InsertUser,
  postos, InsertPosto,
  produtos, InsertProduto,
  tanques, InsertTanque,
  lotes, InsertLote,
  vendas, InsertVenda,
  consumoLotes, InsertConsumoLote,
  medicoes, InsertMedicao,
  alertas, InsertAlerta,
  configuracoes, InsertConfiguracao,
  syncLogs, InsertSyncLog
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== USERS ====================
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};

  if (user.name !== undefined) { values.name = user.name; updateSet.name = user.name; }
  if (user.email !== undefined) { values.email = user.email; updateSet.email = user.email; }
  if (user.loginMethod !== undefined) { values.loginMethod = user.loginMethod; updateSet.loginMethod = user.loginMethod; }
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }

  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ==================== POSTOS ====================
export async function getPostos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(postos).where(eq(postos.ativo, 1)).orderBy(postos.nome);
}

export async function getPostoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(postos).where(eq(postos.id, id)).limit(1);
  return result[0];
}

export async function createPosto(data: InsertPosto) {
  const db = await getDb();
  if (!db) return;
  await db.insert(postos).values(data);
}

// ==================== PRODUTOS ====================
export async function getProdutos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(produtos).where(eq(produtos.ativo, 1)).orderBy(produtos.descricao);
}

export async function createProduto(data: InsertProduto) {
  const db = await getDb();
  if (!db) return;
  await db.insert(produtos).values(data);
}

// ==================== TANQUES ====================
export async function getTanques() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: tanques.id,
    postoId: tanques.postoId,
    codigoAcs: tanques.codigoAcs,
    produtoId: tanques.produtoId,
    capacidade: tanques.capacidade,
    estoqueMinimo: tanques.estoqueMinimo,
    postoNome: postos.nome,
    produtoDescricao: produtos.descricao
  })
  .from(tanques)
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(eq(tanques.ativo, 1))
  .orderBy(postos.nome, tanques.codigoAcs);
}

export async function getTanquesByPosto(postoId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: tanques.id,
    codigoAcs: tanques.codigoAcs,
    produtoId: tanques.produtoId,
    capacidade: tanques.capacidade,
    produtoDescricao: produtos.descricao
  })
  .from(tanques)
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(and(eq(tanques.postoId, postoId), eq(tanques.ativo, 1)))
  .orderBy(tanques.codigoAcs);
}

export async function createTanque(data: InsertTanque) {
  const db = await getDb();
  if (!db) return;
  await db.insert(tanques).values(data);
}

// ==================== LOTES ====================
export async function getLotesAtivos(tanqueId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  let query = db.select({
    id: lotes.id,
    tanqueId: lotes.tanqueId,
    numeroNf: lotes.numeroNf,
    fornecedor: lotes.fornecedor,
    dataEntrada: lotes.dataEntrada,
    quantidadeOriginal: lotes.quantidadeOriginal,
    quantidadeDisponivel: lotes.quantidadeDisponivel,
    custoUnitario: lotes.custoUnitario,
    postoNome: postos.nome,
    tanqueCodigo: tanques.codigoAcs,
    produtoDescricao: produtos.descricao
  })
  .from(lotes)
  .leftJoin(tanques, eq(lotes.tanqueId, tanques.id))
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(eq(lotes.status, "ativo"))
  .orderBy(postos.nome, tanques.codigoAcs, lotes.dataEntrada);
  
  return query;
}

export async function createLote(data: InsertLote) {
  const db = await getDb();
  if (!db) return;
  await db.insert(lotes).values(data);
}

export async function getEstoquePorTanque(tanqueId: number) {
  const db = await getDb();
  if (!db) return "0";
  const result = await db.select({
    total: sum(lotes.quantidadeDisponivel)
  })
  .from(lotes)
  .where(and(eq(lotes.tanqueId, tanqueId), eq(lotes.status, "ativo")));
  return result[0]?.total || "0";
}

// ==================== VENDAS ====================
export async function getVendas(filtros: { postoId?: number; produtoId?: number; dataInicio?: string; dataFim?: string }) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (filtros.dataInicio) conditions.push(gte(vendas.dataVenda, new Date(filtros.dataInicio)));
  if (filtros.dataFim) conditions.push(lte(vendas.dataVenda, new Date(filtros.dataFim)));
  if (filtros.postoId) conditions.push(eq(postos.id, filtros.postoId));
  if (filtros.produtoId) conditions.push(eq(produtos.id, filtros.produtoId));
  
  return db.select({
    id: vendas.id,
    dataVenda: vendas.dataVenda,
    quantidade: vendas.quantidade,
    valorUnitario: vendas.valorUnitario,
    valorTotal: vendas.valorTotal,
    postoNome: postos.nome,
    tanqueCodigo: tanques.codigoAcs,
    produtoDescricao: produtos.descricao
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(vendas.dataVenda))
  .limit(1000);
}

export async function createVenda(data: InsertVenda) {
  const db = await getDb();
  if (!db) return;
  await db.insert(vendas).values(data).onDuplicateKeyUpdate({ set: { id: data.id } });
}

export async function getVendasResumo(dias: number = 30) {
  const db = await getDb();
  if (!db) return { totalLitros: "0", totalValor: "0", totalRegistros: 0 };
  
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  
  const result = await db.select({
    totalLitros: sum(vendas.quantidade),
    totalValor: sum(vendas.valorTotal),
    totalRegistros: sql<number>`COUNT(*)`
  })
  .from(vendas)
  .where(gte(vendas.dataVenda, dataLimite));
  
  return {
    totalLitros: result[0]?.totalLitros || "0",
    totalValor: result[0]?.totalValor || "0",
    totalRegistros: result[0]?.totalRegistros || 0
  };
}

export async function getVendasPorPosto(dias: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  
  return db.select({
    postoNome: postos.nome,
    totalLitros: sum(vendas.quantidade),
    totalValor: sum(vendas.valorTotal)
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .where(gte(vendas.dataVenda, dataLimite))
  .groupBy(postos.nome)
  .orderBy(desc(sum(vendas.quantidade)));
}

export async function getVendasPorCombustivel(dias: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const dataLimite = new Date();
  dataLimite.setDate(dataLimite.getDate() - dias);
  
  return db.select({
    produtoDescricao: produtos.descricao,
    totalLitros: sum(vendas.quantidade),
    totalValor: sum(vendas.valorTotal)
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(gte(vendas.dataVenda, dataLimite))
  .groupBy(produtos.descricao)
  .orderBy(desc(sum(vendas.quantidade)));
}

// ==================== MEDIÇÕES ====================
export async function getMedicoes(tanqueId?: number, limite: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = tanqueId ? eq(medicoes.tanqueId, tanqueId) : undefined;
  
  return db.select({
    id: medicoes.id,
    dataMedicao: medicoes.dataMedicao,
    horaMedicao: medicoes.horaMedicao,
    volumeMedido: medicoes.volumeMedido,
    estoqueEscritural: medicoes.estoqueEscritural,
    diferenca: medicoes.diferenca,
    percentualDiferenca: medicoes.percentualDiferenca,
    tipoDiferenca: medicoes.tipoDiferenca,
    observacoes: medicoes.observacoes,
    postoNome: postos.nome,
    tanqueCodigo: tanques.codigoAcs,
    produtoDescricao: produtos.descricao
  })
  .from(medicoes)
  .leftJoin(tanques, eq(medicoes.tanqueId, tanques.id))
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(conditions)
  .orderBy(desc(medicoes.dataMedicao))
  .limit(limite);
}

export async function createMedicao(data: InsertMedicao) {
  const db = await getDb();
  if (!db) return;
  await db.insert(medicoes).values(data);
}

// ==================== ALERTAS ====================
export async function getAlertasPendentes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertas)
    .where(eq(alertas.status, "pendente"))
    .orderBy(desc(alertas.createdAt))
    .limit(50);
}

export async function createAlerta(data: InsertAlerta) {
  const db = await getDb();
  if (!db) return;
  await db.insert(alertas).values(data);
}

export async function resolverAlerta(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(alertas)
    .set({ status: "resolvido", resolvedAt: new Date() })
    .where(eq(alertas.id, id));
}

// ==================== CONFIGURAÇÕES ====================
export async function getConfiguracoes() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(configuracoes).orderBy(configuracoes.chave);
}

export async function getConfiguracao(chave: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(configuracoes).where(eq(configuracoes.chave, chave)).limit(1);
  return result[0];
}

export async function setConfiguracao(chave: string, valor: string, descricao?: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(configuracoes)
    .values({ chave, valor, descricao })
    .onDuplicateKeyUpdate({ set: { valor, updatedAt: new Date() } });
}

// ==================== SYNC LOGS ====================
export async function createSyncLog(data: InsertSyncLog) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.insert(syncLogs).values(data);
  return result;
}

export async function updateSyncLog(id: number, data: Partial<InsertSyncLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncLogs).set(data).where(eq(syncLogs.id, id));
}

export async function getUltimaSincronizacao() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(syncLogs)
    .where(eq(syncLogs.status, "sucesso"))
    .orderBy(desc(syncLogs.createdAt))
    .limit(1);
  return result[0];
}

// ==================== DASHBOARD STATS ====================
export async function getDashboardStats() {
  const db = await getDb();
  if (!db) return null;
  
  const [vendasResumo, postosCount, tanquesCount] = await Promise.all([
    getVendasResumo(30),
    db.select({ count: sql<number>`COUNT(*)` }).from(postos).where(eq(postos.ativo, 1)),
    db.select({ count: sql<number>`COUNT(*)` }).from(tanques).where(eq(tanques.ativo, 1))
  ]);
  
  return {
    ...vendasResumo,
    totalPostos: postosCount[0]?.count || 0,
    totalTanques: tanquesCount[0]?.count || 0
  };
}
