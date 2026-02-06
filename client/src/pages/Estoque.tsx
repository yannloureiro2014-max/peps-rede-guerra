import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Fuel, AlertTriangle, TrendingDown, Calendar } from "lucide-react";
import { useState, useMemo } from "react";

function formatNumber(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return '-';
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export default function Estoque() {
  const [postoFiltro, setPostoFiltro] = useState<string>("todos");
  const { data: postos } = trpc.postos.list.useQuery();
  const { data: tanques, isLoading } = trpc.tanques.list.useQuery();
  const { data: medicoes } = trpc.medicoes.list.useQuery({ limite: 500 });
  
  // Buscar vendas do dia para calcular estoque atual
  const hoje = useMemo(() => new Date().toISOString().split('T')[0], []);
  const { data: vendasHoje } = trpc.vendas.list.useQuery({ 
    dataInicio: hoje, 
    dataFim: hoje
  });

  // Calcular estoque por tanque baseado na última medição física - vendas do dia
  const estoquesPorTanque = useMemo(() => {
    const estoques = new Map<number, { 
      medicaoFisica: number; 
      vendasDia: number; 
      estoqueAtual: number;
      dataMedicao: Date | null;
    }>();

    // Encontrar última medição de cada tanque
    tanques?.forEach(tanque => {
      const medicoesDoTanque = medicoes?.filter(m => m.tanqueId === tanque.id) || [];
      const ultimaMedicao = medicoesDoTanque.sort((a, b) => 
        new Date(b.dataMedicao).getTime() - new Date(a.dataMedicao).getTime()
      )[0];

      const medicaoFisica = ultimaMedicao ? parseFloat(ultimaMedicao.volumeMedido || '0') : 0;
      const dataMedicao = ultimaMedicao ? new Date(ultimaMedicao.dataMedicao) : null;

      // Somar vendas do dia para este tanque
      // Filtrar vendas pelo código do tanque
      const vendasDoTanque = vendasHoje?.filter(v => v.tanqueCodigo === tanque.codigoAcs) || [];
      const vendasDia = vendasDoTanque.reduce((sum, v) => sum + parseFloat(v.quantidade || '0'), 0);

      // Estoque atual = medição física - vendas do dia
      // Limitar ao máximo da capacidade do tanque
      const capacidade = parseFloat(tanque.capacidade || '10000');
      let estoqueAtual = medicaoFisica - vendasDia;
      
      // Garantir que não ultrapasse a capacidade nem fique negativo
      estoqueAtual = Math.max(0, Math.min(estoqueAtual, capacidade));

      estoques.set(tanque.id, {
        medicaoFisica,
        vendasDia,
        estoqueAtual,
        dataMedicao
      });
    });

    return estoques;
  }, [tanques, medicoes, vendasHoje]);

  const tanquesFiltrados = tanques?.filter(t => 
    postoFiltro === "todos" || t.postoId === parseInt(postoFiltro)
  ) || [];

  // Agrupar por posto
  const tanquesPorPosto = tanquesFiltrados.reduce((acc, tanque) => {
    const postoNome = tanque.postoNome || 'Sem Posto';
    if (!acc[postoNome]) acc[postoNome] = [];
    acc[postoNome].push(tanque);
    return acc;
  }, {} as Record<string, typeof tanquesFiltrados>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estoque por Tanque</h1>
            <p className="text-muted-foreground">
              Estoque baseado na medição física - vendas do dia
            </p>
          </div>
          <Select value={postoFiltro} onValueChange={setPostoFiltro}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filtrar por posto" />
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

        {/* Legenda */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <p className="text-sm text-blue-800">
              <strong>Cálculo do Estoque:</strong> Medição Física (abertura do dia) - Vendas realizadas hoje = Estoque Atual
            </p>
          </CardContent>
        </Card>

        {/* Tanques por Posto */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : Object.keys(tanquesPorPosto).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum tanque encontrado. Sincronize com o ACS na seção de Configurações.
            </CardContent>
          </Card>
        ) : (
          Object.entries(tanquesPorPosto).map(([postoNome, tanquesDoPost]) => (
            <div key={postoNome} className="space-y-4">
              <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
                <Fuel className="h-5 w-5 text-primary" />
                {postoNome}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {tanquesDoPost.map(tanque => {
                  const capacidade = parseFloat(tanque.capacidade || '10000');
                  const estoqueMinimo = parseFloat(tanque.estoqueMinimo || '1000');
                  const dados = estoquesPorTanque.get(tanque.id);
                  const estoqueAtual = dados?.estoqueAtual || 0;
                  const medicaoFisica = dados?.medicaoFisica || 0;
                  const vendasDia = dados?.vendasDia || 0;
                  const dataMedicao = dados?.dataMedicao;
                  
                  const ocupacao = capacidade > 0 ? (estoqueAtual / capacidade) * 100 : 0;
                  const estoqueBaixo = estoqueAtual < estoqueMinimo;
                  const semMedicao = !dataMedicao;

                  return (
                    <Card key={tanque.id} className={
                      semMedicao ? 'border-yellow-300 bg-yellow-50/50' :
                      estoqueBaixo ? 'border-orange-300 bg-orange-50/50' : ''
                    }>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span>Tanque {tanque.codigoAcs}</span>
                          {estoqueBaixo && !semMedicao && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                          {semMedicao && (
                            <Calendar className="h-4 w-4 text-yellow-500" />
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{tanque.produtoDescricao}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {/* Estoque Atual */}
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Estoque Atual</span>
                          <span className="font-bold text-lg">{formatNumber(estoqueAtual)} L</span>
                        </div>
                        
                        <Progress 
                          value={Math.min(ocupacao, 100)} 
                          className={`h-3 ${
                            semMedicao ? '[&>div]:bg-yellow-500' :
                            estoqueBaixo ? '[&>div]:bg-orange-500' : ''
                          }`}
                        />
                        
                        {/* Detalhes do cálculo */}
                        <div className="text-xs space-y-1 pt-2 border-t">
                          <div className="flex justify-between text-muted-foreground">
                            <span>Medição Física:</span>
                            <span>{formatNumber(medicaoFisica)} L</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Vendas Hoje:
                            </span>
                            <span className="text-red-600">-{formatNumber(vendasDia)} L</span>
                          </div>
                          <div className="flex justify-between text-muted-foreground">
                            <span>Capacidade:</span>
                            <span>{formatNumber(capacidade)} L ({ocupacao.toFixed(1)}%)</span>
                          </div>
                          {dataMedicao && (
                            <div className="flex justify-between text-muted-foreground">
                              <span>Última Medição:</span>
                              <span>{formatDate(dataMedicao)}</span>
                            </div>
                          )}
                        </div>

                        {/* Alertas */}
                        {semMedicao && (
                          <p className="text-xs text-yellow-600 font-medium bg-yellow-100 p-2 rounded">
                            Sem medição física registrada
                          </p>
                        )}
                        {estoqueBaixo && !semMedicao && (
                          <p className="text-xs text-orange-600 font-medium bg-orange-100 p-2 rounded">
                            Abaixo do mínimo ({formatNumber(estoqueMinimo)} L)
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </DashboardLayout>
  );
}
