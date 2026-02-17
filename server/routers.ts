import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { publicProcedure, protectedProcedure, router } from "./_core/trpc";
import { z } from "zod";
import * as db from "./db";
import { 
  sincronizarMedicoesACS,
  sincronizarComprasACS,
  verificarMedicoesFaltantes
} from "./etl-acs";
import { alocacoesFisicasRouter } from "./routers/alocacoes-fisicas";

export const appRouter = router({
  system: systemRouter,
  alocacoesFisicas: alocacoesFisicasRouter,

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
    listAll: publicProcedure.query(async () => {
      return db.getAllPostos();
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
    toggleAtivo: protectedProcedure
      .input(z.object({
        id: z.number(),
        ativo: z.boolean()
      }))
      .mutation(async ({ input }) => {
        await db.togglePostoAtivo(input.id, input.ativo);
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
      .input(z.object({ dias: z.number().optional(), dataInicio: z.string().optional(), dataFim: z.string().optional() }))
      .query(async ({ input }) => {
        return db.getVendasResumo(input.dias || 30, input.dataInicio, input.dataFim);
      }),
    porPosto: publicProcedure
      .input(z.object({ dias: z.number().optional(), dataInicio: z.string().optional(), dataFim: z.string().optional(), postoId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVendasPorPosto(input.dias || 30, input.dataInicio, input.dataFim, input.postoId);
      }),
    porCombustivel: publicProcedure
      .input(z.object({ dias: z.number().optional(), dataInicio: z.string().optional(), dataFim: z.string().optional(), postoId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getVendasPorCombustivel(input.dias || 30, input.dataInicio, input.dataFim, input.postoId);
      }),
    lucroBrutoPorPosto: publicProcedure
      .input(z.object({ dataInicio: z.string(), dataFim: z.string(), postoId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getLucroBrutoPorPosto(input.dataInicio, input.dataFim, input.postoId);
      }),
    lucroBrutoPorCombustivel: publicProcedure
      .input(z.object({ dataInicio: z.string(), dataFim: z.string(), postoId: z.number().optional() }))
      .query(async ({ input }) => {
        return db.getLucroBrutoPorCombustivel(input.dataInicio, input.dataFim, input.postoId);
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
    stats: publicProcedure
      .input(z.object({ dataInicio: z.string().optional(), dataFim: z.string().optional(), postoId: z.number().optional() }).optional())
      .query(async ({ input }) => {
        return db.getDashboardStats(input?.dataInicio, input?.dataFim, input?.postoId);
      }),
    ultimaSincronizacao: publicProcedure.query(async () => {
      return db.getUltimaSincronizacao();
    }),
  }),

  // ==================== SYNC ====================
  sync: router({

    sincronizarMedicoes: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return sincronizarMedicoesACS(input?.dias || 90);
      }),
    sincronizarCompras: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return sincronizarComprasACS();
      }),
    verificarMedicoesFaltantes: protectedProcedure
      .input(z.object({ dias: z.number().optional() }).optional())
      .mutation(async ({ input }) => {
        return verificarMedicoesFaltantes();
      }),
  }),

  // ==================== GESTÃO DE USUÁRIOS ====================
  usuarios: router({
    list: protectedProcedure.query(async ({ ctx }) => {
      if (ctx.user?.role !== "admin_geral") {
        throw new Error("Acesso negado. Apenas administradores gerais podem gerenciar usuários.");
      }
      return db.getUsuarios();
    }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado");
        }
        return db.getUsuarioById(input.id);
      }),
    create: protectedProcedure
      .input(z.object({
        email: z.string().email(),
        name: z.string(),
        role: z.enum(["user", "admin_geral", "visualizacao"]),
        postoId: z.number().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado");
        }
        const usuarios = await db.getUsuarios();
        const emailExiste = usuarios.some(u => u.email === input.email);
        if (emailExiste) {
          throw new Error("Email já cadastrado no sistema");
        }
        await db.createUsuario(input);
        return { success: true };
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        name: z.string().optional(),
        role: z.enum(["user", "admin_geral", "visualizacao"]).optional(),
        postoId: z.number().nullable().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado");
        }
        const { id, ...dados } = input;
        await db.updateUsuario(id, dados);
        return { success: true };
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado");
        }
        if (ctx.user?.id === input.id) {
          throw new Error("Você não pode excluir seu próprio usuário");
        }
        const usuarios = await db.getUsuarios();
        const admins = usuarios.filter(u => u.role === "admin_geral");
        if (admins.length === 1 && admins[0].id === input.id) {
          throw new Error("Não é possível excluir o último administrador geral");
        }
        await db.deleteUsuario(input.id);
        return { success: true };
      }),
  }),

  // ==================== INICIALIZAÇÃO MENSAL DE LOTES ====================
  inicializacaoMensal: router({
    inicializar: protectedProcedure
      .input(z.object({
        mesReferencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato deve ser YYYY-MM"),
        postoId: z.number(),
        produtoId: z.number(),
        lotesConfigurados: z.array(z.object({
          loteId: z.number(),
          saldoInicial: z.string(),
          ordemConsumo: z.number()
        })),
        observacoes: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado. Apenas administradores gerais podem inicializar meses.");
        }
        
        // Verificar se já existe inicialização para este mês/posto/produto
        const jaExiste = await db.verificarInicializacaoExistente(
          input.mesReferencia, 
          input.postoId, 
          input.produtoId
        );
        if (jaExiste) {
          throw new Error("Este mês/posto/produto já foi inicializado. Para ajustar saldos, edite a inicialização existente.");
        }
        
        // Verificar ordens de consumo duplicadas
        const ordens = input.lotesConfigurados.map(l => l.ordemConsumo);
        const ordensUnicas = new Set(ordens);
        if (ordens.length !== ordensUnicas.size) {
          throw new Error("Ordens de consumo PEPS não podem ser duplicadas");
        }
        
        await db.criarInicializacaoMensal({
          ...input,
          usuarioAdminId: ctx.user.id
        });
        
        // RECÁLCULO RETROATIVO: Após inicializar os saldos dos lotes,
        // recalcular o CMV de todas as vendas do mês para garantir consistência
        try {
          const dataInicioMes = new Date(input.mesReferencia + "-01");
          console.log(`[INICIALIZAR MES] Iniciando recálculo retroativo de CMV para ${input.mesReferencia}...`);
          const recalcResult = await db.recalcularCMVRetroativo(input.postoId, input.produtoId, dataInicioMes);
          console.log(`[INICIALIZAR MES] Recálculo concluído: ${recalcResult.recalculadas} vendas recalculadas, ${recalcResult.erros} erros`);
          return { 
            success: true, 
            recalculo: { 
              vendasRecalculadas: recalcResult.recalculadas, 
              erros: recalcResult.erros 
            } 
          };
        } catch (error) {
          console.error("[INICIALIZAR MES] Erro ao recalcular CMV:", error);
          return { success: true, recalculo: { erro: String(error) } };
        }
      }),
    listar: protectedProcedure
      .input(z.object({
        postoId: z.number().optional(),
        produtoId: z.number().optional()
      }).optional())
      .query(async ({ input }) => {
        return db.getInicializacoesMensais(input?.postoId, input?.produtoId);
      }),
    verificarExistente: protectedProcedure
      .input(z.object({
        mesReferencia: z.string(),
        postoId: z.number(),
        produtoId: z.number()
      }))
      .query(async ({ input }) => {
        return db.verificarInicializacaoExistente(input.mesReferencia, input.postoId, input.produtoId);
      }),
    getById: protectedProcedure
      .input(z.object({ id: z.number() }))
      .query(async ({ input }) => {
        return db.getInicializacaoById(input.id);
      }),
    update: protectedProcedure
      .input(z.object({
        id: z.number(),
        postoId: z.number(),
        produtoId: z.number(),
        lotesConfigurados: z.array(z.object({
          loteId: z.number(),
          saldoInicial: z.string(),
          ordemConsumo: z.number()
        })),
        observacoes: z.string().optional()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado. Apenas administradores gerais podem editar inicializações.");
        }
        
        // Atualizar inicialização
        const existente = await db.updateInicializacaoMensal(input.id, input.lotesConfigurados, input.observacoes);
        
        // Recálculo retroativo de CMV após edição
        try {
          const dataInicioMes = new Date(existente.mesReferencia + "-01");
          console.log(`[EDITAR INICIALIZACAO] Iniciando recálculo retroativo de CMV para ${existente.mesReferencia}...`);
          const recalcResult = await db.recalcularCMVRetroativo(input.postoId, input.produtoId, dataInicioMes);
          console.log(`[EDITAR INICIALIZACAO] Recálculo concluído: ${recalcResult.recalculadas} vendas recalculadas, ${recalcResult.erros} erros`);
          return { 
            success: true, 
            recalculo: { 
              vendasRecalculadas: recalcResult.recalculadas, 
              erros: recalcResult.erros 
            } 
          };
        } catch (error) {
          console.error("[EDITAR INICIALIZACAO] Erro ao recalcular CMV:", error);
          return { success: true, recalculo: { erro: String(error) } };
        }
      }),
    delete: protectedProcedure
      .input(z.object({ 
        id: z.number(),
        postoId: z.number(),
        produtoId: z.number()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado. Apenas administradores gerais podem excluir inicializações.");
        }
        
        // Buscar inicialização antes de excluir para obter mesReferencia
        const existente = await db.getInicializacaoById(input.id);
        if (!existente) {
          throw new Error("Inicialização não encontrada");
        }
        
        // Excluir inicialização (reseta lotes para quantidade original)
        await db.deleteInicializacaoMensal(input.id);
        
        // Recálculo retroativo de CMV após exclusão
        try {
          const dataInicioMes = new Date(existente.mesReferencia + "-01");
          console.log(`[EXCLUIR INICIALIZACAO] Iniciando recálculo retroativo de CMV para ${existente.mesReferencia}...`);
          const recalcResult = await db.recalcularCMVRetroativo(input.postoId, input.produtoId, dataInicioMes);
          console.log(`[EXCLUIR INICIALIZACAO] Recálculo concluído: ${recalcResult.recalculadas} vendas recalculadas, ${recalcResult.erros} erros`);
          return { 
            success: true, 
            recalculo: { 
              vendasRecalculadas: recalcResult.recalculadas, 
              erros: recalcResult.erros 
            } 
          };
        } catch (error) {
          console.error("[EXCLUIR INICIALIZACAO] Erro ao recalcular CMV:", error);
          return { success: true, recalculo: { erro: String(error) } };
        }
      }),
  }),

  // ==================== DRE COM PEPS DO BACKEND ====================
  dre: router({
    calcular: publicProcedure
      .input(z.object({
        postoId: z.number().optional(),
        produtoId: z.number().optional(),
        dataInicio: z.string(),
        dataFim: z.string()
      }))
      .query(async ({ input }) => {
        return db.calcularDRE(input);
      }),
    calcularCMVVenda: protectedProcedure
      .input(z.object({ vendaId: z.number() }))
      .mutation(async ({ input }) => {
        return db.calcularCMVPEPS(input.vendaId);
      }),
    memoriaCalculo: publicProcedure
      .input(z.object({ vendaIds: z.array(z.number()) }))
      .query(async ({ input }) => {
        return db.getMemoriaCalculoCMV(input.vendaIds);
      }),
  }),

  // ==================== ASSISTENTE DE IA ====================
  ia: router({
    /**
     * Chat interativo com IA para análise de dados da empresa
     * Fornece contexto de vendas, estoque, lucro, alertas
     */
    chat: protectedProcedure
      .input(z.object({
        mensagem: z.string(),
        contexto: z.object({
          postoId: z.number().optional(),
          dataInicio: z.string().optional(),
          dataFim: z.string().optional()
        }).optional()
      }))
      .mutation(async ({ input, ctx }) => {
        return db.processarChatIA(input.mensagem, input.contexto, ctx.user);
      }),
    
    /**
     * Gera análise automática de dados: vendas, estoque, lucro, alertas
     */
    analisarDados: protectedProcedure
      .input(z.object({
        postoId: z.number().optional(),
        dataInicio: z.string(),
        dataFim: z.string()
      }))
      .query(async ({ input }) => {
        return db.analisarDadosComIA(input);
      }),
    
    /**
     * Gera recomendações automáticas: compras, investigações, otimizações
     */
    gerarRecomendacoes: protectedProcedure
      .input(z.object({
        postoId: z.number().optional(),
        tipo: z.enum(["compras", "estoque", "lucro", "geral"]).optional()
      }))
      .query(async ({ input }) => {
        return db.gerarRecomendacoesIA(input);
      }),
    
    /**
     * Valida notas fiscais com IA
     */
    validarNotasFiscais: protectedProcedure
      .input(z.object({
        postoId: z.number().optional(),
        dataInicio: z.string(),
        dataFim: z.string()
      }))
      .query(async ({ input }) => {
        return db.validarNotasFiscaisComIA(input);
      }),
    
    /**
     * Gera relatório semanal automático
     */
    gerarRelatoriSemanal: protectedProcedure
      .input(z.object({
        postoId: z.number().optional()
      }))
      .query(async ({ input }) => {
        return db.gerarRelatoriSemanalIA(input);
      }),
  }),

  // ==================== RECÁLCULO DE CMV ====================
  cmv: router({
    /**
     * Recalcula o CMV de todas as vendas de um posto/produto a partir de uma data.
     * Usado quando lotes são cadastrados retroativamente ou quando há inconsistências.
     */
    recalcularRetroativo: protectedProcedure
      .input(z.object({
        postoId: z.number(),
        produtoId: z.number(),
        dataInicio: z.string()
      }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado. Apenas administradores gerais podem recalcular CMV.");
        }
        
        const dataInicio = new Date(input.dataInicio);
        console.log(`[CMV ROUTER] Recálculo retroativo solicitado por ${ctx.user.name} para posto ${input.postoId}, produto ${input.produtoId}`);
        
        const resultado = await db.recalcularCMVRetroativo(input.postoId, input.produtoId, dataInicio);
        return resultado;
      }),
    
    /**
     * Recalcula o CMV de TODAS as vendas pendentes no sistema.
     * Processa em lote, agrupando por posto/produto.
     */
    recalcularPendentes: protectedProcedure
      .mutation(async ({ ctx }) => {
        if (ctx.user?.role !== "admin_geral") {
          throw new Error("Acesso negado. Apenas administradores gerais podem recalcular CMV.");
        }
        
        console.log(`[CMV ROUTER] Recálculo de todas vendas pendentes solicitado por ${ctx.user.name}`);
        
        const resultado = await db.recalcularTodasVendasPendentes();
        return resultado;
      }),
    
    /**
     * Retorna estatísticas de vendas pendentes de cálculo de CMV.
     */
    estatisticasPendentes: publicProcedure
      .query(async () => {
        const dbInstance = await db.getDb();
        if (!dbInstance) return { total: 0, porPosto: [] };
        
        const { vendas, postos, produtos } = await import("../drizzle/schema");
        const { eq, sql, count } = await import("drizzle-orm");
        
        // Total de vendas pendentes
        const totalResult = await dbInstance.select({ total: count() })
          .from(vendas)
          .where(eq(vendas.statusCmv, "pendente"));
        
        // Agrupado por posto/produto
        const porPosto = await dbInstance.select({
          postoId: vendas.postoId,
          postoNome: postos.nome,
          produtoId: vendas.produtoId,
          produtoDescricao: produtos.descricao,
          total: count()
        })
        .from(vendas)
        .leftJoin(postos, eq(vendas.postoId, postos.id))
        .leftJoin(produtos, eq(vendas.produtoId, produtos.id))
        .where(eq(vendas.statusCmv, "pendente"))
        .groupBy(vendas.postoId, vendas.produtoId, postos.nome, produtos.descricao);
        
        return {
          total: totalResult[0]?.total || 0,
          porPosto
        };
      }),
  }),
});

export type AppRouter = typeof appRouter;
