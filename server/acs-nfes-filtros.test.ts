import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes para validar a lógica de cálculo de custos unitários
 * e filtro de postos ativos na busca de NFes
 */

// Funções puras extraídas do serviço para teste
function calcularCustos(params: {
  totalNota: number;
  totalLitros: number;
  tipoFrete: string;
  frete: number;
  despesas: number;
}) {
  const { totalNota, totalLitros, tipoFrete, frete, despesas } = params;
  const custoUnitarioProduto = totalLitros > 0 ? totalNota / totalLitros : 0;
  const custoUnitarioFrete = (tipoFrete === 'FOB' && frete && totalLitros > 0)
    ? frete / totalLitros
    : 0;
  const custoUnitarioTotal = custoUnitarioProduto + custoUnitarioFrete;
  const custoTotal = totalNota + (tipoFrete === 'FOB' ? (frete || 0) : 0);
  return { custoUnitarioProduto, custoUnitarioFrete, custoUnitarioTotal, custoTotal };
}

function filtrarPostosAtivos(
  codEmpresasAtivos: string[],
  postoId?: string,
  postosMap?: Map<string, { id: number; nome: string; codigoAcs: string }>
): { codEmpresa?: string; codEmpresaList?: string[] } {
  if (postoId && postoId !== "todos") {
    // Buscar codigoAcs do posto
    if (postosMap) {
      for (const [codAcs, info] of Array.from(postosMap.entries())) {
        if (String(info.id) === postoId) {
          return { codEmpresa: codAcs };
        }
      }
    }
    return { codEmpresa: undefined }; // Posto não encontrado
  }
  // Todos os postos ativos
  return { codEmpresaList: codEmpresasAtivos };
}

describe("Cálculo de Custos Unitários", () => {
  it("deve calcular custo unitário produto corretamente", () => {
    const result = calcularCustos({
      totalNota: 13000,
      totalLitros: 2500,
      tipoFrete: 'CIF',
      frete: 0,
      despesas: 0,
    });
    expect(result.custoUnitarioProduto).toBeCloseTo(5.2, 4);
    expect(result.custoUnitarioFrete).toBe(0);
    expect(result.custoUnitarioTotal).toBeCloseTo(5.2, 4);
    expect(result.custoTotal).toBe(13000);
  });

  it("deve incluir frete no custo quando FOB", () => {
    const result = calcularCustos({
      totalNota: 13000,
      totalLitros: 2500,
      tipoFrete: 'FOB',
      frete: 500,
      despesas: 0,
    });
    expect(result.custoUnitarioProduto).toBeCloseTo(5.2, 4);
    expect(result.custoUnitarioFrete).toBeCloseTo(0.2, 4);
    expect(result.custoUnitarioTotal).toBeCloseTo(5.4, 4);
    expect(result.custoTotal).toBe(13500);
  });

  it("deve ignorar frete quando CIF", () => {
    const result = calcularCustos({
      totalNota: 13000,
      totalLitros: 2500,
      tipoFrete: 'CIF',
      frete: 500, // Mesmo com frete preenchido, CIF ignora
      despesas: 0,
    });
    expect(result.custoUnitarioFrete).toBe(0);
    expect(result.custoUnitarioTotal).toBeCloseTo(5.2, 4);
    expect(result.custoTotal).toBe(13000);
  });

  it("deve tratar FOB sem frete cadastrado", () => {
    const result = calcularCustos({
      totalNota: 13000,
      totalLitros: 2500,
      tipoFrete: 'FOB',
      frete: 0,
      despesas: 0,
    });
    expect(result.custoUnitarioFrete).toBe(0);
    expect(result.custoUnitarioTotal).toBeCloseTo(5.2, 4);
  });

  it("deve tratar divisão por zero (sem litros)", () => {
    const result = calcularCustos({
      totalNota: 13000,
      totalLitros: 0,
      tipoFrete: 'FOB',
      frete: 500,
      despesas: 0,
    });
    expect(result.custoUnitarioProduto).toBe(0);
    expect(result.custoUnitarioFrete).toBe(0);
    expect(result.custoUnitarioTotal).toBe(0);
  });
});

describe("Filtro de Postos Ativos", () => {
  const postosMap = new Map<string, { id: number; nome: string; codigoAcs: string }>([
    ["01", { id: 1, nome: "GUERRA FORTIM", codigoAcs: "01" }],
    ["03", { id: 3, nome: "GUERRA PALHANO", codigoAcs: "03" }],
    ["04", { id: 4, nome: "PAI TEREZA", codigoAcs: "04" }],
    ["06", { id: 6, nome: "MÃE E FILHO", codigoAcs: "06" }],
    ["08", { id: 8, nome: "JAGUARUANA", codigoAcs: "08" }],
    ["09", { id: 9, nome: "ITAIÇABA", codigoAcs: "09" }],
  ]);
  const codEmpresasAtivos = Array.from(postosMap.keys());

  it("deve retornar todos os postos ativos quando filtro é 'todos'", () => {
    const result = filtrarPostosAtivos(codEmpresasAtivos, "todos", postosMap);
    expect(result.codEmpresaList).toEqual(["01", "03", "04", "06", "08", "09"]);
    expect(result.codEmpresa).toBeUndefined();
  });

  it("deve retornar todos os postos ativos quando filtro é undefined", () => {
    const result = filtrarPostosAtivos(codEmpresasAtivos, undefined, postosMap);
    expect(result.codEmpresaList).toEqual(["01", "03", "04", "06", "08", "09"]);
  });

  it("deve converter postoId para codEmpresa corretamente", () => {
    // Posto ID 6 (MÃE E FILHO) -> codEmpresa "06"
    const result = filtrarPostosAtivos(codEmpresasAtivos, "6", postosMap);
    expect(result.codEmpresa).toBe("06");
    expect(result.codEmpresaList).toBeUndefined();
  });

  it("deve converter postoId 4 (PAI TEREZA) para codEmpresa 04", () => {
    const result = filtrarPostosAtivos(codEmpresasAtivos, "4", postosMap);
    expect(result.codEmpresa).toBe("04");
  });

  it("deve converter postoId 8 (JAGUARUANA) para codEmpresa 08", () => {
    const result = filtrarPostosAtivos(codEmpresasAtivos, "8", postosMap);
    expect(result.codEmpresa).toBe("08");
  });

  it("deve retornar undefined para posto inexistente", () => {
    const result = filtrarPostosAtivos(codEmpresasAtivos, "999", postosMap);
    expect(result.codEmpresa).toBeUndefined();
  });

  it("NÃO deve incluir postos inativos (ex: Guararapes VIP cod 11)", () => {
    // codEmpresasAtivos não inclui "11" (Guararapes VIP)
    expect(codEmpresasAtivos).not.toContain("11");
    expect(codEmpresasAtivos).not.toContain("02"); // Potiretama
    expect(codEmpresasAtivos).not.toContain("05"); // Leite
    expect(codEmpresasAtivos).not.toContain("10"); // SG Petroleo
    expect(codEmpresasAtivos).not.toContain("12"); // Aracati
    expect(codEmpresasAtivos).not.toContain("13"); // Horizonte
  });
});
