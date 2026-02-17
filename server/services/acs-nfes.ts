/**
 * Serviço para buscar Compras reais do banco ACS
 * Conecta ao PostgreSQL externo e retorna compras da tabela compras_comb
 */

import pg from "pg";
import { executeWithRetry } from "../utils/retry";

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
  totalNota: number;
  totalProdutos: number;
  totalItens: number;
  totalLitros: number;
  quantidadePendente: number;
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
 * Buscar compras do ACS do período especificado
 */
export async function buscarComprasDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  codEmpresa?: string;
}): Promise<Compra[]> {
  try {
    console.log("[ACS-COMPRAS] Buscando compras do ACS...");

    const compras = await executeWithRetry(
      async () => {
        const acsClient = await getAcsClient();
        if (!acsClient) {
          throw new Error("Não foi possível conectar ao ACS");
        }

        try {
          // Query para buscar compras com itens
          let query = `
            SELECT 
              c.cod_empresa,
              c.codigo,
              c.documento,
              c.serie,
              c.dt_emissao,
              c.dt_lmc,
              c.cod_fornecedor,
              c.total_nota,
              c.total_produtos,
              COUNT(i.numero) as total_itens,
              SUM(i.quantidade::numeric) as total_litros
            FROM compras_comb c
            LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa
            WHERE c.dt_emissao >= '2025-12-16'::date
              AND c.dt_emissao <= '2026-02-16'::date
          `;

          const params: any[] = [];

          if (filtros?.dataInicio) {
            query = query.replace("'2025-12-16'::date", `$${params.length + 1}::date`);
            params.push(filtros.dataInicio);
          }

          if (filtros?.dataFim) {
            query = query.replace("'2026-02-16'::date", `$${params.length + 1}::date`);
            params.push(filtros.dataFim);
          }

          if (filtros?.codEmpresa) {
            query += ` AND c.cod_empresa = $${params.length + 1}`;
            params.push(filtros.codEmpresa);
          }

          query += ` GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.dt_lmc, c.cod_fornecedor, c.total_nota, c.total_produtos
            ORDER BY c.dt_emissao DESC
            LIMIT 500`;

          console.log("[ACS-COMPRAS] Executando query para buscar compras");
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
            totalNota: Number(row.total_nota) || 0,
            totalProdutos: Number(row.total_produtos) || 0,
            totalItens: Number(row.total_itens) || 0,
            totalLitros: Number(row.total_litros) || 0,
            quantidadePendente: Number(row.total_litros) || 0,
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
              c.total_nota,
              c.total_produtos,
              COUNT(i.numero) as total_itens,
              SUM(i.quantidade::numeric) as total_litros
            FROM compras_comb c
            LEFT JOIN itens_compra_comb i ON c.codigo = i.cod_compra AND c.cod_empresa = i.cod_empresa
            WHERE c.cod_empresa = $1 AND c.codigo = $2
            GROUP BY c.cod_empresa, c.codigo, c.documento, c.serie, c.dt_emissao, c.dt_lmc, c.cod_fornecedor, c.total_nota, c.total_produtos
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
            totalNota: Number(row.total_nota) || 0,
            totalProdutos: Number(row.total_produtos) || 0,
            totalItens: Number(row.total_itens) || 0,
            totalLitros: Number(row.total_litros) || 0,
            quantidadePendente: Number(row.total_litros) || 0,
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
        WHERE c.dt_emissao >= '2025-12-16'::date
          AND c.dt_emissao <= '2026-02-16'::date
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
 * Buscar NFes (para compatibilidade com interface anterior)
 * Enriquece dados com custoUnitario calculado e nome do posto
 */
export async function buscarNfesDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  postoId?: string;
  status?: string;
}): Promise<any[]> {
  const compras = await buscarComprasDoACS({
    dataInicio: filtros?.dataInicio,
    dataFim: filtros?.dataFim,
    codEmpresa: filtros?.postoId,
  });

  // Mapeamento de cod_empresa para nomes de postos
  const MAPA_POSTOS: Record<string, string> = {
    "01": "NOVO GUERRA - Fotim",
    "02": "PALHANO",
    "03": "NOVO GUERRA - Itaiçaba",
    "04": "PAI TEREZA",
    "05": "LEITE LEITE",
    "06": "MÃE E FILHO",
    "07": "GUERRA COMB.",
    "08": "JAGUARUANA",
    "09": "GUERRA COMB. LTDA",
    "10": "SG PETROLEO",
    "11": "GUARARAPES",
    "12": "ARACATI",
    "13": "HORIZONTE",
  };

  return compras.map((c: any) => {
    const codEmpTrimmed = (c.codEmpresa || "").trim();
    const custoUnitario = c.totalLitros > 0 ? c.totalNota / c.totalLitros : 0;
    return {
      ...c,
      quantidade: c.totalLitros,
      custoUnitario,
      custoTotal: c.totalNota,
      postoDestino: MAPA_POSTOS[codEmpTrimmed] || `Empresa ${codEmpTrimmed}`,
      produto: "Combustível",
      statusAlocacao: "pendente",
      quantidadePendente: c.totalLitros,
      numeroNf: c.documento,
      serieNf: c.serie,
      dataEmissao: c.dataEmissao,
      chaveNfe: `ACS-${codEmpTrimmed}-${c.codigo}`,
    };
  });
}
