import { getDb } from "./db";
import { postos, produtos, tanques, vendas, syncLogs } from "../drizzle/schema";
import { eq, sql } from "drizzle-orm";
import pg from "pg";

// Configuração do banco ACS (PostgreSQL externo)
const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

// Mapeamento de tipo_combustivel ACS para descrição padronizada
const MAPEAMENTO_COMBUSTIVEL: Record<string, string> = {
  "GC": "GASOLINA COMUM",
  "GA": "GASOLINA ADITIVADA",
  "ET": "ETANOL HIDRATADO",
  "DS": "DIESEL S10",
  "DC": "DIESEL COMUM",
};

async function getAcsClient(): Promise<pg.Client | null> {
  try {
    const client = new pg.Client(ACS_CONFIG);
    await client.connect();
    return client;
  } catch (error) {
    console.error("[ETL] Erro ao conectar ao ACS:", error);
    return null;
  }
}

export async function sincronizarPostosACS() {
  const db = await getDb();
  if (!db) {
    console.error("[ETL] Database PEPS not available");
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log("[ETL] Sincronizando postos do ACS...");

    // Buscar empresas do ACS
    const result = await acsClient.query(`
      SELECT 
        codigo,
        nome_fantasia,
        razao_social,
        cnpj,
        endereco,
        numero,
        bairro,
        uf
      FROM empresa
      ORDER BY codigo
    `);

    let inseridos = 0;
    let atualizados = 0;

    for (const row of result.rows) {
      const cnpjFormatado = row.cnpj ? formatarCNPJ(row.cnpj) : null;
      const endereco = [row.endereco, row.numero, row.bairro, row.uf].filter(Boolean).join(", ");

      // Verificar se já existe
      const existente = await db.select().from(postos)
        .where(eq(postos.codigoAcs, row.codigo.trim()))
        .limit(1);

      if (existente.length === 0) {
        await db.insert(postos).values({
          codigoAcs: row.codigo.trim(),
          nome: row.nome_fantasia?.trim() || row.razao_social?.trim() || `Posto ${row.codigo}`,
          cnpj: cnpjFormatado,
          endereco: endereco || null,
        });
        inseridos++;
      } else {
        await db.update(postos)
          .set({
            nome: row.nome_fantasia?.trim() || row.razao_social?.trim() || existente[0].nome,
            cnpj: cnpjFormatado || existente[0].cnpj,
            endereco: endereco || existente[0].endereco,
          })
          .where(eq(postos.id, existente[0].id));
        atualizados++;
      }
    }

    console.log(`[ETL] Postos: ${inseridos} inseridos, ${atualizados} atualizados`);
    return { success: true, inseridos, atualizados };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar postos:", error);
    return { success: false, error: String(error) };
  } finally {
    await acsClient.end();
  }
}

export async function sincronizarProdutosACS() {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log("[ETL] Sincronizando produtos do ACS...");

    // Buscar produtos combustíveis do ACS
    const result = await acsClient.query(`
      SELECT 
        codigo,
        descricao,
        tipo,
        tipo_combustivel
      FROM produtos
      WHERE tipo = 'C'
      ORDER BY codigo
    `);

    let inseridos = 0;

    for (const row of result.rows) {
      const codigoAcs = row.codigo.trim();
      const descricao = row.descricao?.trim() || `Combustível ${codigoAcs}`;
      const tipoComb = row.tipo_combustivel?.trim() || "GC";

      // Verificar se já existe
      const existente = await db.select().from(produtos)
        .where(eq(produtos.codigoAcs, codigoAcs))
        .limit(1);

      if (existente.length === 0) {
        await db.insert(produtos).values({
          codigoAcs,
          descricao,
          tipo: "C",
        });
        inseridos++;
      }
    }

    console.log(`[ETL] Produtos: ${inseridos} inseridos`);
    return { success: true, inseridos };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar produtos:", error);
    return { success: false, error: String(error) };
  } finally {
    await acsClient.end();
  }
}

export async function sincronizarTanquesACS() {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log("[ETL] Sincronizando tanques do ACS...");

    // Buscar tanques ativos do ACS
    const result = await acsClient.query(`
      SELECT 
        t.cod_empresa,
        t.codigo,
        t.cod_combustivel,
        t.capacidade,
        t.estoque_minimo,
        t.ativo,
        p.descricao as produto_descricao,
        p.tipo_combustivel
      FROM tanques t
      LEFT JOIN produtos p ON TRIM(t.cod_combustivel) = TRIM(p.codigo)
      WHERE t.ativo = 'S'
      ORDER BY t.cod_empresa, t.codigo
    `);

    // Buscar postos e produtos do PEPS
    const postosDb = await db.select().from(postos);
    const produtosDb = await db.select().from(produtos);

    let inseridos = 0;
    let atualizados = 0;

    for (const row of result.rows) {
      const codEmpresa = row.cod_empresa.trim();
      const codigoTanque = row.codigo.trim();
      const codCombustivel = row.cod_combustivel?.trim();

      // Encontrar posto correspondente
      const posto = postosDb.find(p => p.codigoAcs === codEmpresa);
      if (!posto) {
        console.log(`[ETL] Posto não encontrado para cod_empresa: ${codEmpresa}`);
        continue;
      }

      // Encontrar produto correspondente
      let produto = produtosDb.find(p => p.codigoAcs === codCombustivel);
      if (!produto) {
        // Tentar encontrar por descrição
        const descProduto = row.produto_descricao?.trim();
        produto = produtosDb.find(p => p.descricao?.includes(descProduto?.split(" ")[0] || ""));
      }

      // Verificar se já existe
      const existente = await db.select().from(tanques)
        .where(sql`${tanques.postoId} = ${posto.id} AND ${tanques.codigoAcs} = ${codigoTanque}`)
        .limit(1);

      if (existente.length === 0) {
        await db.insert(tanques).values({
          postoId: posto.id,
          codigoAcs: codigoTanque,
          produtoId: produto?.id || null,
          capacidade: row.capacidade?.toString() || "10000",
          estoqueMinimo: row.estoque_minimo?.toString() || "1000",
        });
        inseridos++;
      } else {
        await db.update(tanques)
          .set({
            produtoId: produto?.id || existente[0].produtoId,
            capacidade: row.capacidade?.toString() || existente[0].capacidade,
          })
          .where(eq(tanques.id, existente[0].id));
        atualizados++;
      }
    }

    console.log(`[ETL] Tanques: ${inseridos} inseridos, ${atualizados} atualizados`);
    return { success: true, inseridos, atualizados };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar tanques:", error);
    return { success: false, error: String(error) };
  } finally {
    await acsClient.end();
  }
}

export async function sincronizarVendasACS(diasAtras: number = 30) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log(`[ETL] Sincronizando vendas dos últimos ${diasAtras} dias...`);

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];

    // Buscar abastecimentos do ACS
    const result = await acsClient.query(`
      SELECT 
        a.cod_empresa,
        a.codigo as cod_abastecimento,
        a.cod_tanque,
        a.cod_combustivel,
        a.dt_abast,
        a.litros,
        a.preco,
        a.total,
        a.tipo_combustivel
      FROM abastecimentos a
      WHERE a.dt_abast >= $1
        AND a.baixado = 'S'
      ORDER BY a.dt_abast DESC
      LIMIT 10000
    `, [dataInicioStr]);

    // Buscar postos, tanques e produtos do PEPS
    const postosDb = await db.select().from(postos);
    const tanquesDb = await db.select().from(tanques);
    const produtosDb = await db.select().from(produtos);

    let inseridos = 0;
    let ignorados = 0;

    for (const row of result.rows) {
      const codEmpresa = row.cod_empresa?.trim();
      const codTanque = row.cod_tanque?.trim();
      const codAbast = row.cod_abastecimento?.trim();

      // Encontrar posto
      const posto = postosDb.find(p => p.codigoAcs === codEmpresa);
      if (!posto) {
        ignorados++;
        continue;
      }

      // Encontrar tanque
      const tanque = tanquesDb.find(t => t.postoId === posto.id && t.codigoAcs === codTanque);
      
      // Encontrar produto
      const codCombustivel = row.cod_combustivel?.trim();
      let produto = produtosDb.find(p => p.codigoAcs === codCombustivel);
      if (!produto) {
        // Tentar por tipo_combustivel
        const tipoComb = row.tipo_combustivel?.trim();
        const descPadrao = MAPEAMENTO_COMBUSTIVEL[tipoComb] || tipoComb;
        produto = produtosDb.find(p => p.descricao?.includes(descPadrao?.split(" ")[0] || ""));
      }

      // Verificar se já existe (por código único)
      const codigoVendaAcs = `${codEmpresa}-${codAbast}`;
      const existente = await db.select().from(vendas)
        .where(eq(vendas.codigoAcs, codigoVendaAcs))
        .limit(1);

      if (existente.length === 0) {
        await db.insert(vendas).values({
          postoId: posto.id,
          tanqueId: tanque?.id || null,
          produtoId: produto?.id || null,
          codigoAcs: codigoVendaAcs,
          dataVenda: new Date(row.dt_abast),
          quantidade: row.litros?.toString() || "0",
          valorUnitario: row.preco?.toString() || "0",
          valorTotal: row.total?.toString() || "0",
        });
        inseridos++;
      }
    }

    console.log(`[ETL] Vendas: ${inseridos} inseridas, ${ignorados} ignoradas`);

    // Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "vendas",
      dataInicio: new Date(),
      dataFim: new Date(),
      registrosProcessados: result.rows.length,
      registrosInseridos: inseridos,
      status: "sucesso",
      mensagem: `Sincronizadas ${inseridos} vendas dos últimos ${diasAtras} dias`,
    });

    return { success: true, inseridos, ignorados, total: result.rows.length };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar vendas:", error);
    return { success: false, error: String(error) };
  } finally {
    await acsClient.end();
  }
}

export async function sincronizarTudo(diasVendas: number = 60) {
  console.log("[ETL] Iniciando sincronização completa com ACS...");
  
  const resultados = {
    postos: await sincronizarPostosACS(),
    produtos: await sincronizarProdutosACS(),
    tanques: await sincronizarTanquesACS(),
    vendas: await sincronizarVendasACS(diasVendas),
  };

  const sucesso = Object.values(resultados).every(r => r.success);
  
  console.log("[ETL] Sincronização completa:", sucesso ? "SUCESSO" : "COM ERROS");
  console.log("[ETL] Resultados:", JSON.stringify(resultados, null, 2));

  return { success: sucesso, resultados };
}

// Função auxiliar para formatar CNPJ
function formatarCNPJ(cnpj: string): string {
  const numeros = cnpj.replace(/\D/g, "");
  if (numeros.length !== 14) return cnpj;
  return numeros.replace(
    /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
    "$1.$2.$3/$4-$5"
  );
}

// Exportar funções para uso via API
export { sincronizarTudo as syncAll };
