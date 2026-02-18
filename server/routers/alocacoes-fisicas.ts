/**
 * tRPC Router para Alocações Físicas
 * Gerencia NFes em staging, alocações físicas e recalcular CMV
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import {
  listarNfesPendentes as dbListarNfesPendentes,
  criarAlocacaoFisica as dbCriarAlocacaoFisica,
  criarLoteFisico as dbCriarLoteFisico,
  registrarAuditoria as dbRegistrarAuditoria,
  listarAlocacoesRealizadas as dbListarAlocacoesRealizadas,
  listarLotesFisicos as dbListarLotesFisicos,
  obterEstatisticasAlocacoes as dbObterEstatisticasAlocacoes,
} from "../db-fuel-engine";
import { buscarNfesDoACS } from "../services/acs-nfes";
import { buscarNfesReaisDoACS, sincronizarNfesAutomaticamente, obterEstatisticasSincronizacao } from "../services/sefaz-real";
import {
  criarLoteDoSEFAZ,
  listarNfesAlocadas,
  obterEstatisticasAlocacoes,
  registrarConsumoLote,
  atualizarDisponibilidadeLote,
  obterLotesDisponiveisPEPS,
  cancelarAlocacao,
  desfazerAlocacao,
} from "../db-nfe-alocacoes";


export const alocacoesFisicasRouter = router({
  /**
   * Listar NFes em staging (busca do ACS real)
   */
  listarNfesPendentes: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
        postoId: z.string().optional(),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      try {
        console.log("[ALOCACOES] Buscando NFes do ACS...");
        
        // Buscar NFes reais do ACS
        let nfesReais: any[] = [];
        try {
          nfesReais = await buscarNfesDoACS({
            dataInicio: input?.dataInicio,
            dataFim: input?.dataFim,
            postoId: input?.postoId,
          });
        } catch (erro) {
          console.warn("[ALOCACOES] Erro ao buscar ACS, usando fallback:", erro);
          // Fallback para dados simulados se ACS indisponível
          nfesReais = [];
        }

        // Se temos dados reais, retornar
        if (nfesReais.length > 0) {
          return {
            sucesso: true,
            dados: nfesReais,
            total: nfesReais.length,
            timestamp: new Date(),
            origem: "ACS",
          };
        }

        // Fallback: dados simulados
        const nfes = [
          {
            id: "1",
            chaveNfe: "35240216123456789012345678901234567890",
            numeroNf: "001234",
            serieNf: "1",
            dataEmissao: new Date("2026-02-14"),
            cnpjFaturado: "07.526.847/0001-00",
            cnpjFornecedor: "07.526.847/0001-00",
            postoDestino: "Aracati",
            produto: "Gasolina Comum",
            quantidade: 5000,
            custoUnitario: 5.42,
            custoTotal: 27100,
            statusAlocacao: "pendente",
            quantidadePendente: 5000,
          },
        ];

        return {
          sucesso: true,
          dados: nfes,
          total: nfes.length,
          timestamp: new Date(),
          origem: "SIMULADO",
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao listar NFes:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
          total: 0,
        };
      }
    }),

  /**
   * Criar nova alocação física
   */
  criarAlocacao: protectedProcedure
    .input(
      z.object({
        chaveNfe: z.string(),
        numeroNf: z.string(),
        serieNf: z.string(),
        dataEmissao: z.string(),
        postoDestinoId: z.number(),
        tanqueDestinoId: z.number(),
        produtoId: z.number().default(1),
        dataDescargaReal: z.string(),
        horaDescargaReal: z.string().optional(),
        volumeAlocado: z.number().positive(),
        custoUnitarioAplicado: z.number().positive(),
        justificativa: z.string().optional(),
        // Dados extras da NFe para persistir
        nomeFornecedor: z.string().optional(),
        nomeProduto: z.string().optional(),
        tipoFrete: z.string().optional(),
        custoUnitarioProduto: z.number().optional(),
        custoUnitarioFrete: z.number().optional(),
        valorFrete: z.number().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        // Criar lote no banco de dados com persistencia
        const loteId = await criarLoteDoSEFAZ({
          chaveNfe: input.chaveNfe,
          numeroNf: input.numeroNf,
          serieNf: input.serieNf,
          dataEmissao: new Date(input.dataEmissao),
          dataDescargaReal: new Date(input.dataDescargaReal),
          postoId: input.postoDestinoId,
          tanqueId: input.tanqueDestinoId,
          produtoId: input.produtoId,
          volumeAlocado: input.volumeAlocado,
          custoUnitario: input.custoUnitarioAplicado,
          justificativa: input.justificativa,
          usuarioId: ctx.user.id,
          nomeFornecedor: input.nomeFornecedor,
          nomeProduto: input.nomeProduto,
          tipoFrete: input.tipoFrete,
          custoUnitarioProduto: input.custoUnitarioProduto,
          custoUnitarioFrete: input.custoUnitarioFrete,
          valorFrete: input.valorFrete,
        });

        const custoTotalAlocado = input.volumeAlocado * input.custoUnitarioAplicado;

        return {
          sucesso: true,
          dados: {
            id: loteId,
            volumeAlocado: input.volumeAlocado,
            custoTotalAlocado,
            statusAlocacao: "confirmada",
            timestamp: new Date(),
          },
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao criar alocação:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Listar alocacoes realizadas
   */
  listarAlocacoesRealizadas: protectedProcedure
    .input(
      z.object({
        postoId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        console.log("[ALOCACOES] Filtro recebido:", input);
        const alocacoes = await listarNfesAlocadas({
          postoId: input?.postoId,
          dataInicio: input?.dataInicio ? new Date(input.dataInicio) : undefined,
          dataFim: input?.dataFim ? new Date(input.dataFim) : undefined,
          status: "ativo",
        });

        return {
          sucesso: true,
          dados: alocacoes,
          total: alocacoes.length,
          timestamp: new Date(),
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao listar alocações:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
          total: 0,
        };
      }
    }),

  /**
   * Listar lotes físicos criados
   */
  listarLotesFisicos: protectedProcedure
    .input(
      z.object({
        postoId: z.number().optional(),
        tanqueId: z.number().optional(),
        statusLote: z.string().optional(),
      }).optional()
    )
    .query(async ({ input }) => {
      try {
        const lotes = await dbListarLotesFisicos(
          input?.postoId,
          input?.tanqueId,
          input?.statusLote
        );

        return {
          sucesso: true,
          dados: lotes,
          total: lotes.length,
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao listar lotes:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
          dados: [],
          total: 0,
        };
      }
    }),

  /**
   * Recalcular CMV com alocações
   */
  recalcularCMVComAlocacoes: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string(),
        dataFim: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const stats = await obterEstatisticasAlocacoes({
          dataInicio: new Date(input.dataInicio),
          dataFim: new Date(input.dataFim),
        });

        return {
          sucesso: true,
          dados: {
            totalAlocacoes: stats.totalAlocacoes,
            totalVolume: stats.totalVolume,
            custoMedio: stats.custoMedio,
            lotesPorStatus: stats.lotesPorStatus,
            timestamp: new Date(),
          },
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao recalcular CMV:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Desfazer alocação - deleta o lote e a NFe volta para pendentes
   */
  desfazerAlocacao: protectedProcedure
    .input(
      z.object({
        loteId: z.number(),
        justificativa: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      try {
        const resultado = await desfazerAlocacao({
          loteId: input.loteId,
          justificativa: input.justificativa || "Alocação desfeita pelo usuário",
          usuarioId: ctx.user.id,
        });

        return {
          sucesso: true,
          dados: {
            numeroNf: resultado.numeroNf,
            volumeAlocado: resultado.volumeAlocado,
            mensagem: `Alocação da NF ${resultado.numeroNf} desfeita com sucesso. A NFe voltará a aparecer como pendente.`,
          },
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao desfazer alocação:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),

  /**
   * Sincronizar NFes com SEFAZ real
   */
  sincronizarNfes: protectedProcedure.query(async ({ ctx }) => {
    try {
      console.log("[ALOCACOES] Sincronizando NFes...");
      const resultado = await sincronizarNfesAutomaticamente();
      return {
        sucesso: true,
        dados: resultado,
        timestamp: new Date(),
      };
    } catch (erro) {
      console.error("[ALOCACOES] Erro ao sincronizar:", erro);
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        timestamp: new Date(),
      };
    }
  }),

  /**
   * Obter estatisticas de sincronizacao
   */
  obterEstatisticasSincronizacao: protectedProcedure.query(async ({ ctx }) => {
    try {
      const stats = await obterEstatisticasSincronizacao();
      return {
        sucesso: true,
        dados: stats,
        timestamp: new Date(),
      };
    } catch (erro) {
      console.error("[ALOCACOES] Erro ao obter estatisticas:", erro);
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        timestamp: new Date(),
      };
    }
  }),

  /**
   * Importar NFes do ACS
   */
  importarNfesDoACS: protectedProcedure.mutation(async ({ ctx }) => {
    try {
      console.log("[ALOCACOES] Importando NFes do ACS...");
      const nfes = await buscarNfesDoACS();

      return {
        sucesso: true,
        dados: {
          nfesImportadas: nfes.length,
          nfesNaoAlocadas: nfes.filter((n: any) => n.quantidadePendente > 0).length,
          timestamp: new Date(),
        },
      };
    } catch (erro) {
      console.error("[ALOCACOES] Erro ao importar NFes:", erro);
      return {
        sucesso: false,
        erro: erro instanceof Error ? erro.message : "Erro desconhecido",
      };
    }
  }),
});
