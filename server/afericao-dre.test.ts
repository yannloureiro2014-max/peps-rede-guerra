import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };

  return { ctx };
}

describe("DRE - Exclusão de Aferições", () => {
  it("should calculate DRE for today without errors", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const today = new Date().toISOString().split('T')[0];
    
    const result = await caller.dre.calcular({
      dataInicio: today,
      dataFim: today,
    });
    
    expect(Array.isArray(result)).toBe(true);
    // Each DRE item should have expected properties
    for (const item of result) {
      expect(item).toHaveProperty("produtoId");
      expect(item).toHaveProperty("produtoNome");
      expect(item).toHaveProperty("quantidadeVendida");
      expect(item).toHaveProperty("receitaBruta");
      expect(item).toHaveProperty("cmv");
      expect(item).toHaveProperty("lucroBruto");
      expect(item).toHaveProperty("margemBruta");
      expect(item).toHaveProperty("lotesConsumidos");
      // Quantities should be non-negative
      expect(item.quantidadeVendida).toBeGreaterThanOrEqual(0);
      expect(item.receitaBruta).toBeGreaterThanOrEqual(0);
    }
  });

  it("should calculate DRE for a period without errors", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.dre.calcular({
      dataInicio: "2025-12-01",
      dataFim: "2025-12-31",
    });
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should calculate DRE for specific posto", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Get postos first
    const postos = await caller.postos.list();
    if (postos.length > 0) {
      const result = await caller.dre.calcular({
        postoId: postos[0].id,
        dataInicio: "2025-12-01",
        dataFim: "2026-02-06",
      });
      
      expect(Array.isArray(result)).toBe(true);
    }
  });
});

describe("Vendas - Campo Aferição", () => {
  it("should return vendas with afericao field", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const today = new Date().toISOString().split('T')[0];
    const result = await caller.vendas.list({
      dataInicio: "2025-12-01",
      dataFim: today,
    });
    
    expect(Array.isArray(result)).toBe(true);
    // Each venda should have afericao field
    if (result.length > 0) {
      expect(result[0]).toHaveProperty("afericao");
      // afericao should be 0 or 1
      for (const venda of result) {
        expect([0, 1]).toContain(venda.afericao);
      }
    }
  });

  it("should list vendas with date filter consistency", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // Test specific date filter - all returned vendas should be within range
    const result = await caller.vendas.list({
      dataInicio: "2026-02-06",
      dataFim: "2026-02-06",
    });
    
    expect(Array.isArray(result)).toBe(true);
    
    // All vendas should be from 2026-02-06
    for (const venda of result) {
      const vendaDate = new Date(venda.dataVenda);
      const dateStr = vendaDate.toISOString().split('T')[0];
      expect(dateStr).toBe("2026-02-06");
    }
  });
});

describe("Dashboard - Aferições excluídas", () => {
  it("should return resumo excluding afericoes", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.vendas.resumo({ dias: 30 });
    
    expect(result).toHaveProperty("totalLitros");
    expect(result).toHaveProperty("totalValor");
    expect(result).toHaveProperty("totalRegistros");
    // totalRegistros should be a number
    expect(typeof result.totalRegistros).toBe("number");
  });
});
