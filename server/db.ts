import { eq, desc, and, gte, lte, sql, sum, isNull } from "drizzle-orm";
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
  syncLogs, InsertSyncLog,
  historicoAlteracoes, InsertHistoricoAlteracao
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

// ==================== LOTES (CRUD COMPLETO) ====================
export async function getLotesAtivos(tanqueId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  return db.select({
    id: lotes.id,
    tanqueId: lotes.tanqueId,
    postoId: lotes.postoId,
    numeroNf: lotes.numeroNf,
    chaveNfe: lotes.chaveNfe,
    fornecedorId: lotes.fornecedorId,
    dataEntrada: lotes.dataEntrada,
    quantidadeOriginal: lotes.quantidadeOriginal,
    quantidadeDisponivel: lotes.quantidadeDisponivel,
    custoUnitario: lotes.custoUnitario,
    custoTotal: lotes.custoTotal,
    origem: lotes.origem,
    ordemConsumo: lotes.ordemConsumo,
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
}

export async function getLotes(postoId?: number, status?: string, limite?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (postoId) conditions.push(eq(lotes.postoId, postoId));
  if (status) conditions.push(eq(lotes.status, status as any));
  
  return db.select({
    id: lotes.id,
    codigoAcs: lotes.codigoAcs,
    tanqueId: lotes.tanqueId,
    postoId: lotes.postoId,
    produtoId: lotes.produtoId,
    numeroNf: lotes.numeroNf,
    serieNf: lotes.serieNf,
    chaveNfe: lotes.chaveNfe,
    dataEmissao: lotes.dataEmissao,
    dataEntrada: lotes.dataEntrada,
    dataLmc: lotes.dataLmc,
    quantidadeOriginal: lotes.quantidadeOriginal,
    quantidadeDisponivel: lotes.quantidadeDisponivel,
    custoUnitario: lotes.custoUnitario,
    custoTotal: lotes.custoTotal,
    status: lotes.status,
    origem: lotes.origem,
    fornecedorId: lotes.fornecedorId,
    postoNome: postos.nome,
    tanqueCodigo: tanques.codigoAcs,
    produtoDescricao: produtos.descricao
  })
  .from(lotes)
  .leftJoin(postos, eq(lotes.postoId, postos.id))
  .leftJoin(tanques, eq(lotes.tanqueId, tanques.id))
  .leftJoin(produtos, eq(lotes.produtoId, produtos.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(lotes.dataEntrada))
  .limit(limite || 500);
}

export async function getLoteById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(lotes).where(eq(lotes.id, id)).limit(1);
  return result[0];
}

export async function createLote(data: InsertLote, usuarioId?: number, usuarioNome?: string) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(lotes).values(data);
  
  // Registrar no histórico
  if (result[0]?.insertId) {
    await registrarHistorico("lotes", result[0].insertId, "insert", null, data, usuarioId, usuarioNome);
  }
}

export async function updateLote(id: number, data: Record<string, any>, usuarioId?: number, usuarioNome?: string, justificativa?: string) {
  const db = await getDb();
  if (!db) return;
  
  const antigo = await getLoteById(id);
  await db.update(lotes).set(data).where(eq(lotes.id, id));
  
  if (antigo) {
    await registrarHistorico("lotes", id, "update", antigo, data, usuarioId, usuarioNome, justificativa);
  }
}

export async function deleteLote(id: number, usuarioId?: number, usuarioNome?: string, justificativa?: string) {
  const db = await getDb();
  if (!db) return;
  
  const antigo = await getLoteById(id);
  await db.update(lotes).set({ status: "cancelado" }).where(eq(lotes.id, id));
  
  if (antigo) {
    await registrarHistorico("lotes", id, "delete", antigo, { status: "cancelado" }, usuarioId, usuarioNome, justificativa);
  }
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

// ==================== MEDIÇÕES (CRUD COMPLETO) ====================
export async function getMedicoes(tanqueId?: number, postoId?: number, limite: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (tanqueId) conditions.push(eq(medicoes.tanqueId, tanqueId));
  if (postoId) conditions.push(eq(medicoes.postoId, postoId));
  
  return db.select({
    id: medicoes.id,
    codigoAcs: medicoes.codigoAcs,
    tanqueId: medicoes.tanqueId,
    postoId: medicoes.postoId,
    dataMedicao: medicoes.dataMedicao,
    horaMedicao: medicoes.horaMedicao,
    volumeMedido: medicoes.volumeMedido,
    temperatura: medicoes.temperatura,
    estoqueEscritural: medicoes.estoqueEscritural,
    diferenca: medicoes.diferenca,
    percentualDiferenca: medicoes.percentualDiferenca,
    tipoDiferenca: medicoes.tipoDiferenca,
    observacoes: medicoes.observacoes,
    origem: medicoes.origem,
    postoNome: postos.nome,
    tanqueCodigo: tanques.codigoAcs,
    produtoDescricao: produtos.descricao
  })
  .from(medicoes)
  .leftJoin(tanques, eq(medicoes.tanqueId, tanques.id))
  .leftJoin(postos, eq(medicoes.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(medicoes.dataMedicao))
  .limit(limite);
}

export async function getMedicaoById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(medicoes).where(eq(medicoes.id, id)).limit(1);
  return result[0];
}

export async function createMedicao(data: InsertMedicao, usuarioId?: number, usuarioNome?: string) {
  const db = await getDb();
  if (!db) return;
  const result = await db.insert(medicoes).values(data);
  
  if (result[0]?.insertId) {
    await registrarHistorico("medicoes", result[0].insertId, "insert", null, data, usuarioId, usuarioNome);
  }
}

export async function updateMedicao(id: number, data: Record<string, any>, usuarioId?: number, usuarioNome?: string, justificativa?: string) {
  const db = await getDb();
  if (!db) return;
  
  const antigo = await getMedicaoById(id);
  await db.update(medicoes).set(data).where(eq(medicoes.id, id));
  
  if (antigo) {
    await registrarHistorico("medicoes", id, "update", antigo, data, usuarioId, usuarioNome, justificativa);
  }
}

export async function deleteMedicao(id: number, usuarioId?: number, usuarioNome?: string, justificativa?: string) {
  const db = await getDb();
  if (!db) return;
  
  const antigo = await getMedicaoById(id);
  await db.delete(medicoes).where(eq(medicoes.id, id));
  
  if (antigo) {
    await registrarHistorico("medicoes", id, "delete", antigo, null, usuarioId, usuarioNome, justificativa);
  }
}

export async function getMedicoesFaltantes(dias: number = 30) {
  const db = await getDb();
  if (!db) return [];
  
  const postosAtivos = await db.select().from(postos).where(eq(postos.ativo, 1));
  
  const hoje = new Date();
  const datasEsperadas: string[] = [];
  for (let i = 1; i <= dias; i++) {
    const data = new Date(hoje);
    data.setDate(data.getDate() - i);
    datasEsperadas.push(data.toISOString().split('T')[0]);
  }
  
  const dataInicio = new Date();
  dataInicio.setDate(dataInicio.getDate() - dias);
  
  const medicoesExistentes = await db.select({
    postoId: medicoes.postoId,
    dataMedicao: medicoes.dataMedicao,
  }).from(medicoes)
    .where(gte(medicoes.dataMedicao, dataInicio));
  
  const medicoesMap = new Set(
    medicoesExistentes.map(m => `${m.postoId}-${m.dataMedicao?.toISOString().split('T')[0]}`)
  );
  
  const faltantes: Array<{ postoId: number; postoNome: string; datasFaltantes: string[] }> = [];
  
  for (const posto of postosAtivos) {
    const datasFaltantes: string[] = [];
    
    for (const data of datasEsperadas) {
      if (!medicoesMap.has(`${posto.id}-${data}`)) {
        datasFaltantes.push(data);
      }
    }
    
    if (datasFaltantes.length > 0) {
      faltantes.push({
        postoId: posto.id,
        postoNome: posto.nome,
        datasFaltantes: datasFaltantes.sort().reverse(),
      });
    }
  }
  
  return faltantes;
}

// ==================== ALERTAS ====================
export async function getAlertasPendentes() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: alertas.id,
    tipo: alertas.tipo,
    postoId: alertas.postoId,
    tanqueId: alertas.tanqueId,
    titulo: alertas.titulo,
    mensagem: alertas.mensagem,
    dados: alertas.dados,
    status: alertas.status,
    createdAt: alertas.createdAt,
    postoNome: postos.nome
  })
  .from(alertas)
  .leftJoin(postos, eq(alertas.postoId, postos.id))
  .where(eq(alertas.status, "pendente"))
  .orderBy(desc(alertas.createdAt))
  .limit(50);
}

export async function getAlertasPorTipo(tipo: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: alertas.id,
    tipo: alertas.tipo,
    postoId: alertas.postoId,
    tanqueId: alertas.tanqueId,
    titulo: alertas.titulo,
    mensagem: alertas.mensagem,
    dados: alertas.dados,
    status: alertas.status,
    createdAt: alertas.createdAt,
    postoNome: postos.nome
  })
  .from(alertas)
  .leftJoin(postos, eq(alertas.postoId, postos.id))
  .where(eq(alertas.tipo, tipo as any))
  .orderBy(desc(alertas.createdAt))
  .limit(100);
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

// ==================== HISTÓRICO ====================
export async function registrarHistorico(
  tabela: string, 
  registroId: number, 
  acao: "insert" | "update" | "delete",
  valoresAntigos: any,
  valoresNovos: any,
  usuarioId?: number,
  usuarioNome?: string,
  justificativa?: string
) {
  const db = await getDb();
  if (!db) return;
  
  const camposAlterados = valoresNovos ? Object.keys(valoresNovos).join(", ") : null;
  
  await db.insert(historicoAlteracoes).values({
    tabela,
    registroId,
    acao,
    camposAlterados,
    valoresAntigos: valoresAntigos ? JSON.stringify(valoresAntigos) : null,
    valoresNovos: valoresNovos ? JSON.stringify(valoresNovos) : null,
    usuarioId,
    usuarioNome,
    justificativa,
  });
}

export async function getHistorico(tabela?: string, registroId?: number, limite: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (tabela) conditions.push(eq(historicoAlteracoes.tabela, tabela));
  if (registroId) conditions.push(eq(historicoAlteracoes.registroId, registroId));
  
  return db.select()
    .from(historicoAlteracoes)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(historicoAlteracoes.createdAt))
    .limit(limite);
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
