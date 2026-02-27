import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Fuel, DollarSign, Building2, Gauge, TrendingUp, TrendingDown, Calendar } from "lucide-react";
import { useMemo, useState } from "react";

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#ea580c', '#dc2626', '#8b5cf6', '#06b6d4', '#f43f5e', '#14b8a6', '#a855f7'];

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

function formatDateBR(dateStr: string): string {
  const [y, m, d] = dateStr.split('-');
  return `${d}/${m}/${y}`;
}

function getDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Gráfico de barras horizontais usando CSS puro
function BarChart({ data, formatFn, colorOffset = 0 }: { 
  data: Array<{ nome: string; valor: number }>; 
  formatFn: (v: number) => string;
  colorOffset?: number;
}) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        Sem dados disponíveis
      </div>
    );
  }

  const maxVal = Math.max(...data.map(d => Math.abs(d.valor)));

  return (
    <div className="space-y-2.5">
      {data.map((item, idx) => (
        <div key={`bar-${item.nome}-${idx}`} className="space-y-0.5">
          <div className="flex justify-between text-sm">
            <span className="font-medium truncate max-w-[180px]">{item.nome}</span>
            <span className="text-muted-foreground font-mono text-xs">{formatFn(item.valor)}</span>
          </div>
          <div className="h-5 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${maxVal > 0 ? (Math.abs(item.valor) / maxVal) * 100 : 0}%`,
                backgroundColor: item.valor < 0 ? '#ef4444' : COLORS[(idx + colorOffset) % COLORS.length],
                minWidth: item.valor !== 0 ? '4px' : '0'
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Gráfico de pizza usando CSS puro (conic-gradient)
function PieChart({ data, formatFn }: { data: Array<{ nome: string; valor: number }>; formatFn: (v: number) => string }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
        Sem dados disponíveis
      </div>
    );
  }

  const total = data.reduce((acc, item) => acc + Math.abs(item.valor), 0);
  
  let currentAngle = 0;
  const gradientParts: string[] = [];
  const legendItems: Array<{ nome: string; percent: number; color: string; valor: number }> = [];
  
  data.forEach((item, index) => {
    const percent = total > 0 ? (Math.abs(item.valor) / total) * 100 : 0;
    const color = COLORS[index % COLORS.length];
    const startAngle = currentAngle;
    currentAngle += percent * 3.6;
    
    gradientParts.push(`${color} ${startAngle}deg ${currentAngle}deg`);
    legendItems.push({ nome: item.nome, percent, color, valor: item.valor });
  });

  const gradient = `conic-gradient(${gradientParts.join(', ')})`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className="w-44 h-44 rounded-full shadow-inner"
        style={{ background: gradient }}
      />
      <div className="grid grid-cols-1 gap-1.5 w-full">
        {legendItems.map((item) => (
          <div key={item.nome} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate flex-1">{item.nome}</span>
            <span className="text-muted-foreground font-mono">{formatFn(item.valor)}</span>
            <span className="text-muted-foreground w-10 text-right">{item.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Atalhos de período
const ATALHOS = [
  { label: 'Hoje', getDates: () => { const d = new Date(); return { inicio: getDateStr(d), fim: getDateStr(d) }; } },
  { label: 'Ontem', getDates: () => { const d = new Date(); d.setDate(d.getDate() - 1); return { inicio: getDateStr(d), fim: getDateStr(d) }; } },
  { label: '7 dias', getDates: () => { const f = new Date(); const i = new Date(); i.setDate(i.getDate() - 6); return { inicio: getDateStr(i), fim: getDateStr(f) }; } },
  { label: '15 dias', getDates: () => { const f = new Date(); const i = new Date(); i.setDate(i.getDate() - 14); return { inicio: getDateStr(i), fim: getDateStr(f) }; } },
  { label: '30 dias', getDates: () => { const f = new Date(); const i = new Date(); i.setDate(i.getDate() - 29); return { inicio: getDateStr(i), fim: getDateStr(f) }; } },
  { label: '60 dias', getDates: () => { const f = new Date(); const i = new Date(); i.setDate(i.getDate() - 59); return { inicio: getDateStr(i), fim: getDateStr(f) }; } },
  { label: 'Mês Atual', getDates: () => { const d = new Date(); return { inicio: `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`, fim: getDateStr(d) }; } },
  { label: 'Mês Anterior', getDates: () => { 
    const d = new Date(); 
    d.setMonth(d.getMonth() - 1);
    const inicio = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;
    const lastDay = new Date(d.getFullYear(), d.getMonth()+1, 0);
    return { inicio, fim: getDateStr(lastDay) }; 
  }},
];

export default function Home() {
  // Filtros de data - padrão: últimos 30 dias
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return getDateStr(d);
  });
  const [dataFim, setDataFim] = useState(() => getDateStr(new Date()));
  const [postoId, setPostoId] = useState<number | undefined>(undefined);

  // Buscar lista de postos para o filtro
  const { data: postosLista } = trpc.postos.list.useQuery();

  const dateParams = useMemo(() => ({ 
    dataInicio, 
    dataFim, 
    postoId 
  }), [dataInicio, dataFim, postoId]);

  const { data: stats, isLoading: loadingStats } = trpc.dashboard.stats.useQuery(dateParams);
  const { data: vendasPorPosto, isLoading: loadingPosto } = trpc.vendas.porPosto.useQuery(dateParams);
  const { data: vendasPorCombustivel, isLoading: loadingComb } = trpc.vendas.porCombustivel.useQuery(dateParams);
  const { data: lucroPorPosto, isLoading: loadingLucroPosto } = trpc.vendas.lucroBrutoPorPosto.useQuery(dateParams);
  const { data: lucroPorCombustivel, isLoading: loadingLucroComb } = trpc.vendas.lucroBrutoPorCombustivel.useQuery(dateParams);
  const { data: ultimaSync } = trpc.dashboard.ultimaSincronizacao.useQuery();
  const { data: alertas } = trpc.alertas.pendentes.useQuery();

  const chartVendasPosto = useMemo(() => {
    if (!vendasPorPosto) return [];
    return vendasPorPosto.map(item => ({
      nome: item.postoNome?.replace('POSTO ', '').replace('REDE ', '') || 'N/A',
      valor: parseFloat(item.totalLitros || '0'),
    })).sort((a, b) => b.valor - a.valor);
  }, [vendasPorPosto]);

  const chartVendasCombustivel = useMemo(() => {
    if (!vendasPorCombustivel) return [];
    return vendasPorCombustivel.map(item => ({
      nome: item.produtoDescricao?.replace('OLEO ', '').replace(' HIDRATADO', '').replace(' COMUM', '') || 'N/A',
      valor: parseFloat(item.totalLitros || '0'),
    })).sort((a, b) => b.valor - a.valor);
  }, [vendasPorCombustivel]);

  const chartLucroPosto = useMemo(() => {
    if (!lucroPorPosto) return [];
    return lucroPorPosto.map(item => ({
      nome: item.postoNome?.replace('POSTO ', '').replace('REDE ', '') || 'N/A',
      valor: parseFloat(item.lucroBruto || '0'),
    })).sort((a, b) => b.valor - a.valor);
  }, [lucroPorPosto]);

  const chartLucroCombustivel = useMemo(() => {
    if (!lucroPorCombustivel) return [];
    return lucroPorCombustivel.map(item => ({
      nome: item.produtoDescricao?.replace('OLEO ', '').replace(' HIDRATADO', '').replace(' COMUM', '') || 'N/A',
      valor: parseFloat(item.lucroBruto || '0'),
    })).sort((a, b) => b.valor - a.valor);
  }, [lucroPorCombustivel]);

  const totalLucroBruto = useMemo(() => {
    if (!lucroPorPosto) return 0;
    return lucroPorPosto.reduce((acc, item) => acc + parseFloat(item.lucroBruto || '0'), 0);
  }, [lucroPorPosto]);

  const totalReceita = useMemo(() => {
    if (!lucroPorPosto) return 0;
    return lucroPorPosto.reduce((acc, item) => acc + parseFloat(item.totalValor || '0'), 0);
  }, [lucroPorPosto]);

  const margemBruta = totalReceita > 0 ? (totalLucroBruto / totalReceita) * 100 : 0;

  const postoSelecionadoNome = useMemo(() => {
    if (!postoId || !postosLista) return "Todos os Postos";
    const p = postosLista.find(p => p.id === postoId);
    return p?.nome || "Todos os Postos";
  }, [postoId, postosLista]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <img src="/logo-rede-super.png" alt="Rede Super Petróleo" className="h-12 w-auto" />
            <div>
              <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground">Visão geral da rede de postos</p>
            </div>
          </div>
          {ultimaSync && (
            <div className="text-sm text-muted-foreground bg-card px-4 py-2 rounded-lg border">
              Última sincronização: {new Date(ultimaSync.createdAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* Filtros de Data e Posto */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-col gap-4">
              <div className="flex flex-col md:flex-row md:items-end gap-4">
                {/* Filtro de Posto */}
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    <Building2 className="h-3.5 w-3.5 inline mr-1" />
                    Posto
                  </label>
                  <Select
                    value={postoId ? String(postoId) : "all"}
                    onValueChange={(val) => setPostoId(val === "all" ? undefined : Number(val))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Todos os Postos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">REDE GUERRA DE POSTOS</SelectItem>
                      {postosLista?.filter(p => p.ativo).map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    <Calendar className="h-3.5 w-3.5 inline mr-1" />
                    Data Inicial
                  </label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm font-medium text-muted-foreground mb-1 block">
                    <Calendar className="h-3.5 w-3.5 inline mr-1" />
                    Data Final
                  </label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full border rounded-md px-3 py-2 text-sm bg-background"
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="text-sm text-muted-foreground self-center mr-1">Atalhos:</span>
                {ATALHOS.map(a => (
                  <Button
                    key={a.label}
                    variant="outline"
                    size="sm"
                    className="text-xs h-7"
                    onClick={() => {
                      const { inicio, fim } = a.getDates();
                      setDataInicio(inicio);
                      setDataFim(fim);
                    }}
                  >
                    {a.label}
                  </Button>
                ))}
              </div>
              <div className="text-sm text-muted-foreground">
                Período: {formatDateBR(dataInicio)} a {formatDateBR(dataFim)}
                {postoId && <span className="ml-2 font-medium text-foreground">| {postoSelecionadoNome}</span>}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Litros Vendidos
              </CardTitle>
              <Fuel className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? '...' : formatNumber(stats?.totalLitros)} L
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {stats?.totalRegistros || 0} registros
              </p>
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
              <div className="text-2xl font-bold">
                {loadingStats ? '...' : formatCurrency(stats?.totalValor)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Lucro Bruto
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-600" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${totalLucroBruto >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {loadingLucroPosto ? '...' : formatCurrency(totalLucroBruto)}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Margem: {margemBruta.toFixed(1)}%
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Postos Ativos
              </CardTitle>
              <Building2 className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? '...' : stats?.totalPostos || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Rede Guerra de Postos
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Tanques
              </CardTitle>
              <Gauge className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? '...' : stats?.totalTanques || 0}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Em operação
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Alertas pendentes */}
        {alertas && alertas.length > 0 && (
          <Card className="border-orange-200 bg-orange-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-800 flex items-center gap-2">
                <TrendingDown className="h-4 w-4" />
                {alertas.length} Alerta(s) Pendente(s)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {alertas.slice(0, 3).map(alerta => (
                  <li key={alerta.id} className="text-sm text-orange-700">
                    • {alerta.titulo}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Vendas Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendas por Posto (Litros)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPosto ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Carregando...</div>
              ) : (
                <BarChart data={chartVendasPosto} formatFn={(v) => formatNumber(v) + ' L'} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Combustível (Litros)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingComb ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Carregando...</div>
              ) : (
                <PieChart data={chartVendasCombustivel} formatFn={(v) => formatNumber(v) + ' L'} />
              )}
            </CardContent>
          </Card>
        </div>

        {/* Lucro Bruto Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Lucro Bruto por Posto
                <span className="text-xs font-normal text-muted-foreground">(Receita - CMV)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLucroPosto ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Carregando...</div>
              ) : (
                <BarChart data={chartLucroPosto} formatFn={formatCurrency} colorOffset={3} />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                Lucro Bruto por Combustível
                <span className="text-xs font-normal text-muted-foreground">(Receita - CMV)</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loadingLucroComb ? (
                <div className="h-[200px] flex items-center justify-center text-muted-foreground">Carregando...</div>
              ) : (
                <PieChart data={chartLucroCombustivel} formatFn={formatCurrency} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
