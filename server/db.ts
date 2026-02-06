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
  else if (user.openId === ENV.ownerOpenId) { values.role = 'admin_geral'; updateSet.role = 'admin_geral'; }

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

// Retorna TODOS os postos (incluindo inativos) - para a aba de gerenciamento
export async function getAllPostos() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(postos).orderBy(postos.nome);
}

export async function togglePostoAtivo(id: number, ativo: boolean) {
  const db = await getDb();
  if (!db) return;
  await db.update(postos).set({ ativo: ativo ? 1 : 0 }).where(eq(postos.id, id));
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
  .innerJoin(postos, eq(tanques.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(and(eq(tanques.ativo, 1), eq(postos.ativo, 1)))
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
  // Sempre filtrar apenas postos ativos
  conditions.push(eq(postos.ativo, 1));
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
  .innerJoin(postos, eq(lotes.postoId, postos.id))
  .leftJoin(tanques, eq(lotes.tanqueId, tanques.id))
  .leftJoin(produtos, eq(lotes.produtoId, produtos.id))
  .where(and(...conditions))
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
    
    // RECALCULAR CMV RETROATIVO: Quando um lote é cadastrado, recalcular
    // o CMV de todas as vendas pendentes a partir da data de entrada do lote
    if (data.postoId && data.produtoId && data.dataEntrada) {
      try {
        const dataEntrada = new Date(data.dataEntrada);
        console.log(`[CREATE LOTE] Iniciando recálculo retroativo de CMV para lote ${result[0].insertId}...`);
        const recalcResult = await recalcularCMVRetroativo(data.postoId, data.produtoId, dataEntrada);
        console.log(`[CREATE LOTE] Recálculo concluído: ${recalcResult.recalculadas} vendas recalculadas, ${recalcResult.erros} erros`);
      } catch (error) {
        console.error("[CREATE LOTE] Erro ao recalcular CMV retroativo:", error);
      }
    }
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
  // Sempre filtrar apenas postos ativos
  conditions.push(eq(postos.ativo, 1));
  if (filtros.dataInicio) {
    // Usar UTC para evitar deslocamento de fuso horário
    const dataIni = new Date(filtros.dataInicio + 'T00:00:00.000Z');
    conditions.push(gte(vendas.dataVenda, dataIni));
  }
  if (filtros.dataFim) {
    const dataFi = new Date(filtros.dataFim + 'T23:59:59.999Z');
    conditions.push(lte(vendas.dataVenda, dataFi));
  }
  if (filtros.postoId) conditions.push(eq(postos.id, filtros.postoId));
  if (filtros.produtoId) conditions.push(eq(produtos.id, filtros.produtoId));
  
  return db.select({
    id: vendas.id,
    dataVenda: vendas.dataVenda,
    quantidade: vendas.quantidade,
    valorUnitario: vendas.valorUnitario,
    valorTotal: vendas.valorTotal,
    afericao: vendas.afericao,
    postoNome: postos.nome,
    tanqueCodigo: tanques.codigoAcs,
    produtoDescricao: produtos.descricao
  })
  .from(vendas)
  .innerJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .innerJoin(postos, eq(tanques.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(and(...conditions))
  .orderBy(desc(vendas.dataVenda))
  .limit(100000);
}

export async function createVenda(data: InsertVenda) {
  const db = await getDb();
  if (!db) return;
  await db.insert(vendas).values(data).onDuplicateKeyUpdate({ set: { id: data.id } });
}

export async function getVendasResumo(dias: number = 30, dataInicio?: string, dataFim?: string, postoId?: number) {
  const db = await getDb();
  if (!db) return { totalLitros: "0", totalValor: "0", totalRegistros: 0 };
  
  const conditions = [eq(postos.ativo, 1), eq(vendas.afericao, 0)];
  if (postoId) conditions.push(eq(vendas.postoId, postoId));
  if (dataInicio && dataFim) {
    conditions.push(gte(vendas.dataVenda, new Date(dataInicio + 'T00:00:00.000Z')));
    conditions.push(lte(vendas.dataVenda, new Date(dataFim + 'T23:59:59.999Z')));
  } else {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    conditions.push(gte(vendas.dataVenda, dataLimite));
  }
  
  const result = await db.select({
    totalLitros: sum(vendas.quantidade),
    totalValor: sum(vendas.valorTotal),
    totalRegistros: sql<number>`COUNT(*)`
  })
  .from(vendas)
  .innerJoin(postos, eq(vendas.postoId, postos.id))
  .where(and(...conditions));
  
  return {
    totalLitros: result[0]?.totalLitros || "0",
    totalValor: result[0]?.totalValor || "0",
    totalRegistros: result[0]?.totalRegistros || 0
  };
}

export async function getVendasPorPosto(dias: number = 30, dataInicio?: string, dataFim?: string, postoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(postos.ativo, 1), eq(vendas.afericao, 0)];
  if (postoId) conditions.push(eq(vendas.postoId, postoId));
  if (dataInicio && dataFim) {
    conditions.push(gte(vendas.dataVenda, new Date(dataInicio + 'T00:00:00.000Z')));
    conditions.push(lte(vendas.dataVenda, new Date(dataFim + 'T23:59:59.999Z')));
  } else {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    conditions.push(gte(vendas.dataVenda, dataLimite));
  }
  
  return db.select({
    postoNome: postos.nome,
    totalLitros: sum(vendas.quantidade),
    totalValor: sum(vendas.valorTotal)
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .where(and(...conditions))
  .groupBy(postos.nome)
  .orderBy(desc(sum(vendas.quantidade)));
}

export async function getVendasPorCombustivel(dias: number = 30, dataInicio?: string, dataFim?: string, postoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [eq(postos.ativo, 1), eq(vendas.afericao, 0)];
  if (postoId) conditions.push(eq(vendas.postoId, postoId));
  if (dataInicio && dataFim) {
    conditions.push(gte(vendas.dataVenda, new Date(dataInicio + 'T00:00:00.000Z')));
    conditions.push(lte(vendas.dataVenda, new Date(dataFim + 'T23:59:59.999Z')));
  } else {
    const dataLimite = new Date();
    dataLimite.setDate(dataLimite.getDate() - dias);
    conditions.push(gte(vendas.dataVenda, dataLimite));
  }
  
  return db.select({
    produtoDescricao: produtos.descricao,
    totalLitros: sum(vendas.quantidade),
    totalValor: sum(vendas.valorTotal)
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(postos, eq(vendas.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(and(...conditions))
  .groupBy(produtos.descricao)
  .orderBy(desc(sum(vendas.quantidade)));
}

// Lucro bruto por posto (receita - CMV)
export async function getLucroBrutoPorPosto(dataInicio: string, dataFim: string, postoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(postos.ativo, 1), 
    eq(vendas.afericao, 0),
    gte(vendas.dataVenda, new Date(dataInicio + 'T00:00:00.000Z')),
    lte(vendas.dataVenda, new Date(dataFim + 'T23:59:59.999Z'))
  ];
  if (postoId) conditions.push(eq(vendas.postoId, postoId));
  
  const result = await db.select({
    postoNome: postos.nome,
    totalValor: sum(vendas.valorTotal),
    totalCmv: sum(vendas.cmvCalculado),
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(postos, eq(tanques.postoId, postos.id))
  .where(and(...conditions))
  .groupBy(postos.nome)
  .orderBy(desc(sql`SUM(${vendas.valorTotal}) - SUM(${vendas.cmvCalculado})`));
  
  return result.map(r => ({
    postoNome: r.postoNome,
    totalValor: r.totalValor || "0",
    totalCmv: r.totalCmv || "0",
    lucroBruto: (parseFloat(r.totalValor || "0") - parseFloat(r.totalCmv || "0")).toFixed(2),
  }));
}

// Lucro bruto por combustível
export async function getLucroBrutoPorCombustivel(dataInicio: string, dataFim: string, postoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [
    eq(postos.ativo, 1), 
    eq(vendas.afericao, 0),
    gte(vendas.dataVenda, new Date(dataInicio + 'T00:00:00.000Z')),
    lte(vendas.dataVenda, new Date(dataFim + 'T23:59:59.999Z'))
  ];
  if (postoId) conditions.push(eq(vendas.postoId, postoId));
  
  const result = await db.select({
    produtoDescricao: produtos.descricao,
    totalValor: sum(vendas.valorTotal),
    totalCmv: sum(vendas.cmvCalculado),
  })
  .from(vendas)
  .leftJoin(tanques, eq(vendas.tanqueId, tanques.id))
  .leftJoin(postos, eq(vendas.postoId, postos.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(and(...conditions))
  .groupBy(produtos.descricao)
  .orderBy(desc(sql`SUM(${vendas.valorTotal}) - SUM(${vendas.cmvCalculado})`));
  
  return result.map(r => ({
    produtoDescricao: r.produtoDescricao,
    totalValor: r.totalValor || "0",
    totalCmv: r.totalCmv || "0",
    lucroBruto: (parseFloat(r.totalValor || "0") - parseFloat(r.totalCmv || "0")).toFixed(2),
  }));
}

// ==================== MEDIÇÕES (CRUD COMPLETO) ====================
export async function getMedicoes(tanqueId?: number, postoId?: number, limite: number = 100) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  // Sempre filtrar apenas postos ativos
  conditions.push(eq(postos.ativo, 1));
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
  .innerJoin(postos, eq(medicoes.postoId, postos.id))
  .leftJoin(tanques, eq(medicoes.tanqueId, tanques.id))
  .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
  .where(and(...conditions))
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
  .innerJoin(postos, eq(alertas.postoId, postos.id))
  .where(and(eq(alertas.status, "pendente"), eq(postos.ativo, 1)))
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
  .innerJoin(postos, eq(alertas.postoId, postos.id))
  .where(and(eq(alertas.tipo, tipo as any), eq(postos.ativo, 1)))
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
export async function getDashboardStats(dataInicio?: string, dataFim?: string, postoId?: number) {
  const db = await getDb();
  if (!db) return null;
  
  const [vendasResumo, postosCount, tanquesCount] = await Promise.all([
    getVendasResumo(30, dataInicio, dataFim, postoId),
    db.select({ count: sql<number>`COUNT(*)` }).from(postos).where(eq(postos.ativo, 1)),
    db.select({ count: sql<number>`COUNT(*)` }).from(tanques)
      .innerJoin(postos, eq(tanques.postoId, postos.id))
      .where(and(eq(tanques.ativo, 1), eq(postos.ativo, 1)))
  ]);
  
  return {
    ...vendasResumo,
    totalPostos: postosCount[0]?.count || 0,
    totalTanques: tanquesCount[0]?.count || 0
  };
}


// ==================== GESTÃO DE USUÁRIOS ====================
export async function getUsuarios() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: users.id,
    openId: users.openId,
    name: users.name,
    email: users.email,
    role: users.role,
    postoId: users.postoId,
    postoNome: postos.nome,
    createdAt: users.createdAt,
    lastSignedIn: users.lastSignedIn
  })
  .from(users)
  .leftJoin(postos, eq(users.postoId, postos.id))
  .orderBy(users.createdAt);
}

export async function getUsuarioById(id: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result[0] || null;
}

export async function createUsuario(data: { 
  email: string; 
  name: string; 
  role: string; 
  postoId?: number | null 
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const openId = data.email; // Usar email como openId temporário
  await db.insert(users).values({
    openId,
    email: data.email,
    name: data.name,
    role: data.role as any,
    postoId: data.postoId || null,
    loginMethod: "email"
  });
}

export async function updateUsuario(id: number, data: { 
  name?: string; 
  role?: string; 
  postoId?: number | null 
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const updateData: Record<string, any> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.postoId !== undefined) updateData.postoId = data.postoId;
  
  await db.update(users).set(updateData).where(eq(users.id, id));
}

export async function deleteUsuario(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

// ==================== INICIALIZAÇÃO MENSAL DE LOTES ====================
import { inicializacaoMensalLotes, InsertInicializacaoMensalLote } from "../drizzle/schema";

export async function criarInicializacaoMensal(data: {
  mesReferencia: string;
  postoId: number;
  produtoId: number;
  usuarioAdminId: number;
  lotesConfigurados: Array<{ loteId: number; saldoInicial: string; ordemConsumo: number }>;
  observacoes?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  const lotesJson = JSON.stringify(data.lotesConfigurados);
  
  // Calcular data de inicialização como primeiro dia do mês de referência
  // mesReferencia está no formato "YYYY-MM"
  const dataInicializacao = new Date(data.mesReferencia + "-01T00:00:00");
  
  // Inserir registro de inicialização
  await db.insert(inicializacaoMensalLotes).values({
    mesReferencia: data.mesReferencia,
    postoId: data.postoId,
    produtoId: data.produtoId,
    usuarioAdminId: data.usuarioAdminId,
    lotesConfigurados: lotesJson,
    observacoes: data.observacoes,
    dataInicializacao: dataInicializacao
  });
  
  // Atualizar saldos e ordem de consumo dos lotes
  for (const loteConfig of data.lotesConfigurados) {
    await db.update(lotes).set({
      quantidadeDisponivel: loteConfig.saldoInicial,
      ordemConsumo: loteConfig.ordemConsumo
    }).where(eq(lotes.id, loteConfig.loteId));
  }
  
  console.log(`[InicializacaoMensal] Mês ${data.mesReferencia} inicializado para posto ${data.postoId}, produto ${data.produtoId} com ${data.lotesConfigurados.length} lotes`);
}

export async function getInicializacoesMensais(postoId?: number, produtoId?: number) {
  const db = await getDb();
  if (!db) return [];
  
  const conditions = [];
  if (postoId) conditions.push(eq(inicializacaoMensalLotes.postoId, postoId));
  if (produtoId) conditions.push(eq(inicializacaoMensalLotes.produtoId, produtoId));
  
  return db.select({
    id: inicializacaoMensalLotes.id,
    mesReferencia: inicializacaoMensalLotes.mesReferencia,
    postoId: inicializacaoMensalLotes.postoId,
    produtoId: inicializacaoMensalLotes.produtoId,
    dataInicializacao: inicializacaoMensalLotes.dataInicializacao,
    usuarioAdminId: inicializacaoMensalLotes.usuarioAdminId,
    lotesConfigurados: inicializacaoMensalLotes.lotesConfigurados,
    observacoes: inicializacaoMensalLotes.observacoes,
    createdAt: inicializacaoMensalLotes.createdAt,
    postoNome: postos.nome,
    produtoDescricao: produtos.descricao
  })
  .from(inicializacaoMensalLotes)
  .leftJoin(postos, eq(inicializacaoMensalLotes.postoId, postos.id))
  .leftJoin(produtos, eq(inicializacaoMensalLotes.produtoId, produtos.id))
  .where(conditions.length > 0 ? and(...conditions) : undefined)
  .orderBy(desc(inicializacaoMensalLotes.dataInicializacao));
}

export async function verificarInicializacaoExistente(mesReferencia: string, postoId: number, produtoId: number) {
  const db = await getDb();
  if (!db) return false;
  
  const result = await db.select()
    .from(inicializacaoMensalLotes)
    .where(and(
      eq(inicializacaoMensalLotes.mesReferencia, mesReferencia),
      eq(inicializacaoMensalLotes.postoId, postoId),
      eq(inicializacaoMensalLotes.produtoId, produtoId)
    ))
    .limit(1);
  
  return result.length > 0;
}

export async function getInicializacaoById(id: number) {
  const db = await getDb();
  if (!db) return null;
  
  const result = await db.select({
    id: inicializacaoMensalLotes.id,
    mesReferencia: inicializacaoMensalLotes.mesReferencia,
    postoId: inicializacaoMensalLotes.postoId,
    produtoId: inicializacaoMensalLotes.produtoId,
    dataInicializacao: inicializacaoMensalLotes.dataInicializacao,
    usuarioAdminId: inicializacaoMensalLotes.usuarioAdminId,
    lotesConfigurados: inicializacaoMensalLotes.lotesConfigurados,
    observacoes: inicializacaoMensalLotes.observacoes,
    createdAt: inicializacaoMensalLotes.createdAt,
    postoNome: postos.nome,
    produtoDescricao: produtos.descricao
  })
  .from(inicializacaoMensalLotes)
  .leftJoin(postos, eq(inicializacaoMensalLotes.postoId, postos.id))
  .leftJoin(produtos, eq(inicializacaoMensalLotes.produtoId, produtos.id))
  .where(eq(inicializacaoMensalLotes.id, id))
  .limit(1);
  
  return result[0] || null;
}

export async function updateInicializacaoMensal(
  id: number, 
  lotesConfigurados: Array<{ loteId: number; saldoInicial: string; ordemConsumo: number }>,
  observacoes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar inicialização existente para obter mesReferencia
  const existente = await getInicializacaoById(id);
  if (!existente) throw new Error("Inicialização não encontrada");
  
  // Calcular data de inicialização como primeiro dia do mês de referência
  const dataInicializacao = new Date(existente.mesReferencia + "-01T00:00:00");
  
  // Atualizar registro de inicialização
  await db.update(inicializacaoMensalLotes).set({
    lotesConfigurados: JSON.stringify(lotesConfigurados),
    dataInicializacao: dataInicializacao,
    observacoes: observacoes || existente.observacoes
  }).where(eq(inicializacaoMensalLotes.id, id));
  
  // Atualizar saldos e ordem de consumo dos lotes
  for (const loteConfig of lotesConfigurados) {
    await db.update(lotes).set({
      quantidadeDisponivel: loteConfig.saldoInicial,
      ordemConsumo: loteConfig.ordemConsumo
    }).where(eq(lotes.id, loteConfig.loteId));
  }
  
  console.log(`[InicializacaoMensal] Atualizada inicialização ${id} com ${lotesConfigurados.length} lotes`);
  
  return existente;
}

export async function deleteInicializacaoMensal(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar inicialização para obter os lotes configurados
  const existente = await getInicializacaoById(id);
  if (!existente) throw new Error("Inicialização não encontrada");
  
  // Parsear lotes configurados
  let lotesConfigurados: Array<{ loteId: number }> = [];
  try {
    lotesConfigurados = JSON.parse(existente.lotesConfigurados || "[]");
  } catch (e) {
    console.error("Erro ao parsear lotesConfigurados:", e);
  }
  
  // Resetar os lotes para quantidade original
  for (const loteConfig of lotesConfigurados) {
    const lote = await db.select().from(lotes).where(eq(lotes.id, loteConfig.loteId)).limit(1);
    if (lote[0]) {
      await db.update(lotes).set({
        quantidadeDisponivel: lote[0].quantidadeOriginal,
        ordemConsumo: 0,
        status: "ativo"
      }).where(eq(lotes.id, loteConfig.loteId));
    }
  }
  
  // Excluir registro de inicialização
  await db.delete(inicializacaoMensalLotes).where(eq(inicializacaoMensalLotes.id, id));
  
  console.log(`[InicializacaoMensal] Excluída inicialização ${id}, ${lotesConfigurados.length} lotes resetados`);
  
  return existente;
}

// ==================== CÁLCULO PEPS NO BACKEND ====================
export async function calcularCMVPEPS(vendaId: number): Promise<{ cmvTotal: number; cmvUnitario: number; quantidadeRestante: number; lotesConsumidos: any[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // Buscar a venda
  const vendaResult = await db.select().from(vendas).where(eq(vendas.id, vendaId)).limit(1);
  if (!vendaResult[0]) throw new Error(`Venda ${vendaId} não encontrada`);
  
  const vendaData = vendaResult[0];
  const quantidadeVendida = parseFloat(vendaData.quantidade || "0");
  
  if (quantidadeVendida <= 0) {
    return { cmvTotal: 0, cmvUnitario: 0, quantidadeRestante: 0, lotesConsumidos: [] };
  }
  
  let quantidadeRestante = quantidadeVendida;
  let cmvTotal = 0;
  const lotesConsumidos: any[] = [];
  
  // Buscar lotes disponíveis do mesmo posto/produto, ordenados por ordemConsumo e dataEntrada (PEPS)
  const lotesDisponiveis = await db.select()
    .from(lotes)
    .where(and(
      eq(lotes.postoId, vendaData.postoId),
      eq(lotes.produtoId, vendaData.produtoId || 0),
      eq(lotes.status, "ativo"),
      sql`CAST(${lotes.quantidadeDisponivel} AS DECIMAL(12,3)) > 0`
    ))
    .orderBy(lotes.ordemConsumo, lotes.dataEntrada);
  
  // Consumir lotes na ordem PEPS
  for (const lote of lotesDisponiveis) {
    if (quantidadeRestante <= 0) break;
    
    const saldoLote = parseFloat(lote.quantidadeDisponivel || "0");
    if (saldoLote <= 0) continue;
    
    const quantidadeConsumida = Math.min(quantidadeRestante, saldoLote);
    const custoUnitario = parseFloat(lote.custoUnitario || "0");
    const custoTotal = quantidadeConsumida * custoUnitario;
    
    // Registrar consumo na tabela consumoLotes
    await db.insert(consumoLotes).values({
      vendaId: vendaData.id,
      loteId: lote.id,
      quantidadeConsumida: quantidadeConsumida.toFixed(3),
      custoUnitario: custoUnitario.toFixed(4),
      custoTotal: custoTotal.toFixed(2)
    });
    
    // Atualizar saldo do lote
    const novoSaldo = saldoLote - quantidadeConsumida;
    const novoStatus = novoSaldo <= 0.001 ? "consumido" : "ativo";
    
    await db.update(lotes).set({
      quantidadeDisponivel: novoSaldo.toFixed(3),
      status: novoStatus as any
    }).where(eq(lotes.id, lote.id));
    
    cmvTotal += custoTotal;
    quantidadeRestante -= quantidadeConsumida;
    
    lotesConsumidos.push({
      loteId: lote.id,
      numeroNf: lote.numeroNf,
      dataEntrada: lote.dataEntrada,
      custoUnitario,
      quantidadeConsumida,
      custoTotal,
      saldoAnterior: saldoLote,
      saldoAtual: novoSaldo
    });
  }
  
  // Calcular CMV unitário
  const cmvUnitario = quantidadeVendida > 0 ? cmvTotal / quantidadeVendida : 0;
  
  // Atualizar venda com CMV calculado
  const statusCmv = quantidadeRestante > 0.001 ? "erro" : "calculado";
  await db.update(vendas).set({
    cmvCalculado: cmvTotal.toFixed(2),
    cmvUnitario: cmvUnitario.toFixed(4),
    statusCmv: statusCmv as any
  }).where(eq(vendas.id, vendaData.id));
  
  // Se não conseguiu consumir toda a quantidade, gerar alerta
  if (quantidadeRestante > 0.001) {
    await db.insert(alertas).values({
      tipo: "lotes_insuficientes",
      postoId: vendaData.postoId,
      titulo: `Lotes Insuficientes - Venda ${vendaId}`,
      mensagem: `Não há lotes suficientes para cobrir a venda de ${quantidadeVendida.toFixed(3)} L. Faltam ${quantidadeRestante.toFixed(3)} L.`,
      dados: JSON.stringify({ vendaId, quantidadeVendida, quantidadeRestante, lotesConsumidos }),
      status: "pendente"
    });
    console.warn(`[PEPS] Venda ${vendaId}: Lotes insuficientes. Faltam ${quantidadeRestante.toFixed(3)} L`);
  }
  
  console.log(`[PEPS] Venda ${vendaId}: CMV calculado = R$ ${cmvTotal.toFixed(2)} (${lotesConsumidos.length} lotes consumidos)`);
  
  return { cmvTotal, cmvUnitario, quantidadeRestante, lotesConsumidos };
}

export async function getMemoriaCalculoCMV(vendaIds: number[]) {
  const db = await getDb();
  if (!db) return [];
  
  if (vendaIds.length === 0) return [];
  
  return db.select({
    id: consumoLotes.id,
    vendaId: consumoLotes.vendaId,
    loteId: consumoLotes.loteId,
    quantidadeConsumida: consumoLotes.quantidadeConsumida,
    custoUnitario: consumoLotes.custoUnitario,
    custoTotal: consumoLotes.custoTotal,
    createdAt: consumoLotes.createdAt,
    numeroNf: lotes.numeroNf,
    dataEntrada: lotes.dataEntrada,
    ordemConsumo: lotes.ordemConsumo
  })
  .from(consumoLotes)
  .leftJoin(lotes, eq(consumoLotes.loteId, lotes.id))
  .where(sql`${consumoLotes.vendaId} IN (${sql.raw(vendaIds.join(","))})`)
  .orderBy(consumoLotes.vendaId, lotes.ordemConsumo);
}

// ==================== DRE COM PEPS DO BACKEND ====================
export async function calcularDRE(filtros: { 
  postoId?: number; 
  produtoId?: number; 
  dataInicio: string; 
  dataFim: string 
}) {
  const db = await getDb();
  if (!db) return [];
  
  // Buscar vendas do período com CMV já calculado
  const conditions = [];
  
  // Usar UTC para evitar deslocamento de fuso horário
  const dataIni = new Date(filtros.dataInicio + 'T00:00:00.000Z');
  conditions.push(gte(vendas.dataVenda, dataIni));
  
  const dataFi = new Date(filtros.dataFim + 'T23:59:59.999Z');
  conditions.push(lte(vendas.dataVenda, dataFi));
  
  // IMPORTANTE: Excluir aferições do DRE - apenas vendas reais (afericao = 0)
  conditions.push(eq(vendas.afericao, 0));
  
  if (filtros.postoId) conditions.push(eq(vendas.postoId, filtros.postoId));
  if (filtros.produtoId) conditions.push(eq(vendas.produtoId, filtros.produtoId));
  
  const vendasData = await db.select({
    id: vendas.id,
    postoId: vendas.postoId,
    produtoId: vendas.produtoId,
    dataVenda: vendas.dataVenda,
    quantidade: vendas.quantidade,
    valorTotal: vendas.valorTotal,
    cmvCalculado: vendas.cmvCalculado,
    statusCmv: vendas.statusCmv,
    produtoDescricao: produtos.descricao,
    postoNome: postos.nome
  })
  .from(vendas)
  .leftJoin(produtos, eq(vendas.produtoId, produtos.id))
  .leftJoin(postos, eq(vendas.postoId, postos.id))
  .where(and(...conditions))
  .orderBy(vendas.dataVenda);
  
  // Buscar memória de cálculo para as vendas
  const vendaIds = vendasData.map(v => v.id);
  const memoriaCalculo = vendaIds.length > 0 ? await getMemoriaCalculoCMV(vendaIds) : [];
  
  // Agrupar por produto
  const drePorProduto: Record<number, {
    produtoId: number;
    produtoNome: string;
    quantidadeVendida: number;
    receitaBruta: number;
    cmv: number;
    lucroBruto: number;
    margemBruta: number;
    lotesConsumidos: any[];
  }> = {};
  
  for (const venda of vendasData) {
    const produtoId = venda.produtoId || 0;
    
    if (!drePorProduto[produtoId]) {
      drePorProduto[produtoId] = {
        produtoId,
        produtoNome: venda.produtoDescricao || `Produto ${produtoId}`,
        quantidadeVendida: 0,
        receitaBruta: 0,
        cmv: 0,
        lucroBruto: 0,
        margemBruta: 0,
        lotesConsumidos: []
      };
    }
    
    drePorProduto[produtoId].quantidadeVendida += parseFloat(venda.quantidade || "0");
    drePorProduto[produtoId].receitaBruta += parseFloat(venda.valorTotal || "0");
    drePorProduto[produtoId].cmv += parseFloat(venda.cmvCalculado || "0");
  }
  
  // Calcular lucro e margem, adicionar lotes consumidos
  for (const produtoId in drePorProduto) {
    const dre = drePorProduto[produtoId];
    dre.lucroBruto = dre.receitaBruta - dre.cmv;
    dre.margemBruta = dre.receitaBruta > 0 ? (dre.lucroBruto / dre.receitaBruta) * 100 : 0;
    
    // Filtrar lotes consumidos deste produto
    const vendasDoProduto = vendasData.filter(v => v.produtoId === parseInt(produtoId));
    const vendaIdsDoProduto = vendasDoProduto.map(v => v.id);
    dre.lotesConsumidos = memoriaCalculo.filter(m => vendaIdsDoProduto.includes(m.vendaId));
  }
  
  return Object.values(drePorProduto).sort((a, b) => b.receitaBruta - a.receitaBruta);
}


// ==================== RECÁLCULO RETROATIVO DE CMV ====================

/**
 * Recalcula o CMV de todas as vendas pendentes de um posto/produto a partir de uma data.
 * Esta função é chamada automaticamente quando um lote é cadastrado para garantir
 * que vendas anteriores consumam os lotes na ordem cronológica correta (PEPS).
 */
export async function recalcularCMVRetroativo(
  postoId: number, 
  produtoId: number, 
  dataInicio: Date
): Promise<{ recalculadas: number; erros: number; detalhes: any[] }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  console.log(`[RECALC CMV] Iniciando recálculo retroativo para posto ${postoId}, produto ${produtoId}, a partir de ${dataInicio.toISOString()}`);
  
  // 1. Primeiro, resetar os lotes do posto/produto para recalcular do zero
  // Buscar todos os lotes ativos do posto/produto
  const lotesDoPostoProduto = await db.select()
    .from(lotes)
    .where(and(
      eq(lotes.postoId, postoId),
      eq(lotes.produtoId, produtoId),
      sql`${lotes.status} IN ('ativo', 'consumido')`
    ))
    .orderBy(lotes.ordemConsumo, lotes.dataEntrada);
  
  // Resetar quantidadeDisponivel para quantidadeOriginal
  for (const lote of lotesDoPostoProduto) {
    await db.update(lotes).set({
      quantidadeDisponivel: lote.quantidadeOriginal,
      status: "ativo"
    }).where(eq(lotes.id, lote.id));
    console.log(`[RECALC CMV] Lote ${lote.id} (NF ${lote.numeroNf}) resetado: ${lote.quantidadeOriginal} L`);
  }
  
  // 2. Buscar TODAS as vendas do posto/produto a partir da data de início
  // (não apenas pendentes, pois precisamos recalcular tudo na ordem correta)
  // IMPORTANTE: Excluir aferições (afericao = 1) - não devem consumir lotes
  const vendasParaRecalcular = await db.select()
    .from(vendas)
    .where(and(
      eq(vendas.postoId, postoId),
      eq(vendas.produtoId, produtoId),
      gte(vendas.dataVenda, dataInicio),
      eq(vendas.afericao, 0)
    ))
    .orderBy(vendas.dataVenda, vendas.id);
  
  console.log(`[RECALC CMV] Encontradas ${vendasParaRecalcular.length} vendas para recalcular`);
  
  let recalculadas = 0;
  let erros = 0;
  const detalhes: any[] = [];
  
  // 3. Processar cada venda em ordem cronológica
  for (const venda of vendasParaRecalcular) {
    try {
      // Limpar consumos antigos desta venda
      await db.delete(consumoLotes).where(eq(consumoLotes.vendaId, venda.id));
      
      // Recalcular CMV
      const resultado = await calcularCMVPEPS(venda.id);
      recalculadas++;
      
      detalhes.push({
        vendaId: venda.id,
        dataVenda: venda.dataVenda,
        quantidade: venda.quantidade,
        cmvCalculado: resultado.cmvTotal,
        lotesConsumidos: resultado.lotesConsumidos.length,
        status: resultado.quantidadeRestante > 0.001 ? "erro" : "sucesso"
      });
      
      console.log(`[RECALC CMV] Venda ${venda.id} (${venda.dataVenda}) recalculada: CMV = R$ ${resultado.cmvTotal.toFixed(2)}`);
    } catch (error) {
      erros++;
      console.error(`[RECALC CMV] Erro ao recalcular venda ${venda.id}:`, error);
      
      // Marcar venda com erro
      await db.update(vendas).set({ 
        statusCmv: "erro",
        cmvCalculado: "0",
        cmvUnitario: "0"
      }).where(eq(vendas.id, venda.id));
      
      detalhes.push({
        vendaId: venda.id,
        dataVenda: venda.dataVenda,
        quantidade: venda.quantidade,
        status: "erro",
        erro: String(error)
      });
    }
  }
  
  // 4. Registrar no histórico
  await registrarHistorico(
    "recalculo_cmv",
    postoId,
    "update",
    null,
    { 
      postoId, 
      produtoId, 
      dataInicio: dataInicio.toISOString(), 
      vendasRecalculadas: recalculadas, 
      erros 
    },
    undefined,
    "Sistema"
  );
  
  console.log(`[RECALC CMV] Finalizado: ${recalculadas} recalculadas, ${erros} erros`);
  
  return { recalculadas, erros, detalhes };
}

/**
 * Recalcula o CMV de todas as vendas pendentes no sistema, agrupadas por posto/produto.
 * Útil para processar em lote vendas que não tinham lotes disponíveis no momento da sincronização.
 */
export async function recalcularTodasVendasPendentes(): Promise<{ 
  totalRecalculadas: number; 
  totalErros: number;
  grupos: number;
  detalhes: any[] 
}> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  console.log(`[RECALC CMV] Iniciando recálculo de todas as vendas pendentes...`);
  
  // Buscar vendas pendentes agrupadas por posto/produto
  const vendasPendentes = await db.select({
    postoId: vendas.postoId,
    produtoId: vendas.produtoId,
    dataVenda: sql<Date>`MIN(${vendas.dataVenda})`,
    total: sql<number>`COUNT(*)`
  })
  .from(vendas)
  .where(eq(vendas.statusCmv, "pendente"))
  .groupBy(vendas.postoId, vendas.produtoId)
  .orderBy(sql`MIN(${vendas.dataVenda})`);
  
  console.log(`[RECALC CMV] Encontrados ${vendasPendentes.length} grupos de vendas pendentes`);
  
  let totalRecalculadas = 0;
  let totalErros = 0;
  const detalhes: any[] = [];
  
  for (const grupo of vendasPendentes) {
    try {
      const resultado = await recalcularCMVRetroativo(
        grupo.postoId,
        grupo.produtoId || 0,
        new Date(grupo.dataVenda)
      );
      
      totalRecalculadas += resultado.recalculadas;
      totalErros += resultado.erros;
      
      detalhes.push({
        postoId: grupo.postoId,
        produtoId: grupo.produtoId,
        dataInicio: grupo.dataVenda,
        vendasRecalculadas: resultado.recalculadas,
        erros: resultado.erros
      });
    } catch (error) {
      console.error(`[RECALC CMV] Erro ao processar grupo posto=${grupo.postoId} produto=${grupo.produtoId}:`, error);
      totalErros++;
      detalhes.push({
        postoId: grupo.postoId,
        produtoId: grupo.produtoId,
        status: "erro",
        erro: String(error)
      });
    }
  }
  
  console.log(`[RECALC CMV] Recálculo total finalizado: ${totalRecalculadas} vendas, ${totalErros} erros, ${vendasPendentes.length} grupos`);
  
  return { 
    totalRecalculadas, 
    totalErros, 
    grupos: vendasPendentes.length,
    detalhes 
  };
}
