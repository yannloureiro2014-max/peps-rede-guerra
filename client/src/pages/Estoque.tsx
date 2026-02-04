import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Fuel, AlertTriangle } from "lucide-react";
import { useState } from "react";

function formatNumber(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

export default function Estoque() {
  const [postoFiltro, setPostoFiltro] = useState<string>("todos");
  const { data: postos } = trpc.postos.list.useQuery();
  const { data: tanques, isLoading } = trpc.tanques.list.useQuery();
  const { data: lotes } = trpc.lotes.listAtivos.useQuery();

  // Calcular estoque por tanque baseado nos lotes ativos
  const estoquesPorTanque = new Map<number, number>();
  lotes?.forEach(lote => {
    const atual = estoquesPorTanque.get(lote.tanqueId) || 0;
    estoquesPorTanque.set(lote.tanqueId, atual + parseFloat(lote.quantidadeDisponivel || '0'));
  });

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
            <p className="text-muted-foreground">Visualização do estoque escritural de cada tanque</p>
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

        {/* Tanques por Posto */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : Object.keys(tanquesPorPosto).length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              Nenhum tanque encontrado. Cadastre tanques na seção de Postos.
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
                  const capacidade = parseFloat(tanque.capacidade || '0');
                  const estoque = estoquesPorTanque.get(tanque.id) || 0;
                  const estoqueMinimo = parseFloat(tanque.estoqueMinimo || '1000');
                  const ocupacao = capacidade > 0 ? (estoque / capacidade) * 100 : 0;
                  const estoqueBaixo = estoque < estoqueMinimo;

                  return (
                    <Card key={tanque.id} className={estoqueBaixo ? 'border-orange-300 bg-orange-50/50' : ''}>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center justify-between">
                          <span>Tanque {tanque.codigoAcs}</span>
                          {estoqueBaixo && (
                            <AlertTriangle className="h-4 w-4 text-orange-500" />
                          )}
                        </CardTitle>
                        <p className="text-xs text-muted-foreground">{tanque.produtoDescricao}</p>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Estoque</span>
                          <span className="font-semibold">{formatNumber(estoque)} L</span>
                        </div>
                        <Progress 
                          value={Math.min(ocupacao, 100)} 
                          className={`h-2 ${estoqueBaixo ? '[&>div]:bg-orange-500' : ''}`}
                        />
                        <div className="flex justify-between text-xs text-muted-foreground">
                          <span>Capacidade: {formatNumber(capacidade)} L</span>
                          <span>{ocupacao.toFixed(1)}%</span>
                        </div>
                        {estoqueBaixo && (
                          <p className="text-xs text-orange-600 font-medium">
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
