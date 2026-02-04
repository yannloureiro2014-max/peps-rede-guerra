import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { FileText, Download, Building2, Fuel, Ruler, Package } from "lucide-react";

function formatNumber(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatCurrency(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return 'R$ 0,00';
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
}

export default function Relatorios() {
  const { data: vendasPorPosto } = trpc.vendas.porPosto.useQuery({ dias: 30 });
  const { data: vendasPorCombustivel } = trpc.vendas.porCombustivel.useQuery({ dias: 30 });
  const { data: medicoes } = trpc.medicoes.list.useQuery({ limite: 50 });
  const { data: lotes } = trpc.lotes.listAtivos.useQuery();

  const exportarCSV = (dados: any[], nome: string, headers: string[]) => {
    if (!dados || dados.length === 0) return;
    const rows = dados.map(d => headers.map(h => d[h] ?? ''));
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${nome}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Relatórios</h1>
          <p className="text-muted-foreground">Relatórios gerenciais da rede de postos</p>
        </div>

        <Tabs defaultValue="postos" className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="postos" className="flex items-center gap-2">
              <Building2 className="h-4 w-4" />
              <span className="hidden sm:inline">Por Posto</span>
            </TabsTrigger>
            <TabsTrigger value="combustiveis" className="flex items-center gap-2">
              <Fuel className="h-4 w-4" />
              <span className="hidden sm:inline">Por Combustível</span>
            </TabsTrigger>
            <TabsTrigger value="medicoes" className="flex items-center gap-2">
              <Ruler className="h-4 w-4" />
              <span className="hidden sm:inline">Medições</span>
            </TabsTrigger>
            <TabsTrigger value="lotes" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              <span className="hidden sm:inline">Lotes</span>
            </TabsTrigger>
          </TabsList>

          {/* Vendas por Posto */}
          <TabsContent value="postos">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Vendas por Posto (30 dias)
                  </CardTitle>
                  <CardDescription>Resumo de vendas agrupado por posto</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportarCSV(
                    vendasPorPosto?.map(v => ({
                      Posto: v.postoNome,
                      'Litros Vendidos': v.totalLitros,
                      Faturamento: v.totalValor
                    })) || [],
                    'vendas_por_posto',
                    ['Posto', 'Litros Vendidos', 'Faturamento']
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posto</TableHead>
                      <TableHead className="text-right">Litros Vendidos</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasPorPosto?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.postoNome}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.totalLitros)} L</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalValor)}</TableCell>
                      </TableRow>
                    ))}
                    {(!vendasPorPosto || vendasPorPosto.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Sem dados disponíveis
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Vendas por Combustível */}
          <TabsContent value="combustiveis">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Fuel className="h-5 w-5" />
                    Vendas por Combustível (30 dias)
                  </CardTitle>
                  <CardDescription>Resumo de vendas agrupado por tipo de combustível</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportarCSV(
                    vendasPorCombustivel?.map(v => ({
                      Combustível: v.produtoDescricao,
                      'Litros Vendidos': v.totalLitros,
                      Faturamento: v.totalValor
                    })) || [],
                    'vendas_por_combustivel',
                    ['Combustível', 'Litros Vendidos', 'Faturamento']
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Combustível</TableHead>
                      <TableHead className="text-right">Litros Vendidos</TableHead>
                      <TableHead className="text-right">Faturamento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendasPorCombustivel?.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-medium">{item.produtoDescricao}</TableCell>
                        <TableCell className="text-right">{formatNumber(item.totalLitros)} L</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(item.totalValor)}</TableCell>
                      </TableRow>
                    ))}
                    {(!vendasPorCombustivel || vendasPorCombustivel.length === 0) && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          Sem dados disponíveis
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medições */}
          <TabsContent value="medicoes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Ruler className="h-5 w-5" />
                    Histórico de Medições
                  </CardTitle>
                  <CardDescription>Últimas 50 medições físicas realizadas</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportarCSV(
                    medicoes?.map(m => ({
                      Data: new Date(m.dataMedicao).toLocaleDateString('pt-BR'),
                      Posto: m.postoNome,
                      Tanque: m.tanqueCodigo,
                      Combustível: m.produtoDescricao,
                      'Vol. Medido': m.volumeMedido,
                      'Est. Escritural': m.estoqueEscritural,
                      Diferença: m.diferenca,
                      '% Dif': m.percentualDiferenca,
                      Tipo: m.tipoDiferenca
                    })) || [],
                    'medicoes',
                    ['Data', 'Posto', 'Tanque', 'Combustível', 'Vol. Medido', 'Est. Escritural', 'Diferença', '% Dif', 'Tipo']
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Posto</TableHead>
                        <TableHead>Tanque</TableHead>
                        <TableHead className="text-right">Vol. Medido</TableHead>
                        <TableHead className="text-right">Est. Escritural</TableHead>
                        <TableHead className="text-right">Diferença</TableHead>
                        <TableHead>Tipo</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {medicoes?.map(med => (
                        <TableRow key={med.id}>
                          <TableCell>{new Date(med.dataMedicao).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="font-medium">{med.postoNome}</TableCell>
                          <TableCell>{med.tanqueCodigo}</TableCell>
                          <TableCell className="text-right">{formatNumber(med.volumeMedido)} L</TableCell>
                          <TableCell className="text-right">{formatNumber(med.estoqueEscritural)} L</TableCell>
                          <TableCell className="text-right">{formatNumber(med.diferenca)} L</TableCell>
                          <TableCell className="capitalize">{med.tipoDiferenca}</TableCell>
                        </TableRow>
                      ))}
                      {(!medicoes || medicoes.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                            Sem medições registradas
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lotes Ativos */}
          <TabsContent value="lotes">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    Lotes Ativos
                  </CardTitle>
                  <CardDescription>Lotes de combustível disponíveis para consumo PEPS</CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => exportarCSV(
                    lotes?.map(l => ({
                      Posto: l.postoNome,
                      Tanque: l.tanqueCodigo,
                      Combustível: l.produtoDescricao,
                      NF: l.numeroNf,
                      Fornecedor: l.fornecedorId || 'N/A',
                      'Data Entrada': new Date(l.dataEntrada).toLocaleDateString('pt-BR'),
                      'Qtd Original': l.quantidadeOriginal,
                      'Qtd Disponível': l.quantidadeDisponivel,
                      'Custo Unit.': l.custoUnitario
                    })) || [],
                    'lotes_ativos',
                    ['Posto', 'Tanque', 'Combustível', 'NF', 'Fornecedor', 'Data Entrada', 'Qtd Original', 'Qtd Disponível', 'Custo Unit.']
                  )}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Posto</TableHead>
                        <TableHead>Tanque</TableHead>
                        <TableHead>Combustível</TableHead>
                        <TableHead>NF</TableHead>
                        <TableHead>Data</TableHead>
                        <TableHead className="text-right">Qtd Original</TableHead>
                        <TableHead className="text-right">Disponível</TableHead>
                        <TableHead className="text-right">Custo Unit.</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lotes?.map(lote => (
                        <TableRow key={lote.id}>
                          <TableCell className="font-medium">{lote.postoNome}</TableCell>
                          <TableCell>{lote.tanqueCodigo}</TableCell>
                          <TableCell>{lote.produtoDescricao}</TableCell>
                          <TableCell>{lote.numeroNf || '-'}</TableCell>
                          <TableCell>{new Date(lote.dataEntrada).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="text-right">{formatNumber(lote.quantidadeOriginal)} L</TableCell>
                          <TableCell className="text-right font-semibold">{formatNumber(lote.quantidadeDisponivel)} L</TableCell>
                          <TableCell className="text-right">{formatCurrency(lote.custoUnitario)}</TableCell>
                        </TableRow>
                      ))}
                      {(!lotes || lotes.length === 0) && (
                        <TableRow>
                          <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                            Nenhum lote ativo
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
