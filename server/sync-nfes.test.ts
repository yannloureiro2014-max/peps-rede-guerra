import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "sample-user",
    email: "sample@example.com",
    name: "Sample User",
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

describe("Sincronização de NFes do ACS", () => {
  it("deve exportar a função sincronizarNfesDoACS", async () => {
    const mod = await import("./services/sync-nfes-acs");
    expect(typeof mod.sincronizarNfesDoACS).toBe("function");
  });

  it("deve exportar a função obterUltimaSyncNfes", async () => {
    const mod = await import("./services/sync-nfes-acs");
    expect(typeof mod.obterUltimaSyncNfes).toBe("function");
  });

  it("deve ter o endpoint sync.sincronizarNfes no router", async () => {
    const procedureKeys = Object.keys(appRouter._def.procedures);
    expect(procedureKeys).toContain("sync.sincronizarNfes");
  });

  it("deve ter o endpoint sync.ultimaSyncNfes no router", async () => {
    const procedureKeys = Object.keys(appRouter._def.procedures);
    expect(procedureKeys).toContain("sync.ultimaSyncNfes");
  });

  it("deve executar sincronização e retornar resultado estruturado", async () => {
    const { sincronizarNfesDoACS } = await import("./services/sync-nfes-acs");
    const result = await sincronizarNfesDoACS(7); // Últimos 7 dias apenas

    // Verificar estrutura do resultado
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("totalACS");
    expect(result).toHaveProperty("jaExistentes");
    expect(result).toHaveProperty("inseridos");
    expect(result).toHaveProperty("naoMapeados");
    expect(result).toHaveProperty("itensCancelados");
    expect(result).toHaveProperty("erros");
    expect(result).toHaveProperty("detalhes");
    expect(result.detalhes).toHaveProperty("porPosto");
    expect(result.detalhes).toHaveProperty("naoMapeados");

    // Tipos corretos
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.totalACS).toBe("number");
    expect(typeof result.jaExistentes).toBe("number");
    expect(typeof result.inseridos).toBe("number");
    expect(typeof result.naoMapeados).toBe("number");
    expect(typeof result.itensCancelados).toBe("number");
    expect(Array.isArray(result.erros)).toBe(true);
    expect(Array.isArray(result.detalhes.naoMapeados)).toBe(true);

    // Deve ser sucesso (mesmo que não insira nada, pois já foram importadas)
    expect(result.success).toBe(true);
  }, 30000);

  it("deve retornar estatísticas da última sincronização", async () => {
    const { obterUltimaSyncNfes } = await import("./services/sync-nfes-acs");
    const stats = await obterUltimaSyncNfes();

    expect(stats).toHaveProperty("ultimaSync");
    expect(stats).toHaveProperty("resultado");
    expect(stats).toHaveProperty("inseridos");
    expect(stats).toHaveProperty("erros");
    expect(typeof stats.inseridos).toBe("number");
    expect(typeof stats.erros).toBe("number");
  }, 10000);

  it("deve chamar sincronizarNfes via tRPC", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sync.sincronizarNfes({ dias: 3 });

    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
    expect(typeof result.totalACS).toBe("number");
  }, 30000);

  it("deve chamar ultimaSyncNfes via tRPC", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.sync.ultimaSyncNfes();

    expect(result).toHaveProperty("ultimaSync");
    expect(result).toHaveProperty("inseridos");
    expect(result).toHaveProperty("erros");
  }, 10000);

  it("deve ter autoSync configurado no servidor com NFes", async () => {
    const fs = await import("fs");
    const indexContent = fs.readFileSync("server/_core/index.ts", "utf-8");

    expect(indexContent).toContain("sincronizarNfesDoACS");
    expect(indexContent).toContain("Sincronizando NFes");
    expect(indexContent).toContain("Etapa 3/3");
  });

  it("não deve duplicar lotes ao sincronizar duas vezes", async () => {
    const { sincronizarNfesDoACS } = await import("./services/sync-nfes-acs");

    // Primeira execução
    const result1 = await sincronizarNfesDoACS(3);
    expect(result1.success).toBe(true);

    // Segunda execução - não deve inserir nenhum novo
    const result2 = await sincronizarNfesDoACS(3);
    expect(result2.success).toBe(true);
    expect(result2.inseridos).toBe(0);
    // Todos devem ser "já existentes"
    expect(result2.jaExistentes + result2.itensCancelados).toBe(result2.totalACS);
  }, 60000);

  it("deve ter botão de sincronizar NFes na página de Configurações", async () => {
    const fs = await import("fs");
    const configContent = fs.readFileSync("client/src/pages/Configuracoes.tsx", "utf-8");

    expect(configContent).toContain("sincronizarNfes");
    expect(configContent).toContain("Sincronizar NFes");
    expect(configContent).toContain("syncNfesStatus");
    expect(configContent).toContain("ultimaSyncNfes");
  });
});
