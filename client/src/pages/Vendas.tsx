import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { BarChart3, Download, Fuel, DollarSign, Calendar, AlertTriangle, Gauge } from "lucide-react";
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

// Correção de data: sempre usar UTC para evitar deslocamento de fuso horário
function formatDateBR(date: Date | string): string {
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      return `${match[3]}/${match[2]}/${match[1]}`;
    }
  }
  const d = date instanceof Date ? date : new Date(date);
  // Usar UTC para evitar que meia-noite UTC vire dia anterior em UTC-3
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function getDateString(date: Date): string {
  // Usar timezone local para evitar problemas de UTC
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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
  const [tabAtiva, setTabAtiva] = useState<string>("vendas");
  
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

  // Separar vendas reais e aferições
  const { vendasReais, afericoes } = useMemo(() => {
    if (!vendas) return { vendasReais: [], afericoes: [] };
    const reais: typeof vendas = [];
    const afer: typeof vendas = [];
    for (const v of vendas) {
      if ((v as any).afericao === 1) {
        afer.push(v);
      } else {
        reais.push(v);
      }
    }
    return { vendasReais: reais, afericoes: afer };
  }, [vendas]);

  // Calcular totais de vendas reais (sem aferições)
  const totaisVendas = useMemo(() => {
    return vendasReais.reduce((acc, v) => ({
      litros: acc.litros + parseFloat(v.quantidade || '0'),
      valor: acc.valor + parseFloat(v.valorTotal || '0'),
      registros: acc.registros + 1
    }), { litros: 0, valor: 0, registros: 0 });
  }, [vendasReais]);

  // Calcular totais de aferições
  const totaisAfericoes = useMemo(() => {
    return afericoes.reduce((acc, v) => ({
      litros: acc.litros + parseFloat(v.quantidade || '0'),
      valor: acc.valor + parseFloat(v.valorTotal || '0'),
      registros: acc.registros + 1
    }), { litros: 0, valor: 0, registros: 0 });
  }, [afericoes]);

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
  const exportarCSV = (dados: typeof vendas, tipo: string) => {
    if (!dados || dados.length === 0) return;
    
    const headers = ['Data', 'Posto', 'Tanque', 'Combustível', 'Quantidade (L)', 'Preço Unit.', 'Valor Total', 'Tipo'];
    const rows = dados.map(v => [
      formatDateBR(v.dataVenda),
      v.postoNome,
      v.tanqueCodigo,
      v.produtoDescricao,
      v.quantidade,
      v.valorUnitario,
      v.valorTotal,
      (v as any).afericao === 1 ? 'AFERIÇÃO' : 'VENDA'
    ]);
    
    const csv = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${tipo}_${dataInicio}_${dataFim}.csv`;
    link.click();
  };

  // Componente de tabela reutilizável
  const TabelaVendas = ({ dados, tipo }: { dados: typeof vendas; tipo: string }) => {
    if (!dados || dados.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          Nenhum registro de {tipo} encontrado para os filtros selecionados.
        </div>
      );
    }

    return (
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
            {dados.slice(0, 200).map(venda => (
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
        {dados.length > 200 && (
          <p className="text-center text-sm text-muted-foreground mt-4">
            Mostrando 200 de {formatNumber(dados.length)} registros. Exporte o CSV para ver todos.
          </p>
        )}
      </div>
    );
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
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => exportarCSV(vendasReais, 'vendas')} disabled={vendasReais.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              Exportar Vendas
            </Button>
            {afericoes.length > 0 && (
              <Button variant="outline" onClick={() => exportarCSV(afericoes, 'afericoes')} disabled={afericoes.length === 0}>
                <Download className="h-4 w-4 mr-2" />
                Exportar Aferições
              </Button>
            )}
          </div>
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
              <div className="flex flex-wrap gap-4 text-sm">
                <span className="text-muted-foreground">
                  <strong>{formatNumber(totaisVendas.registros)}</strong> vendas
                </span>
                <span className="text-blue-600">
                  <strong>{formatNumber(totaisVendas.litros)}</strong> L
                </span>
                <span className="text-green-600">
                  <strong>{formatCurrency(totaisVendas.valor)}</strong>
                </span>
                {afericoes.length > 0 && (
                  <span className="text-amber-600">
                    <strong>{formatNumber(totaisAfericoes.registros)}</strong> aferições ({formatNumber(totaisAfericoes.litros)} L)
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo - Apenas vendas reais */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Vendas Reais
              </CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totaisVendas.registros)}</div>
              {afericoes.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  + {formatNumber(totaisAfericoes.registros)} aferições excluídas
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Volume Vendido
              </CardTitle>
              <Fuel className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatNumber(totaisVendas.litros)} L</div>
              {afericoes.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  + {formatNumber(totaisAfericoes.litros)} L em aferições
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Faturamento Real
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totaisVendas.valor)}</div>
              {afericoes.length > 0 && (
                <p className="text-xs text-amber-600 mt-1">
                  {formatCurrency(totaisAfericoes.valor)} em aferições (não contabilizado)
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Vendas e Aferições */}
        <Tabs value={tabAtiva} onValueChange={setTabAtiva}>
          <TabsList>
            <TabsTrigger value="vendas" className="gap-2">
              <DollarSign className="h-4 w-4" />
              Vendas Reais
              <Badge variant="secondary" className="ml-1">{formatNumber(totaisVendas.registros)}</Badge>
            </TabsTrigger>
            <TabsTrigger value="afericoes" className="gap-2">
              <Gauge className="h-4 w-4" />
              Aferições
              {afericoes.length > 0 ? (
                <Badge variant="outline" className="ml-1 text-amber-600 border-amber-300">{formatNumber(totaisAfericoes.registros)}</Badge>
              ) : (
                <Badge variant="secondary" className="ml-1">0</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="vendas">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Detalhamento de Vendas</CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <TabelaVendas dados={vendasReais} tipo="vendas" />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="afericoes">
            <Card>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5 shrink-0" />
                  <div>
                    <CardTitle className="text-base">Aferições (Calibração)</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Aferições são operações de calibração onde o combustível é retirado do tanque para teste e deve ser devolvido.
                      Estes registros <strong>não são contabilizados</strong> como vendas no DRE nem no consumo de estoque.
                      Use esta aba para auditoria operacional e verificar se o combustível de aferição está sendo devolvido ao tanque.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">Carregando...</div>
                ) : (
                  <TabelaVendas dados={afericoes} tipo="aferições" />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
