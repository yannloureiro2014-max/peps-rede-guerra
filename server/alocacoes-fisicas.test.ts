/**
 * Testes para Alocações Físicas
 */

import { describe, it, expect } from "vitest";
import { appRouter } from "./routers";

describe("Alocações Físicas - tRPC Procedures", () => {
  const mockCtx = { 
    user: { 
      id: 1, 
      name: "Test User",
      email: "test@example.com",
      role: "admin" as const
    },
    req: {},
    res: {}
  };

  describe("listarNfesPendentes", () => {
    it("deve retornar lista de NFes pendentes", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarNfesPendentes();

      expect(result.sucesso).toBe(true);
      expect(result.dados).toBeDefined();
      expect(Array.isArray(result.dados)).toBe(true);
      expect(result.total).toBeGreaterThanOrEqual(0);
    });

    it("deve incluir campos obrigatórios em cada NFe", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarNfesPendentes();

      if (result.dados.length > 0) {
        const nfe = result.dados[0];
        expect(nfe).toHaveProperty("id");
        expect(nfe).toHaveProperty("chaveNfe");
        expect(nfe).toHaveProperty("numeroNf");
        expect(nfe).toHaveProperty("dataEmissao");
        expect(nfe).toHaveProperty("cnpjFaturado");
        expect(nfe).toHaveProperty("postoFiscal");
        expect(nfe).toHaveProperty("produto");
        expect(nfe).toHaveProperty("quantidade");
        expect(nfe).toHaveProperty("custoUnitario");
        expect(nfe).toHaveProperty("statusAlocacao");
      }
    });

    it("deve retornar timestamp da consulta", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarNfesPendentes();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp instanceof Date).toBe(true);
    });
  });

  describe("criarAlocacao", () => {
    it("deve criar alocação com dados válidos", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        nfeStagingId: "1",
        chaveNfe: "35240216123456789012345678901234567890",
        postoDestinoId: 1,
        tanqueDestinoId: 1,
        dataDescargaReal: "2026-02-17",
        horaDescargaReal: "14:30",
        volumeAlocado: 5000,
        custoUnitarioAplicado: 5.42,
        justificativa: "Teste",
      };

      const result = await caller.alocacoesFisicas.criarAlocacao(input);

      expect(result.sucesso).toBe(true);
      expect(result.dados).toBeDefined();
      expect(result.dados.volumeAlocado).toBe(5000);
      expect(result.dados.custoTotalAlocado).toBe(27100);
    });

    it("deve calcular custo total corretamente", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        nfeStagingId: "1",
        chaveNfe: "35240216123456789012345678901234567890",
        postoDestinoId: 1,
        tanqueDestinoId: 1,
        dataDescargaReal: "2026-02-17",
        horaDescargaReal: "14:30",
        volumeAlocado: 3000,
        custoUnitarioAplicado: 6.15,
      };

      const result = await caller.alocacoesFisicas.criarAlocacao(input);

      expect(result.sucesso).toBe(true);
      expect(result.dados.custoTotalAlocado).toBe(18450); // 3000 * 6.15
    });

    it("deve registrar usuário que criou alocação", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        nfeStagingId: "1",
        chaveNfe: "35240216123456789012345678901234567890",
        postoDestinoId: 1,
        tanqueDestinoId: 1,
        dataDescargaReal: "2026-02-17",
        volumeAlocado: 5000,
        custoUnitarioAplicado: 5.42,
      };

      const result = await caller.alocacoesFisicas.criarAlocacao(input);

      expect(result.dados.usuarioId).toBe(1);
      expect(result.dados.usuarioNome).toBe("Test User");
    });
  });

  describe("listarAlocacoesRealizadas", () => {
    it("deve retornar lista de alocações realizadas", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarAlocacoesRealizadas();

      expect(result.sucesso).toBe(true);
      expect(result.dados).toBeDefined();
      expect(Array.isArray(result.dados)).toBe(true);
    });

    it("deve incluir informações de alocação", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarAlocacoesRealizadas();

      if (result.dados.length > 0) {
        const alocacao = result.dados[0];
        expect(alocacao).toHaveProperty("postoDestino");
        expect(alocacao).toHaveProperty("tanqueDestino");
        expect(alocacao).toHaveProperty("dataDescarga");
        expect(alocacao).toHaveProperty("volumeAlocado");
        expect(alocacao).toHaveProperty("status");
      }
    });
  });

  describe("listarLotesFisicos", () => {
    it("deve retornar lista de lotes físicos", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarLotesFisicos();

      expect(result.sucesso).toBe(true);
      expect(result.dados).toBeDefined();
      expect(Array.isArray(result.dados)).toBe(true);
    });

    it("deve incluir ordem PEPS em cada lote", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarLotesFisicos();

      if (result.dados.length > 0) {
        const lote = result.dados[0];
        expect(lote).toHaveProperty("ordemPEPS");
        expect(typeof lote.ordemPEPS).toBe("number");
      }
    });
  });

  describe("recalcularCMVComAlocacoes", () => {
    it("deve recalcular CMV com sucesso", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        dataInicio: "2026-02-17",
        dataFim: "2026-02-17",
      };

      const result = await caller.alocacoesFisicas.recalcularCMVComAlocacoes(input);

      expect(result.sucesso).toBe(true);
      expect(result.dados).toBeDefined();
      expect(result.dados).toHaveProperty("vendasProcessadas");
      expect(result.dados).toHaveProperty("cmvAnterior");
      expect(result.dados).toHaveProperty("cmvNovo");
      expect(result.dados).toHaveProperty("diferenca");
    });

    it("deve calcular diferença de CMV corretamente", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        dataInicio: "2026-02-17",
        dataFim: "2026-02-17",
      };

      const result = await caller.alocacoesFisicas.recalcularCMVComAlocacoes(input);

      // Usar toBeCloseTo para lidar com imprecisão de ponto flutuante
      expect(result.dados.diferenca).toBeCloseTo(
        result.dados.cmvNovo - result.dados.cmvAnterior,
        2
      );
    });

    it("deve calcular percentual de mudança", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        dataInicio: "2026-02-17",
        dataFim: "2026-02-17",
      };

      const result = await caller.alocacoesFisicas.recalcularCMVComAlocacoes(input);

      expect(result.dados.percentualMudanca).toBeDefined();
      expect(typeof result.dados.percentualMudanca).toBe("number");
    });

    it("deve registrar timestamp de recalcular", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        dataInicio: "2026-02-17",
        dataFim: "2026-02-17",
      };

      const result = await caller.alocacoesFisicas.recalcularCMVComAlocacoes(input);

      expect(result.dados.timestamp).toBeDefined();
      expect(result.dados.timestamp instanceof Date).toBe(true);
    });
  });

  describe("Fluxo Completo", () => {
    it("deve executar fluxo: listar NFes -> criar alocação -> recalcular CMV", async () => {
      const caller = appRouter.createCaller(mockCtx);

      // 1. Listar NFes
      const nfesResult = await caller.alocacoesFisicas.listarNfesPendentes();
      expect(nfesResult.sucesso).toBe(true);
      expect(nfesResult.dados.length).toBeGreaterThan(0);

      // 2. Criar alocação
      const nfe = nfesResult.dados[0];
      const alocacaoResult = await caller.alocacoesFisicas.criarAlocacao({
        nfeStagingId: nfe.id.toString(),
        chaveNfe: nfe.chaveNfe,
        postoDestinoId: 1,
        tanqueDestinoId: 1,
        dataDescargaReal: "2026-02-17",
        volumeAlocado: 1000,
        custoUnitarioAplicado: nfe.custoUnitario,
      });

      expect(alocacaoResult.sucesso).toBe(true);

      // 3. Recalcular CMV
      const cmvResult = await caller.alocacoesFisicas.recalcularCMVComAlocacoes({
        dataInicio: "2026-02-17",
        dataFim: "2026-02-17",
      });

      expect(cmvResult.sucesso).toBe(true);
      expect(cmvResult.dados.vendasProcessadas).toBeGreaterThanOrEqual(0);
    });
  });
});
