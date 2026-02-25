import pg from "pg";
import { getDb } from "./db";
import { medicoes, postos, tanques, syncLogs, vendas, produtos } from "../drizzle/schema";
import { eq, gte, sql } from "drizzle-orm";

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

const DATA_CORTE = "2024-12-01"; // Data mínima permitida
const DIAS_POR_LOTE = 7; // Processar em lotes de 7 dias

const TIPOS_COMBUSTIVEL: Record<string, string> = {
  "G": "GASOLINA",
  "A": "ÁLCOOL",
  "DS": "DIESEL S10",
  "DC": "DIESEL COMUM",
};

// Pool de conexão reutilizável
let acsPool: pg.Pool | null = null;

async function getAcsPool(): Promise<pg.Pool | null> {
  try {
    if (!acsPool) {
      acsPool = new pg.Pool({
        ...ACS_CONFIG,
        max: 5,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      });

      acsPool.on('error', (err) => {
        console.error("[ETL] Erro no pool ACS:", err);
        acsPool = null;
      });
    }
    return acsPool;
  } catch (error) {
    console.error("[ETL] Erro ao criar pool ACS:", error);
    return null;
  }
}

async function getAcsClient(): Promise<pg.PoolClient | null> {
  try {
    const pool = await getAcsPool();
    if (!pool) return null;

    const client = await Promise.race([
      pool.connect(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Timeout ao conectar ao ACS")), 10000)
      ),
    ]);

    return client;
  } catch (error) {
    console.error("[ETL] Erro ao obter cliente ACS:", error);
    return null;
  }
}

export async function sincronizarMedicoesACS(diasAtras: number = 90) {
  const db = await getDb();
  if (!db) {
    console.error("[ETL] Database PEPS not available");
    return { success: false, error: "Database PEPS not available", inseridos: 0, atualizados: 0, ignorados: 0, total: 0 };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    console.error("[ETL] Não foi possível conectar ao banco ACS");
    return { success: false, error: "Não foi possível conectar ao banco ACS", inseridos: 0, atualizados: 0, ignorados: 0, total: 0 };
  }

  const tempoInicio = Date.now();
  let inseridos = 0;
  let atualizados = 0;
  let ignorados = 0;
  let totalRegistros = 0;

  try {
    console.log(`[ETL] ⏱️ Iniciando sincronização de medições (${diasAtras} dias em lotes de ${DIAS_POR_LOTE} dias)`);

    // Calcular datas
    const dataFim = new Date();
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);

    // Buscar postos e tanques uma única vez
    console.log("[ETL] 📍 Carregando postos e tanques...");
    const postosDb = await db.select().from(postos).where(eq(postos.ativo, 1));
    const tanquesDb = await db.select().from(tanques);
    console.log(`[ETL] ✅ Carregados ${postosDb.length} postos e ${tanquesDb.length} tanques`);

    // Processar em lotes de DIAS_POR_LOTE dias
    let dataLoteInicio = new Date(dataInicio);
    let loteNum = 1;

    while (dataLoteInicio < dataFim) {
      const dataLoteFim = new Date(dataLoteInicio);
      dataLoteFim.setDate(dataLoteFim.getDate() + DIAS_POR_LOTE);

      const dataLoteInicioStr = dataLoteInicio.toISOString().split("T")[0];
      const dataLoteFimStr = dataLoteFim > dataFim ? dataFim.toISOString().split("T")[0] : dataLoteFim.toISOString().split("T")[0];

      // Garantir que nunca busque antes da data de corte
      const dataLoteInicioFinal = dataLoteInicioStr > DATA_CORTE ? dataLoteInicioStr : DATA_CORTE;

      console.log(`[ETL] 📦 Lote ${loteNum}: ${dataLoteInicioFinal} até ${dataLoteFimStr}`);
      const tempoLoteInicio = Date.now();

      try {
        // Buscar medições com timeout
        let result: any = null;
        try {
          result = await Promise.race([
            acsClient.query(`
              SELECT 
                a.cod_empresa,
                a.cod_tanque,
                a.data as data_lmc,
                a.volume as volume_medido,
                t.saldo as estoque_sistema,
                t.capacidade
              FROM aberturas a
              LEFT JOIN tanques t ON a.cod_empresa = t.cod_empresa AND a.cod_tanque = t.codigo
              WHERE a.data >= $1 AND a.data < $2
              ORDER BY a.data DESC, a.cod_empresa, a.cod_tanque
            `, [dataLoteInicioFinal, dataLoteFimStr]),
            new Promise<never>((_, reject) =>
              setTimeout(() => reject(new Error("Timeout ao buscar medições do ACS")), 30000)
            ),
          ]);
        } catch (queryError) {
          console.error(`[ETL] ❌ Erro ao buscar medições do lote ${loteNum}:`, queryError);
          // Continuar com próximo lote em caso de erro
          dataLoteInicio = new Date(dataLoteFim);
          loteNum++;
          continue;
        }

        // Validar resultado
        if (!result || !result.rows || !Array.isArray(result.rows)) {
          console.warn(`[ETL] ⚠️ Resultado vazio ou inválido para lote ${loteNum}`);
          dataLoteInicio = new Date(dataLoteFim);
          loteNum++;
          continue;
        }

        console.log(`[ETL] 📊 Lote ${loteNum}: ${result.rows.length} registros encontrados`);

        // Processar registros do lote
        for (const row of result.rows) {
          if (!row || !row.cod_empresa || !row.cod_tanque) {
            ignorados++;
            continue;
          }

          const codEmpresa = String(row.cod_empresa).trim();
          const codTanque = String(row.cod_tanque).trim();
          const dataLmc = row.data_lmc;

          if (!dataLmc) {
            ignorados++;
            continue;
          }

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
          const volumeMedido = parseFloat(String(row.volume_medido || "0"));
          const estoqueEscritural = parseFloat(String(row.estoque_sistema || "0"));
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

        totalRegistros += result.rows.length;
        const tempoLote = Date.now() - tempoLoteInicio;
        console.log(`[ETL] ✅ Lote ${loteNum} processado em ${tempoLote}ms (${inseridos} inseridas, ${atualizados} atualizadas)`);

      } catch (loteError) {
        console.error(`[ETL] ❌ Erro ao processar lote ${loteNum}:`, loteError);
      }

      dataLoteInicio = new Date(dataLoteFim);
      loteNum++;
    }

    const tempoTotal = Date.now() - tempoInicio;
    console.log(`[ETL] ✅ Sincronização concluída em ${tempoTotal}ms`);
    console.log(`[ETL] 📊 Resumo: ${inseridos} inseridas, ${atualizados} atualizadas, ${ignorados} ignoradas, ${totalRegistros} total`);

    // Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "medicoes",
      dataInicio: new Date(tempoInicio),
      dataFim: new Date(),
      registrosProcessados: totalRegistros,
      registrosInseridos: inseridos,
      status: "sucesso",
      mensagem: `Sincronizadas ${inseridos} medições em ${tempoTotal}ms`,
    });

    return { success: true, inseridos, atualizados, ignorados, total: totalRegistros };
  } catch (error) {
    const tempoTotal = Date.now() - tempoInicio;
    console.error(`[ETL] ❌ Erro geral ao sincronizar medições (${tempoTotal}ms):`, error);
    
    // Registrar erro no log
    await db.insert(syncLogs).values({
      tipo: "medicoes",
      dataInicio: new Date(tempoInicio),
      dataFim: new Date(),
      registrosProcessados: 0,
      registrosInseridos: 0,
      status: "erro",
      mensagem: `Erro: ${String(error)}`,
    });

    return { success: false, error: String(error), inseridos, atualizados, ignorados, total: totalRegistros };
  } finally {
    acsClient.release();
  }
}

// NOVA FUNÇÃO: Sincronizar vendas (abastecimentos) do ACS
export async function sincronizarVendasACS(diasAtras: number = 7) {
  const db = await getDb();
  if (!db) {
    console.error("[ETL] Database PEPS not available");
    return { success: false, error: "Database PEPS not available", inseridos: 0, ignorados: 0, total: 0 };
  }

  const tempoInicio = Date.now();
  let inseridos = 0;
  let ignorados = 0;
  let totalRegistros = 0;

  try {
    // Calcular data de início
    const dataInicioCalc = new Date();
    dataInicioCalc.setDate(dataInicioCalc.getDate() - diasAtras);
    const dataInicioStr = dataInicioCalc.toISOString().split("T")[0];
    const dataInicioFinal = dataInicioStr > DATA_CORTE ? dataInicioStr : DATA_CORTE;

    console.log(`[ETL] ⏱️ Iniciando sincronização de vendas (desde: ${dataInicioFinal}, diasAtras=${diasAtras})`);

    // Buscar postos ATIVOS, tanques e produtos do PEPS
    const postosDb = await db.select().from(postos).where(eq(postos.ativo, 1));
    const tanquesDb = await db.select().from(tanques);
    const produtosDb = await db.select().from(produtos);
    console.log(`[ETL] 📍 ${postosDb.length} postos, ${tanquesDb.length} tanques, ${produtosDb.length} produtos`);

    // Buscar codigoAcs existentes no período para evitar duplicatas
    const existentes = await db.select({ codigoAcs: vendas.codigoAcs })
      .from(vendas)
      .where(gte(vendas.dataVenda, new Date(dataInicioFinal + 'T00:00:00.000Z')));
    const existentesSet = new Set(existentes.map(e => e.codigoAcs));
    console.log(`[ETL] 📊 ${existentesSet.size} vendas já existentes no período`);

    // ETAPA 1: Buscar abastecimentos do ACS por empresa individualmente
    // (evita timeout em queries grandes)
    const codEmpresaList = postosDb.map(p => p.codigoAcs);
    let acsRows: any[] = [];

    for (const codEmpresa of codEmpresaList) {
      const acsClient = await getAcsClient();
      if (!acsClient) {
        console.warn(`[ETL] ⚠️ Não foi possível conectar ao ACS para empresa ${codEmpresa}`);
        continue;
      }
      try {
        const result = await Promise.race([
          acsClient.query(`
            SELECT 
              a.cod_empresa,
              a.codigo as cod_abastecimento,
              a.cod_tanque,
              a.cod_combustivel,
              a.dt_abast,
              a.litros,
              a.preco,
              a.total,
              a.tipo_combustivel,
              a.afericao
            FROM abastecimentos a
            WHERE a.dt_abast >= $1
              AND a.baixado = 'S'
              AND a.cod_empresa = $2
            ORDER BY a.dt_abast ASC
          `, [dataInicioFinal, codEmpresa]),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout empresa ${codEmpresa}`)), 60000)
          ),
        ]);
        if (result?.rows) {
          acsRows = acsRows.concat(result.rows);
          console.log(`[ETL]   Empresa ${codEmpresa}: ${result.rows.length} abastecimentos`);
        }
      } catch (queryError) {
        console.error(`[ETL] ❌ Erro ao buscar empresa ${codEmpresa}:`, queryError);
      } finally {
        acsClient.release();
      }
    }

    totalRegistros = acsRows.length;
    console.log(`[ETL] 📦 Total: ${totalRegistros} abastecimentos do ACS`);

    if (totalRegistros === 0) {
      console.log(`[ETL] ✅ Nenhum abastecimento novo encontrado`);
      return { success: true, inseridos: 0, ignorados: 0, total: 0 };
    }

    // ETAPA 2: Processar e preparar registros para inserção
    const registrosParaInserir: any[] = [];

    for (const row of acsRows) {
      const codEmpresa = row.cod_empresa?.trim();
      const codTanque = row.cod_tanque?.trim();
      const codAbast = row.cod_abastecimento?.trim();

      if (!codEmpresa || !codAbast) {
        ignorados++;
        continue;
      }

      const codigoVendaAcs = `${codEmpresa}-${codAbast}`;
      if (existentesSet.has(codigoVendaAcs)) {
        continue; // Já existe, pular
      }

      const posto = postosDb.find(p => p.codigoAcs === codEmpresa);
      if (!posto) {
        ignorados++;
        continue;
      }

      const tanque = tanquesDb.find(t => t.postoId === posto.id && t.codigoAcs === codTanque);

      const codCombustivel = row.cod_combustivel?.trim();
      let produto = produtosDb.find(p => p.codigoAcs === codCombustivel);
      if (!produto) {
        const tipoComb = row.tipo_combustivel?.trim();
        const descPadrao = TIPOS_COMBUSTIVEL[tipoComb] || tipoComb;
        if (descPadrao) {
          produto = produtosDb.find(p => p.descricao?.includes(descPadrao.split(" ")[0] || ""));
        }
      }

      const isAfericao = row.afericao?.trim() === 'S' ? 1 : 0;
      const litros = parseFloat(String(row.litros || "0"));
      const preco = parseFloat(String(row.preco || "0"));
      const total = parseFloat(String(row.total || "0"));

      if (litros <= 0) {
        ignorados++;
        continue;
      }

      registrosParaInserir.push({
        postoId: posto.id,
        tanqueId: tanque?.id || null,
        produtoId: produto?.id || null,
        codigoAcs: codigoVendaAcs,
        dataVenda: new Date(row.dt_abast),
        quantidade: litros.toFixed(3),
        valorUnitario: preco.toFixed(4),
        valorTotal: total.toFixed(2),
        afericao: isAfericao,
        statusCmv: isAfericao ? "calculado" as const : "pendente" as const,
        origem: "acs",
      });
      existentesSet.add(codigoVendaAcs);
    }

    console.log(`[ETL] 📝 ${registrosParaInserir.length} registros novos para inserir`);

    // ETAPA 3: Inserir em batches no PEPS
    const BATCH_SIZE = 200;
    for (let i = 0; i < registrosParaInserir.length; i += BATCH_SIZE) {
      const batch = registrosParaInserir.slice(i, i + BATCH_SIZE);
      try {
        await db.insert(vendas).values(batch).onDuplicateKeyUpdate({ set: { origem: "acs" } });
        inseridos += batch.length;
      } catch (batchError: any) {
        // Se batch falhar, tentar um por um
        for (const reg of batch) {
          try {
            await db.insert(vendas).values(reg).onDuplicateKeyUpdate({ set: { origem: "acs" } });
            inseridos++;
          } catch (singleError: any) {
            if (!String(singleError).includes('Duplicate entry')) {
              console.error(`[ETL] Erro ao inserir venda ${reg.codigoAcs}:`, singleError);
            }
            ignorados++;
          }
        }
      }

      if ((i + BATCH_SIZE) % 2000 < BATCH_SIZE) {
        console.log(`[ETL] 📈 Inseridos: ${inseridos}/${registrosParaInserir.length}`);
      }
    }

    const tempoTotal = Date.now() - tempoInicio;
    console.log(`[ETL] ✅ Sincronização de vendas concluída em ${tempoTotal}ms`);
    console.log(`[ETL] 📊 Resumo vendas: ${inseridos} inseridas, ${ignorados} ignoradas, ${totalRegistros} total`);

    // Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "vendas",
      dataInicio: new Date(tempoInicio),
      dataFim: new Date(),
      registrosProcessados: totalRegistros,
      registrosInseridos: inseridos,
      registrosIgnorados: ignorados,
      status: "sucesso",
      mensagem: `Sincronizadas ${inseridos} vendas em ${tempoTotal}ms (desde ${dataInicioFinal})`,
    });

    return { success: true, inseridos, ignorados, total: totalRegistros };
  } catch (error) {
    const tempoTotal = Date.now() - tempoInicio;
    console.error(`[ETL] ❌ Erro geral ao sincronizar vendas (${tempoTotal}ms):`, error);

    try {
      await db.insert(syncLogs).values({
        tipo: "vendas",
        dataInicio: new Date(tempoInicio),
        dataFim: new Date(),
        registrosProcessados: 0,
        registrosInseridos: 0,
        status: "erro",
        mensagem: `Erro: ${String(error)}`,
      });
    } catch (_) { /* ignore log error */ }

    return { success: false, error: String(error), inseridos, ignorados, total: totalRegistros };
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
    console.log(`[ETL] Sincronizando notas fiscais de compra (corte: ${DATA_CORTE})...`);

    const dataInicioCalc = new Date();
    dataInicioCalc.setDate(dataInicioCalc.getDate() - diasAtras);
    const dataInicioStr = dataInicioCalc.toISOString().split("T")[0];
    // Garantir que nunca busque antes da data de corte
    const dataInicioFinal = dataInicioStr > DATA_CORTE ? dataInicioStr : DATA_CORTE;
    console.log(`[ETL] Data início compras: ${dataInicioFinal}`);

    // Buscar compras de combustível do ACS (tabela compras_comb + itens_compra_comb)
    const result = await acsClient.query(`
      SELECT 
        c.cod_empresa,
        c.codigo,
        c.data_emissao,
        c.valor_total,
        c.fornecedor,
        ic.tipo_combustivel,
        ic.quantidade,
        ic.valor_unitario
      FROM compras_comb c
      LEFT JOIN itens_compra_comb ic ON c.codigo = ic.codigo_compra
      WHERE c.data_emissao >= $1
      ORDER BY c.data_emissao DESC
    `, [dataInicioFinal]);

    if (!result || !result.rows) {
      console.warn("[ETL] Resultado vazio ao buscar compras");
      return { success: false, error: "Resultado vazio ao buscar compras" };
    }

    console.log(`[ETL] Compras: ${result.rows.length} registros encontrados`);
    return { success: true, total: result.rows.length };
  } catch (error) {
    console.error("[ETL] Erro ao sincronizar compras:", error);
    return { success: false, error: String(error) };
  } finally {
    acsClient.release();
  }
}

// Função para verificar medições faltantes
export async function verificarMedicoesFaltantes() {
  const db = await getDb();
  if (!db) {
    return { success: false, error: "Database PEPS not available" };
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    return { success: false, error: "Não foi possível conectar ao banco ACS" };
  }

  try {
    console.log("[ETL] Verificando medições faltantes...");

    const postosDb = await db.select().from(postos).where(eq(postos.ativo, 1));
    const tanquesDb = await db.select().from(tanques);

    const medicoesFaltantes: any[] = [];

    for (const posto of postosDb) {
      for (const tanque of tanquesDb.filter(t => t.postoId === posto.id)) {
        // Buscar últimas 30 dias de aberturas do ACS
        const result = await acsClient.query(`
          SELECT DISTINCT a.data
          FROM aberturas a
          WHERE a.cod_empresa = $1 AND a.cod_tanque = $2
          AND a.data >= CURRENT_DATE - INTERVAL '30 days'
          ORDER BY a.data DESC
        `, [posto.codigoAcs, tanque.codigoAcs]);

        if (result && result.rows && result.rows.length > 0) {
          // Verificar quais datas têm medições no PEPS
          for (const row of result.rows) {
            const dataMedicao = new Date(row.data);
            const existente = await db.select().from(medicoes)
              .where(eq(medicoes.tanqueId, tanque.id))
              .limit(1);

            if (existente.length === 0) {
              medicoesFaltantes.push({
                posto: posto.nome,
                tanque: tanque.codigoAcs,
                data: dataMedicao,
              });
            }
          }
        }
      }
    }

    console.log(`[ETL] Medições faltantes: ${medicoesFaltantes.length}`);
    return { success: true, medicoesFaltantes };
  } catch (error) {
    console.error("[ETL] Erro ao verificar medições faltantes:", error);
    return { success: false, error: String(error) };
  } finally {
    acsClient.release();
  }
}
