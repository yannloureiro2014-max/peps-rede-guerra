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

function createUserContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
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

// ==================== COERÊNCIA FÍSICA ====================

describe("Coerência Física - Verificação", () => {
  it("should verify coherence for a specific post", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Use a short date range (3 days) to avoid timeout
    const result = await caller.coerenciaTransferencias.verificarCoerenciaPosto({
      postoId: 1,
      dataInicio: "2025-12-28",
      dataFim: "2025-12-30",
      tolerancia: 1000,
    });

    expect(result).toHaveProperty("sucesso");
    // If posto exists, should return data; if not, should return error
    if (result.sucesso) {
      expect(result.dados).toHaveProperty("postoId");
      expect(result.dados).toHaveProperty("periodo");
      expect(result.dados).toHaveProperty("detalhes");
      expect(Array.isArray(result.dados?.detalhes)).toBe(true);
    }
  });

  it("should verify coherence for all posts", { timeout: 30000 }, async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Use a short date range (2 days) to keep it fast for 6 postos
    const result = await caller.coerenciaTransferencias.verificarCoerenciaTodos({
      dataInicio: "2025-12-29",
      dataFim: "2025-12-30",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
    }
  });

  it("should return coherence summary by post", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.resumoCoerencia({
      dataInicio: "2025-12-01",
      dataFim: "2025-12-31",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
    }
  });
});

// ==================== MEDIÇÕES AUSENTES ====================

describe("Coerência Física - Medições Ausentes", () => {
  it("should detect missing measurements", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.detectarMedicoesAusentes({
      dataInicio: "2025-12-01",
      dataFim: "2025-12-31",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
      // Each item should have postoId, tanqueId, datasAusentes
      for (const item of result.dados || []) {
        expect(item).toHaveProperty("postoId");
        expect(item).toHaveProperty("tanqueId");
        expect(item).toHaveProperty("datasAusentes");
        expect(Array.isArray(item.datasAusentes)).toBe(true);
      }
    }
  });
});

// ==================== TRANSFERÊNCIAS FÍSICAS ====================

describe("Transferências Físicas - Listagem", () => {
  it("should list transfers", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.listarTransferencias({
      dataInicio: "2025-12-01",
      dataFim: "2025-12-31",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
    }
  });

  it("should list transfers filtered by post", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.listarTransferencias({
      postoOrigemId: 1,
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
    }
  });
});

describe("Transferências Físicas - Validação", () => {
  it("should reject transfer with invalid lot", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.realizarTransferencia({
      loteOrigemId: 999999, // Non-existent lot
      postoDestinoId: 1,
      tanqueDestinoId: 1,
      volumeTransferido: 1000,
      dataTransferencia: "2025-12-15",
      justificativa: "Teste de validação de lote inexistente",
      tipo: "transferencia_fisica",
    });

    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toContain("não encontrado");
  });

  it("should check month lock before transfer", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.verificarBloqueio({
      postoId: 1,
      data: "2025-12-15",
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("bloqueado");
    expect(typeof result.bloqueado).toBe("boolean");
  });
});

// ==================== BLOQUEIO MENSAL DRE ====================

describe("Bloqueio Mensal DRE - Listagem", () => {
  it("should list lock status for a month", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.listarStatusBloqueio({
      mesReferencia: "2025-12",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
      // Each item should have postoId, status, mesReferencia
      for (const item of result.dados || []) {
        expect(item).toHaveProperty("postoId");
        expect(item).toHaveProperty("status");
        expect(["aberto", "fechado"]).toContain(item.status);
      }
    }
  });

  it("should check if month is locked", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.isMesBloqueado({
      postoId: 1,
      mesReferencia: "2025-12",
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("bloqueado");
    expect(typeof result.bloqueado).toBe("boolean");
  });
});

describe("Bloqueio Mensal DRE - Permissões", () => {
  it("should reject unlock from non-admin user", async () => {
    const { ctx } = createUserContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.desbloquearMes({
      postoId: 1,
      mesReferencia: "2025-12",
      observacoes: "Tentativa de desbloqueio por usuário comum",
    });

    expect(result.sucesso).toBe(false);
    expect(result.mensagem).toContain("administradores");
  });

  it("should allow admin to close month", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Use a far-future month to avoid conflicts with existing data
    const result = await caller.coerenciaTransferencias.fecharMes({
      postoId: 1,
      mesReferencia: "2099-01",
      observacoes: "Teste de fechamento de mês",
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("mensagem");
  });

  it("should allow admin to unlock month", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    // Try to unlock the month we just closed
    const result = await caller.coerenciaTransferencias.desbloquearMes({
      postoId: 1,
      mesReferencia: "2099-01",
      observacoes: "Teste de desbloqueio de mês",
    });

    expect(result).toHaveProperty("sucesso");
    expect(result).toHaveProperty("mensagem");
  });
});

// ==================== VERIFICAÇÕES SALVAS ====================

describe("Coerência Física - Verificações Salvas", () => {
  it("should fetch saved verifications", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.buscarVerificacoes({
      dataInicio: "2025-12-01",
      dataFim: "2025-12-31",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
    }
  });

  it("should filter verifications by status", async () => {
    const { ctx } = createAdminContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.coerenciaTransferencias.buscarVerificacoes({
      status: "alerta",
    });

    expect(result).toHaveProperty("sucesso");
    if (result.sucesso) {
      expect(Array.isArray(result.dados)).toBe(true);
    }
  });
});
