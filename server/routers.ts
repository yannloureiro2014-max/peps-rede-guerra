import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { 
  sincronizarTudo, 
  sincronizarPostosACS, 
  sincronizarProdutosACS, 
  sincronizarTanquesACS, 
  sincronizarVendasACS,
  sincronizarMedicoesACS,
  sincronizarComprasACS,
  verificarMedicoesFaltantes
} from "./etl-acs";

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

  // ==================== LOTES (COMPRAS/NFs) ====================
  lotes: router({
    list: publicProcedure
      .input(z.object({ 
        postoId: z.number().optional(),
        status: z.string().optional(),
        limite: z.number().optional()
      }).optional())
      .query(async ({ input }) => {
        return db.getLotes(input?.postoId, input?.status, input?.limite);
      }),
    listAtivos: publicProcedure.query(async () => {
      return db.getLotesAtivos();
    }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getLoteById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        tanqueId: z.number(),
        postoId: z.number(),
        produtoId: z.number().optional(),
        numeroNf: z.string().optional(),
        serieNf: z.string().optional(),
        chaveNfe: z.string().optional(),
        dataEmissao: z.string().optional(),
        dataEntrada: z.string(),
        dataLmc: z.string().optional(),
        quantidadeOriginal: z.string(),
        custoUnitario: z.string(),
        fornecedorNome: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const custoTotal = (parseFloat(input.quantidadeOriginal) * parseFloat(input.custoUnitario)).toFixed(2);
        await db.createLote({
          tanqueId: input.tanqueId,
          postoId: input.postoId,
          produtoId: input.produtoId || null,
          numeroNf: input.numeroNf || null,
          serieNf: input.serieNf || null,
          chaveNfe: input.chaveNfe || null,
          dataEmissao: input.dataEmissao ? new Date(input.dataEmissao) : null,
          dataEntrada: new Date(input.dataEntrada),
          dataLmc: input.dataLmc ? new Date(input.dataLmc) : null,
          quantidadeOriginal: input.quantidadeOriginal,
          quantidadeDisponivel: input.quantidadeOriginal,
          custoUnitario: input.custoUnitario,
          custoTotal,
          origem: "manual",
          status: "ativo",
        }, ctx.user?.id, ctx.user?.name || undefined);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        numeroNf: z.string().optional(),
        serieNf: z.string().optional(),
        chaveNfe: z.string().optional(),
        dataEmissao: z.string().optional(),
        dataEntrada: z.string().optional(),
        dataLmc: z.string().optional(),
        quantidadeOriginal: z.string().optional(),
        custoUnitario: z.string().optional(),
        justificativa: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, justificativa, ...dados } = input;
        const updateData: Record<string, any> = {};
        
        if (dados.numeroNf !== undefined) updateData.numeroNf = dados.numeroNf;
        if (dados.serieNf !== undefined) updateData.serieNf = dados.serieNf;
        if (dados.chaveNfe !== undefined) updateData.chaveNfe = dados.chaveNfe;
        if (dados.dataEmissao !== undefined) updateData.dataEmissao = new Date(dados.dataEmissao);
        if (dados.dataEntrada !== undefined) updateData.dataEntrada = new Date(dados.dataEntrada);
        if (dados.dataLmc !== undefined) updateData.dataLmc = new Date(dados.dataLmc);
        if (dados.quantidadeOriginal !== undefined) {
          updateData.quantidadeOriginal = dados.quantidadeOriginal;
          updateData.quantidadeDisponivel = dados.quantidadeOriginal;
        }
        if (dados.custoUnitario !== undefined) updateData.custoUnitario = dados.custoUnitario;
        
        if (updateData.quantidadeOriginal && updateData.custoUnitario) {
          updateData.custoTotal = (parseFloat(updateData.quantidadeOriginal) * parseFloat(updateData.custoUnitario)).toFixed(2);
        }
        
        await db.updateLote(id, updateData, ctx.user?.id, ctx.user?.name || undefined, justificativa);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        justificativa: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteLote(input.id, ctx.user?.id, ctx.user?.name || undefined, input.justificativa);
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
      .input(z.object({ 
        tanqueId: z.number().optional(), 
        postoId: z.number().optional(),
        limite: z.number().optional() 
      }).optional())
      .query(async ({ input }) => {
        return db.getMedicoes(input?.tanqueId, input?.postoId, input?.limite || 100);
      }),
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getMedicaoById(input.id);
      }),
    faltantes: publicProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getMedicoesFaltantes(input?.dias || 30);
      }),
    create: protectedProcedure
      .input(z.object({
        tanqueId: z.number(),
        postoId: z.number(),
        dataMedicao: z.string(),
        horaMedicao: z.string().optional(),
        volumeMedido: z.string(),
        temperatura: z.string().optional(),
        estoqueEscritural: z.string().optional(),
        observacoes: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        // Calcular diferença
        const volumeMedido = parseFloat(input.volumeMedido);
        const estoqueEscritural = parseFloat(input.estoqueEscritural || "0");
        const diferenca = volumeMedido - estoqueEscritural;
        const percentualDiferenca = estoqueEscritural > 0 ? (diferenca / estoqueEscritural) * 100 : 0;
        
        let tipoDiferenca: "sobra" | "perda" | "ok" = "ok";
        if (diferenca > 0.5) tipoDiferenca = "sobra";
        else if (diferenca < -0.5) tipoDiferenca = "perda";
        
        await db.createMedicao({
          tanqueId: input.tanqueId,
          postoId: input.postoId,
          dataMedicao: new Date(input.dataMedicao),
          horaMedicao: input.horaMedicao || null,
          volumeMedido: input.volumeMedido,
          temperatura: input.temperatura || null,
          estoqueEscritural: input.estoqueEscritural || "0",
          diferenca: diferenca.toFixed(3),
          percentualDiferenca: percentualDiferenca.toFixed(4),
          tipoDiferenca,
          observacoes: input.observacoes || null,
          origem: "manual",
        }, ctx.user?.id, ctx.user?.name || undefined);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        volumeMedido: z.string().optional(),
        temperatura: z.string().optional(),
        horaMedicao: z.string().optional(),
        estoqueEscritural: z.string().optional(),
        observacoes: z.string().optional(),
        justificativa: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const { id, justificativa, ...dados } = input;
        const updateData: Record<string, any> = {};
        
        if (dados.volumeMedido !== undefined) updateData.volumeMedido = dados.volumeMedido;
        if (dados.temperatura !== undefined) updateData.temperatura = dados.temperatura;
        if (dados.horaMedicao !== undefined) updateData.horaMedicao = dados.horaMedicao;
        if (dados.estoqueEscritural !== undefined) updateData.estoqueEscritural = dados.estoqueEscritural;
        if (dados.observacoes !== undefined) updateData.observacoes = dados.observacoes;
        
        // Recalcular diferença se volumeMedido ou estoqueEscritural mudaram
        if (updateData.volumeMedido || updateData.estoqueEscritural) {
          const medicaoAtual = await db.getMedicaoById(id);
          const volumeMedido = parseFloat(updateData.volumeMedido || medicaoAtual?.volumeMedido || "0");
          const estoqueEscritural = parseFloat(updateData.estoqueEscritural || medicaoAtual?.estoqueEscritural || "0");
          const diferenca = volumeMedido - estoqueEscritural;
          const percentualDiferenca = estoqueEscritural > 0 ? (diferenca / estoqueEscritural) * 100 : 0;
          
          updateData.diferenca = diferenca.toFixed(3);
          updateData.percentualDiferenca = percentualDiferenca.toFixed(4);
          
          if (diferenca > 0.5) updateData.tipoDiferenca = "sobra";
          else if (diferenca < -0.5) updateData.tipoDiferenca = "perda";
          else updateData.tipoDiferenca = "ok";
        }
        
        await db.updateMedicao(id, updateData, ctx.user?.id, ctx.user?.name || undefined, justificativa);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        justificativa: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        await db.deleteMedicao(input.id, ctx.user?.id, ctx.user?.name || undefined, input.justificativa);
        return { success: true };
      }),
  }),

  // ==================== ALERTAS ====================
  alertas: router({
    pendentes: publicProcedure.query(async () => {
      return db.getAlertasPendentes();
    }),
    porTipo: publicProcedure
      .input(z.object({ tipo: z.string() }))
      .query(async ({ input }) => {
        return db.getAlertasPorTipo(input.tipo);
      }),
    resolver: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ input }) => {
        await db.resolverAlerta(input.id);
        return { success: true };
      }),
    create: protectedProcedure
      .input(z.object({
        tipo: z.enum(["estoque_baixo", "diferenca_medicao", "cmv_pendente", "sincronizacao", "medicao_faltante"]),
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

  // ==================== HISTÓRICO ====================
  historico: router({
    list: publicProcedure
      .input(z.object({ 
        tabela: z.string().optional(),
        registroId: z.number().optional(),
        limite: z.number().optional()
      }).optional())
      .query(async ({ input }) => {
        return db.getHistorico(input?.tabela, input?.registroId, input?.limite || 100);
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
    sincronizarTudo: protectedProcedure
      .input(z.object({ diasVendas: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return sincronizarTudo(input?.diasVendas || 60);
      }),
    sincronizarPostos: protectedProcedure.mutation(async () => {
      return sincronizarPostosACS();
    }),
    sincronizarProdutos: protectedProcedure.mutation(async () => {
      return sincronizarProdutosACS();
    }),
    sincronizarTanques: protectedProcedure.mutation(async () => {
      return sincronizarTanquesACS();
    }),
    sincronizarVendas: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return sincronizarVendasACS(input?.dias || 30);
      }),
    sincronizarMedicoes: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return sincronizarMedicoesACS(input?.dias || 90);
      }),
    sincronizarCompras: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return sincronizarComprasACS(input?.dias || 180);
      }),
    verificarMedicoesFaltantes: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return verificarMedicoesFaltantes(input?.dias || 30);
      }),
  }),
});

export type AppRouter = typeof appRouter;
