/**
 * Serviço para buscar NFes reais do banco ACS
 * Conecta ao PostgreSQL externo e retorna NFes de entrada (compras)
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

interface NFe {
  id: string;
  chaveNfe: string;
  numeroNf: string;
  serieNf: string;
  dataEmissao: Date;
  cnpjFaturado: string;
  cnpjFornecedor: string;
  postoDestino: string;
  produto: string;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  statusAlocacao: string;
  quantidadePendente: number;
}

async function getAcsClient(): Promise<pg.Client | null> {
  try {
    const client = new pg.Client(ACS_CONFIG);
    await client.connect();
    return client;
  } catch (error) {
    console.error("[ACS-NFES] Erro ao conectar ao ACS:", error);
    return null;
  }
}

/**
 * Buscar NFes de entrada (compras) do ACS
 */
export async function buscarNfesDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  postoId?: string;
  status?: string;
}): Promise<NFe[]> {
  try {
    console.log("[ACS-NFES] Buscando NFes do ACS...");

    const nfes = await executeWithRetry(
      async () => {
        const acsClient = await getAcsClient();
        if (!acsClient) {
          throw new Error("Não foi possível conectar ao ACS");
        }

        try {
          // Query para buscar NFes de entrada (compras)
          let query = `
            SELECT 
              nf.id,
              nf.chave_nfe as chaveNfe,
              nf.numero_nf as numeroNf,
              nf.serie_nf as serieNf,
              nf.data_emissao as dataEmissao,
              nf.cnpj_faturado as cnpjFaturado,
              nf.cnpj_fornecedor as cnpjFornecedor,
              nf.cod_empresa as postoDestino,
              nf.descricao_produto as produto,
              nf.quantidade,
              nf.valor_unitario as custoUnitario,
              nf.valor_total as custoTotal,
              nf.status,
              COALESCE(nf.quantidade - nf.quantidade_alocada, nf.quantidade) as quantidadePendente
            FROM nf_entrada nf
            WHERE nf.tipo_documento = 'NF'
              AND nf.data_emissao >= '2025-12-01'
          `;

          const params: any[] = [];

          if (filtros?.dataInicio) {
            query += ` AND nf.data_emissao >= $${params.length + 1}`;
            params.push(filtros.dataInicio);
          }

          if (filtros?.dataFim) {
            query += ` AND nf.data_emissao <= $${params.length + 1}`;
            params.push(filtros.dataFim);
          }

          query += ` ORDER BY nf.data_emissao DESC LIMIT 1000`;

          console.log("[ACS-NFES] Executando query:", query);
          const result = await acsClient.query(query, params);

          // Transformar resultados
          const nfesTransformadas: NFe[] = result.rows.map((row: any) => ({
            id: String(row.id),
            chaveNfe: row.chavenfe || "",
            numeroNf: row.numeronf || "",
            serieNf: row.serienf || "",
            dataEmissao: new Date(row.dataemissao),
            cnpjFaturado: row.cnpjfaturado || "",
            cnpjFornecedor: row.cnpjfornecedor || "",
            postoDestino: row.postodestino || "",
            produto: row.produto || "",
            quantidade: Number(row.quantidade) || 0,
            custoUnitario: Number(row.custunitario) || 0,
            custoTotal: Number(row.custotal) || 0,
            statusAlocacao: row.status || "pendente",
            quantidadePendente: Number(row.quantidadependente) || 0,
          }));

          console.log(`[ACS-NFES] ${nfesTransformadas.length} NFes buscadas com sucesso`);
          return nfesTransformadas;
        } finally {
          await acsClient.end();
        }
      },
      "buscarNfesDoACS"
    );

    return nfes;
  } catch (erro) {
    console.error("[ACS-NFES] Erro ao buscar NFes:", erro);
    return [];
  }
}

/**
 * Buscar uma NFe específica por chave
 */
export async function buscarNfePorChave(chaveNfe: string): Promise<NFe | null> {
  try {
    console.log(`[ACS-NFES] Buscando NFe ${chaveNfe}...`);

    const nfe = await executeWithRetry(
      async () => {
        const acsClient = await getAcsClient();
        if (!acsClient) {
          throw new Error("Não foi possível conectar ao ACS");
        }

        try {
          const result = await acsClient.query(
            `
            SELECT 
              nf.id,
              nf.chave_nfe as chaveNfe,
              nf.numero_nf as numeroNf,
              nf.serie_nf as serieNf,
              nf.data_emissao as dataEmissao,
              nf.cnpj_faturado as cnpjFaturado,
              nf.cnpj_fornecedor as cnpjFornecedor,
              nf.cod_empresa as postoDestino,
              nf.descricao_produto as produto,
              nf.quantidade,
              nf.valor_unitario as custoUnitario,
              nf.valor_total as custoTotal,
              nf.status,
              COALESCE(nf.quantidade - nf.quantidade_alocada, nf.quantidade) as quantidadePendente
            FROM nf_entrada nf
            WHERE nf.chave_nfe = $1
            LIMIT 1
            `,
            [chaveNfe]
          );

          if (result.rows.length === 0) {
            return null;
          }

          const row = result.rows[0];
          return {
            id: String(row.id),
            chaveNfe: row.chavenfe || "",
            numeroNf: row.numeronf || "",
            serieNf: row.serienf || "",
            dataEmissao: new Date(row.dataemissao),
            cnpjFaturado: row.cnpjfaturado || "",
            cnpjFornecedor: row.cnpjfornecedor || "",
            postoDestino: row.postodestino || "",
            produto: row.produto || "",
            quantidade: Number(row.quantidade) || 0,
            custoUnitario: Number(row.custunitario) || 0,
            custoTotal: Number(row.custotal) || 0,
            statusAlocacao: row.status || "pendente",
            quantidadePendente: Number(row.quantidadependente) || 0,
          };
        } finally {
          await acsClient.end();
        }
      },
      "buscarNfePorChave"
    );

    return nfe;
  } catch (erro) {
    console.error("[ACS-NFES] Erro ao buscar NFe:", erro);
    return null;
  }
}

/**
 * Contar NFes não alocadas
 */
export async function contarNfesNaoAlocadas(): Promise<number> {
  try {
    const acsClient = await getAcsClient();
    if (!acsClient) {
      return 0;
    }

    try {
      const result = await acsClient.query(
        `
        SELECT COUNT(*) as total
        FROM nf_entrada nf
        WHERE nf.tipo_documento = 'NF'
          AND nf.data_emissao >= '2025-12-01'
          AND (nf.quantidade_alocada IS NULL OR nf.quantidade_alocada < nf.quantidade)
        `
      );

      return Number(result.rows[0]?.total) || 0;
    } finally {
      await acsClient.end();
    }
  } catch (erro) {
    console.error("[ACS-NFES] Erro ao contar NFes:", erro);
    return 0;
  }
}
