import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock pg module
vi.mock("pg", () => {
  const mockRelease = vi.fn();
  const mockQuery = vi.fn();
  const mockPoolConnect = vi.fn().mockResolvedValue({
    query: mockQuery,
    release: mockRelease,
  });
  const mockPool = vi.fn().mockImplementation(() => ({
    connect: mockPoolConnect,
    on: vi.fn(),
  }));
  return { Pool: mockPool, default: { Pool: mockPool } };
});

describe("Sincronização de Vendas ACS", () => {
  it("deve exportar a função sincronizarVendasACS", async () => {
    const etl = await import("./etl-acs");
    expect(typeof etl.sincronizarVendasACS).toBe("function");
  });

  it("deve retornar objeto com campos obrigatórios", async () => {
    const etl = await import("./etl-acs");
    const result = await etl.sincronizarVendasACS(1);
    // O resultado deve ter os campos obrigatórios
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("inseridos");
    expect(result).toHaveProperty("total");
    expect(typeof result.success).toBe("boolean");
    expect(typeof result.inseridos).toBe("number");
    expect(typeof result.total).toBe("number");
  });

  it("deve ter a função sincronizarVendasACS no router sync", async () => {
    // Verify the router has the sincronizarVendas endpoint
    const routersModule = await import("./routers");
    const router = routersModule.appRouter;
    
    // Check that sync.sincronizarVendas procedure exists
    expect(router._def.procedures).toBeDefined();
    const procedureKeys = Object.keys(router._def.procedures);
    expect(procedureKeys).toContain("sync.sincronizarVendas");
  });

  it("deve ter autoSync configurado no servidor com vendas", async () => {
    // Read the index.ts file to verify autoSync includes vendas
    const fs = await import("fs");
    const indexContent = fs.readFileSync("server/_core/index.ts", "utf-8");
    
    expect(indexContent).toContain("sincronizarVendasACS");
    expect(indexContent).toContain("Sincronizando vendas");
    expect(indexContent).toContain("autoSync");
  });

  it("deve buscar vendas por empresa individualmente (evitar timeout)", async () => {
    const fs = await import("fs");
    const etlContent = fs.readFileSync("server/etl-acs.ts", "utf-8");
    
    // Verify the function uses per-empresa queries instead of a single large query
    expect(etlContent).toContain("for (const codEmpresa of codEmpresaList)");
    expect(etlContent).toContain("AND a.cod_empresa = $2");
    // Should NOT have the old ANY($2) pattern in the vendas function
    // The function should use individual queries per empresa
    expect(etlContent).toContain("Empresa ${codEmpresa}");
  });

  it("deve usar batch insert para melhor performance", async () => {
    const fs = await import("fs");
    const etlContent = fs.readFileSync("server/etl-acs.ts", "utf-8");
    
    // Verify batch insert pattern
    expect(etlContent).toContain("BATCH_SIZE");
    expect(etlContent).toContain("registrosParaInserir");
    expect(etlContent).toContain("onDuplicateKeyUpdate");
  });

  it("deve ter botão de sincronizar vendas na página de Configurações", async () => {
    const fs = await import("fs");
    const configContent = fs.readFileSync("client/src/pages/Configuracoes.tsx", "utf-8");
    
    expect(configContent).toContain("sincronizarVendas");
    expect(configContent).toContain("Sincronizar Vendas");
    expect(configContent).toContain("syncVendasStatus");
  });
});
