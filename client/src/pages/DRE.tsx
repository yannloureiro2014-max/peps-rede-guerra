import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, TrendingDown, Percent, Package, Calculator, Server, RefreshCw } from "lucide-react";
import { useState, useMemo, Fragment } from "react";

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3 }).format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

export default function DRE() {
  const [postoFiltro, setPostoFiltro] = useState<string>("todos");
  const [tipoFiltro, setTipoFiltro] = useState<"dia" | "periodo">("dia");
  const [dataEspecifica, setDataEspecifica] = useState<string>(new Date().toISOString().split('T')[0]);
  const [dataInicio, setDataInicio] = useState<string>(
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [dataFim, setDataFim] = useState<string>(new Date().toISOString().split('T')[0]);
  const [mostrarMemoria, setMostrarMemoria] = useState<number | null>(null);

  const { data: postos } = trpc.postos.list.useQuery();
  
  // Determinar período de consulta
  const periodoInicio = tipoFiltro === "dia" ? dataEspecifica : dataInicio;
  const periodoFim = tipoFiltro === "dia" ? dataEspecifica : dataFim;

  // Usar cálculo do backend
  const { data: dreData, isLoading, refetch } = trpc.dre.calcular.useQuery({
    postoId: postoFiltro !== "todos" ? parseInt(postoFiltro) : undefined,
    dataInicio: periodoInicio,
    dataFim: periodoFim,
  });

  // Totais gerais
  const totais = useMemo(() => {
    if (!dreData) return { quantidadeVendida: 0, receitaBruta: 0, cmv: 0, lucroBruto: 0 };
    return dreData.reduce(
      (acc, item) => ({
        quantidadeVendida: acc.quantidadeVendida + item.quantidadeVendida,
        receitaBruta: acc.receitaBruta + item.receitaBruta,
        cmv: acc.cmv + item.cmv,
        lucroBruto: acc.lucroBruto + item.lucroBruto,
      }),
      { quantidadeVendida: 0, receitaBruta: 0, cmv: 0, lucroBruto: 0 }
    );
  }, [dreData]);

  const margemTotal = totais.receitaBruta > 0 
    ? (totais.lucroBruto / totais.receitaBruta) * 100 
    : 0;

  // Atalhos de data
  const setHoje = () => setDataEspecifica(new Date().toISOString().split('T')[0]);
  const setOntem = () => {
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    setDataEspecifica(ontem.toISOString().split('T')[0]);
  };

  // Renderizar filtro de data baseado no tipo
  const renderDateFilter = () => {
    if (tipoFiltro === "dia") {
      return (
        <div className="space-y-2">
          <Label>Data</Label>
          <div className="flex gap-2">
            <Input 
              type="date" 
              value={dataEspecifica}
              onChange={(e) => setDataEspecifica(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={setHoje}>Hoje</Button>
            <Button variant="outline" size="sm" onClick={setOntem}>Ontem</Button>
          </div>
        </div>
      );
    }
    return (
      <Fragment>
        <div className="space-y-2">
          <Label>Data Início</Label>
          <Input 
            type="date" 
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Data Fim</Label>
          <Input 
            type="date" 
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
          />
        </div>
      </Fragment>
    );
  };

  // Renderizar conteúdo da tabela
  const renderTableContent = () => {
    if (!dreData || dreData.length === 0) {
      return (
        <p className="text-center text-muted-foreground py-8">
          {isLoading ? "Calculando DRE..." : "Nenhuma venda encontrada no período selecionado"}
        </p>
      );
    }

    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/50">
              <th className="text-left p-3 font-medium">Combustível</th>
              <th className="text-right p-3 font-medium">Litros</th>
              <th className="text-right p-3 font-medium">Receita Bruta</th>
              <th className="text-right p-3 font-medium">CMV (PEPS)</th>
              <th className="text-right p-3 font-medium">Lucro Bruto</th>
              <th className="text-right p-3 font-medium">Margem</th>
              <th className="text-center p-3 font-medium">Memória</th>
            </tr>
          </thead>
          <tbody>
            {dreData.map((item) => (
              <Fragment key={`dre-produto-${item.produtoId}`}>
                <tr className="border-b hover:bg-muted/50">
                  <td className="p-3 font-medium">{item.produtoNome}</td>
                  <td className="p-3 text-right">{formatNumber(item.quantidadeVendida)}</td>
                  <td className="p-3 text-right text-green-600">{formatCurrency(item.receitaBruta)}</td>
                  <td className="p-3 text-right text-red-600">{formatCurrency(item.cmv)}</td>
                  <td className={`p-3 text-right font-medium ${item.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {formatCurrency(item.lucroBruto)}
                  </td>
                  <td className={`p-3 text-right ${item.margemBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.margemBruta.toFixed(2)}%
                  </td>
                  <td className="p-3 text-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setMostrarMemoria(mostrarMemoria === item.produtoId ? null : item.produtoId)}
                    >
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
                {mostrarMemoria === item.produtoId ? (
                  item.lotesConsumidos && item.lotesConsumidos.length > 0 ? (
                    <tr key={`memoria-${item.produtoId}`}>
                      <td colSpan={7} className="p-0">
                        <div className="bg-muted/30 p-4 border-t">
                          <h4 className="font-medium mb-3 flex items-center gap-2">
                            <Server className="h-4 w-4" />
                            Memória de Cálculo PEPS - {item.produtoNome}
                            <Badge variant="outline" className="ml-2">Persistido no Banco</Badge>
                          </h4>
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="border-b">
                                <th className="text-left p-2">Ordem</th>
                                <th className="text-left p-2">NF-e</th>
                                <th className="text-left p-2">Data Entrada</th>
                                <th className="text-right p-2">Custo Unit.</th>
                                <th className="text-right p-2">Qtd Consumida</th>
                                <th className="text-right p-2">Custo Total</th>
                              </tr>
                            </thead>
                            <tbody>
                              {item.lotesConsumidos.map((lote: any) => (
                                <tr key={`lote-${item.produtoId}-${lote.loteId}-${lote.vendaId || lote.ordemConsumo}`} className="border-b">
                                  <td className="p-2">
                                    <Badge variant="outline">{lote.ordemConsumo || 1}º</Badge>
                                  </td>
                                  <td className="p-2 font-mono">{lote.numeroNf || `Lote ${lote.loteId}`}</td>
                                  <td className="p-2">{formatDate(lote.dataEntrada)}</td>
                                  <td className="p-2 text-right">{formatCurrency(parseFloat(lote.custoUnitario || "0"))}</td>
                                  <td className="p-2 text-right">{formatNumber(parseFloat(lote.quantidadeConsumida || "0"))} L</td>
                                  <td className="p-2 text-right font-medium">{formatCurrency(parseFloat(lote.custoTotal || "0"))}</td>
                                </tr>
                              ))}
                            </tbody>
                            <tfoot>
                              <tr className="bg-muted/50 font-medium">
                                <td colSpan={4} className="p-2 text-right">Total CMV:</td>
                                <td className="p-2 text-right">
                                  {formatNumber(item.lotesConsumidos.reduce((sum: number, l: any) => sum + parseFloat(l.quantidadeConsumida || "0"), 0))} L
                                </td>
                                <td className="p-2 text-right text-red-600">
                                  {formatCurrency(item.lotesConsumidos.reduce((sum: number, l: any) => sum + parseFloat(l.custoTotal || "0"), 0))}
                                </td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr key={`memoria-vazia-${item.produtoId}`}>
                      <td colSpan={7} className="p-4 text-center text-muted-foreground bg-muted/30">
                        Nenhum lote consumido registrado para este produto
                      </td>
                    </tr>
                  )
                ) : null}
              </Fragment>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted font-bold">
              <td className="p-3">TOTAL</td>
              <td className="p-3 text-right">{formatNumber(totais.quantidadeVendida)}</td>
              <td className="p-3 text-right text-green-600">{formatCurrency(totais.receitaBruta)}</td>
              <td className="p-3 text-right text-red-600">{formatCurrency(totais.cmv)}</td>
              <td className={`p-3 text-right ${totais.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totais.lucroBruto)}
              </td>
              <td className={`p-3 text-right ${margemTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {margemTotal.toFixed(2)}%
              </td>
              <td></td>
            </tr>
          </tfoot>
        </table>
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">DRE - Demonstrativo de Resultados</h1>
            <p className="text-muted-foreground flex items-center gap-2">
              <Server className="h-4 w-4" />
              Cálculo PEPS processado no servidor com memória de cálculo persistida
            </p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {/* Filtro de Posto */}
              <div className="space-y-2">
                <Label>Posto</Label>
                <Select value={postoFiltro} onValueChange={setPostoFiltro}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o posto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Postos</SelectItem>
                    {postos?.map(posto => (
                      <SelectItem key={`posto-select-${posto.id}`} value={posto.id.toString()}>
                        {posto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tipo de Filtro */}
              <div className="space-y-2">
                <Label>Tipo de Período</Label>
                <Select value={tipoFiltro} onValueChange={(v) => setTipoFiltro(v as "dia" | "periodo")}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dia">Dia Específico</SelectItem>
                    <SelectItem value="periodo">Período</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Data */}
              {renderDateFilter()}
            </div>
          </CardContent>
        </Card>

        {/* Cards de Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4" />
                Litros Vendidos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{formatNumber(totais.quantidadeVendida)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                Receita Bruta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(totais.receitaBruta)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                CMV (PEPS)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-600">{formatCurrency(totais.cmv)}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Lucro Bruto
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${totais.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(totais.lucroBruto)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Percent className="h-4 w-4" />
                Margem Bruta
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className={`text-2xl font-bold ${margemTotal >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {margemTotal.toFixed(2)}%
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Tabela DRE por Produto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5" />
              DRE por Combustível
              {isLoading ? <Badge variant="outline">Carregando...</Badge> : null}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {renderTableContent()}
          </CardContent>
        </Card>

        {/* Explicação do Método PEPS */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Sobre o Método PEPS (FIFO)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>PEPS (Primeiro que Entra, Primeiro que Sai)</strong> é o método de custeio 
                que considera que os primeiros lotes comprados são os primeiros a serem vendidos.
              </p>
              <p>
                <strong>Cálculo no Backend:</strong> O CMV é calculado automaticamente no servidor 
                quando as vendas são sincronizadas do ACS. Cada venda tem seu CMV persistido no banco 
                de dados, garantindo consistência e auditabilidade.
              </p>
              <p>
                <strong>Memória de Cálculo:</strong> Clique no ícone de calculadora para ver 
                exatamente quais lotes foram consumidos para cada combustível, com a ordem PEPS 
                e os custos detalhados.
              </p>
              <p>
                <strong>Inicialização Mensal:</strong> Administradores podem definir saldos iniciais 
                e ordem de consumo dos lotes no início de cada mês através do menu "Inicialização Mensal".
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
