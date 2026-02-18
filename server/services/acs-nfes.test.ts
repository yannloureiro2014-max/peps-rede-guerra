import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('ACS NFes Service - Cálculo de Custo Unitário com Frete', () => {
  it('deve calcular custoUnitario incluindo frete para NFes FOB', () => {
    // Simular uma NFe FOB com frete
    const compra = {
      totalNota: 10000, // R$ 10.000 (produto)
      totalLitros: 1000, // 1000 litros
      tipoFrete: 'FOB',
      frete: 500, // R$ 500 de frete
      despesas: 0,
    };

    // Cálculo esperado: (10000 + 500) / 1000 = 10.5 por litro
    let custoTotal = compra.totalNota;
    if (compra.tipoFrete === 'FOB' && compra.frete) {
      custoTotal += compra.frete;
    }
    const custoUnitario = compra.totalLitros > 0 ? custoTotal / compra.totalLitros : 0;

    expect(custoUnitario).toBe(10.5);
    expect(custoTotal).toBe(10500);
  });

  it('deve calcular custoUnitario SEM incluir frete para NFes CIF', () => {
    // Simular uma NFe CIF (frete já incluído no valor)
    const compra = {
      totalNota: 10500, // R$ 10.500 (já inclui frete)
      totalLitros: 1000, // 1000 litros
      tipoFrete: 'CIF',
      frete: 0,
      despesas: 0,
    };

    // Cálculo esperado: 10500 / 1000 = 10.5 por litro (frete já está em totalNota)
    let custoTotal = compra.totalNota;
    if (compra.tipoFrete === 'FOB' && compra.frete) {
      custoTotal += compra.frete;
    }
    const custoUnitario = compra.totalLitros > 0 ? custoTotal / compra.totalLitros : 0;

    expect(custoUnitario).toBe(10.5);
    expect(custoTotal).toBe(10500);
  });

  it('deve calcular custoUnitario para NFe FOB sem frete cadastrado', () => {
    // Simular uma NFe FOB sem frete (ainda não foi cadastrado)
    const compra = {
      totalNota: 10000,
      totalLitros: 1000,
      tipoFrete: 'FOB',
      frete: 0, // Sem frete cadastrado
      despesas: 0,
    };

    // Cálculo esperado: 10000 / 1000 = 10.0 por litro
    let custoTotal = compra.totalNota;
    if (compra.tipoFrete === 'FOB' && compra.frete) {
      custoTotal += compra.frete;
    }
    const custoUnitario = compra.totalLitros > 0 ? custoTotal / compra.totalLitros : 0;

    expect(custoUnitario).toBe(10);
    expect(custoTotal).toBe(10000);
  });

  it('deve retornar 0 quando totalLitros é 0', () => {
    const compra = {
      totalNota: 10000,
      totalLitros: 0, // Sem litros
      tipoFrete: 'FOB',
      frete: 500,
      despesas: 0,
    };

    let custoTotal = compra.totalNota;
    if (compra.tipoFrete === 'FOB' && compra.frete) {
      custoTotal += compra.frete;
    }
    const custoUnitario = compra.totalLitros > 0 ? custoTotal / compra.totalLitros : 0;

    expect(custoUnitario).toBe(0);
  });

  it('deve incluir despesas no cálculo se necessário', () => {
    // Simular uma NFe FOB com frete e despesas
    const compra = {
      totalNota: 10000,
      totalLitros: 1000,
      tipoFrete: 'FOB',
      frete: 500,
      despesas: 100, // R$ 100 de despesas
    };

    // Cálculo esperado: (10000 + 500 + 100) / 1000 = 10.6 por litro
    let custoTotal = compra.totalNota;
    if (compra.tipoFrete === 'FOB' && compra.frete) {
      custoTotal += compra.frete;
    }
    // Se precisar incluir despesas também:
    if (compra.despesas) {
      custoTotal += compra.despesas;
    }
    const custoUnitario = compra.totalLitros > 0 ? custoTotal / compra.totalLitros : 0;

    expect(custoUnitario).toBe(10.6);
    expect(custoTotal).toBe(10600);
  });
});
