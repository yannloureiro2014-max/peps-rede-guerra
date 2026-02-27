/**
 * Serviço de Sincronização Automática de NFes do ACS
 * 
 * Busca compras do ACS (PostgreSQL externo) e cria lotes provisórios no PEPS (MySQL).
 * Integra-se ao auto-sync existente (vendas + medições).
 * 
 * Fluxo:
 * 1. Busca postos ativos e seus tanques do PEPS
 * 2. Busca compras recentes do ACS (últimos N dias)
 * 3. Filtra compras que já existem como lotes (via chaveNfe)
 * 4. Mapeia automaticamente produto → tanque correto
 * 5. Cria lotes provisórios para compras novas
 * 6. Gera alertas para compras que não puderam ser mapeadas
 * 7. Registra log de sincronização
 */

import pg from "pg";
import { getDb } from "../db";
import { postos, tanques, produtos, lotes, syncLogs, alertas } from "../../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

// Mapeamento de descricao do produto ACS → codigoAcs do produto PEPS
// Será construído dinamicamente a partir do banco
interface PostoMap {
  id: number;
  nome: string;
  codigoAcs: string;
}

interface TanqueMap {
  id: number;
  postoId: number;
  produtoId: number | null;
  codigoAcs: string;
  capacidade: number;
}

interface ProdutoMap {
  id: number;
  descricao: string;
  codigoAcs: string;
}

interface SyncResult {
  success: boolean;
  totalACS: number;
  jaExistentes: number;
  inseridos: number;
  naoMapeados: number;
  itensCancelados: number;
  erros: string[];
  detalhes: {
    porPosto: Record<string, { inseridos: number; litros: number; valor: number }>;
    naoMapeados: Array<{ nfe: string; posto: string; produto: string; motivo: string }>;
  };
}

async function getAcsClient(): Promise<pg.Client | null> {
  try {
    const client = new pg.Client({
      ...ACS_CONFIG,
      connectionTimeoutMillis: 10000,
    });
    await Promise.race([
      client.connect(),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
    ]);
    return client;
  } catch (error) {
    console.error("[SYNC-NFES] Erro ao conectar ao ACS:", error);
    return null;
  }
}

/**
 * Sincronizar NFes do ACS → Lotes provisórios no PEPS
 * @param diasAtras Quantos dias para trás buscar (padrão: 30)
 */
export async function sincronizarNfesDoACS(diasAtras: number = 30): Promise<SyncResult> {
  const tempoInicio = Date.now();
  const result: SyncResult = {
    success: false,
    totalACS: 0,
    jaExistentes: 0,
    inseridos: 0,
    naoMapeados: 0,
    itensCancelados: 0,
    erros: [],
    detalhes: {
      porPosto: {},
      naoMapeados: [],
    },
  };

  const db = await getDb();
  if (!db) {
    result.erros.push("Database PEPS não disponível");
    return result;
  }

  const acsClient = await getAcsClient();
  if (!acsClient) {
    result.erros.push("Não foi possível conectar ao ACS");
    return result;
  }

  try {
    console.log(`[SYNC-NFES] Iniciando sincronização de NFes (últimos ${diasAtras} dias)...`);

    // 1. Buscar mapeamentos do PEPS
    const postosDb = await db.select().from(postos).where(eq(postos.ativo, 1));
    const tanquesDb = await db.select().from(tanques).where(eq(tanques.ativo, 1));
    const produtosDb = await db.select().from(produtos).where(eq(produtos.ativo, 1));

    // Mapa: codigoAcs → posto
    const postoMap = new Map<string, PostoMap>();
    for (const p of postosDb) {
      postoMap.set(p.codigoAcs.trim(), { id: p.id, nome: p.nome, codigoAcs: p.codigoAcs.trim() });
    }

    // Mapa: descricao produto → produto
    const produtoByDescricao = new Map<string, ProdutoMap>();
    for (const p of produtosDb) {
      produtoByDescricao.set(p.descricao.trim().toUpperCase(), { id: p.id, descricao: p.descricao, codigoAcs: p.codigoAcs });
    }

    // Mapa: "postoId-produtoId" → tanque (primeiro tanque encontrado)
    const tanqueMap = new Map<string, TanqueMap>();
    for (const t of tanquesDb) {
      const key = `${t.postoId}-${t.produtoId}`;
      if (!tanqueMap.has(key)) {
        tanqueMap.set(key, {
          id: t.id,
          postoId: t.postoId,
          produtoId: t.produtoId,
          codigoAcs: t.codigoAcs,
          capacidade: parseFloat(String(t.capacidade)) || 0,
        });
      }
    }

    const codEmpresasAtivos = Array.from(postoMap.keys());
    console.log(`[SYNC-NFES] Postos ativos: ${codEmpresasAtivos.join(', ')}`);
    console.log(`[SYNC-NFES] Produtos mapeados: ${produtosDb.length}`);
    console.log(`[SYNC-NFES] Tanques ativos: ${tanquesDb.length}`);

    // 2. Buscar chaves de lotes já existentes no PEPS
    const lotesExistentes = await db.select({ chaveNfe: lotes.chaveNfe }).from(lotes)
      .where(sql`${lotes.status} != 'cancelado'`);
    const chavesExistentes = new Set(lotesExistentes.map(l => l.chaveNfe).filter(Boolean));
    console.log(`[SYNC-NFES] Lotes existentes no PEPS: ${chavesExistentes.size}`);

    // 3. Buscar compras do ACS
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    // Nunca buscar antes de 01/12/2025
    const dataCorte = '2025-12-01';
    const dataInicioFinal = dataInicioStr > dataCorte ? dataInicioStr : dataCorte;

    const placeholders = codEmpresasAtivos.map((_, i) => `$${i + 3}`).join(', ');
    const acsResult = await acsClient.query(`
      SELECT 
        c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao,
        c.total_nota::numeric as total_nota, 
        c.total_produtos::numeric as total_produtos,
        c.frete::numeric as frete, c.tipo_frete,
        COALESCE(f.razao_social, 'N/A') as fornecedor,
        (SELECT SUM(ic.quantidade::numeric) 
         FROM itens_compra_comb ic 
         WHERE ic.cod_compra = c.codigo AND ic.cod_empresa = c.cod_empresa AND ic.cancelado = 'N'
        ) as litros_ativos,
        (SELECT COALESCE(p.descricao, 'N/A') 
         FROM itens_compra_comb ic 
         LEFT JOIN produtos p ON TRIM(ic.cod_combustivel) = TRIM(p.codigo) 
         WHERE ic.cod_compra = c.codigo AND ic.cod_empresa = c.cod_empresa AND ic.cancelado = 'N' 
         ORDER BY ic.quantidade::numeric DESC LIMIT 1
        ) as produto
      FROM compras_comb c
      LEFT JOIN fornecedores f ON c.cod_fornecedor = f.codigo
      WHERE c.cancelada = 'N'
        AND c.dt_emissao >= $1 AND c.dt_emissao <= $2
        AND c.cod_empresa IN (${placeholders})
      ORDER BY c.dt_emissao
    `, [dataInicioFinal, new Date().toISOString().split('T')[0], ...codEmpresasAtivos]);

    result.totalACS = acsResult.rows.length;
    console.log(`[SYNC-NFES] Compras encontradas no ACS: ${result.totalACS}`);

    // 4. Processar cada compra
    for (const row of acsResult.rows) {
      const codEmpresa = (row.cod_empresa || '').trim();
      const codigo = (row.codigo || '').trim();
      const chaveNfe = `ACS-${codEmpresa}-${codigo}`;

      // 4a. Já existe?
      if (chavesExistentes.has(chaveNfe)) {
        result.jaExistentes++;
        continue;
      }

      // 4b. Litros ativos (itens não cancelados)
      const litros = parseFloat(row.litros_ativos) || 0;
      if (litros <= 0) {
        result.itensCancelados++;
        continue;
      }

      // 4c. Mapear posto
      const posto = postoMap.get(codEmpresa);
      if (!posto) {
        result.naoMapeados++;
        result.detalhes.naoMapeados.push({
          nfe: `${row.documento}/${row.serie}`,
          posto: codEmpresa,
          produto: row.produto || 'N/A',
          motivo: `Posto com código ACS '${codEmpresa}' não encontrado`,
        });
        continue;
      }

      // 4d. Mapear produto
      const produtoNome = (row.produto || '').trim().toUpperCase();
      const produto = produtoByDescricao.get(produtoNome);
      if (!produto) {
        result.naoMapeados++;
        result.detalhes.naoMapeados.push({
          nfe: `${row.documento}/${row.serie}`,
          posto: posto.nome,
          produto: produtoNome || 'N/A',
          motivo: `Produto '${produtoNome}' não encontrado no cadastro PEPS`,
        });
        continue;
      }

      // 4e. Mapear tanque
      const tanqueKey = `${posto.id}-${produto.id}`;
      const tanque = tanqueMap.get(tanqueKey);
      if (!tanque) {
        result.naoMapeados++;
        result.detalhes.naoMapeados.push({
          nfe: `${row.documento}/${row.serie}`,
          posto: posto.nome,
          produto: produto.descricao,
          motivo: `Tanque para ${produto.descricao} no ${posto.nome} não encontrado`,
        });
        continue;
      }

      // 4f. Calcular custos
      const totalNota = parseFloat(row.total_nota) || 0;
      const totalProdutos = parseFloat(row.total_produtos) || 0;
      const frete = parseFloat(row.frete) || 0;
      const tipoFrete = row.tipo_frete === 'F' ? 'FOB' : 'CIF';
      
      const custoUnitario = litros > 0 ? totalNota / litros : 0;
      const custoUnitarioProduto = litros > 0 ? totalProdutos / litros : 0;
      const custoUnitarioFrete = litros > 0 ? frete / litros : 0;

      // 4g. Inserir lote provisório
      try {
        await db.insert(lotes).values({
          chaveNfe,
          postoId: posto.id,
          tanqueId: tanque.id,
          produtoId: produto.id,
          numeroNf: row.documento,
          serieNf: row.serie,
          codigoAcs: codigo,
          nomeFornecedor: row.fornecedor,
          nomeProduto: produto.descricao,
          quantidadeOriginal: String(litros),
          quantidadeDisponivel: String(litros),
          custoUnitario: String(Math.round(custoUnitario * 10000) / 10000),
          custoUnitarioProduto: String(Math.round(custoUnitarioProduto * 10000) / 10000),
          custoUnitarioFrete: String(Math.round(custoUnitarioFrete * 10000) / 10000),
          custoTotal: String(Math.round(totalNota * 100) / 100),
          valorFrete: String(Math.round(frete * 100) / 100),
          tipoFrete,
          dataEntrada: row.dt_emissao.toISOString().split('T')[0],
          dataEmissao: row.dt_emissao.toISOString().split('T')[0],
          statusNfe: 'provisoria',
          status: 'ativo',
          origem: 'acs',
        });

        result.inseridos++;
        chavesExistentes.add(chaveNfe); // Evitar duplicatas no mesmo batch

        // Contabilizar por posto
        if (!result.detalhes.porPosto[posto.nome]) {
          result.detalhes.porPosto[posto.nome] = { inseridos: 0, litros: 0, valor: 0 };
        }
        result.detalhes.porPosto[posto.nome].inseridos++;
        result.detalhes.porPosto[posto.nome].litros += litros;
        result.detalhes.porPosto[posto.nome].valor += totalNota;

      } catch (err: any) {
        // Duplicata (chaveNfe unique constraint) - ignorar silenciosamente
        if (err.code === 'ER_DUP_ENTRY' || err.message?.includes('Duplicate')) {
          result.jaExistentes++;
          chavesExistentes.add(chaveNfe);
        } else {
          result.erros.push(`Erro ao inserir ${chaveNfe}: ${err.message}`);
        }
      }
    }

    result.success = true;
    const tempoTotal = Date.now() - tempoInicio;

    // 5. Registrar log de sincronização
    await db.insert(syncLogs).values({
      tipo: "nfes",
      dataInicio: new Date(tempoInicio),
      dataFim: new Date(),
      registrosProcessados: result.totalACS,
      registrosInseridos: result.inseridos,
      registrosIgnorados: result.jaExistentes + result.itensCancelados,
      erros: result.erros.length,
      status: result.erros.length > 0 ? "erro" : "sucesso",
      mensagem: `Sync NFes: ${result.inseridos} inseridas, ${result.jaExistentes} existentes, ${result.naoMapeados} não mapeadas, ${result.itensCancelados} canceladas (${tempoTotal}ms)`,
    });

    // 6. Gerar alertas para NFes não mapeadas (se houver)
    if (result.detalhes.naoMapeados.length > 0) {
      const naoMapeadasMsg = result.detalhes.naoMapeados
        .slice(0, 10) // Limitar a 10 para não sobrecarregar
        .map(n => `• ${n.nfe} (${n.posto} - ${n.produto}): ${n.motivo}`)
        .join('\n');

      await db.insert(alertas).values({
        tipo: 'sincronizacao',
        titulo: `${result.detalhes.naoMapeados.length} NFe(s) não puderam ser importadas automaticamente`,
        mensagem: `As seguintes NFes do ACS não puderam ser mapeadas para lotes provisórios:\n${naoMapeadasMsg}${result.detalhes.naoMapeados.length > 10 ? `\n... e mais ${result.detalhes.naoMapeados.length - 10}` : ''}`,
        dados: JSON.stringify(result.detalhes.naoMapeados),
        status: 'pendente',
      });
    }

    console.log(`[SYNC-NFES] ✅ Concluída em ${tempoTotal}ms: ${result.inseridos} inseridas, ${result.jaExistentes} existentes, ${result.naoMapeados} não mapeadas, ${result.itensCancelados} canceladas`);

    // Log por posto
    for (const [nome, dados] of Object.entries(result.detalhes.porPosto)) {
      console.log(`[SYNC-NFES]   ${nome}: ${dados.inseridos} NFes | ${dados.litros.toFixed(0)}L | R$ ${dados.valor.toFixed(2)}`);
    }

    return result;

  } catch (error: any) {
    const tempoTotal = Date.now() - tempoInicio;
    console.error(`[SYNC-NFES] ❌ Erro na sincronização (${tempoTotal}ms):`, error);
    result.erros.push(String(error));

    // Registrar erro no log
    try {
      await db.insert(syncLogs).values({
        tipo: "nfes",
        dataInicio: new Date(tempoInicio),
        dataFim: new Date(),
        registrosProcessados: 0,
        erros: 1,
        status: "erro",
        mensagem: `Erro: ${error.message || String(error)}`,
      });
    } catch (logErr) {
      console.error("[SYNC-NFES] Erro ao registrar log:", logErr);
    }

    return result;
  } finally {
    await acsClient.end();
  }
}

/**
 * Obter estatísticas da última sincronização de NFes
 */
export async function obterUltimaSyncNfes(): Promise<{
  ultimaSync: Date | null;
  resultado: string | null;
  inseridos: number;
  erros: number;
}> {
  const db = await getDb();
  if (!db) return { ultimaSync: null, resultado: null, inseridos: 0, erros: 0 };

  const [ultimo] = await db.select()
    .from(syncLogs)
    .where(eq(syncLogs.tipo, 'nfes'))
    .orderBy(sql`${syncLogs.id} DESC`)
    .limit(1);

  if (!ultimo) return { ultimaSync: null, resultado: null, inseridos: 0, erros: 0 };

  return {
    ultimaSync: ultimo.dataFim || ultimo.dataInicio,
    resultado: ultimo.mensagem,
    inseridos: ultimo.registrosInseridos || 0,
    erros: ultimo.erros || 0,
  };
}
