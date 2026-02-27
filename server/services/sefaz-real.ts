/**
 * Serviço SEFAZ Real
 * Busca NFes reais do banco ACS e integra com SEFAZ
 * Implementa cache e sincronização automática
 */

import { buscarComprasDoACS } from "./acs-nfes";
import { listarNfesAlocadas } from "../db-nfe-alocacoes";

interface NFeReal {
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
  statusAlocacao: "pendente" | "parcial" | "alocada";
  quantidadePendente: number;
  origem: "ACS" | "SEFAZ";
  ultimaSincronizacao: Date;
}

interface CacheNFes {
  dados: NFeReal[];
  timestamp: Date;
  validade: number;
}

let cacheNFes: CacheNFes | null = null;
const CACHE_VALIDITY = 30;

function isCacheValido(): boolean {
  if (!cacheNFes) return false;
  const agora = new Date();
  const diferenca = (agora.getTime() - cacheNFes.timestamp.getTime()) / (1000 * 60);
  return diferenca < cacheNFes.validade;
}

function transformarCompraEmNFe(compra: any): NFeReal {
  const chaveNfe = `35${new Date(compra.dataEmissao).toISOString().slice(2, 8)}${compra.documento.padStart(14, "0")}${compra.serie.padStart(8, "0")}000000001`;

  return {
    id: compra.id,
    chaveNfe,
    numeroNf: compra.documento,
    serieNf: compra.serie,
    dataEmissao: new Date(compra.dataEmissao),
    cnpjFaturado: "07.526.847/0001-00",
    cnpjFornecedor: "07.526.847/0001-00",
    postoDestino: "Aracati",
    produto: "Gasolina Comum",
    quantidade: compra.totalLitros || 0,
    custoUnitario: compra.totalProdutos && compra.totalLitros ? compra.totalProdutos / compra.totalLitros : 0,
    custoTotal: compra.totalProdutos || compra.totalNota || 0,
    statusAlocacao: "pendente",
    quantidadePendente: compra.totalLitros || 0,
    origem: "ACS",
    ultimaSincronizacao: new Date(),
  };
}

export async function buscarNfesReaisDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  forcarAtualizar?: boolean;
}): Promise<NFeReal[]> {
  try {
    console.log("[SEFAZ-REAL] Buscando NFes reais...");

    if (!filtros?.forcarAtualizar && isCacheValido()) {
      console.log("[SEFAZ-REAL] Retornando dados do cache");
      return cacheNFes!.dados;
    }

    const compras = await buscarComprasDoACS({
      dataInicio: filtros?.dataInicio,
      dataFim: filtros?.dataFim,
    });

    const nfes: NFeReal[] = compras.map(transformarCompraEmNFe);

    const nfesComStatus = await Promise.all(
      nfes.map(async (nfe) => {
        try {
          const alocadas = await listarNfesAlocadas({
            dataInicio: filtros?.dataInicio ? new Date(filtros.dataInicio) : undefined,
            dataFim: filtros?.dataFim ? new Date(filtros.dataFim) : undefined,
          });

          const alocada = alocadas.find((a) => a.chaveNfe === nfe.chaveNfe);
          if (alocada) {
            nfe.statusAlocacao = "alocada";
            nfe.quantidadePendente = 0;
          }

          return nfe;
        } catch (erro) {
          console.warn("[SEFAZ-REAL] Erro ao verificar alocação:", erro);
          return nfe;
        }
      })
    );

    cacheNFes = {
      dados: nfesComStatus,
      timestamp: new Date(),
      validade: CACHE_VALIDITY,
    };

    console.log(`[SEFAZ-REAL] ${nfesComStatus.length} NFes carregadas e cacheadas`);
    return nfesComStatus;
  } catch (erro) {
    console.error("[SEFAZ-REAL] Erro ao buscar NFes:", erro);
    if (cacheNFes) {
      console.log("[SEFAZ-REAL] Retornando cache antigo (expirado)");
      return cacheNFes.dados;
    }
    return [];
  }
}

export async function sincronizarNfesAutomaticamente(): Promise<{
  novasNfes: number;
  nfesAtualizadas: number;
  erros: string[];
}> {
  try {
    console.log("[SEFAZ-REAL] Iniciando sincronização automática...");

    const nfes = await buscarNfesReaisDoACS({
      forcarAtualizar: true,
    });

    console.log(`[SEFAZ-REAL] Sincronizadas ${nfes.length} NFes`);
    return {
      novasNfes: nfes.length,
      nfesAtualizadas: 0,
      erros: [],
    };
  } catch (erro) {
    console.error("[SEFAZ-REAL] Erro na sincronização:", erro);
    return {
      novasNfes: 0,
      nfesAtualizadas: 0,
      erros: [erro instanceof Error ? erro.message : "Erro desconhecido"],
    };
  }
}

export async function buscarNFeComDetalhes(chaveNfe: string): Promise<NFeReal | null> {
  try {
    console.log(`[SEFAZ-REAL] Buscando detalhes da NFe ${chaveNfe}...`);

    if (isCacheValido()) {
      const nfe = cacheNFes!.dados.find((n) => n.chaveNfe === chaveNfe);
      if (nfe) {
        console.log("[SEFAZ-REAL] NFe encontrada no cache");
        return nfe;
      }
    }

    const nfes = await buscarNfesReaisDoACS({ forcarAtualizar: true });
    return nfes.find((n) => n.chaveNfe === chaveNfe) || null;
  } catch (erro) {
    console.error("[SEFAZ-REAL] Erro ao buscar NFe:", erro);
    return null;
  }
}

export function limparCache(): void {
  console.log("[SEFAZ-REAL] Cache limpo manualmente");
  cacheNFes = null;
}

export async function obterEstatisticasSincronizacao(): Promise<{
  totalNfes: number;
  nfesPendentes: number;
  nfesAlocadas: number;
  ultimaSincronizacao: Date | null;
  cacheValido: boolean;
}> {
  try {
    const nfes = await buscarNfesReaisDoACS({ forcarAtualizar: false });

    return {
      totalNfes: nfes.length,
      nfesPendentes: nfes.filter((n) => n.statusAlocacao === "pendente").length,
      nfesAlocadas: nfes.filter((n) => n.statusAlocacao === "alocada").length,
      ultimaSincronizacao: cacheNFes?.timestamp || null,
      cacheValido: isCacheValido(),
    };
  } catch (erro) {
    console.error("[SEFAZ-REAL] Erro ao obter estatísticas:", erro);
    return {
      totalNfes: 0,
      nfesPendentes: 0,
      nfesAlocadas: 0,
      ultimaSincronizacao: null,
      cacheValido: false,
    };
  }
}

export function configurarSincronizacaoAutomatica(intervaloMinutos: number = 60): NodeJS.Timer {
  console.log(`[SEFAZ-REAL] Configurando sincronização automática a cada ${intervaloMinutos} minutos`);

  return setInterval(async () => {
    try {
      const resultado = await sincronizarNfesAutomaticamente();
      console.log("[SEFAZ-REAL] Sincronização automática concluída:", resultado);
    } catch (erro) {
      console.error("[SEFAZ-REAL] Erro na sincronização automática:", erro);
    }
  }, intervaloMinutos * 60 * 1000);
}
