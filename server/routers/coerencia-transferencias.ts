/**
 * tRPC Router para Coerência Física, Transferências Inteligentes e Bloqueio DRE
 * 
 * Fluxo principal:
 * 1. NFes entram como provisórias no posto de origem
 * 2. Coerência física detecta sobras/faltas
 * 3. Motor de sugestão cruza alertas complementares
 * 4. Usuário resolve via transferência (não alocação manual)
 * 5. Recálculo automático de CMV, lotes e coerência
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
import {
  buscarPendenciasEstoque,
  confirmarNfe,
  buscarLotesProvisorisPosto,
  validarCapacidadeTanque,
  validarEstoqueNegativo,
} from "../services/motor-sugestao";

export const coerenciaTransferenciasRouter = router({
  // ==================== PENDÊNCIAS DE ESTOQUE (FLUXO PRINCIPAL) ====================

  /**
   * Buscar pendências de estoque com sugestões de transferência
   * Este é o endpoint principal do novo fluxo
   */
  buscarPendencias: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
        postoId: z.number().optional(),
      })
    )
    .query(async ({ input }) => {
      try {
        const pendencias = await buscarPendenciasEstoque(
          input.dataInicio,
          input.dataFim,
          input.postoId
        );
        return { sucesso: true, dados: pendencias };
      } catch (erro) {
        console.error("[PENDENCIAS] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
        };
      }
    }),

  /**
   * Buscar lotes provisórios (NFes não confirmadas)
   */
  buscarLotesProvisórios: protectedProcedure
    .input(
      z.object({
        postoId: z.number().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const lotes = await buscarLotesProvisorisPosto(input?.postoId);
        return { sucesso: true, dados: lotes };
      } catch (erro) {
        console.error("[PROVISORIOS] Erro:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
        };
      }
    }),

  /**
   * Confirmar NFe como corretamente alocada
   */
  confirmarNfe: protectedProcedure
    .input(z.object({ loteId: z.number() }))
    .mutation(async ({ input }) => {
      try {
        return await confirmarNfe(input.loteId);
      } catch (erro) {
        return {
          sucesso: false,
          mensagem: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Validar transferência antes de executar (capacidade + estoque negativo)
   */
  validarTransferencia: protectedProcedure
    .input(
      z.object({
        loteOrigemId: z.number(),
        tanqueDestinoId: z.number(),
        volumeTransferido: z.number().positive(),
      })
    )
    .query(async ({ input }) => {
      try {
        const [validacaoEstoque, validacaoCapacidade] = await Promise.all([
          validarEstoqueNegativo(input.loteOrigemId, input.volumeTransferido),
          validarCapacidadeTanque(input.tanqueDestinoId, input.volumeTransferido),
        ]);

        return {
          sucesso: true,
          valido: validacaoEstoque.valido && validacaoCapacidade.valido,
          estoque: validacaoEstoque,
          capacidade: validacaoCapacidade,
        };
      } catch (erro) {
        return {
          sucesso: false,
          valido: false,
          estoque: { valido: false, saldoAtual: 0, mensagem: "Erro na validação" },
          capacidade: { valido: false, capacidade: 0, saldoAtual: 0, espacoLivre: 0, mensagem: "Erro na validação" },
        };
      }
    }),

  // ==================== COERÊNCIA FÍSICA ====================

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
        // Validar antes de executar
        const [validacaoEstoque, validacaoCapacidade] = await Promise.all([
          validarEstoqueNegativo(input.loteOrigemId, input.volumeTransferido),
          validarCapacidadeTanque(input.tanqueDestinoId, input.volumeTransferido),
        ]);

        if (!validacaoEstoque.valido) {
          return { sucesso: false, mensagem: validacaoEstoque.mensagem };
        }
        if (!validacaoCapacidade.valido) {
          return { sucesso: false, mensagem: validacaoCapacidade.mensagem };
        }

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

  verificarBloqueio: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        data: z.string(),
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

  fecharMes: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        mesReferencia: z.string(),
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

  desbloquearMes: protectedProcedure
    .input(
      z.object({
        postoId: z.number(),
        mesReferencia: z.string(),
        observacoes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
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
