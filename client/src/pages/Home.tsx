import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trpc } from "@/lib/trpc";
import { Fuel, DollarSign, Building2, Gauge, TrendingUp, TrendingDown } from "lucide-react";
import { useMemo } from "react";

const COLORS = ['#2563eb', '#16a34a', '#eab308', '#ea580c', '#dc2626', '#8b5cf6', '#06b6d4'];

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

// Gráfico de barras horizontais usando CSS puro
function VendasPorPostoChart({ data }: { data: Array<{ nome: string; litros: number; valor: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        Sem dados disponíveis
      </div>
    );
  }

  const maxLitros = Math.max(...data.map(d => d.litros));

  return (
    <div className="space-y-3">
      {data.map((item, itemIndex) => (
        <div key={`posto-chart-${item.nome}`} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span className="font-medium truncate max-w-[150px]">{item.nome}</span>
            <span className="text-muted-foreground">{formatNumber(item.litros)} L</span>
          </div>
          <div className="h-6 bg-gray-100 rounded-full overflow-hidden">
            <div 
              className="h-full rounded-full transition-all duration-500"
              style={{ 
                width: `${(item.litros / maxLitros) * 100}%`,
                backgroundColor: COLORS[itemIndex % COLORS.length]
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

// Gráfico de pizza usando CSS puro (conic-gradient)
function DistribuicaoCombustivelChart({ data }: { data: Array<{ nome: string; litros: number }> }) {
  if (!data || data.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-muted-foreground">
        Sem dados disponíveis
      </div>
    );
  }

  const total = data.reduce((acc, item) => acc + item.litros, 0);
  
  // Calcular gradiente cônico
  let currentAngle = 0;
  const gradientParts: string[] = [];
  const legendItems: Array<{ nome: string; percent: number; color: string }> = [];
  
  data.forEach((item, index) => {
    const percent = (item.litros / total) * 100;
    const color = COLORS[index % COLORS.length];
    const startAngle = currentAngle;
    currentAngle += percent * 3.6; // 360 graus / 100%
    
    gradientParts.push(`${color} ${startAngle}deg ${currentAngle}deg`);
    legendItems.push({ nome: item.nome, percent, color });
  });

  const gradient = `conic-gradient(${gradientParts.join(', ')})`;

  return (
    <div className="flex flex-col items-center gap-4">
      <div 
        className="w-48 h-48 rounded-full shadow-inner"
        style={{ background: gradient }}
      />
      <div className="grid grid-cols-2 gap-2 w-full">
        {legendItems.map((item) => (
          <div key={item.nome} className="flex items-center gap-2 text-xs">
            <div 
              className="w-3 h-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: item.color }}
            />
            <span className="truncate">{item.nome}</span>
            <span className="text-muted-foreground ml-auto">{item.percent.toFixed(0)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Home() {
  const { data: stats, isLoading: loadingStats } = trpc.dashboard.stats.useQuery();
  const { data: vendasPorPosto, isLoading: loadingPosto } = trpc.vendas.porPosto.useQuery({ dias: 30 });
  const { data: vendasPorCombustivel, isLoading: loadingComb } = trpc.vendas.porCombustivel.useQuery({ dias: 30 });
  const { data: ultimaSync } = trpc.dashboard.ultimaSincronizacao.useQuery();
  const { data: alertas } = trpc.alertas.pendentes.useQuery();

  const chartDataPosto = useMemo(() => {
    if (!vendasPorPosto) return [];
    return vendasPorPosto.map(item => ({
      nome: item.postoNome?.replace('POSTO ', '').replace('REDE ', '') || 'N/A',
      litros: parseFloat(item.totalLitros || '0'),
      valor: parseFloat(item.totalValor || '0'),
    })).sort((a, b) => b.litros - a.litros);
  }, [vendasPorPosto]);

  const chartDataCombustivel = useMemo(() => {
    if (!vendasPorCombustivel) return [];
    return vendasPorCombustivel.map(item => ({
      nome: item.produtoDescricao?.replace('OLEO ', '').replace(' HIDRATADO', '').replace(' COMUM', '') || 'N/A',
      litros: parseFloat(item.totalLitros || '0'),
    })).sort((a, b) => b.litros - a.litros);
  }, [vendasPorCombustivel]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
            <p className="text-muted-foreground">Visão geral da rede de postos</p>
          </div>
          {ultimaSync && (
            <div className="text-sm text-muted-foreground bg-card px-4 py-2 rounded-lg border">
              Última sincronização: {new Date(ultimaSync.createdAt).toLocaleString('pt-BR')}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Litros Vendidos (30d)
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
                Faturamento (30d)
              </CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {loadingStats ? '...' : formatCurrency(stats?.totalValor)}
              </div>
              <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                Últimos 30 dias
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
                Rede Guerra
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

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Vendas por Posto */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Vendas por Posto (30 dias)</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingPosto ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <VendasPorPostoChart data={chartDataPosto} />
              )}
            </CardContent>
          </Card>

          {/* Vendas por Combustível */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Distribuição por Combustível</CardTitle>
            </CardHeader>
            <CardContent>
              {loadingComb ? (
                <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                  Carregando...
                </div>
              ) : (
                <DistribuicaoCombustivelChart data={chartDataCombustivel} />
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
