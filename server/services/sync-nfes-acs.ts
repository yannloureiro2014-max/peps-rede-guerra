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
 * 4. Mapeia tanque usando cod_tanque do ACS (especificado no cadastro da compra)
 * 5. Cria lotes provisórios para compras novas
 * 6. Gera alertas para compras que não puderam ser mapeadas
 * 7. Registra log de sincronização
 */

import pg from "pg";
import { getDb } from "../db";
import { postos, tanques, produtos, lotes, syncLogs, alertas } from "../../drizzle/schema";
import { eq, and, inArray, sql } from "drizzle-orm";
import { buscarComprasDoACS } from "./acs-nfes";
import type { SyncLog } from "../../drizzle/schema";

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

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
    naoMapeados: Array<{ nfe: string; posto: string; tanque: string; motivo: string }>;
  };
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

    // Mapa: "postoId-codTanqueAcs" → tanque (usando código do tanque do ACS)
    const tanqueByPostoAndCodigo = new Map<string, TanqueMap>();
    for (const t of tanquesDb) {
      const key = `${t.postoId}-${t.codigoAcs.trim()}`;
      tanqueByPostoAndCodigo.set(key, {
        id: t.id,
        postoId: t.postoId,
        produtoId: t.produtoId,
        codigoAcs: t.codigoAcs,
        capacidade: parseFloat(String(t.capacidade)) || 0,
      });
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

    // 3. Buscar compras do ACS usando o serviço acs-nfes.ts
    const dataInicio = new Date();
    dataInicio.setDate(dataInicio.getDate() - diasAtras);
    const dataInicioStr = dataInicio.toISOString().split('T')[0];
    const dataCorte = '2025-12-01';
    const dataInicioFinal = dataInicioStr > dataCorte ? dataInicioStr : dataCorte;

    const comprasACS = await buscarComprasDoACS({
      dataInicio: dataInicioFinal,
      dataFim: new Date().toISOString().split('T')[0],
      codEmpresaList: codEmpresasAtivos,
    });

    result.totalACS = comprasACS.length;
    console.log(`[SYNC-NFES] Compras encontradas no ACS: ${result.totalACS}`);

    // 4. Processar cada compra
    for (const compra of comprasACS) {
      const codEmpresa = compra.codEmpresa.trim();
      const codigo = compra.codigo.trim();
      const chaveNfe = `ACS-${codEmpresa}-${codigo}`;

      // 4a. Já existe?
      if (chavesExistentes.has(chaveNfe)) {
        result.jaExistentes++;
        continue;
      }

      // 4b. Litros ativos (itens não cancelados)
      const litros = compra.totalLitros || 0;
      if (litros <= 0) {
        result.itensCancelados++;
        continue;
      }

      // 4c. Mapear posto
      const posto = postoMap.get(codEmpresa);
      if (!posto) {
        result.naoMapeados++;
        result.detalhes.naoMapeados.push({
          nfe: `${compra.documento}/${compra.serie}`,
          posto: codEmpresa,
          tanque: compra.codTanque || 'N/A',
          motivo: `Posto com código ACS '${codEmpresa}' não encontrado`,
        });
        continue;
      }

      // 4d. Mapear produto
      const produtoNome = (compra.nomeCombustivel || '').trim().toUpperCase();
      const produto = produtoByDescricao.get(produtoNome);
      if (!produto) {
        result.naoMapeados++;
        result.detalhes.naoMapeados.push({
          nfe: `${compra.documento}/${compra.serie}`,
          posto: posto.nome,
          tanque: compra.codTanque || 'N/A',
          motivo: `Produto '${produtoNome}' não encontrado no cadastro PEPS`,
        });
        continue;
      }

      // 4e. Mapear tanque usando cod_tanque do ACS (PRINCIPAL)
      const codTanqueAcs = (compra.codTanque || '').trim();
      let tanque = null;

      if (codTanqueAcs) {
        // Primeiro, tenta mapear usando cod_tanque do ACS
        const tanqueKey = `${posto.id}-${codTanqueAcs}`;
        tanque = tanqueByPostoAndCodigo.get(tanqueKey);
      }

      // Se não encontrou pelo cod_tanque, tenta mapear por produto
      if (!tanque) {
        // Busca qualquer tanque do posto que tenha o mesmo produto
        const tanquesPorProduto = tanquesDb.filter(
          t => t.postoId === posto.id && t.produtoId === produto.id && t.ativo === 1
        );
        if (tanquesPorProduto.length > 0) {
          tanque = {
            id: tanquesPorProduto[0].id,
            postoId: tanquesPorProduto[0].postoId,
            produtoId: tanquesPorProduto[0].produtoId,
            codigoAcs: tanquesPorProduto[0].codigoAcs,
            capacidade: parseFloat(String(tanquesPorProduto[0].capacidade)) || 0,
          };
        }
      }

      if (!tanque) {
        result.naoMapeados++;
        result.detalhes.naoMapeados.push({
          nfe: `${compra.documento}/${compra.serie}`,
          posto: posto.nome,
          tanque: codTanqueAcs || 'Não especificado',
          motivo: `Tanque ${codTanqueAcs ? `'${codTanqueAcs}'` : 'para ' + produto.descricao} no ${posto.nome} não encontrado`,
        });
        continue;
      }

      // 4f. Calcular custos
      const totalNota = compra.totalNota || 0;
      const totalProdutos = compra.totalProdutos || 0;
      const frete = compra.frete || 0;
      const tipoFrete = compra.tipoFrete || 'CIF';
      
      const custoUnitario = litros > 0 ? totalNota / litros : 0;
      const custoUnitarioProduto = litros > 0 ? totalProdutos / litros : 0;
      const custoUnitarioFrete = litros > 0 ? frete / litros : 0;

      // 4g. Inserir lote provisório
      try {
        const custoTotal = litros * custoUnitario;
        await db.insert(lotes).values({
          chaveNfe,
          postoId: posto.id,
          tanqueId: tanque.id,
          produtoId: produto.id,
          numeroNf: compra.documento,
          serieNf: compra.serie,
          codigoAcs: codigo,
          nomeFornecedor: compra.nomeFornecedor,
          nomeProduto: produto.descricao,
          quantidadeOriginal: String(litros),
          quantidadeDisponivel: String(litros),
          dataEntrada: compra.dataEmissao,
          custoUnitario: String(custoUnitario.toFixed(6)),
          custoUnitarioProduto: String(custoUnitarioProduto.toFixed(6)),
          custoUnitarioFrete: String(custoUnitarioFrete.toFixed(6)),
          custoTotal: String(custoTotal.toFixed(2)),
          tipoFrete,
          status: 'ativo',
          statusNfe: 'provisoria',
          origem: 'acs',
        });

        result.inseridos++;
        if (!result.detalhes.porPosto[posto.nome]) {
          result.detalhes.porPosto[posto.nome] = { inseridos: 0, litros: 0, valor: 0 };
        }
        result.detalhes.porPosto[posto.nome].inseridos++;
        result.detalhes.porPosto[posto.nome].litros += litros;
        result.detalhes.porPosto[posto.nome].valor += totalNota;

        console.log(`[SYNC-NFES] ✅ Lote criado: ${chaveNfe} (${litros}L) em ${tanque.codigoAcs}`);
      } catch (err) {
        result.erros.push(`Erro ao inserir lote ${chaveNfe}: ${String(err)}`);
        console.error(`[SYNC-NFES] ❌ Erro ao inserir lote ${chaveNfe}:`, err);
      }
    }

    // 5. Gerar alertas para NFes não mapeadas
    if (result.detalhes.naoMapeados.length > 0) {
      for (const item of result.detalhes.naoMapeados) {
        try {
          await db.insert(alertas).values({
            tipo: 'sincronizacao',
            titulo: `NFe não mapeada: ${item.nfe}`,
            mensagem: `${item.nfe} do ${item.posto} (tanque ${item.tanque}). Motivo: ${item.motivo}`,
          });
        } catch (err) {
          console.warn(`[SYNC-NFES] Erro ao criar alerta para ${item.nfe}:`, err);
        }
      }
    }

    // 6. Registrar log de sincronização
    try {
      await db.insert(syncLogs).values({
        tipo: 'SYNC_NFES_ACS',
        status: result.erros.length === 0 ? 'sucesso' : 'erro',
        dataInicio: new Date(),
        registrosProcessados: result.totalACS,
        registrosInseridos: result.inseridos,
        erros: result.erros.length,
        mensagem: result.detalhes.naoMapeados.length > 0 ? `${result.detalhes.naoMapeados.length} NFes não mapeadas` : undefined,
      });
    } catch (err) {
      console.warn("[SYNC-NFES] Erro ao registrar log:", err);
    }

    result.success = result.erros.length === 0;
    const tempoTotal = Date.now() - tempoInicio;
    console.log(`[SYNC-NFES] ✅ Sincronização concluída em ${tempoTotal}ms: ${result.inseridos} lotes criados, ${result.jaExistentes} já existentes, ${result.naoMapeados} não mapeados`);

    return result;
  } catch (erro) {
    result.erros.push(`Erro geral na sincronização: ${String(erro)}`);
    console.error("[SYNC-NFES] Erro geral:", erro);
    return result;
  }
}
