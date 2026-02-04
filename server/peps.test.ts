import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role: "admin",
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

describe("PEPS API - Postos", () => {
  it("should list postos (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.postos.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Produtos", () => {
  it("should list produtos (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.produtos.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Tanques", () => {
  it("should list tanques (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.tanques.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Lotes", () => {
  it("should list lotes ativos (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.lotes.listAtivos();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Vendas", () => {
  it("should get vendas resumo (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.vendas.resumo({ dias: 30 });
    
    expect(result).toHaveProperty("totalLitros");
    expect(result).toHaveProperty("totalValor");
    expect(result).toHaveProperty("totalRegistros");
  });

  it("should get vendas por posto (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.vendas.porPosto({ dias: 30 });
    
    expect(Array.isArray(result)).toBe(true);
  });

  it("should get vendas por combustivel (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.vendas.porCombustivel({ dias: 30 });
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Medicoes", () => {
  it("should list medicoes (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.medicoes.list({ limite: 10 });
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Alertas", () => {
  it("should list alertas pendentes (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.alertas.pendentes();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Configuracoes", () => {
  it("should list configuracoes (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.configuracoes.list();
    
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("PEPS API - Dashboard", () => {
  it("should get dashboard stats (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.dashboard.stats();
    
    expect(result).not.toBeNull();
  });

  it("should get ultima sincronizacao (public procedure)", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    // This may return undefined if no sync has happened
    const result = await caller.dashboard.ultimaSincronizacao();
    
    // Just verify it doesn't throw
    expect(true).toBe(true);
  });
});

describe("PEPS API - Auth", () => {
  it("should return user info when authenticated", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    
    expect(result).not.toBeNull();
    expect(result?.openId).toBe("test-user");
  });

  it("should return null when not authenticated", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    
    const result = await caller.auth.me();
    
    expect(result).toBeNull();
  });
});
