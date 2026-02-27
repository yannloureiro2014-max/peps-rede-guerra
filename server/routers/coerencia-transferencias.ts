/**
 * tRPC Router para Coerência Física, Transferências e Bloqueio DRE
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  verificarCoerenciaFisicaPosto,
  verificarCoerenciaFisicaTodosPostos,
  detectarMedicoesAusentes,
  buscarVerificacoesSalvas,
  resumoCoerenciaPorPosto,
} from "../services/coerencia-fisica";
import {
  realizarTransferencia,
  listarTransferencias,
  cancelarTransferencia,
  verificarBloqueioMes,
} from "../services/transferencias-fisicas";
import {
  fecharMesDRE,
  desbloquearMesDRE,
  listarStatusBloqueio,
  fecharMesTodosPostos,
  isMesBloqueado,
} from "../services/bloqueio-dre";

export const coerenciaTransferenciasRouter = router({
  // ==================== COERÊNCIA FÍSICA ====================

  /**
   * Verificar coerência física de um posto específico
   */
  verificarCoerenciaPosto: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        dataInicio: z.string(),
        dataFim: z.string(),
        tolerancia: z.number().optional().default(1000),
      })
    )
    .query(async ({ input }) => {
      try {
        const resultado = await verificarCoerenciaFisicaPosto(
          input.postoId,
          input.dataInicio,
          input.dataFim,
          input.tolerancia
        );
        return { sucesso: true, dados: resultado };
      } catch (erro) {
        console.error("[COERENCIA] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Verificar coerência física de todos os postos
   */
  verificarCoerenciaTodos: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
        tolerancia: z.number().optional().default(1000),
      })
    )
    .query(async ({ input }) => {
      try {
        const resultados = await verificarCoerenciaFisicaTodosPostos(
          input.dataInicio,
          input.dataFim,
          input.tolerancia
        );
        return { sucesso: true, dados: resultados };
      } catch (erro) {
        console.error("[COERENCIA] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Detectar medições ausentes
   */
  detectarMedicoesAusentes: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const resultado = await detectarMedicoesAusentes(input.dataInicio, input.dataFim);
        return { sucesso: true, dados: resultado };
      } catch (erro) {
        console.error("[COERENCIA] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Buscar verificações salvas (cache)
   */
  buscarVerificacoes: protectedProcedure
    .input(
      z.object({
        postoId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        status: z.enum(["coerente", "alerta", "sem_medicao"]).optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const resultado = await buscarVerificacoesSalvas(
          input?.postoId,
          input?.dataInicio,
          input?.dataFim,
          input?.status
        );
        return { sucesso: true, dados: resultado };
      } catch (erro) {
        console.error("[COERENCIA] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Resumo de coerência por posto (para dashboard)
   */
  resumoCoerencia: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const resultado = await resumoCoerenciaPorPosto(input.dataInicio, input.dataFim);
        return { sucesso: true, dados: resultado };
      } catch (erro) {
        console.error("[COERENCIA] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  // ==================== TRANSFERÊNCIAS FÍSICAS ====================

  /**
   * Realizar transferência física
   */
  realizarTransferencia: protectedProcedure
    .input(
      z.object({
        loteOrigemId: z.number(),
        postoDestinoId: z.number(),
        tanqueDestinoId: z.number(),
        volumeTransferido: z.number().positive(),
        dataTransferencia: z.string(),
        justificativa: z.string().min(5, "Justificativa deve ter pelo menos 5 caracteres"),
        tipo: z.enum(["correcao_alocacao", "transferencia_fisica", "divisao_nfe"]),
        nfeStagingId: z.number().optional(),
        numeroNf: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const resultado = await realizarTransferencia({
          ...input,
          usuarioId: ctx.user.id,
          usuarioNome: ctx.user.name || undefined,
        });
        return resultado;
      } catch (erro) {
        console.error("[TRANSFERENCIA] Erro:", erro);
        return {
          sucesso: false,
          mensagem: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Listar transferências realizadas
   */
  listarTransferencias: protectedProcedure
    .input(
      z.object({
        postoOrigemId: z.number().optional(),
        postoDestinoId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        tipo: z.string().optional(),
        status: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const resultado = await listarTransferencias(input || undefined);
        return { sucesso: true, dados: resultado };
      } catch (erro) {
        console.error("[TRANSFERENCIA] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
        };
      }
    }),

  /**
   * Cancelar transferência
   */
  cancelarTransferencia: protectedProcedure
    .input(
      z.object({
        transferenciaId: z.number(),
        justificativa: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const resultado = await cancelarTransferencia(
          input.transferenciaId,
          ctx.user.id,
          ctx.user.name || undefined,
          input.justificativa
        );
        return resultado;
      } catch (erro) {
        console.error("[TRANSFERENCIA] Erro:", erro);
        return {
          sucesso: false,
          mensagem: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Verificar se mês está bloqueado para um posto
   */
  verificarBloqueio: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        data: z.string(), // YYYY-MM-DD
      })
    )
    .query(async ({ input }) => {
      try {
        const resultado = await verificarBloqueioMes(input.postoId, input.data);
        return { sucesso: true, ...resultado };
      } catch (erro) {
        return { sucesso: false, bloqueado: false };
      }
    }),

  // ==================== BLOQUEIO MENSAL DRE ====================

  /**
   * Fechar mês de DRE para um posto
   */
  fecharMes: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        mesReferencia: z.string(), // YYYY-MM
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const resultado = await fecharMesDRE(
          input.postoId,
          input.mesReferencia,
          ctx.user.id,
          ctx.user.name || undefined,
          input.observacoes
        );
        return resultado;
      } catch (erro) {
        console.error("[BLOQUEIO] Erro:", erro);
        return {
          sucesso: false,
          mensagem: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Fechar mês para todos os postos
   */
  fecharMesTodosPostos: protectedProcedure
    .input(
      z.object({
        mesReferencia: z.string(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const resultado = await fecharMesTodosPostos(
          input.mesReferencia,
          ctx.user.id,
          ctx.user.name || undefined,
          input.observacoes
        );
        return resultado;
      } catch (erro) {
        console.error("[BLOQUEIO] Erro:", erro);
        return {
          sucesso: false,
          mensagem: erro instanceof Error ? erro.message : "Erro desconhecido",
          detalhes: [],
        };
      }
    }),

  /**
   * Desbloquear mês de DRE (admin only)
   */
  desbloquearMes: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        mesReferencia: z.string(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verificar se é admin
      if (ctx.user.role !== "admin_geral") {
        return {
          sucesso: false,
          mensagem: "Apenas administradores podem desbloquear meses fechados.",
        };
      }

      try {
        const resultado = await desbloquearMesDRE(
          input.postoId,
          input.mesReferencia,
          ctx.user.id,
          ctx.user.name || undefined,
          input.observacoes
        );
        return resultado;
      } catch (erro) {
        console.error("[BLOQUEIO] Erro:", erro);
        return {
          sucesso: false,
          mensagem: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Listar status de bloqueio
   */
  listarStatusBloqueio: protectedProcedure
    .input(
      z.object({
        mesReferencia: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const resultado = await listarStatusBloqueio(input?.mesReferencia);
        return { sucesso: true, dados: resultado };
      } catch (erro) {
        console.error("[BLOQUEIO] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
        };
      }
    }),

  /**
   * Verificar se mês está bloqueado
   */
  isMesBloqueado: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        mesReferencia: z.string(),
      })
    )
    .query(async ({ input }) => {
      try {
        const bloqueado = await isMesBloqueado(input.postoId, input.mesReferencia);
        return { sucesso: true, bloqueado };
      } catch (erro) {
        return { sucesso: false, bloqueado: false };
      }
    }),
});
