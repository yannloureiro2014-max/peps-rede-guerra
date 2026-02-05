import { getDb } from "./db";
import { postos, produtos, tanques, vendas, syncLogs, medicoes, lotes, fornecedores, alertas } from "../drizzle/schema";
import { eq, sql, and, between, isNull } from "drizzle-orm";
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

    // Buscar tanques ativos do ACS com saldo atual
    const result = await acsClient.query(`
      SELECT 
        t.cod_empresa,
        t.codigo,
        t.cod_combustivel,
        t.capacidade,
        t.estoque_minimo,
        t.ativo,
        t.saldo,
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
          saldoAtual: row.saldo?.toString() || "0",
        });
        inseridos++;
      } else {
        await db.update(tanques)
          .set({
            produtoId: produto?.id || existente[0].produtoId,
            capacidade: row.capacidade?.toString() || existente[0].capacidade,
            saldoAtual: row.saldo?.toString() || existente[0].saldoAtual,
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
        // Inserir a venda
        const insertResult = await db.insert(vendas).values({
          postoId: posto.id,
          tanqueId: tanque?.id || null,
          produtoId: produto?.id || null,
          codigoAcs: codigoVendaAcs,
          dataVenda: new Date(row.dt_abast),
          quantidade: row.litros?.toString() || "0",
          valorUnitario: row.preco?.toString() || "0",
          valorTotal: row.total?.toString() || "0",
          statusCmv: "pendente",
        });
        inseridos++;
        
        // Calcular CMV automaticamente após inserir a venda
        if (insertResult[0]?.insertId) {
          try {
            const { calcularCMVPEPS } = await import("./db");
            await calcularCMVPEPS(insertResult[0].insertId);
          } catch (cmvError) {
            console.error(`[ETL] Erro ao calcular CMV para venda ${insertResult[0].insertId}:`, cmvError);
            // Marcar venda com erro de CMV
            await db.update(vendas)
              .set({ statusCmv: "erro" })
              .where(eq(vendas.id, insertResult[0].insertId));
          }
        }
      }
    }

    console.log(`[ETL] Vendas: ${inseridos} inseridas (com CMV calculado), ${ignorados} ignoradas`);

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

// NOVA FUNÇÃO: Sincronizar medições físicas do LMC (Livro de Movimentação de Combustíveis)
export async function sincronizarMedicoesACS(diasAtras: number = 90) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log(`[ETL] Sincronizando medições físicas dos últimos ${diasAtras} dias...`);

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];

    // Buscar medições da tabela aberturas do ACS
    // A tabela aberturas contém as medições físicas diárias de cada tanque (abertura do dia)
    const result = await acsClient.query(`
      SELECT 
        a.cod_empresa,
        a.cod_tanque,
        a.data as data_lmc,
        a.volume as volume_medido,
        t.saldo as estoque_sistema,
        t.capacidade
      FROM aberturas a
      LEFT JOIN tanques t ON a.cod_empresa = t.cod_empresa AND a.cod_tanque = t.codigo
      WHERE a.data >= $1
      ORDER BY a.data DESC, a.cod_empresa, a.cod_tanque
    `, [dataInicioStr]);

    // Buscar postos e tanques do PEPS
    const postosDb = await db.select().from(postos);
    const tanquesDb = await db.select().from(tanques);

    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const row of result.rows) {
      const codEmpresa = row.cod_empresa?.trim();
      const codTanque = row.cod_tanque?.trim();
      const dataLmc = row.data_lmc;

      // Encontrar posto
      const posto = postosDb.find(p => p.codigoAcs === codEmpresa);
      if (!posto) {
        ignorados++;
        continue;
      }

      // Encontrar tanque
      const tanque = tanquesDb.find(t => t.postoId === posto.id && t.codigoAcs === codTanque);
      if (!tanque) {
        ignorados++;
        continue;
      }

      // Código único para a medição
      const codigoMedicaoAcs = `${codEmpresa}-${codTanque}-${dataLmc.toISOString().split('T')[0]}`;

      // Calcular diferença e tipo
      const volumeMedido = parseFloat(row.volume_medido || "0");
      const estoqueEscritural = parseFloat(row.estoque_sistema || "0");
      const diferenca = volumeMedido - estoqueEscritural;
      const percentualDiferenca = estoqueEscritural > 0 ? (diferenca / estoqueEscritural) * 100 : 0;
      
      let tipoDiferenca: "sobra" | "perda" | "ok" = "ok";
      if (diferenca > 0.5) tipoDiferenca = "sobra";
      else if (diferenca < -0.5) tipoDiferenca = "perda";

      // Verificar se já existe
      const existente = await db.select().from(medicoes)
        .where(eq(medicoes.codigoAcs, codigoMedicaoAcs))
        .limit(1);

      if (existente.length === 0) {
        await db.insert(medicoes).values({
          codigoAcs: codigoMedicaoAcs,
          tanqueId: tanque.id,
          postoId: posto.id,
          dataMedicao: new Date(dataLmc),
          horaMedicao: null,
          volumeMedido: volumeMedido.toFixed(3),
          temperatura: null,
          estoqueEscritural: estoqueEscritural.toFixed(3),
          diferenca: diferenca.toFixed(3),
          percentualDiferenca: percentualDiferenca.toFixed(4),
          tipoDiferenca,
          observacoes: null,
          origem: "acs",
        });
        inseridos++;
      } else {
        // Atualizar apenas se for do ACS (não sobrescrever edições manuais)
        if (existente[0].origem === "acs") {
          await db.update(medicoes)
            .set({
              volumeMedido: volumeMedido.toFixed(3),
              estoqueEscritural: estoqueEscritural.toFixed(3),
              diferenca: diferenca.toFixed(3),
              percentualDiferenca: percentualDiferenca.toFixed(4),
              tipoDiferenca,
              observacoes: existente[0].observacoes,
            })
            .where(eq(medicoes.id, existente[0].id));
          atualizados++;
        }
      }
    }

    console.log(`[ETL] Medições: ${inseridos} inseridas, ${atualizados} atualizadas, ${ignorados} ignoradas`);

    // Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "medicoes",
      dataInicio: new Date(),
      dataFim: new Date(),
      registrosProcessados: result.rows.length,
      registrosInseridos: inseridos,
      status: "sucesso",
      mensagem: `Sincronizadas ${inseridos} medições dos últimos ${diasAtras} dias`,
    });

    return { success: true, inseridos, atualizados, ignorados, total: result.rows.length };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar medições:", error);
    return { success: false, error: String(error) };
  } finally {
    await acsClient.end();
  }
}

// NOVA FUNÇÃO: Sincronizar notas fiscais de compra do ACS
export async function sincronizarComprasACS(diasAtras: number = 180) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log(`[ETL] Sincronizando notas fiscais de compra dos últimos ${diasAtras} dias...`);

    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);
    const dataInicioStr = dataInicio.toISOString().split("T")[0];

    // Buscar compras de combustível do ACS (tabela compras_comb + itens_compra_comb)
    const result = await acsClient.query(`
      SELECT 
        c.cod_empresa,
        c.codigo,
        c.documento as numero_nf,
        c.serie as serie_nf,
        c.chave_eletronica as chave_nfe,
        c.dt_emissao,
        c.dt_recebimento as dt_entrada,
        c.dt_lmc,
        c.cod_fornecedor,
        c.total_nota,
        i.cod_tanque,
        i.cod_combustivel,
        i.quantidade,
        i.custo_comenc as valor_unitario,
        i.valor_nominal as valor_total
      FROM compras_comb c
      JOIN itens_compra_comb i ON c.cod_empresa = i.cod_empresa AND c.codigo = i.cod_compra
      WHERE c.dt_recebimento >= $1
        AND (c.cancelada = 'N' OR c.cancelada IS NULL)
      ORDER BY c.dt_recebimento DESC
    `, [dataInicioStr]);

    // Buscar postos, tanques e produtos do PEPS
    const postosDb = await db.select().from(postos);
    const tanquesDb = await db.select().from(tanques);
    const produtosDb = await db.select().from(produtos);

    let inseridos = 0;
    let atualizados = 0;
    let ignorados = 0;

    for (const row of result.rows) {
      const codEmpresa = row.cod_empresa?.trim();
      const codCompra = row.codigo?.trim();
      const codTanque = row.cod_tanque?.trim();

      // Encontrar posto
      const posto = postosDb.find(p => p.codigoAcs === codEmpresa);
      if (!posto) {
        ignorados++;
        continue;
      }

      // Encontrar tanque
      const tanque = tanquesDb.find(t => t.postoId === posto.id && t.codigoAcs === codTanque);
      if (!tanque) {
        ignorados++;
        continue;
      }

      // Encontrar produto
      const codCombustivel = row.cod_combustivel?.trim();
      const produto = produtosDb.find(p => p.codigoAcs === codCombustivel);

      // Código único para a compra
      const codigoCompraAcs = `${codEmpresa}-${codCompra}`;

      const quantidade = parseFloat(row.quantidade || "0");
      const custoUnitario = parseFloat(row.valor_unitario || "0");
      const custoTotal = quantidade * custoUnitario; // Recalcular com base no custo real

      // Verificar se já existe
      const existente = await db.select().from(lotes)
        .where(eq(lotes.codigoAcs, codigoCompraAcs))
        .limit(1);

      if (existente.length === 0) {
        await db.insert(lotes).values({
          codigoAcs: codigoCompraAcs,
          tanqueId: tanque.id,
          postoId: posto.id,
          produtoId: produto?.id || null,
          numeroNf: row.numero_nf?.trim() || null,
          serieNf: row.serie_nf?.trim() || null,
          chaveNfe: row.chave_nfe?.trim() || null,
          dataEmissao: row.dt_emissao ? new Date(row.dt_emissao) : null,
          dataEntrada: new Date(row.dt_entrada),
          dataLmc: row.dt_lmc ? new Date(row.dt_lmc) : null,
          quantidadeOriginal: quantidade.toFixed(3),
          quantidadeDisponivel: quantidade.toFixed(3), // Inicialmente igual à original
          custoUnitario: custoUnitario.toFixed(4),
          custoTotal: custoTotal.toFixed(2),
          origem: "acs",
          status: "ativo",
        });
        inseridos++;
      } else {
        // Atualizar apenas se for do ACS
        if (existente[0].origem === "acs") {
          await db.update(lotes)
            .set({
              numeroNf: row.numero_nf?.trim() || existente[0].numeroNf,
              serieNf: row.serie_nf?.trim() || existente[0].serieNf,
              chaveNfe: row.chave_nfe?.trim() || existente[0].chaveNfe,
              custoUnitario: custoUnitario.toFixed(4),
              custoTotal: custoTotal.toFixed(2),
            })
            .where(eq(lotes.id, existente[0].id));
          atualizados++;
        }
      }
    }

    console.log(`[ETL] Compras: ${inseridos} inseridas, ${atualizados} atualizadas, ${ignorados} ignoradas`);

    // Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "compras",
      dataInicio: new Date(),
      dataFim: new Date(),
      registrosProcessados: result.rows.length,
      registrosInseridos: inseridos,
      status: "sucesso",
      mensagem: `Sincronizadas ${inseridos} notas fiscais dos últimos ${diasAtras} dias`,
    });

    return { success: true, inseridos, atualizados, ignorados, total: result.rows.length };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar compras:", error);
    return { success: false, error: String(error) };
  } finally {
    await acsClient.end();
  }
}

// NOVA FUNÇÃO: Verificar medições faltantes e gerar alertas
export async function verificarMedicoesFaltantes(diasVerificar: number = 30) {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  try {
    console.log(`[ETL] Verificando medições faltantes dos últimos ${diasVerificar} dias...`);

    // Buscar todos os postos e tanques ativos
    const postosDb = await db.select().from(postos).where(eq(postos.ativo, 1));
    const tanquesDb = await db.select().from(tanques).where(eq(tanques.ativo, 1));

    // Gerar lista de datas esperadas
    const hoje = new Date();
    const datasEsperadas: string[] = [];
    for (let i = 1; i <= diasVerificar; i++) {
      const data = new Date(hoje);
      data.setDate(data.getDate() - i);
      datasEsperadas.push(data.toISOString().split('T')[0]);
    }

    // Buscar medições existentes
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasVerificar);
    
    const medicoesExistentes = await db.select({
      postoId: medicoes.postoId,
      tanqueId: medicoes.tanqueId,
      dataMedicao: medicoes.dataMedicao,
    }).from(medicoes)
      .where(sql`${medicoes.dataMedicao} >= ${dataInicio.toISOString().split('T')[0]}`);

    // Criar mapa de medições existentes
    const medicoesMap = new Set(
      medicoesExistentes.map(m => `${m.postoId}-${m.tanqueId}-${m.dataMedicao?.toISOString().split('T')[0]}`)
    );

    // Verificar faltantes por posto
    const faltantesPorPosto: Record<number, { posto: string; datasFaltantes: string[] }> = {};

    for (const posto of postosDb) {
      const tanquesDoPosto = tanquesDb.filter(t => t.postoId === posto.id);
      const datasFaltantes: Set<string> = new Set();

      for (const data of datasEsperadas) {
        // Verificar se pelo menos um tanque do posto tem medição nessa data
        const temMedicao = tanquesDoPosto.some(t => 
          medicoesMap.has(`${posto.id}-${t.id}-${data}`)
        );

        if (!temMedicao) {
          datasFaltantes.add(data);
        }
      }

      if (datasFaltantes.size > 0) {
        faltantesPorPosto[posto.id] = {
          posto: posto.nome,
          datasFaltantes: Array.from(datasFaltantes).sort().reverse(),
        };
      }
    }

    // Gerar alertas para medições faltantes
    let alertasCriados = 0;
    for (const [postoId, info] of Object.entries(faltantesPorPosto)) {
      const postoIdNum = parseInt(postoId);
      
      // Verificar se já existe alerta pendente para este posto
      const alertaExistente = await db.select().from(alertas)
        .where(and(
          eq(alertas.tipo, "medicao_faltante"),
          eq(alertas.postoId, postoIdNum),
          eq(alertas.status, "pendente")
        ))
        .limit(1);

      const datasStr = info.datasFaltantes.slice(0, 10).join(", ");
      const mensagem = `Medições físicas faltantes para ${info.posto}: ${datasStr}${info.datasFaltantes.length > 10 ? ` e mais ${info.datasFaltantes.length - 10} datas` : ""}`;

      if (alertaExistente.length === 0) {
        await db.insert(alertas).values({
          tipo: "medicao_faltante",
          postoId: postoIdNum,
          titulo: `Medições Faltantes - ${info.posto}`,
          mensagem,
          dados: JSON.stringify(info.datasFaltantes),
          status: "pendente",
        });
        alertasCriados++;
      } else {
        // Atualizar alerta existente
        await db.update(alertas)
          .set({
            mensagem,
            dados: JSON.stringify(info.datasFaltantes),
          })
          .where(eq(alertas.id, alertaExistente[0].id));
      }
    }

    console.log(`[ETL] Alertas de medições faltantes: ${alertasCriados} criados`);
    return { 
      success: true, 
      alertasCriados, 
      faltantesPorPosto: Object.values(faltantesPorPosto) 
    };
  } catch (error) {
    console.error("[ETL] Erro ao verificar medições faltantes:", error);
    return { success: false, error: String(error) };
  }
}

// Função de sincronização completa atualizada
export async function sincronizarTudo(diasVendas: number = 60) {
  console.log("[ETL] Iniciando sincronização completa com ACS...");
  
  const resultados = {
    postos: await sincronizarPostosACS(),
    produtos: await sincronizarProdutosACS(),
    tanques: await sincronizarTanquesACS(),
    vendas: await sincronizarVendasACS(diasVendas),
    medicoes: await sincronizarMedicoesACS(90),
    compras: await sincronizarComprasACS(180),
    alertasMedicoes: await verificarMedicoesFaltantes(30),
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
