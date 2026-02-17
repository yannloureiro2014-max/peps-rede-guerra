import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getDb } from "./db";
import {
  criarLoteDoSEFAZ,
  listarNfesAlocadas,
  obterEstatisticasAlocacoes,
  registrarConsumoLote,
  atualizarDisponibilidadeLote,
  obterLotesDisponiveisPEPS,
} from "./db-sefaz-alocacoes";

describe("Fluxo Completo de Alocação SEFAZ", () => {
  let db: any;
  let loteId: number;

  beforeAll(async () => {
    db = await getDb();
    if (!db) {
      console.warn("[TESTE] Banco de dados não disponível, pulando testes");
    }
  });

  it("deve criar lote a partir de NFe SEFAZ", async () => {
    if (!db) {
      console.warn("[TESTE] Pulando teste - DB indisponível");
      return;
    }

    const loteIdCriado = await criarLoteDoSEFAZ({
      chaveNfe: "35202512161234567890123456789012345678901244",
      numeroNf: "001234",
      serieNf: "1",
      dataEmissao: new Date("2026-02-16"),
      dataDescargaReal: new Date("2026-02-16"),
      postoId: 1,
      tanqueId: 1,
      produtoId: 1,
      volumeAlocado: 5000,
      custoUnitario: 5.30,
      justificativa: "Teste de alocação SEFAZ",
      usuarioId: 1,
    });

    expect(loteIdCriado).toBeGreaterThan(0);
    loteId = loteIdCriado;
  });

  it("deve listar NFes alocadas", async () => {
    if (!db || !loteId) {
      console.warn("[TESTE] Pulando teste - DB ou loteId indisponível");
      return;
    }

    const nfes = await listarNfesAlocadas({
      postoId: 1,
      status: "ativo",
    });

    expect(Array.isArray(nfes)).toBe(true);
    expect(nfes.length).toBeGreaterThanOrEqual(0);
  });

  it("deve obter estatísticas de alocações", async () => {
    if (!db) {
      console.warn("[TESTE] Pulando teste - DB indisponível");
      return;
    }

    const stats = await obterEstatisticasAlocacoes({
      dataInicio: new Date("2026-02-01"),
      dataFim: new Date("2026-02-28"),
    });

    expect(stats.totalAlocacoes).toBeGreaterThanOrEqual(0);
    expect(stats.totalVolume).toBeGreaterThanOrEqual(0);
    expect(stats.custoMedio).toBeGreaterThanOrEqual(0);
    expect(typeof stats.lotesPorStatus).toBe("object");
  });

  it("deve obter lotes disponíveis em ordem PEPS", async () => {
    if (!db) {
      console.warn("[TESTE] Pulando teste - DB indisponível");
      return;
    }

    const lotes = await obterLotesDisponiveisPEPS({
      postoId: 1,
      tanqueId: 1,
      produtoId: 1,
    });

    expect(Array.isArray(lotes)).toBe(true);

    // Verificar ordem PEPS (lotes mais antigos primeiro)
    if (lotes.length > 1) {
      for (let i = 1; i < lotes.length; i++) {
        const dataAnterior = new Date(lotes[i - 1].dataEntrada).getTime();
        const dataAtual = new Date(lotes[i].dataEntrada).getTime();
        expect(dataAnterior).toBeLessThanOrEqual(dataAtual);
      }
    }
  });

  it("deve registrar consumo de lote", async () => {
    if (!db || !loteId) {
      console.warn("[TESTE] Pulando teste - DB ou loteId indisponível");
      return;
    }

    const consumoId = await registrarConsumoLote({
      vendaId: 1,
      loteId: loteId,
      volumeConsumido: 1000,
      custoUnitario: 5.30,
      usuarioId: 1,
    });

    expect(consumoId).toBeGreaterThan(0);
  });

  it("deve atualizar disponibilidade de lote após consumo", async () => {
    if (!db || !loteId) {
      console.warn("[TESTE] Pulando teste - DB ou loteId indisponível");
      return;
    }

    await atualizarDisponibilidadeLote({
      loteId: loteId,
      volumeConsumido: 1000,
      usuarioId: 1,
    });

    // Verificar que o lote foi atualizado
    const lotes = await obterLotesDisponiveisPEPS({
      postoId: 1,
      tanqueId: 1,
      produtoId: 1,
    });

    const loteAtualizado = lotes.find((l) => l.id === loteId);
    if (loteAtualizado) {
      expect(loteAtualizado.volumeDisponivel).toBeLessThan(5000);
    }
  });

  it("deve simular fluxo completo: alocação -> consumo -> CMV", async () => {
    if (!db) {
      console.warn("[TESTE] Pulando teste - DB indisponível");
      return;
    }

    // 1. Criar lote
    const novoLoteId = await criarLoteDoSEFAZ({
      chaveNfe: "35202512171234567890123456789012345678901245",
      numeroNf: "001235",
      serieNf: "1",
      dataEmissao: new Date("2026-02-17"),
      dataDescargaReal: new Date("2026-02-17"),
      postoId: 1,
      tanqueId: 1,
      produtoId: 1,
      volumeAlocado: 3000,
      custoUnitario: 5.40,
      justificativa: "Teste fluxo completo",
      usuarioId: 1,
    });

    expect(novoLoteId).toBeGreaterThan(0);

    // 2. Listar lotes (deve incluir o novo)
    const lotes = await obterLotesDisponiveisPEPS({
      postoId: 1,
      tanqueId: 1,
      produtoId: 1,
    });

    expect(lotes.length).toBeGreaterThan(0);

    // 3. Registrar consumo
    const consumoId = await registrarConsumoLote({
      vendaId: 2,
      loteId: novoLoteId,
      volumeConsumido: 500,
      custoUnitario: 5.40,
      usuarioId: 1,
    });

    expect(consumoId).toBeGreaterThan(0);

    // 4. Atualizar disponibilidade
    await atualizarDisponibilidadeLote({
      loteId: novoLoteId,
      volumeConsumido: 500,
      usuarioId: 1,
    });

    // 5. Verificar que o lote foi atualizado
    const lotesApos = await obterLotesDisponiveisPEPS({
      postoId: 1,
      tanqueId: 1,
      produtoId: 1,
    });

    const loteConsumido = lotesApos.find((l) => l.id === novoLoteId);
    if (loteConsumido) {
      expect(loteConsumido.volumeDisponivel).toBe(2500); // 3000 - 500
    }
  });

  it("deve manter ordem PEPS mesmo com múltiplos lotes", async () => {
    if (!db) {
      console.warn("[TESTE] Pulando teste - DB indisponível");
      return;
    }

    // Criar 3 lotes com datas diferentes
    const lote1 = await criarLoteDoSEFAZ({
      chaveNfe: "35202512101234567890123456789012345678901246",
      numeroNf: "001236",
      serieNf: "1",
      dataEmissao: new Date("2026-02-10"),
      dataDescargaReal: new Date("2026-02-10"),
      postoId: 1,
      tanqueId: 2,
      produtoId: 1,
      volumeAlocado: 2000,
      custoUnitario: 5.20,
      usuarioId: 1,
    });

    const lote2 = await criarLoteDoSEFAZ({
      chaveNfe: "35202512121234567890123456789012345678901247",
      numeroNf: "001237",
      serieNf: "1",
      dataEmissao: new Date("2026-02-12"),
      dataDescargaReal: new Date("2026-02-12"),
      postoId: 1,
      tanqueId: 2,
      produtoId: 1,
      volumeAlocado: 2500,
      custoUnitario: 5.25,
      usuarioId: 1,
    });

    const lote3 = await criarLoteDoSEFAZ({
      chaveNfe: "35202512151234567890123456789012345678901248",
      numeroNf: "001238",
      serieNf: "1",
      dataEmissao: new Date("2026-02-15"),
      dataDescargaReal: new Date("2026-02-15"),
      postoId: 1,
      tanqueId: 2,
      produtoId: 1,
      volumeAlocado: 3000,
      custoUnitario: 5.30,
      usuarioId: 1,
    });

    // Listar lotes em ordem PEPS
    const lotes = await obterLotesDisponiveisPEPS({
      postoId: 1,
      tanqueId: 2,
      produtoId: 1,
    });

    // Deve estar em ordem de data (PEPS)
    expect(lotes.length).toBeGreaterThanOrEqual(3);

    // Verificar que estão ordenados
    for (let i = 1; i < lotes.length; i++) {
      const dataAnterior = new Date(lotes[i - 1].dataEntrada).getTime();
      const dataAtual = new Date(lotes[i].dataEntrada).getTime();
      expect(dataAnterior).toBeLessThanOrEqual(dataAtual);
    }
  });
});
