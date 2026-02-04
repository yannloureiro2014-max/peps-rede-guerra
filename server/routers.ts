import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { sincronizarDadosIniciais } from "./etl-acs";

export const appRouter = router({
  system: systemRouter,
  
  auth: router({
    me: publicProcedure.query(opts => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),

  // ==================== POSTOS ====================
  postos: router({
    list: publicProcedure.query(async () => {
      return db.getPostos();
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getPostoById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        codigoAcs: z.string(),
        nome: z.string(),
        cnpj: z.string().optional(),
        endereco: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createPosto(input);
        return { success: true };
      }),
  }),

  // ==================== PRODUTOS ====================
  produtos: router({
    list: publicProcedure.query(async () => {
      return db.getProdutos();
    }),
    create: protectedProcedure
      .input(z.object({
        codigoAcs: z.string(),
        descricao: z.string(),
        tipo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createProduto(input);
        return { success: true };
      }),
  }),

  // ==================== TANQUES ====================
  tanques: router({
    list: publicProcedure.query(async () => {
      return db.getTanques();
    }),
    byPosto: publicProcedure
      .input(z.object({ postoId: z.number() }))
      .query(async ({ input }) => {
        return db.getTanquesByPosto(input.postoId);
      }),
    getEstoque: publicProcedure
      .input(z.object({ tanqueId: z.number() }))
      .query(async ({ input }) => {
        return db.getEstoquePorTanque(input.tanqueId);
      }),
    create: protectedProcedure
      .input(z.object({
        postoId: z.number(),
        codigoAcs: z.string(),
        produtoId: z.number(),
        capacidade: z.string(),
        estoqueMinimo: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createTanque(input);
        return { success: true };
      }),
  }),

  // ==================== LOTES (COMPRAS) ====================
  lotes: router({
    listAtivos: publicProcedure.query(async () => {
      return db.getLotesAtivos();
    }),
    create: protectedProcedure
      .input(z.object({
        tanqueId: z.number(),
        numeroNf: z.string().optional(),
        fornecedor: z.string().optional(),
        dataEntrada: z.string(),
        quantidadeOriginal: z.string(),
        quantidadeDisponivel: z.string(),
        custoUnitario: z.string(),
      }))
      .mutation(async ({ input }) => {
        await db.createLote({
          ...input,
          dataEntrada: new Date(input.dataEntrada),
        });
        return { success: true };
      }),
  }),

  // ==================== VENDAS ====================
  vendas: router({
    list: publicProcedure
      .input(z.object({
        postoId: z.number().optional(),
        produtoId: z.number().optional(),
        dataInicio: z.string().optional(),
        dataFim: z.string().optional(),
      }))
      .query(async ({ input }) => {
        return db.getVendas(input);
      }),
    resumo: publicProcedure
      .input(z.object({ dias: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVendasResumo(input.dias || 30);
      }),
    porPosto: publicProcedure
      .input(z.object({ dias: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVendasPorPosto(input.dias || 30);
      }),
    porCombustivel: publicProcedure
      .input(z.object({ dias: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVendasPorCombustivel(input.dias || 30);
      }),
  }),

  // ==================== MEDIÇÕES ====================
  medicoes: router({
    list: publicProcedure
      .input(z.object({ tanqueId: z.number().optional(), limite: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getMedicoes(input.tanqueId, input.limite || 100);
      }),
    create: protectedProcedure
      .input(z.object({
        tanqueId: z.number(),
        dataMedicao: z.string(),
        horaMedicao: z.string().optional(),
        volumeMedido: z.string(),
        temperatura: z.string().optional(),
        estoqueEscritural: z.string(),
        diferenca: z.string(),
        percentualDiferenca: z.string(),
        tipoDiferenca: z.enum(["sobra", "perda", "ok"]),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createMedicao({
          ...input,
          dataMedicao: new Date(input.dataMedicao),
        });
        return { success: true };
      }),
  }),

  // ==================== ALERTAS ====================
  alertas: router({
    pendentes: publicProcedure.query(async () => {
      return db.getAlertasPendentes();
    }),
    resolver: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.resolverAlerta(input.id);
        return { success: true };
      }),
    create: protectedProcedure
      .input(z.object({
        tipo: z.enum(["estoque_baixo", "diferenca_medicao", "cmv_pendente", "sincronizacao"]),
        postoId: z.number().optional(),
        tanqueId: z.number().optional(),
        titulo: z.string(),
        mensagem: z.string(),
        dados: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.createAlerta(input);
        return { success: true };
      }),
  }),

  // ==================== CONFIGURAÇÕES ====================
  configuracoes: router({
    list: publicProcedure.query(async () => {
      return db.getConfiguracoes();
    }),
    get: publicProcedure
      .input(z.object({ chave: z.string() }))
      .query(async ({ input }) => {
        return db.getConfiguracao(input.chave);
      }),
    set: protectedProcedure
      .input(z.object({
        chave: z.string(),
        valor: z.string(),
        descricao: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        await db.setConfiguracao(input.chave, input.valor, input.descricao);
        return { success: true };
      }),
  }),

  // ==================== DASHBOARD ====================
  dashboard: router({
    stats: publicProcedure.query(async () => {
      return db.getDashboardStats();
    }),
    ultimaSincronizacao: publicProcedure.query(async () => {
      return db.getUltimaSincronizacao();
    }),
  }),

  // ==================== SYNC ====================
  sync: router({
    inicializar: protectedProcedure.mutation(async () => {
      return sincronizarDadosIniciais();
    }),
  }),
});

export type AppRouter = typeof appRouter;
