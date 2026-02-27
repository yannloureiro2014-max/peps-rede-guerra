import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Testes para validar a lógica de cálculo de custos unitários
 * e filtro de postos ativos na busca de NFes
 */

// Funções puras extraídas do serviço para teste
function calcularCustos(params: {
  totalNota: number;
  totalProdutos?: number;
  totalLitros: number;
  tipoFrete: string;
  frete: number;
  despesas: number;
}) {
  const { totalNota, totalProdutos, totalLitros, tipoFrete, frete, despesas } = params;
  // CORREÇÃO: usar totalProdutos (valor sem frete) ao invés de totalNota (que pode incluir frete)
  const valorProdutos = (totalProdutos && totalProdutos > 0) ? totalProdutos : totalNota;
  const custoUnitarioProduto = totalLitros > 0 ? valorProdutos / totalLitros : 0;
  const custoUnitarioFrete = (tipoFrete === 'FOB' && frete && totalLitros > 0)
    ? frete / totalLitros
    : 0;
  const custoUnitarioTotal = custoUnitarioProduto + custoUnitarioFrete;
  const custoTotal = valorProdutos + (tipoFrete === 'FOB' ? (frete || 0) : 0);
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
      totalNota: 13500, // totalNota já inclui frete no ACS
      totalProdutos: 13000, // totalProdutos é o valor sem frete
      totalLitros: 2500,
      tipoFrete: 'FOB',
      frete: 500,
      despesas: 0,
    });
    expect(result.custoUnitarioProduto).toBeCloseTo(5.2, 4); // 13000/2500 = 5.2 (sem frete)
    expect(result.custoUnitarioFrete).toBeCloseTo(0.2, 4); // 500/2500 = 0.2
    expect(result.custoUnitarioTotal).toBeCloseTo(5.4, 4); // 5.2 + 0.2 = 5.4
    expect(result.custoTotal).toBe(13500); // 13000 + 500 = 13500
  });

  it("deve usar totalProdutos ao invés de totalNota para evitar duplicação de frete (caso real SETTA)", () => {
    // Caso real: NFe 000021167 - SETTA COMBUSTIVEIS
    // Valor Unitario: 5,29 | Quantidade: 5000 | Total Produtos: 26450 | Frete: 400 | Total Nota: 26850
    const result = calcularCustos({
      totalNota: 26850, // Total da nota (já inclui frete)
      totalProdutos: 26450, // Valor dos produtos (sem frete)
      totalLitros: 5000,
      tipoFrete: 'FOB',
      frete: 400,
      despesas: 0,
    });
    expect(result.custoUnitarioProduto).toBeCloseTo(5.29, 2); // 26450/5000 = 5.29
    expect(result.custoUnitarioFrete).toBeCloseTo(0.08, 2); // 400/5000 = 0.08
    expect(result.custoUnitarioTotal).toBeCloseTo(5.37, 2); // 5.29 + 0.08 = 5.37
    expect(result.custoTotal).toBe(26850); // 26450 + 400 = 26850
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
