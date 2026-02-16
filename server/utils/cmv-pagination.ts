/**
 * Paginação no Recálculo de CMV
 * Implementa processamento em lotes para melhor performance e resiliência
 */

import { getDb } from "../db";
import { vendas as vendasTable } from "../../drizzle/schema";
import { eq } from "drizzle-orm";

export interface CMVRecalcProgress {
  totalProcessado: number;
  totalErros: number;
  totalPaginas: number;
  paginaAtual: number;
  percentualConcluido: number;
  status: "iniciado" | "processando" | "concluido" | "erro";
  mensagem: string;
}

// Armazenar estado do recálculo em memória (em produção, usar Redis)
const recalcStates = new Map<string, CMVRecalcProgress>();

/**
 * Gera ID único para rastrear progresso do recálculo
 */
export function gerarIdRecalc(): string {
  return `recalc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Busca vendas pendentes de CMV com paginação
 */
export async function getVendasPendentesCMV(limit: number, offset: number) {
  const db = await getDb();
  if (!db) return [];

  try {
    return await db
      .select()
      .from(vendasTable)
      .where(eq(vendasTable.statusCmv, "pendente"))
      .limit(limit)
      .offset(offset)
      .execute();
  } catch (error) {
    console.error("[CMV-PAGINACAO] Erro ao buscar vendas pendentes:", error);
    return [];
  }
}

/**
 * Conta total de vendas pendentes de CMV
 */
export async function contarVendasPendentesCMV(): Promise<number> {
  const db = await getDb();
  if (!db) return 0;

  try {
    const result = await db
      .select({ count: vendasTable.id })
      .from(vendasTable)
      .where(eq(vendasTable.statusCmv, "pendente"))
      .execute();

    return result.length;
  } catch (error) {
    console.error("[CMV-PAGINACAO] Erro ao contar vendas pendentes:", error);
    return 0;
  }
}

/**
 * Inicia recálculo de CMV com paginação
 */
export async function iniciarRecalcCMVPaginado(
  idRecalc: string,
  tamanhoPagina: number = 1000
): Promise<CMVRecalcProgress> {
  try {
    const totalVendas = await contarVendasPendentesCMV();
    const totalPaginas = Math.ceil(totalVendas / tamanhoPagina);

    const progress: CMVRecalcProgress = {
      totalProcessado: 0,
      totalErros: 0,
      totalPaginas,
      paginaAtual: 0,
      percentualConcluido: 0,
      status: "iniciado",
      mensagem: `Iniciando recálculo de CMV. Total de vendas pendentes: ${totalVendas}`,
    };

    recalcStates.set(idRecalc, progress);
    console.log(`[CMV-PAGINACAO] Recálculo iniciado: ${idRecalc}, ${totalVendas} vendas pendentes`);

    return progress;
  } catch (error) {
    console.error("[CMV-PAGINACAO] Erro ao iniciar recálculo:", error);
    const progress: CMVRecalcProgress = {
      totalProcessado: 0,
      totalErros: 0,
      totalPaginas: 0,
      paginaAtual: 0,
      percentualConcluido: 0,
      status: "erro",
      mensagem: `Erro ao iniciar recálculo: ${error instanceof Error ? error.message : String(error)}`,
    };
    recalcStates.set(idRecalc, progress);
    return progress;
  }
}

/**
 * Processa uma página de vendas pendentes
 */
export async function processarPaginaCMV(
  idRecalc: string,
  paginaAtual: number,
  tamanhoPagina: number = 1000,
  funcaoRecalc: (vendaId: number) => Promise<boolean>
): Promise<CMVRecalcProgress> {
  try {
    const progress = recalcStates.get(idRecalc);
    if (!progress) {
      throw new Error(`Recálculo ${idRecalc} não encontrado`);
    }

    progress.status = "processando";
    progress.paginaAtual = paginaAtual;

    const offset = (paginaAtual - 1) * tamanhoPagina;
    const vendas = await getVendasPendentesCMV(tamanhoPagina, offset);

    console.log(
      `[CMV-PAGINACAO] Processando página ${paginaAtual}/${progress.totalPaginas}, ${vendas.length} vendas`
    );

    let processados = 0;
    let erros = 0;

    for (const venda of vendas) {
      try {
        const sucesso = await funcaoRecalc(venda.id);
        if (sucesso) {
          processados++;
        } else {
          erros++;
        }
      } catch (error) {
        console.error(`[CMV-PAGINACAO] Erro ao processar venda ${venda.id}:`, error);
        erros++;
      }
    }

    progress.totalProcessado += processados;
    progress.totalErros += erros;
    progress.percentualConcluido = Math.round(
      (paginaAtual / progress.totalPaginas) * 100
    );

    if (paginaAtual >= progress.totalPaginas) {
      progress.status = "concluido";
      progress.percentualConcluido = 100;
      progress.mensagem = `Recálculo concluído. Processadas: ${progress.totalProcessado}, Erros: ${progress.totalErros}`;
      console.log(`[CMV-PAGINACAO] Recálculo concluído: ${idRecalc}`);
    } else {
      progress.mensagem = `Processando página ${paginaAtual}/${progress.totalPaginas}. Processadas: ${progress.totalProcessado}, Erros: ${progress.totalErros}`;
    }

    recalcStates.set(idRecalc, progress);
    return progress;
  } catch (error) {
    console.error("[CMV-PAGINACAO] Erro ao processar página:", error);
    const progress = recalcStates.get(idRecalc) || {
      totalProcessado: 0,
      totalErros: 0,
      totalPaginas: 0,
      paginaAtual: 0,
      percentualConcluido: 0,
      status: "erro" as const,
      mensagem: "",
    };
    progress.status = "erro";
    progress.mensagem = `Erro ao processar página: ${error instanceof Error ? error.message : String(error)}`;
    recalcStates.set(idRecalc, progress);
    return progress;
  }
}

/**
 * Obtém status atual do recálculo
 */
export function obterStatusRecalc(idRecalc: string): CMVRecalcProgress | null {
  return recalcStates.get(idRecalc) || null;
}

/**
 * Limpa estado do recálculo após conclusão
 */
export function limparRecalc(idRecalc: string): void {
  recalcStates.delete(idRecalc);
  console.log(`[CMV-PAGINACAO] Limpeza do recálculo: ${idRecalc}`);
}

/**
 * Lista todos os recálculos em andamento
 */
export function listarRecalcsEmAndamento(): Array<{ id: string; progress: CMVRecalcProgress }> {
  const resultado: Array<{ id: string; progress: CMVRecalcProgress }> = [];
  recalcStates.forEach((progress, id) => {
    if (progress.status !== "concluido" && progress.status !== "erro") {
      resultado.push({ id, progress });
    }
  });
  return resultado;
}
