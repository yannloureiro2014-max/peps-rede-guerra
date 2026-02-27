/**
 * Serviço para buscar Compras reais do banco ACS
 * Conecta ao PostgreSQL externo e retorna compras da tabela compras_comb
 * 
 * CORREÇÕES:
 * - Filtra apenas postos ATIVOS (busca do banco PEPS)
 * - Mapeamento dinâmico de postos via codigoAcs do banco PEPS
 * - Converte postoId (ID PEPS) para codEmpresa (código ACS) corretamente
 * - Busca nome do fornecedor do ACS
 * - Calcula custo unitário produto, custo frete unitário e custo total unitário
 */

import pg from "pg";
import { executeWithRetry } from "../utils/retry";
import { getDb } from "../db";
import { postos, lotes } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

const ACS_CONFIG = {
  host: "177.87.120.172",
  port: 5432,
  database: "Sintese_Rede_Guerra",
  user: "redeguerra",
  password: "ZQ18Uaa4AD",
};

interface Compra {
  id: string;
  codEmpresa: string;
  codigo: string;
  documento: string;
  serie: string;
  dataEmissao: Date;
  dataLmc: Date;
  codFornecedor: string;
  nomeFornecedor: string;
  totalNota: number;
  totalProdutos: number;
  totalItens: number;
  totalLitros: number;
  quantidadePendente: number;
  tipoFrete: string;
  frete: number;
  despesas: number;
}

/**
 * Mapear tipo_frete do ACS para FOB/CIF
 * No ACS: C=CIF, F=FOB, R=Remetente(CIF), T=Terceiros, S=Sem Frete
 * Para CMV: FOB = comprador paga frete (soma no custo)
 *           CIF = fornecedor paga frete (já incluso no preço)
 */
function mapTipoFrete(tipoFreteAcs: string | null): string {
  const tipo = (tipoFreteAcs || '').trim().toUpperCase();
  switch (tipo) {
    case 'F': return 'FOB'; // FOB - comprador paga frete
    case 'C': return 'CIF'; // CIF - fornecedor paga frete
    case 'R': return 'CIF'; // Remetente = CIF (fornecedor paga)
    case 'T': return 'FOB'; // Terceiros = FOB (comprador paga)
    case 'S': return 'CIF'; // Sem frete = CIF
    default: return 'CIF';  // Padrão = CIF
  }
}

async function getAcsClient(): Promise<pg.Client | null> {
  try {
    const client = new pg.Client({
      ...ACS_CONFIG,
      connectionTimeoutMillis: 5000,
    });
    await Promise.race([
      client.connect(),
      new Promise<void>((_, reject) => setTimeout(() => reject(new Error("Timeout")), 5000))
    ]);
    return client;
  } catch (error) {
    console.error("[ACS-COMPRAS] Erro ao conectar ao ACS:", error);
    return null;
  }
}

/**
 * Buscar mapeamento de postos ativos do banco PEPS
 * Retorna: { codigoAcs -> { id, nome, codigoAcs } }
 */
async function getPostosAtivosMap(): Promise<Map<string, { id: number; nome: string; codigoAcs: string }>> {
  const db = await getDb();
  if (!db) return new Map();
  
  const postosAtivos = await db.select().from(postos).where(eq(postos.ativo, 1));
  const mapa = new Map<string, { id: number; nome: string; codigoAcs: string }>();
  
  for (const p of postosAtivos) {
    const codTrimmed = (p.codigoAcs || "").trim();
    mapa.set(codTrimmed, { id: p.id, nome: p.nome, codigoAcs: codTrimmed });
  }
  
  console.log(`[ACS-COMPRAS] ${mapa.size} postos ativos mapeados: ${Array.from(mapa.entries()).map(([k, v]) => `${k}=${v.nome}`).join(', ')}`);
  return mapa;
}

/**
 * Converter postoId (ID do banco PEPS) para codEmpresa (código ACS)
 */
async function postoIdToCodEmpresa(postoId: string): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;
  
  const id = parseInt(postoId);
  if (isNaN(id)) return null;
  
  const result = await db.select().from(postos).where(eq(postos.id, id)).limit(1);
  if (result.length === 0) return null;
  
  return (result[0].codigoAcs || "").trim();
}

/**
 * Buscar compras do ACS do período especificado
 * Agora filtra apenas postos ATIVOS e converte postoId corretamente
 */
export async function buscarComprasDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  codEmpresa?: string;
  codEmpresaList?: string[]; // Lista de cod_empresa para filtrar (postos ativos)
}): Promise<Compra[]> {
  try {
    console.log("[ACS-COMPRAS] Buscando compras do ACS...", filtros);

    const compras = await executeWithRetry(
      async () => {
        const acsClient = await getAcsClient();
        if (!acsClient) {
          throw new Error("Não foi possível conectar ao ACS");
        }

        try {
          const params: any[] = [];
          let paramIdx = 1;

          // Datas padrão
          const dataInicio = filtros?.dataInicio || '2025-12-01';
          const dataFim = filtros?.dataFim || new Date().toISOString().split('T')[0];

          let query = `
            SELECT 
              c.cod_empresa,
              c.codigo,
              c.documento,
              c.serie,
              c.dt_emissao,
              c.dt_lmc,
              c.cod_fornecedor,
              COALESCE(f.razao_social, 'Fornecedor ' || c.cod_fornecedor) as nome_fornecedor,
              c.total_nota,
              c.total_produtos,
              c.tipo_frete,
              c.frete,
              c.despesas,
              COUNT(i.numero) as total_itens,
              SUM(i.quantidade::numeric) as total_litros,
              (
                SELECT COALESCE(p.descricao, 'Combustível')
                FROM itens_compra_comb ic
                LEFT JOIN produtos p ON TRIM(ic.cod_combustivel) = TRIM(p.codigo)
                WHERE ic.cod_compra = c.codigo AND ic.cod_empresa = c.cod_empresa AND ic.cancelado = 'N'
                ORDER BY ic.quantidade::numeric DESC
                LIMIT 1
              ) as nome_combustivel
            FROM compras_comb c
            LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa
            LEFT JOIN fornecedores f ON c.cod_fornecedor = f.codigo
            WHERE c.dt_emissao >= $${paramIdx}::date
          `;
          params.push(dataInicio);
          paramIdx++;

          query += ` AND c.dt_emissao <= $${paramIdx}::date`;
          params.push(dataFim);
          paramIdx++;

          // Filtro por cod_empresa específico
          if (filtros?.codEmpresa) {
            query += ` AND c.cod_empresa = $${paramIdx}`;
            params.push(filtros.codEmpresa);
            paramIdx++;
          }
          // Filtro por lista de cod_empresa (postos ativos)
          else if (filtros?.codEmpresaList && filtros.codEmpresaList.length > 0) {
            const placeholders = filtros.codEmpresaList.map((_, i) => `$${paramIdx + i}`).join(', ');
            query += ` AND c.cod_empresa IN (${placeholders})`;
            params.push(...filtros.codEmpresaList);
            paramIdx += filtros.codEmpresaList.length;
          }

          query += ` GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.dt_lmc, c.cod_fornecedor, f.razao_social, c.total_nota, c.total_produtos, c.tipo_frete, c.frete, c.despesas, nome_combustivel
            ORDER BY c.dt_emissao DESC
            LIMIT 500`;

          console.log(`[ACS-COMPRAS] Executando query com ${params.length} params`);
          const result = await acsClient.query(query, params);

          // Transformar resultados
          const comprasTransformadas: Compra[] = result.rows.map((row: any) => ({
            id: `${row.cod_empresa}-${row.codigo}`,
            codEmpresa: row.cod_empresa,
            codigo: row.codigo,
            documento: row.documento,
            serie: row.serie,
            dataEmissao: new Date(row.dt_emissao),
            dataLmc: new Date(row.dt_lmc),
            codFornecedor: row.cod_fornecedor,
            nomeFornecedor: row.nome_fornecedor || `Fornecedor ${row.cod_fornecedor}`,
            totalNota: Number(row.total_nota) || 0,
            totalProdutos: Number(row.total_produtos) || 0,
            totalItens: Number(row.total_itens) || 0,
            totalLitros: Number(row.total_litros) || 0,
            quantidadePendente: Number(row.total_litros) || 0,
            tipoFrete: mapTipoFrete(row.tipo_frete),
            tipoFreteOriginal: (row.tipo_frete || '').trim(),
            frete: Number(row.frete) || 0,
            despesas: Number(row.despesas) || 0,
            nomeCombustivel: row.nome_combustivel || 'Combustível',
          }));

          console.log(
            `[ACS-COMPRAS] ${comprasTransformadas.length} compras buscadas com sucesso`
          );
          return comprasTransformadas;
        } finally {
          await acsClient.end();
        }
      },
      "buscarComprasDoACS"
    );

    return compras;
  } catch (erro) {
    console.error("[ACS-COMPRAS] Erro ao buscar compras:", erro);
    return [];
  }
}

/**
 * Buscar uma compra específica
 */
export async function buscarCompraPorCodigo(
  codEmpresa: string,
  codigo: string
): Promise<Compra | null> {
  try {
    console.log(`[ACS-COMPRAS] Buscando compra ${codEmpresa}-${codigo}...`);

    const compra = await executeWithRetry(
      async () => {
        const acsClient = await getAcsClient();
        if (!acsClient) {
          throw new Error("Não foi possível conectar ao ACS");
        }

        try {
          const result = await acsClient.query(
            `
            SELECT 
              c.cod_empresa,
              c.codigo,
              c.documento,
              c.serie,
              c.dt_emissao,
              c.dt_lmc,
              c.cod_fornecedor,
              COALESCE(f.razao_social, 'Fornecedor ' || c.cod_fornecedor) as nome_fornecedor,
              c.total_nota,
              c.total_produtos,
              c.tipo_frete,
              c.frete,
              c.despesas,
              COUNT(i.numero) as total_itens,
              SUM(i.quantidade::numeric) as total_litros
            FROM compras_comb c
            LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa
            LEFT JOIN fornecedores f ON c.cod_fornecedor = f.codigo
            WHERE c.cod_empresa = $1 AND c.codigo = $2
            GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.dt_lmc, c.cod_fornecedor, f.razao_social, c.total_nota, c.total_produtos, c.tipo_frete, c.frete, c.despesas
            LIMIT 1
            `,
            [codEmpresa, codigo]
          );

          if (result.rows.length === 0) {
            return null;
          }

          const row = result.rows[0];
          return {
            id: `${row.cod_empresa}-${row.codigo}`,
            codEmpresa: row.cod_empresa,
            codigo: row.codigo,
            documento: row.documento,
            serie: row.serie,
            dataEmissao: new Date(row.dt_emissao),
            dataLmc: new Date(row.dt_lmc),
            codFornecedor: row.cod_fornecedor,
            nomeFornecedor: row.nome_fornecedor || `Fornecedor ${row.cod_fornecedor}`,
            totalNota: Number(row.total_nota) || 0,
            totalProdutos: Number(row.total_produtos) || 0,
            totalItens: Number(row.total_itens) || 0,
            totalLitros: Number(row.total_litros) || 0,
            quantidadePendente: Number(row.total_litros) || 0,
            tipoFrete: mapTipoFrete(row.tipo_frete),
            tipoFreteOriginal: (row.tipo_frete || '').trim(),
            frete: Number(row.frete) || 0,
            despesas: Number(row.despesas) || 0,
          };
        } finally {
          await acsClient.end();
        }
      },
      "buscarCompraPorCodigo"
    );

    return compra;
  } catch (erro) {
    console.error("[ACS-COMPRAS] Erro ao buscar compra:", erro);
    return null;
  }
}

/**
 * Contar compras não alocadas
 */
export async function contarComprasNaoAlocadas(): Promise<number> {
  try {
    const acsClient = await getAcsClient();
    if (!acsClient) {
      return 0;
    }

    try {
      const result = await acsClient.query(
        `
        SELECT COUNT(DISTINCT c.codigo) as total
        FROM compras_comb c
        WHERE c.dt_emissao >= '2025-12-01'::date
          AND c.dt_emissao <= CURRENT_DATE
        `
      );

      return Number(result.rows[0]?.total) || 0;
    } finally {
      await acsClient.end();
    }
  } catch (erro) {
    console.error("[ACS-COMPRAS] Erro ao contar compras:", erro);
    return 0;
  }
}

/**
 * Buscar itens da NFe com tipo de combustível específico
 */
async function buscarItensNfeComCombustivel(codEmpresa: string, codCompra: string): Promise<any[]> {
  try {
    const acsClient = await getAcsClient();
    if (!acsClient) return [];

    try {
      const result = await acsClient.query(
        `
        SELECT 
          i.cod_combustivel,
          COALESCE(a.descricao, 'Combustível') as descricao_combustivel,
          SUM(i.quantidade::numeric) as quantidade,
          AVG(i.preco::numeric) as preco_medio
        FROM itens_compra_comb i
        LEFT JOIN codigos_anp a ON i.cod_combustivel = a.codigo
        WHERE i.cod_empresa = $1 AND i.cod_compra = $2 AND i.cancelado = 'N'
        GROUP BY i.cod_combustivel, a.descricao
        ORDER BY SUM(i.quantidade::numeric) DESC
        `,
        [codEmpresa, codCompra]
      );
      return result.rows;
    } finally {
      await acsClient.end();
    }
  } catch (erro) {
    console.error("[ACS-NFES] Erro ao buscar itens da NFe:", erro);
    return [];
  }
}

/**
 * Buscar NFes enriquecidas do ACS
 * 
 * FLUXO CORRIGIDO:
 * 1. Busca postos ATIVOS do banco PEPS (com codigoAcs)
 * 2. Se postoId informado, converte para codEmpresa do ACS
 * 3. Se "todos", filtra apenas cod_empresa de postos ATIVOS
 * 4. Enriquece com: nome do posto, fornecedor, custos unitários separados
 */
export async function buscarNfesDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  postoId?: string; // ID do banco PEPS (não codEmpresa!)
  status?: string;
}): Promise<any[]> {
  // 1. Buscar mapa de postos ativos
  const postosAtivosMap = await getPostosAtivosMap();
  const codEmpresasAtivos = Array.from(postosAtivosMap.keys());
  
  console.log(`[ACS-NFES] Postos ativos: ${codEmpresasAtivos.join(', ')}`);
  
  // 2. Determinar filtro de codEmpresa
  let codEmpresaFiltro: string | undefined;
  let codEmpresaListFiltro: string[] | undefined;
  
  if (filtros?.postoId && filtros.postoId !== "todos") {
    // Converter postoId (ID PEPS) para codEmpresa (código ACS)
    const codEmpresa = await postoIdToCodEmpresa(filtros.postoId);
    if (codEmpresa) {
      codEmpresaFiltro = codEmpresa;
      console.log(`[ACS-NFES] Filtro por posto ID ${filtros.postoId} -> codEmpresa ${codEmpresa}`);
    } else {
      console.warn(`[ACS-NFES] Posto ID ${filtros.postoId} não encontrado no banco PEPS`);
      return [];
    }
  } else {
    // "Todos os postos" -> filtrar apenas postos ATIVOS
    codEmpresaListFiltro = codEmpresasAtivos;
    console.log(`[ACS-NFES] Filtro por todos os postos ativos: ${codEmpresasAtivos.join(', ')}`);
  }
  
  // 3. Buscar compras do ACS
  const compras = await buscarComprasDoACS({
    dataInicio: filtros?.dataInicio,
    dataFim: filtros?.dataFim,
    codEmpresa: codEmpresaFiltro,
    codEmpresaList: codEmpresaListFiltro,
  });

  // 4. Buscar chaves de NFes já alocadas no banco PEPS para filtrar
  let chavesAlocadas = new Set<string>();
  try {
    const db = await getDb();
    if (db) {
      const lotesExistentes = await db.select({ chaveNfe: lotes.chaveNfe }).from(lotes);
      chavesAlocadas = new Set(lotesExistentes.map((l: any) => l.chaveNfe).filter(Boolean));
      console.log(`[ACS-NFES] ${chavesAlocadas.size} NFes já alocadas serão filtradas`);
    }
  } catch (err) {
    console.error("[ACS-NFES] Erro ao buscar lotes existentes:", err);
  }

  // 5. Enriquecer dados e filtrar alocadas
  const nfesEnriquecidas = await Promise.all(
    compras.map(async (c: any) => {
      const codEmpTrimmed = (c.codEmpresa || "").trim();
      
      // Nome do posto: buscar do mapa de postos ativos (dinâmico, não hardcoded)
      const postoInfo = postosAtivosMap.get(codEmpTrimmed);
      const postoNome = postoInfo?.nome || `Empresa ${codEmpTrimmed}`;
      
      // Calcular custos unitários separados
      // CORREÇÃO: usar totalProdutos (valor dos produtos sem frete) ao invés de totalNota (que já inclui frete)
      // Isso evita duplicação do frete no cálculo do custo unitário
      const valorProdutos = c.totalProdutos > 0 ? c.totalProdutos : c.totalNota;
      const custoUnitarioProduto = c.totalLitros > 0 ? valorProdutos / c.totalLitros : 0;
      const custoUnitarioFrete = (c.tipoFrete === 'FOB' && c.frete && c.totalLitros > 0) 
        ? c.frete / c.totalLitros 
        : 0;
      const custoUnitarioTotal = custoUnitarioProduto + custoUnitarioFrete;
      const custoTotal = valorProdutos + (c.tipoFrete === 'FOB' ? (c.frete || 0) : 0);
      
      // Nome do combustível já vem da query principal (subquery)
      const produtoDescricao = c.nomeCombustivel || 'Combustível';

      return {
        ...c,
        quantidade: c.totalLitros,
        custoUnitarioProduto,
        custoUnitarioFrete,
        custoUnitario: custoUnitarioTotal, // Custo total por litro (produto + frete se FOB)
        custoTotal,
        postoDestino: postoNome,
        postoDestinoId: postoInfo?.id || null,
        produto: produtoDescricao,
        nomeFornecedor: c.nomeFornecedor || `Fornecedor ${c.codFornecedor}`,
        statusAlocacao: "pendente",
        quantidadePendente: c.totalLitros,
        numeroNf: c.documento,
        serieNf: c.serie,
        dataEmissao: c.dataEmissao,
        chaveNfe: `ACS-${codEmpTrimmed}-${c.codigo}`,
        tipoFrete: c.tipoFrete || 'CIF',
        tipoFreteOriginal: c.tipoFreteOriginal || '',
        frete: c.frete || 0,
        despesas: c.despesas || 0,
      };
    })
  );

  // 6. Filtrar NFes já alocadas
  const nfesPendentes = nfesEnriquecidas.filter((nfe: any) => !chavesAlocadas.has(nfe.chaveNfe));
  console.log(`[ACS-NFES] ${nfesEnriquecidas.length} total -> ${nfesPendentes.length} pendentes (${chavesAlocadas.size} já alocadas)`);

  return nfesPendentes;
}
