/**
 * Mock do serviço ACS-NFES para testes
 * Retorna dados simulados sem conectar ao banco real
 */

interface NFe {
  id: string;
  chaveNfe: string;
  numeroNf: string;
  serieNf: string;
  dataEmissao: Date;
  cnpjFaturado: string;
  cnpjFornecedor: string;
  postoDestino: string;
  produto: string;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  statusAlocacao: string;
  quantidadePendente: number;
}

export async function buscarNfesDoACS(filtros?: {
  dataInicio?: string;
  dataFim?: string;
  postoId?: string;
  status?: string;
}): Promise<NFe[]> {
  // Simular delay de rede
  await new Promise(resolve => setTimeout(resolve, 100));

  return [
    {
      id: "1",
      chaveNfe: "35240216123456789012345678901234567890",
      numeroNf: "001234",
      serieNf: "1",
      dataEmissao: new Date("2026-02-14"),
      cnpjFaturado: "07.526.847/0001-00",
      cnpjFornecedor: "07.526.847/0001-00",
      postoDestino: "Aracati",
      produto: "Gasolina Comum",
      quantidade: 5000,
      custoUnitario: 5.42,
      custoTotal: 27100,
      statusAlocacao: "pendente",
      quantidadePendente: 5000,
    },
    {
      id: "2",
      chaveNfe: "35240216234567890123456789012345678901",
      numeroNf: "001235",
      serieNf: "1",
      dataEmissao: new Date("2026-02-15"),
      cnpjFaturado: "07.526.847/0001-00",
      cnpjFornecedor: "07.526.847/0001-00",
      postoDestino: "Aracati",
      produto: "Diesel S10",
      quantidade: 3000,
      custoUnitario: 6.15,
      custoTotal: 18450,
      statusAlocacao: "parcialmente_alocado",
      quantidadePendente: 1500,
    },
  ];
}

export async function buscarNfePorChave(chaveNfe: string): Promise<NFe | null> {
  await new Promise(resolve => setTimeout(resolve, 50));

  const nfes = await buscarNfesDoACS();
  return nfes.find(nfe => nfe.chaveNfe === chaveNfe) || null;
}

export async function contarNfesNaoAlocadas(): Promise<number> {
  await new Promise(resolve => setTimeout(resolve, 50));
  return 2;
}
