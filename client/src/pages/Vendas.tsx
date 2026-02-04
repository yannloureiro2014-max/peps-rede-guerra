import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { BarChart3, Download, Fuel, DollarSign, Calendar } from "lucide-react";
import { useState, useMemo } from "react";

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

function formatDateBR(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function Vendas() {
  const [postoFiltro, setPostoFiltro] = useState<string>("todos");
  const [produtoFiltro, setProdutoFiltro] = useState<string>("todos");
  const [tipoFiltroData, setTipoFiltroData] = useState<string>("periodo");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("30");
  const [dataEspecifica, setDataEspecifica] = useState<string>(getDateString(new Date()));

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();

  // Calcular datas baseado no tipo de filtro
  const { dataInicio, dataFim } = useMemo(() => {
    if (tipoFiltroData === "especifica") {
      // Filtro por data específica
      return {
        dataInicio: dataEspecifica,
        dataFim: dataEspecifica
      };
    } else {
      // Filtro por período
      const fim = new Date();
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - parseInt(periodoFiltro));
      return {
        dataInicio: getDateString(inicio),
        dataFim: getDateString(fim)
      };
    }
  }, [tipoFiltroData, periodoFiltro, dataEspecifica]);

  const { data: vendas, isLoading } = trpc.vendas.list.useQuery({
    postoId: postoFiltro !== "todos" ? parseInt(postoFiltro) : undefined,
    produtoId: produtoFiltro !== "todos" ? parseInt(produtoFiltro) : undefined,
    dataInicio,
    dataFim,
  });

  // Calcular totais
  const totais = useMemo(() => {
    if (!vendas) return { litros: 0, valor: 0, registros: 0 };
    return vendas.reduce((acc, v) => ({
      litros: acc.litros + parseFloat(v.quantidade || '0'),
      valor: acc.valor + parseFloat(v.valorTotal || '0'),
      registros: acc.registros + 1
    }), { litros: 0, valor: 0, registros: 0 });
  }, [vendas]);

  // Atalhos de data
  const setDataHoje = () => {
    setTipoFiltroData("especifica");
    setDataEspecifica(getDateString(new Date()));
  };

  const setDataOntem = () => {
    setTipoFiltroData("especifica");
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    setDataEspecifica(getDateString(ontem));
  };

  const setDataAnteontem = () => {
    setTipoFiltroData("especifica");
    const anteontem = new Date();
    anteontem.setDate(anteontem.getDate() - 2);
    setDataEspecifica(getDateString(anteontem));
  };

  // Exportar CSV
  const exportarCSV = () => {
    if (!vendas || vendas.length === 0) return;
    
    const headers = ['Data', 'Posto', 'Tanque', 'Combustível', 'Quantidade (L)', 'Preço Unit.', 'Valor Total'];
    const rows = vendas.map(v => [
      formatDateBR(v.dataVenda),
      v.postoNome,
      v.tanqueCodigo,
      v.produtoDescricao,
      v.quantidade,
      v.valorUnitario,
      v.valorTotal
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `vendas_${dataInicio}_${dataFim}.csv`;
    link.click();
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Análise de Vendas</h1>
            <p className="text-muted-foreground">Visualização detalhada das vendas por período</p>
          </div>
          <Button variant="outline" onClick={exportarCSV} disabled={!vendas || vendas.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Posto</label>
                <Select value={postoFiltro} onValueChange={setPostoFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os postos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Postos</SelectItem>
                    {postos?.map(posto => (
                      <SelectItem key={posto.id} value={posto.id.toString()}>
                        {posto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Combustível</label>
                <Select value={produtoFiltro} onValueChange={setProdutoFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os combustíveis" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Combustíveis</SelectItem>
                    {produtos?.map(produto => (
                      <SelectItem key={produto.id} value={produto.id.toString()}>
                        {produto.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Filtro</label>
                <Select value={tipoFiltroData} onValueChange={setTipoFiltroData}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="periodo">Por Período</SelectItem>
                    <SelectItem value="especifica">Data Específica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoFiltroData === "periodo" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Hoje</SelectItem>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="15">Últimos 15 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="60">Últimos 60 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data (dd/mm/aaaa)</label>
                  <Input
                    type="date"
                    value={dataEspecifica}
                    onChange={(e) => setDataEspecifica(e.target.value)}
                    className="w-full"
                  />
                </div>
              )}
            </div>

            {/* Atalhos de data */}
            {tipoFiltroData === "especifica" && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground mr-2 self-center">Atalhos:</span>
                <Button variant="outline" size="sm" onClick={setDataHoje}>
                  <Calendar className="h-3 w-3 mr-1" />
                  Hoje ({formatDateBR(new Date())})
                </Button>
                <Button variant="outline" size="sm" onClick={setDataOntem}>
                  Ontem ({formatDateBR(new Date(Date.now() - 86400000))})
                </Button>
                <Button variant="outline" size="sm" onClick={setDataAnteontem}>
                  Anteontem ({formatDateBR(new Date(Date.now() - 172800000))})
                </Button>
              </div>
            )}

            {/* Indicador de período selecionado */}
            <div className="mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                <strong>Período selecionado:</strong>{" "}
                {tipoFiltroData === "especifica" 
                  ? formatDateBR(dataEspecifica)
                  : `${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`
                }
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total de Registros
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totais.registros)}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Volume Total
              </CardTitle>
              <Fuel className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totais.litros)} L</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Faturamento
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totais.valor)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de Vendas */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Detalhamento de Vendas</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !vendas || vendas.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma venda encontrada para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Tanque</TableHead>
                      <TableHead>Combustível</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Preço Unit.</TableHead>
                      <TableHead className="text-right">Valor Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vendas.slice(0, 100).map(venda => (
                      <TableRow key={venda.id}>
                        <TableCell>{formatDateBR(venda.dataVenda)}</TableCell>
                        <TableCell className="font-medium">{venda.postoNome}</TableCell>
                        <TableCell>{venda.tanqueCodigo}</TableCell>
                        <TableCell>{venda.produtoDescricao}</TableCell>
                        <TableCell className="text-right">{formatNumber(venda.quantidade)} L</TableCell>
                        <TableCell className="text-right">{formatCurrency(venda.valorUnitario)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(venda.valorTotal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {vendas.length > 100 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Mostrando 100 de {vendas.length} registros. Exporte para ver todos.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
