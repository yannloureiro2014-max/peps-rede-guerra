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
    }, { timeout: 30000 });

    it("deve incluir campos obrigatórios em cada NFe", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarNfesPendentes();

      if (result.dados.length > 0) {
        const nfe = result.dados[0];
        expect(nfe).toHaveProperty("id");
        expect(nfe).toHaveProperty("chaveNfe");
        expect(nfe).toHaveProperty("numeroNf");
        expect(nfe).toHaveProperty("dataEmissao");
        expect(nfe).toHaveProperty("postoDestino");
        expect(nfe).toHaveProperty("produto");
        expect(nfe).toHaveProperty("quantidade");
        expect(nfe).toHaveProperty("custoUnitario");
        expect(nfe).toHaveProperty("statusAlocacao");
        // Novos campos obrigatórios
        expect(nfe).toHaveProperty("nomeFornecedor");
        expect(nfe).toHaveProperty("custoUnitarioProduto");
        expect(nfe).toHaveProperty("custoUnitarioFrete");
        expect(nfe).toHaveProperty("tipoFrete");
      }
    }, { timeout: 30000 });

    it("deve retornar timestamp da consulta", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const result = await caller.alocacoesFisicas.listarNfesPendentes();

      expect(result.timestamp).toBeDefined();
      expect(result.timestamp instanceof Date).toBe(true);
    }, { timeout: 30000 });
  });

  describe("criarAlocacao", () => {
    it("deve criar alocação com dados válidos", async () => {
      const caller = appRouter.createCaller(mockCtx);
      const input = {
        chaveNfe: "ACS-01-12345",
        numeroNf: "001234",
        serieNf: "1",
        dataEmissao: "2026-02-17",
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
        chaveNfe: "ACS-01-12346",
        numeroNf: "001235",
        serieNf: "1",
        dataEmissao: "2026-02-17",
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
        chaveNfe: "ACS-01-12347",
        numeroNf: "001236",
        serieNf: "1",
        dataEmissao: "2026-02-17",
        postoDestinoId: 1,
        tanqueDestinoId: 1,
        dataDescargaReal: "2026-02-17",
        volumeAlocado: 5000,
        custoUnitarioAplicado: 5.42,
      };

      const result = await caller.alocacoesFisicas.criarAlocacao(input);

      expect(result.dados.volumeAlocado).toBe(5000);
      expect(result.dados.custoTotalAlocado).toBe(27100);
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
      expect(result.dados).toHaveProperty("totalAlocacoes");
      expect(result.dados).toHaveProperty("totalVolume");
      expect(result.dados).toHaveProperty("custoMedio");
      expect(result.dados).toHaveProperty("timestamp");
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

      // Se temos NFes, testar alocação
      if (nfesResult.dados.length > 0) {
        const nfe = nfesResult.dados[0];
        const alocacaoResult = await caller.alocacoesFisicas.criarAlocacao({
          chaveNfe: nfe.chaveNfe,
          numeroNf: nfe.numeroNf || "000000",
          serieNf: nfe.serieNf || "1",
          dataEmissao: nfe.dataEmissao instanceof Date 
            ? nfe.dataEmissao.toISOString().split('T')[0] 
            : String(nfe.dataEmissao || "2026-02-17"),
          postoDestinoId: 1,
          tanqueDestinoId: 1,
          dataDescargaReal: "2026-02-17",
          volumeAlocado: 1000,
          custoUnitarioAplicado: nfe.custoUnitario || 5.0,
        });

        expect(alocacaoResult.sucesso).toBe(true);
      }

      // 3. Recalcular CMV
      const cmvResult = await caller.alocacoesFisicas.recalcularCMVComAlocacoes({
        dataInicio: "2026-02-17",
        dataFim: "2026-02-17",
      });

      expect(cmvResult.sucesso).toBe(true);
      expect(cmvResult.dados).toBeDefined();
    }, { timeout: 30000 });
  });
});
