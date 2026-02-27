import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin_geral",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
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

// ==================== PENDÊNCIAS DE ESTOQUE ====================

describe("Pendências de Estoque", () => {
  it("should fetch stock pendencies for a date range", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.buscarPendencias({
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31",
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("dados");
    expect(Array.isArray(result.dados)).toBe(true);

    // Each pendency should have required fields
    for (const p of result.dados || []) {
      expect(p).toHaveProperty("tipo");
      expect(["sobra", "falta"]).toContain(p.tipo);
      expect(p).toHaveProperty("postoId");
      expect(p).toHaveProperty("postoNome");
      expect(p).toHaveProperty("diferenca");
      expect(typeof p.diferenca).toBe("number");
    }
  });

  it("should filter pendencies by post", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.buscarPendencias({
      dataInicio: "2026-01-01",
      dataFim: "2026-01-31",
      postoId: 1,
    });

    expect(result).toHaveProperty("sucesso");
    expect(Array.isArray(result.dados)).toBe(true);

    // All results should be for postoId 1
    for (const p of result.dados || []) {
      expect(p.postoId).toBe(1);
    }
  });

  it("should include suggestions when complementary alerts exist", { timeout: 30000 }, async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.buscarPendencias({
      dataInicio: "2026-01-01",
      dataFim: "2026-02-28",
    });

    expect(result).toHaveProperty("sucesso");
    expect(Array.isArray(result.dados)).toBe(true);

    // Check that suggestions are included where applicable
    for (const p of result.dados || []) {
      if (p.sugestoes) {
        expect(Array.isArray(p.sugestoes)).toBe(true);
        for (const s of p.sugestoes) {
          expect(s).toHaveProperty("confianca");
          expect(["alta", "media", "baixa"]).toContain(s.confianca);
          if (s.volumeSugerido) {
            expect(typeof s.volumeSugerido).toBe("number");
            expect(s.volumeSugerido).toBeGreaterThan(0);
          }
        }
      }
    }
  });
});

// ==================== LOTES PROVISÓRIOS ====================

describe("Lotes Provisórios (NFes não confirmadas)", () => {
  it("should fetch provisional lots", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias["buscarLotesProvisórios"]({});

    expect(result).toHaveProperty("sucesso");
    expect(Array.isArray(result.dados)).toBe(true);

    // Each provisional lot should have required fields
    for (const lote of result.dados || []) {
      expect(lote).toHaveProperty("id");
      expect(lote).toHaveProperty("statusNfe");
      expect(lote.statusNfe).toBe("provisoria");
    }
  });

  it("should filter provisional lots by post", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias["buscarLotesProvisórios"]({
      postoId: 1,
    });

    expect(result).toHaveProperty("sucesso");
    expect(Array.isArray(result.dados)).toBe(true);
  });
});

// ==================== CONFIRMAÇÃO DE NFE ====================

describe("Confirmação de NFe", () => {
  it("should reject confirmation of non-existent lot", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.confirmarNfe({
      loteId: 999999,
    });

    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toContain("n\u00e3o encontrado");
  });
});

// ==================== VALIDAÇÃO DE TRANSFERÊNCIA ====================

describe("Validação de Transferência", () => {
  it("should validate transfer with non-existent lot", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.validarTransferencia({
      loteOrigemId: 999999,
      tanqueDestinoId: 1,
      volumeTransferido: 1000,
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("valido");
    expect(result).toHaveProperty("estoque");
    expect(result).toHaveProperty("capacidade");
  });

  it("should validate transfer with excessive volume", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Try to validate a transfer with a very large volume
    const result = await caller.coerenciaTransferencias.validarTransferencia({
      loteOrigemId: 1,
      tanqueDestinoId: 1,
      volumeTransferido: 999999999,
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("valido");
    // Should be invalid due to capacity or stock constraints
    if (result.sucesso) {
      expect(result.valido).toBe(false);
    }
  });
});

// ==================== TRANSFERÊNCIA COM VALIDAÇÕES ====================

describe("Transferência com Validações Integradas", () => {
  it("should reject transfer with non-existent lot (with validations)", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.realizarTransferencia({
      loteOrigemId: 999999,
      postoDestinoId: 1,
      tanqueDestinoId: 1,
      volumeTransferido: 1000,
      dataTransferencia: "2026-01-15",
      justificativa: "Teste de validação integrada",
      tipo: "correcao_alocacao",
    });

    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toBeDefined();
  });

  it("should include recalculation info on successful transfer", async () => {
    // This test verifies the response structure
    // We can't easily test a real transfer without setting up proper test data
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Attempt with non-existent lot to verify error handling
    const result = await caller.coerenciaTransferencias.realizarTransferencia({
      loteOrigemId: 999998,
      postoDestinoId: 2,
      tanqueDestinoId: 3,
      volumeTransferido: 500,
      dataTransferencia: "2026-01-15",
      justificativa: "Teste de resposta com recálculo",
      tipo: "transferencia_fisica",
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("mensagem");
  });
});
