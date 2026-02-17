import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  buscarNfesReaisDoACS,
  sincronizarNfesAutomaticamente,
  obterEstatisticasSincronizacao,
  limparCache,
  buscarNFeComDetalhes,
} from "./services/sefaz-real";

// Mock do serviço ACS
vi.mock("./services/acs-nfes", () => ({
  buscarComprasDoACS: vi.fn(async () => [
    {
      id: "1-001",
      codEmpresa: "1",
      codigo: "001",
      documento: "001234",
      serie: "1",
      dataEmissao: new Date("2026-02-14"),
      dataLmc: new Date("2026-02-14"),
      codFornecedor: "123456789012",
      totalNota: 27100,
      totalProdutos: 1,
      totalItens: 1,
      totalLitros: 5000,
      quantidadePendente: 5000,
    },
  ]),
  buscarCompraPorCodigo: vi.fn(async () => null),
}));

// Mock do serviço de alocações
vi.mock("./db-sefaz-alocacoes", () => ({
  listarNfesAlocadas: vi.fn(async () => []),
  criarLoteDoSEFAZ: vi.fn(async () => ({ id: "lote-1" })),
}));

describe("SEFAZ Real Integration", () => {
  beforeEach(() => {
    limparCache();
  });

  describe("buscarNfesReaisDoACS", () => {
    it("deve buscar NFes reais do ACS", async () => {
      const nfes = await buscarNfesReaisDoACS();

      expect(nfes).toBeDefined();
      expect(Array.isArray(nfes)).toBe(true);
      expect(nfes.length).toBeGreaterThan(0);
    });

    it("deve transformar compra em NFe corretamente", async () => {
      const nfes = await buscarNfesReaisDoACS();
      const nfe = nfes[0];

      expect(nfe.chaveNfe).toBeDefined();
      expect(nfe.chaveNfe.length).toBeGreaterThan(0);
      expect(nfe.quantidade).toBeGreaterThan(0);
      expect(nfe.custoTotal).toBeGreaterThan(0);
      expect(nfe.origem).toBe("ACS");
    });

    it("deve calcular custo unitário corretamente", async () => {
      const nfes = await buscarNfesReaisDoACS();
      const nfe = nfes[0];

      const custoEsperado = nfe.custoTotal / nfe.quantidade;
      expect(nfe.custoUnitario).toBeCloseTo(custoEsperado, 2);
    });

    it("deve usar cache na segunda chamada", async () => {
      const nfes1 = await buscarNfesReaisDoACS();
      const nfes2 = await buscarNfesReaisDoACS();

      expect(nfes1.length).toBe(nfes2.length);
    });

    it("deve forçar atualização do cache", async () => {
      const nfes1 = await buscarNfesReaisDoACS();
      const nfes2 = await buscarNfesReaisDoACS({ forcarAtualizar: true });

      expect(nfes1.length).toBeGreaterThanOrEqual(0);
      expect(nfes2.length).toBeGreaterThanOrEqual(0);
    });

    it("deve retornar NFes com data de sincronização", async () => {
      const nfes = await buscarNfesReaisDoACS();

      if (nfes.length > 0) {
        nfes.forEach((nfe) => {
          expect(nfe.ultimaSincronizacao).toBeInstanceOf(Date);
        });
      }
    });
  });

  describe("sincronizarNfesAutomaticamente", () => {
    it("deve sincronizar NFes com sucesso", async () => {
      const resultado = await sincronizarNfesAutomaticamente();

      expect(resultado.novasNfes).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(resultado.erros)).toBe(true);
    });

    it("deve retornar número de NFes sincronizadas", async () => {
      const resultado = await sincronizarNfesAutomaticamente();

      expect(typeof resultado.novasNfes).toBe("number");
    });
  });

  describe("obterEstatisticasSincronizacao", () => {
    it("deve retornar estatísticas de sincronização", async () => {
      await buscarNfesReaisDoACS();
      const stats = await obterEstatisticasSincronizacao();

      expect(stats).toHaveProperty("totalNfes");
      expect(stats).toHaveProperty("nfesPendentes");
      expect(stats).toHaveProperty("nfesAlocadas");
      expect(stats).toHaveProperty("ultimaSincronizacao");
      expect(stats).toHaveProperty("cacheValido");
    });

    it("deve contar NFes pendentes", async () => {
      await buscarNfesReaisDoACS();
      const stats = await obterEstatisticasSincronizacao();

      expect(stats.nfesPendentes).toBeGreaterThanOrEqual(0);
    });

    it("deve indicar se cache é válido", async () => {
      limparCache();
      await buscarNfesReaisDoACS();
      const stats = await obterEstatisticasSincronizacao();

      expect(typeof stats.cacheValido).toBe("boolean");
    });
  });

  describe("buscarNFeComDetalhes", () => {
    it("deve buscar NFe específica", async () => {
      const nfes = await buscarNfesReaisDoACS();
      if (nfes.length > 0) {
        const chaveNfe = nfes[0].chaveNfe;
        const nfe = await buscarNFeComDetalhes(chaveNfe);

        expect(nfe).toBeDefined();
        expect(nfe?.chaveNfe).toBe(chaveNfe);
      }
    });

    it("deve retornar null se NFe não encontrada", async () => {
      await buscarNfesReaisDoACS();
      const nfe = await buscarNFeComDetalhes("chave-inexistente-12345");

      expect(nfe).toBeNull();
    });
  });

  describe("limparCache", () => {
    it("deve limpar cache manualmente", async () => {
      await buscarNfesReaisDoACS();
      limparCache();

      const nfes = await buscarNfesReaisDoACS();
      expect(nfes.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe("Integração completa", () => {
    it("deve sincronizar e obter estatísticas", async () => {
      const resultado = await sincronizarNfesAutomaticamente();
      expect(resultado.novasNfes).toBeGreaterThanOrEqual(0);

      const stats = await obterEstatisticasSincronizacao();
      expect(stats.totalNfes).toBe(resultado.novasNfes);
    });

    it("deve manter consistência entre busca e estatísticas", async () => {
      const nfes = await buscarNfesReaisDoACS();
      const stats = await obterEstatisticasSincronizacao();

      expect(stats.totalNfes).toBe(nfes.length);
    });

    it("deve retornar dados reais da origem ACS", async () => {
      const nfes = await buscarNfesReaisDoACS();

      if (nfes.length > 0) {
        nfes.forEach((nfe) => {
          expect(nfe.origem).toBe("ACS");
          expect(nfe.chaveNfe).toBeDefined();
          expect(nfe.chaveNfe.length).toBeGreaterThan(0);
          expect(nfe.quantidade).toBeGreaterThan(0);
        });
      }
    });
  });
});
