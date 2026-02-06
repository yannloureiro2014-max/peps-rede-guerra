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
  const d = typeof date === 'string' ? new Date(date + 'T12:00:00') : date;
  return d.toLocaleDateString('pt-BR');
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getFirstDayOfMonth(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function getLastDayOfMonth(date: Date): string {
  const last = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return getDateString(last);
}

export default function Vendas() {
  const hoje = useMemo(() => new Date(), []);
  const [postoFiltro, setPostoFiltro] = useState<string>("todos");
  const [produtoFiltro, setProdutoFiltro] = useState<string>("todos");
  
  // Filtros de data inicial e final separados
  const [dataInicio, setDataInicio] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return getDateString(d);
  });
  const [dataFim, setDataFim] = useState<string>(() => getDateString(new Date()));

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();

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

  // Atalhos de período
  const setAtalho = (dias: number) => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);
    setDataInicio(getDateString(inicio));
    setDataFim(getDateString(fim));
  };

  const setMesAtual = () => {
    setDataInicio(getFirstDayOfMonth(hoje));
    setDataFim(getDateString(hoje));
  };

  const setMesAnterior = () => {
    const mesAnterior = new Date(hoje.getFullYear(), hoje.getMonth() - 1, 1);
    setDataInicio(getFirstDayOfMonth(mesAnterior));
    setDataFim(getLastDayOfMonth(mesAnterior));
  };

  const setHoje = () => {
    const h = getDateString(new Date());
    setDataInicio(h);
    setDataFim(h);
  };

  const setOntem = () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    const d = getDateString(ontem);
    setDataInicio(d);
    setDataFim(d);
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
              {/* Posto */}
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

              {/* Combustível */}
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

              {/* Data Inicial */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="w-full"
                />
              </div>

              {/* Data Final */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="w-full"
                />
              </div>
            </div>

            {/* Atalhos de período */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground mr-2 self-center">Atalhos:</span>
              <Button variant="outline" size="sm" onClick={setHoje}>
                <Calendar className="h-3 w-3 mr-1" />
                Hoje
              </Button>
              <Button variant="outline" size="sm" onClick={setOntem}>
                Ontem
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAtalho(7)}>
                7 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAtalho(15)}>
                15 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAtalho(30)}>
                30 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAtalho(60)}>
                60 dias
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAtalho(90)}>
                90 dias
              </Button>
              <Button variant="outline" size="sm" onClick={setMesAtual}>
                Mês Atual
              </Button>
              <Button variant="outline" size="sm" onClick={setMesAnterior}>
                Mês Anterior
              </Button>
            </div>

            {/* Indicador de período selecionado + totais */}
            <div className="mt-4 pt-4 border-t flex flex-wrap gap-4 items-center justify-between">
              <p className="text-sm text-muted-foreground">
                <strong>Período:</strong> {formatDateBR(dataInicio)} a {formatDateBR(dataFim)}
              </p>
              {vendas && vendas.length > 0 && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <span className="text-muted-foreground">
                    <strong>{formatNumber(totais.registros)}</strong> registros
                  </span>
                  <span className="text-blue-600">
                    <strong>{formatNumber(totais.litros)}</strong> L
                  </span>
                  <span className="text-green-600">
                    <strong>{formatCurrency(totais.valor)}</strong>
                  </span>
                </div>
              )}
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
                    {vendas.slice(0, 200).map(venda => (
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
                {vendas.length > 200 && (
                  <p className="text-center text-sm text-muted-foreground mt-4">
                    Mostrando 200 de {formatNumber(vendas.length)} registros. Exporte o CSV para ver todos.
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
