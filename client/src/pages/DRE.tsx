import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { DollarSign, TrendingUp, TrendingDown, Percent, Package, Calculator } from "lucide-react";
import { useState, useMemo } from "react";

function formatNumber(value: number): string {
  return new Intl.NumberFormat('pt-BR').format(value);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

interface LoteConsumo {
  loteId: number;
  nf: string;
  dataCompra: Date;
  custoUnitario: number;
  quantidadeConsumida: number;
  custoTotal: number;
  ordem: number;
}

interface DREPorProduto {
  produtoId: number;
  produtoNome: string;
  quantidadeVendida: number;
  receitaBruta: number;
  cmv: number;
  lucroBruto: number;
  margemBruta: number;
  lotesConsumidos: LoteConsumo[];
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

  const { data: produtos } = trpc.produtos.list.useQuery();

  const { data: vendas } = trpc.vendas.list.useQuery({
    postoId: postoFiltro !== "todos" ? parseInt(postoFiltro) : undefined,
    dataInicio: periodoInicio,
    dataFim: periodoFim,
  });

  const { data: lotes } = trpc.lotes.list.useQuery({
    postoId: postoFiltro !== "todos" ? parseInt(postoFiltro) : undefined,
  });

  // Criar mapa de produto por descrição
  const produtosPorDescricao = useMemo(() => {
    const mapa = new Map<string, number>();
    produtos?.forEach(p => {
      if (p.descricao) mapa.set(p.descricao, p.id);
    });
    return mapa;
  }, [produtos]);

  // Calcular DRE com método PEPS
  const drePorProduto = useMemo(() => {
    if (!vendas || !lotes || !produtos) return [];

    const resultado: DREPorProduto[] = [];

    // Agrupar vendas por produto
    // Agrupar vendas por produto (usando descrição já que não temos produtoId direto)
    const vendasPorProduto = new Map<number, typeof vendas>();
    vendas.forEach(venda => {
      const produtoId = produtosPorDescricao.get(venda.produtoDescricao || '') || 0;
      if (!vendasPorProduto.has(produtoId)) {
        vendasPorProduto.set(produtoId, []);
      }
      vendasPorProduto.get(produtoId)!.push(venda);
    });

    // Para cada produto, calcular DRE com PEPS
    vendasPorProduto.forEach((vendasDoProduto, produtoId) => {
      const produto = produtos.find(p => p.id === produtoId);
      if (!produto) return;

      // Lotes do produto ordenados por data (PEPS - primeiro que entra, primeiro que sai)
      const lotesDisponiveis = lotes
        .filter(l => l.produtoId === produtoId)
        .map(l => ({
          ...l,
          quantidadeRestante: parseFloat(l.quantidadeDisponivel || '0'),
          custoUnitario: parseFloat(l.custoUnitario || '0'),
        }))
        .sort((a, b) => new Date(a.dataEntrada).getTime() - new Date(b.dataEntrada).getTime());

      // Calcular receita bruta
      const quantidadeVendida = vendasDoProduto.reduce(
        (sum, v) => sum + parseFloat(v.quantidade || '0'), 0
      );
      const receitaBruta = vendasDoProduto.reduce(
        (sum, v) => sum + parseFloat(v.valorTotal || '0'), 0
      );

      // Calcular CMV pelo método PEPS
      let cmv = 0;
      let quantidadeRestante = quantidadeVendida;
      const lotesConsumidos: LoteConsumo[] = [];
      let ordem = 1;

      for (const lote of lotesDisponiveis) {
        if (quantidadeRestante <= 0) break;
        if (lote.quantidadeRestante <= 0) continue;

        const quantidadeConsumida = Math.min(quantidadeRestante, lote.quantidadeRestante);
        const custoTotal = quantidadeConsumida * lote.custoUnitario;
        
        cmv += custoTotal;
        quantidadeRestante -= quantidadeConsumida;

        lotesConsumidos.push({
          loteId: lote.id,
          nf: lote.numeroNf || `Lote ${lote.id}`,
          dataCompra: new Date(lote.dataEntrada),
          custoUnitario: lote.custoUnitario,
          quantidadeConsumida,
          custoTotal,
          ordem: ordem++,
        });
      }

      const lucroBruto = receitaBruta - cmv;
      const margemBruta = receitaBruta > 0 ? (lucroBruto / receitaBruta) * 100 : 0;

      resultado.push({
        produtoId,
        produtoNome: produto.descricao || `Produto ${produtoId}`,
        quantidadeVendida,
        receitaBruta,
        cmv,
        lucroBruto,
        margemBruta,
        lotesConsumidos,
      });
    });

    return resultado.sort((a, b) => b.receitaBruta - a.receitaBruta);
  }, [vendas, lotes, produtos]);

  // Totais gerais
  const totais = useMemo(() => {
    return drePorProduto.reduce(
      (acc, item) => ({
        quantidadeVendida: acc.quantidadeVendida + item.quantidadeVendida,
        receitaBruta: acc.receitaBruta + item.receitaBruta,
        cmv: acc.cmv + item.cmv,
        lucroBruto: acc.lucroBruto + item.lucroBruto,
      }),
      { quantidadeVendida: 0, receitaBruta: 0, cmv: 0, lucroBruto: 0 }
    );
  }, [drePorProduto]);

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

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">DRE - Demonstrativo de Resultados</h1>
          <p className="text-muted-foreground">Análise de receitas, custos e margens com cálculo PEPS</p>
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
                      <SelectItem key={posto.id} value={posto.id.toString()}>
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
              {tipoFiltro === "dia" ? (
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
              ) : (
                <>
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
                </>
              )}
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
              <p className="text-2xl font-bold">{formatNumber(totais.quantidadeVendida)} L</p>
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
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(totais.receitaBruta)}</p>
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
            </CardTitle>
          </CardHeader>
          <CardContent>
            {drePorProduto.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma venda encontrada no período selecionado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-semibold">Combustível</th>
                      <th className="text-right p-3 font-semibold">Qtd (L)</th>
                      <th className="text-right p-3 font-semibold">Receita Bruta</th>
                      <th className="text-right p-3 font-semibold">CMV (PEPS)</th>
                      <th className="text-right p-3 font-semibold">Lucro Bruto</th>
                      <th className="text-right p-3 font-semibold">Margem</th>
                      <th className="text-center p-3 font-semibold">Memória</th>
                    </tr>
                  </thead>
                  <tbody>
                    {drePorProduto.map((item) => (
                      <>
                        <tr key={item.produtoId} className="border-b hover:bg-muted/30">
                          <td className="p-3 font-medium">{item.produtoNome}</td>
                          <td className="p-3 text-right">{formatNumber(item.quantidadeVendida)}</td>
                          <td className="p-3 text-right text-blue-600">{formatCurrency(item.receitaBruta)}</td>
                          <td className="p-3 text-right text-red-600">{formatCurrency(item.cmv)}</td>
                          <td className={`p-3 text-right font-semibold ${item.lucroBruto >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {formatCurrency(item.lucroBruto)}
                          </td>
                          <td className={`p-3 text-right ${item.margemBruta >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                            {item.margemBruta.toFixed(2)}%
                          </td>
                          <td className="p-3 text-center">
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => setMostrarMemoria(
                                mostrarMemoria === item.produtoId ? null : item.produtoId
                              )}
                            >
                              {mostrarMemoria === item.produtoId ? 'Ocultar' : 'Ver Lotes'}
                            </Button>
                          </td>
                        </tr>
                        {/* Memória de Cálculo */}
                        {mostrarMemoria === item.produtoId && item.lotesConsumidos.length > 0 && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-blue-50 p-4 border-l-4 border-blue-500">
                                <h4 className="font-semibold text-blue-800 mb-3">
                                  Memória de Cálculo PEPS - {item.produtoNome}
                                </h4>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-blue-200">
                                      <th className="text-left p-2">Ordem</th>
                                      <th className="text-left p-2">NF/Lote</th>
                                      <th className="text-left p-2">Data Compra</th>
                                      <th className="text-right p-2">Custo Unit.</th>
                                      <th className="text-right p-2">Qtd Consumida</th>
                                      <th className="text-right p-2">Custo Total</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {item.lotesConsumidos.map((lote) => (
                                      <tr key={lote.loteId} className="border-b border-blue-100">
                                        <td className="p-2">{lote.ordem}º</td>
                                        <td className="p-2 font-medium">{lote.nf}</td>
                                        <td className="p-2">{formatDate(lote.dataCompra)}</td>
                                        <td className="p-2 text-right">{formatCurrency(lote.custoUnitario)}</td>
                                        <td className="p-2 text-right">{formatNumber(lote.quantidadeConsumida)} L</td>
                                        <td className="p-2 text-right font-semibold">{formatCurrency(lote.custoTotal)}</td>
                                      </tr>
                                    ))}
                                    <tr className="bg-blue-100 font-bold">
                                      <td colSpan={4} className="p-2 text-right">Total CMV:</td>
                                      <td className="p-2 text-right">{formatNumber(item.quantidadeVendida)} L</td>
                                      <td className="p-2 text-right">{formatCurrency(item.cmv)}</td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                        {mostrarMemoria === item.produtoId && item.lotesConsumidos.length === 0 && (
                          <tr>
                            <td colSpan={7} className="p-0">
                              <div className="bg-yellow-50 p-4 border-l-4 border-yellow-500">
                                <p className="text-yellow-800">
                                  Nenhum lote de compra encontrado para este combustível. 
                                  Cadastre as notas fiscais de compra para calcular o CMV corretamente.
                                </p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-bold">
                      <td className="p-3">TOTAL</td>
                      <td className="p-3 text-right">{formatNumber(totais.quantidadeVendida)}</td>
                      <td className="p-3 text-right text-blue-600">{formatCurrency(totais.receitaBruta)}</td>
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
            )}
          </CardContent>
        </Card>

        {/* Explicação do Método PEPS */}
        <Card className="bg-gray-50">
          <CardContent className="py-4">
            <h4 className="font-semibold mb-2">Método PEPS (Primeiro que Entra, Primeiro que Sai)</h4>
            <p className="text-sm text-muted-foreground">
              O CMV é calculado consumindo primeiro os lotes mais antigos. Isso significa que o custo das mercadorias 
              vendidas reflete o preço de compra dos combustíveis que entraram primeiro no estoque. 
              Clique em "Ver Lotes" para visualizar a memória de cálculo detalhada de cada combustível.
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
