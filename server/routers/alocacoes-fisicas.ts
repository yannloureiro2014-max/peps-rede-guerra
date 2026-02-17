/**
 * tRPC Router para Alocações Físicas
 * Gerencia NFes em staging, alocações físicas e recalcular CMV
 */

import { router, protectedProcedure } from "../_core/trpc";
import { z } from "zod";
import { getDb } from "../db";
import { vendas, lotes, historicoAlteracoes } from "../../drizzle/schema";
import { eq, and, gte, lte, isNull } from "drizzle-orm";

export const alocacoesFisicasRouter = router({
  /**
   * Listar NFes em staging (simulando busca do ACS)
   */
  listarNfesPendentes: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Simular busca de NFes do ACS
      // Em produção, isso viria de uma integração real com ACS
      const nfesSimuladas = [
        {
          id: 1,
          chaveNfe: "35240216123456789012345678901234567890",
          numeroNf: "001234",
          dataEmissao: new Date("2026-02-14"),
          cnpjFaturado: "07.526.847/0001-00",
          cnpjFornecedor: "07.526.847/0001-00",
          postoFiscal: "Aracati",
          produto: "Gasolina Comum",
          quantidade: 5000,
          custoUnitario: 5.42,
          custoTotal: 27100,
          statusAlocacao: "pendente",
          quantidadePendente: 5000,
        },
        {
          id: 2,
          chaveNfe: "35240216234567890123456789012345678901",
          numeroNf: "001235",
          dataEmissao: new Date("2026-02-15"),
          cnpjFaturado: "07.526.847/0001-00",
          cnpjFornecedor: "07.526.847/0001-00",
          postoFiscal: "Aracati",
          produto: "Diesel S10",
          quantidade: 3000,
          custoUnitario: 6.15,
          custoTotal: 18450,
          statusAlocacao: "parcialmente_alocado",
          quantidadePendente: 1500,
        },
      ];

      return {
        sucesso: true,
        dados: nfesSimuladas,
        total: nfesSimuladas.length,
        timestamp: new Date(),
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
        nfeStagingId: z.string(),
        chaveNfe: z.string(),
        postoDestinoId: z.number(),
        tanqueDestinoId: z.number(),
        dataDescargaReal: z.string(), // YYYY-MM-DD
        horaDescargaReal: z.string().optional(),
        volumeAlocado: z.number().positive(),
        custoUnitarioAplicado: z.number().positive(),
        justificativa: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        // Validar dados
        if (!input.nfeStagingId || !input.chaveNfe) {
          throw new Error("NFe inválida");
        }

        if (input.volumeAlocado <= 0) {
          throw new Error("Volume deve ser maior que zero");
        }

        // Simular criação de alocação
        const alocacao = {
          id: Math.random(),
          nfeStagingId: input.nfeStagingId,
          chaveNfe: input.chaveNfe,
          postoDestinoId: input.postoDestinoId,
          tanqueDestinoId: input.tanqueDestinoId,
          dataDescargaReal: new Date(input.dataDescargaReal),
          horaDescargaReal: input.horaDescargaReal || "00:00",
          volumeAlocado: input.volumeAlocado,
          custoUnitarioAplicado: input.custoUnitarioAplicado,
          custoTotalAlocado: input.volumeAlocado * input.custoUnitarioAplicado,
          justificativa: input.justificativa || "",
          usuarioId: ctx.user?.id,
          usuarioNome: ctx.user?.name || "Sistema",
          createdAt: new Date(),
        };

        // Registrar auditoria
        console.log("[ALOCACOES] Nova alocação criada:", alocacao);

        return {
          sucesso: true,
          mensagem: "Alocação criada com sucesso",
          dados: alocacao,
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
   * Listar alocações realizadas
   */
  listarAlocacoesRealizadas: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Simular busca de alocações
      const alocacoes = [
        {
          id: 1,
          chaveNfe: "35240216111111111111111111111111111111",
          numeroNf: "001232",
          dataEmissao: new Date("2026-02-13"),
          postoFiscal: "Aracati",
          postoDestino: "Fortaleza Centro",
          tanqueDestino: "Gasolina 1",
          dataDescarga: new Date("2026-02-13"),
          horaDescarga: "14:30",
          volumeAlocado: 4500,
          status: "confirmado",
          usuarioAlocacao: "Yann Loureiro",
          justificativa: "Compra com CNPJ Aracati, descarga em Fortaleza",
        },
        {
          id: 2,
          chaveNfe: "35240216222222222222222222222222222222",
          numeroNf: "001233",
          dataEmissao: new Date("2026-02-14"),
          postoFiscal: "Aracati",
          postoDestino: "Fortaleza Bairro",
          tanqueDestino: "Diesel 1",
          dataDescarga: new Date("2026-02-14"),
          horaDescarga: "09:15",
          volumeAlocado: 3000,
          status: "confirmado",
          usuarioAlocacao: "Yann Loureiro",
          justificativa: "Compra com CNPJ Aracati, descarga em Fortaleza Bairro",
        },
      ];

      return {
        sucesso: true,
        dados: alocacoes,
        total: alocacoes.length,
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
  listarLotesFisicos: protectedProcedure.query(async ({ ctx }) => {
    try {
      const db = await getDb();
      if (!db) throw new Error("Database not available");

      // Simular busca de lotes
      const lotesFisicos = [
        {
          id: "LOT-001",
          postoDestino: "Fortaleza Centro",
          tanque: "Gasolina 1",
          dataDescargaReal: new Date("2026-02-13"),
          volume: 4500,
          ordemPEPS: 1,
          status: "Ativo",
          custoUnitario: 5.42,
          custoTotal: 24390,
        },
        {
          id: "LOT-002",
          postoDestino: "Fortaleza Bairro",
          tanque: "Diesel 1",
          dataDescargaReal: new Date("2026-02-14"),
          volume: 3000,
          ordemPEPS: 2,
          status: "Ativo",
          custoUnitario: 6.15,
          custoTotal: 18450,
        },
      ];

      return {
        sucesso: true,
        dados: lotesFisicos,
        total: lotesFisicos.length,
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
   * Recalcular CMV com base em alocações físicas
   */
  recalcularCMVComAlocacoes: protectedProcedure
    .input(
      z.object({
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      try {
        const db = await getDb();
        if (!db) throw new Error("Database not available");

        console.log("[ALOCACOES] Iniciando recalcular CMV com alocações...");

        // Simular recalcular CMV
        const resultado = {
          vendasProcessadas: 42,
          lotesPEPSReordenados: 3,
          cmvAnterior: 1671344.79,
          cmvNovo: 1671972.96,
          diferenca: 628.17,
          percentualMudanca: 0.04,
          timestamp: new Date(),
        };

        // Registrar auditoria
        console.log("[ALOCACOES] CMV recalculado:", resultado);

        return {
          sucesso: true,
          mensagem: "CMV recalculado com sucesso",
          dados: resultado,
        };
      } catch (erro) {
        console.error("[ALOCACOES] Erro ao recalcular CMV:", erro);
        return {
          sucesso: false,
          erro: erro instanceof Error ? erro.message : "Erro desconhecido",
        };
      }
    }),
});
