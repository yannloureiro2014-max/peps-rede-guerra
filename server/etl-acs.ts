import { getDb } from "./db";
import { postos, produtos, tanques, vendas, syncLogs } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import mysql from "mysql2/promise";

// Configuração do banco ACS
const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

// Mapeamento de empresas ACS para postos PEPS
const MAPEAMENTO_POSTOS: Record<string, { nome: string; cnpj: string }> = {
  "01": { nome: "POSTO GUERRA FORTIM", cnpj: "30.951.450/0005-54" },
  "02": { nome: "POSTO GUERRA PALHANO", cnpj: "30.951.450/0002-01" },
  "03": { nome: "PAI TEREZA COMERCIAL LTDA", cnpj: "04.212.366/0001-85" },
  "04": { nome: "REDE SUPER PETROLEO", cnpj: "50.489.002/0001-64" },
  "05": { nome: "POSTO JAGUARUANA", cnpj: "53.776.141/0001-67" },
  "06": { nome: "POSTO GUERRA ITAIÇABA", cnpj: "30.951.450/0001-20" },
};

// Mapeamento de tanques por posto
const MAPEAMENTO_TANQUES: Record<string, { combustivel: string; capacidade: number }[]> = {
  "POSTO GUERRA FORTIM": [
    { combustivel: "GASOLINA COMUM", capacidade: 10000 },
    { combustivel: "ETANOL HIDRATADO", capacidade: 10000 },
    { combustivel: "DIESEL S10", capacidade: 10000 },
  ],
  "REDE SUPER PETROLEO": [
    { combustivel: "GASOLINA COMUM", capacidade: 20000 },
    { combustivel: "ETANOL HIDRATADO", capacidade: 10000 },
    { combustivel: "ETANOL HIDRATADO", capacidade: 10000 },
    { combustivel: "DIESEL S10", capacidade: 10000 },
  ],
  "POSTO GUERRA PALHANO": [
    { combustivel: "GASOLINA COMUM", capacidade: 10000 },
    { combustivel: "DIESEL S10", capacidade: 10000 },
  ],
  "POSTO GUERRA ITAIÇABA": [
    { combustivel: "GASOLINA COMUM", capacidade: 10000 },
    { combustivel: "DIESEL S10", capacidade: 10000 },
  ],
  "POSTO JAGUARUANA": [
    { combustivel: "GASOLINA COMUM", capacidade: 20000 },
    { combustivel: "DIESEL S10", capacidade: 10000 },
  ],
  "PAI TEREZA COMERCIAL LTDA": [
    { combustivel: "ETANOL HIDRATADO", capacidade: 15000 },
    { combustivel: "GASOLINA COMUM", capacidade: 15000 },
    { combustivel: "DIESEL S10", capacidade: 20000 },
  ],
};

export async function sincronizarDadosIniciais() {
  const db = await getDb();
  if (!db) {
    console.error("[ETL] Database not available");
    return { success: false, error: "Database not available" };
  }

  try {
    console.log("[ETL] Iniciando sincronização de dados iniciais...");

    // 1. Inserir produtos padrão
    const produtosPadrao = [
      { codigoAcs: "GC", descricao: "GASOLINA COMUM", tipo: "C" },
      { codigoAcs: "GA", descricao: "GASOLINA ADITIVADA", tipo: "C" },
      { codigoAcs: "EH", descricao: "ETANOL HIDRATADO", tipo: "C" },
      { codigoAcs: "DS10", descricao: "DIESEL S10", tipo: "C" },
      { codigoAcs: "DC", descricao: "DIESEL COMUM", tipo: "C" },
    ];

    for (const prod of produtosPadrao) {
      await db.insert(produtos).values(prod).onDuplicateKeyUpdate({ set: { descricao: prod.descricao } });
    }
    console.log("[ETL] Produtos inseridos/atualizados");

    // 2. Inserir postos
    for (const [codigo, dados] of Object.entries(MAPEAMENTO_POSTOS)) {
      await db.insert(postos).values({
        codigoAcs: codigo,
        nome: dados.nome,
        cnpj: dados.cnpj,
      }).onDuplicateKeyUpdate({ set: { nome: dados.nome, cnpj: dados.cnpj } });
    }
    console.log("[ETL] Postos inseridos/atualizados");

    // 3. Buscar IDs dos postos e produtos
    const postosDb = await db.select().from(postos);
    const produtosDb = await db.select().from(produtos);

    // 4. Inserir tanques
    for (const posto of postosDb) {
      const tanquesConfig = MAPEAMENTO_TANQUES[posto.nome];
      if (!tanquesConfig) continue;

      for (let i = 0; i < tanquesConfig.length; i++) {
        const config = tanquesConfig[i];
        const produto = produtosDb.find(p => p.descricao === config.combustivel);
        if (!produto) continue;

        const codigoTanque = `T${String(i + 1).padStart(2, "0")}`;
        
        // Verificar se já existe
        const existente = await db.select().from(tanques)
          .where(sql`${tanques.postoId} = ${posto.id} AND ${tanques.codigoAcs} = ${codigoTanque}`)
          .limit(1);

        if (existente.length === 0) {
          await db.insert(tanques).values({
            postoId: posto.id,
            codigoAcs: codigoTanque,
            produtoId: produto.id,
            capacidade: config.capacidade.toString(),
            estoqueMinimo: "1000",
          });
        }
      }
    }
    console.log("[ETL] Tanques inseridos");

    // Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "dados_iniciais",
      dataInicio: new Date(),
      dataFim: new Date(),
      registrosProcessados: Object.keys(MAPEAMENTO_POSTOS).length,
      registrosInseridos: Object.keys(MAPEAMENTO_POSTOS).length,
      status: "sucesso",
      mensagem: "Dados iniciais sincronizados com sucesso",
    });

    return { success: true, message: "Dados iniciais sincronizados" };
  } catch (error) {
    console.error("[ETL] Erro na sincronização:", error);
    return { success: false, error: String(error) };
  }
}

// Exportar função para uso via API
export { sincronizarDadosIniciais as syncInitialData };
