import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  RefreshCw,
  Search,
  BarChart3,
  Calendar,
  Fuel,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

export default function CoerenciaFisica() {
  // Filtros
  const [postoId, setPostoId] = useState("todos");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [statusFiltro, setStatusFiltro] = useState("todos");

  // Parâmetros de busca estabilizados
  const [searchParams, setSearchParams] = useState<{
    postoId?: number;
    dataInicio: string;
    dataFim: string;
  } | null>(null);

  // Queries
  const postosQuery = trpc.postos.list.useQuery();

  const verificacaoQuery = trpc.coerenciaTransferencias.verificarCoerenciaTodos.useQuery(
    {
      dataInicio: searchParams?.dataInicio || dataInicio,
      dataFim: searchParams?.dataFim || dataFim,
    },
    { enabled: searchParams !== null }
  );

  const medicoesAusentesQuery = trpc.coerenciaTransferencias.detectarMedicoesAusentes.useQuery(
    {
      dataInicio: searchParams?.dataInicio || dataInicio,
      dataFim: searchParams?.dataFim || dataFim,
    },
    { enabled: searchParams !== null }
  );

  const resumoQuery = trpc.coerenciaTransferencias.resumoCoerencia.useQuery(
    {
      dataInicio: searchParams?.dataInicio || dataInicio,
      dataFim: searchParams?.dataFim || dataFim,
    },
    { enabled: searchParams !== null }
  );

  // Dados processados
  const resultados = useMemo(() => {
    if (!verificacaoQuery.data?.sucesso) return [];
    const dados = verificacaoQuery.data.dados || [];
    
    if (postoId !== "todos") {
      return dados.filter((r: any) => r.postoId === parseInt(postoId));
    }
    return dados;
  }, [verificacaoQuery.data, postoId]);

  const detalhes = useMemo(() => {
    let items: any[] = [];
    for (const resultado of resultados) {
      items = items.concat(resultado.detalhes || []);
    }
    if (statusFiltro !== "todos") {
      items = items.filter((d: any) => d.statusCoerencia === statusFiltro);
    }
    return items;
  }, [resultados, statusFiltro]);

  const resumo = useMemo(() => {
    if (!resumoQuery.data?.sucesso) return [];
    return resumoQuery.data.dados || [];
  }, [resumoQuery.data]);

  const medicoesAusentes = useMemo(() => {
    if (!medicoesAusentesQuery.data?.sucesso) return [];
    const dados = medicoesAusentesQuery.data.dados || [];
    if (postoId !== "todos") {
      return dados.filter((m: any) => m.postoId === parseInt(postoId));
    }
    return dados;
  }, [medicoesAusentesQuery.data, postoId]);

  // Totais
  const totais = useMemo(() => {
    let coerentes = 0, alertas = 0, semMedicao = 0;
    for (const r of resultados) {
      coerentes += r.diasCoerentes || 0;
      alertas += r.diasAlerta || 0;
      semMedicao += r.diasSemMedicao || 0;
    }
    return { coerentes, alertas, semMedicao, total: coerentes + alertas + semMedicao };
  }, [resultados]);

  const handleBuscar = () => {
    setSearchParams({
      postoId: postoId !== "todos" ? parseInt(postoId) : undefined,
      dataInicio,
      dataFim,
    });
  };

  const isLoading = verificacaoQuery.isLoading || medicoesAusentesQuery.isLoading;

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
            Verificação de Coerência Física
          </h1>
          <p className="text-slate-500 mt-1">
            Valida se o estoque projetado (medição + compras - vendas) é coerente com a medição do dia seguinte. Tolerância: 1.000 litros.
          </p>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>Posto</Label>
                <Select value={postoId} onValueChange={setPostoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os postos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os postos</SelectItem>
                    {(postosQuery.data || []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div>
                <Label>Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <Button onClick={handleBuscar} disabled={isLoading}>
                {isLoading ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : <Search className="h-4 w-4 mr-2" />}
                Verificar Coerência
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cards de resumo */}
        {searchParams && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-100 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Total Verificações</p>
                    <p className="text-2xl font-bold">{totais.total}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Coerentes</p>
                    <p className="text-2xl font-bold text-emerald-600">{totais.coerentes}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-amber-100 rounded-lg">
                    <AlertTriangle className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Alertas</p>
                    <p className="text-2xl font-bold text-amber-600">{totais.alertas}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <HelpCircle className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-slate-500">Sem Medição</p>
                    <p className="text-2xl font-bold text-blue-600">{totais.semMedicao}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Tabs */}
        <Tabs defaultValue="resumo" className="space-y-4">
          <TabsList>
            <TabsTrigger value="resumo">Resumo por Posto</TabsTrigger>
            <TabsTrigger value="detalhes">Detalhes por Dia</TabsTrigger>
            <TabsTrigger value="ausentes">Medições Ausentes</TabsTrigger>
          </TabsList>

          {/* Resumo por Posto */}
          <TabsContent value="resumo">
            <Card>
              <CardHeader>
                <CardTitle>Resumo de Coerência por Posto</CardTitle>
                <CardDescription>Visão geral da coerência física de cada posto no período</CardDescription>
              </CardHeader>
              <CardContent>
                {!searchParams ? (
                  <p className="text-slate-500 text-center py-8">Clique em "Verificar Coerência" para iniciar a análise.</p>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                    <span className="text-slate-500">Processando verificação...</span>
                  </div>
                ) : resumo.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Nenhum dado de verificação encontrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-3 font-medium">Posto</th>
                          <th className="text-center p-3 font-medium">Total</th>
                          <th className="text-center p-3 font-medium">Coerentes</th>
                          <th className="text-center p-3 font-medium">Alertas</th>
                          <th className="text-center p-3 font-medium">Sem Medição</th>
                          <th className="text-center p-3 font-medium">% Coerência</th>
                        </tr>
                      </thead>
                      <tbody>
                        {resumo.map((r: any, i: number) => (
                          <tr key={i} className="border-b hover:bg-slate-50">
                            <td className="p-3 font-medium">{r.postoNome}</td>
                            <td className="p-3 text-center">{r.totalVerificacoes}</td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                {r.coerentes}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                {r.alertas}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                {r.semMedicao}
                              </Badge>
                            </td>
                            <td className="p-3 text-center">
                              <span className={`font-bold ${
                                r.percentualCoerencia >= 80 ? "text-emerald-600" :
                                r.percentualCoerencia >= 50 ? "text-amber-600" :
                                "text-red-600"
                              }`}>
                                {r.percentualCoerencia.toFixed(1)}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Detalhes por Dia */}
          <TabsContent value="detalhes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Detalhes de Verificação por Dia</CardTitle>
                    <CardDescription>Estoque projetado vs medição real do dia seguinte</CardDescription>
                  </div>
                  <Select value={statusFiltro} onValueChange={setStatusFiltro}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Filtrar status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos os status</SelectItem>
                      <SelectItem value="coerente">Coerentes</SelectItem>
                      <SelectItem value="alerta">Alertas</SelectItem>
                      <SelectItem value="sem_medicao">Sem Medição</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                {!searchParams ? (
                  <p className="text-slate-500 text-center py-8">Clique em "Verificar Coerência" para iniciar a análise.</p>
                ) : isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                    <span className="text-slate-500">Processando...</span>
                  </div>
                ) : detalhes.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">Nenhum detalhe encontrado.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-slate-50">
                          <th className="text-left p-2 font-medium">Data</th>
                          <th className="text-left p-2 font-medium">Posto</th>
                          <th className="text-left p-2 font-medium">Tanque</th>
                          <th className="text-left p-2 font-medium">Produto</th>
                          <th className="text-right p-2 font-medium">Medição</th>
                          <th className="text-right p-2 font-medium">+ Compras</th>
                          <th className="text-right p-2 font-medium">- Vendas</th>
                          <th className="text-right p-2 font-medium">= Projetado</th>
                          <th className="text-right p-2 font-medium">Medição D+1</th>
                          <th className="text-right p-2 font-medium">Diferença</th>
                          <th className="text-center p-2 font-medium">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detalhes.slice(0, 500).map((d: any, i: number) => (
                          <tr
                            key={i}
                            className={`border-b ${
                              d.statusCoerencia === "alerta"
                                ? "bg-amber-50"
                                : d.statusCoerencia === "sem_medicao"
                                ? "bg-blue-50"
                                : "hover:bg-slate-50"
                            }`}
                          >
                            <td className="p-2 font-mono text-xs">{d.dataVerificacao}</td>
                            <td className="p-2 text-xs">{d.postoNome}</td>
                            <td className="p-2 text-xs">{d.tanqueCodigo}</td>
                            <td className="p-2 text-xs">{d.produtoNome || "-"}</td>
                            <td className="p-2 text-right font-mono text-xs">
                              {d.medicaoInicial !== null ? Number(d.medicaoInicial).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "-"}
                            </td>
                            <td className="p-2 text-right font-mono text-xs text-emerald-600">
                              {d.comprasDia > 0 ? `+${Number(d.comprasDia).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "-"}
                            </td>
                            <td className="p-2 text-right font-mono text-xs text-red-600">
                              {d.vendasDia > 0 ? `-${Number(d.vendasDia).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}` : "-"}
                            </td>
                            <td className="p-2 text-right font-mono text-xs font-bold">
                              {d.estoqueProjetado !== null ? Number(d.estoqueProjetado).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "-"}
                            </td>
                            <td className="p-2 text-right font-mono text-xs">
                              {d.medicaoDiaSeguinte !== null ? Number(d.medicaoDiaSeguinte).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "-"}
                            </td>
                            <td className={`p-2 text-right font-mono text-xs font-bold ${
                              d.diferenca !== null && Math.abs(d.diferenca) > 300 ? "text-red-600" :
                              d.diferenca !== null ? "text-emerald-600" : ""
                            }`}>
                              {d.diferenca !== null ? Number(d.diferenca).toLocaleString("pt-BR", { maximumFractionDigits: 0 }) : "-"}
                            </td>
                            <td className="p-2 text-center">
                              {d.statusCoerencia === "coerente" && (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                  <CheckCircle2 className="h-3 w-3 mr-1" /> OK
                                </Badge>
                              )}
                              {d.statusCoerencia === "alerta" && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" /> Alerta
                                </Badge>
                              )}
                              {d.statusCoerencia === "sem_medicao" && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                                  <HelpCircle className="h-3 w-3 mr-1" /> S/Med
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {detalhes.length > 500 && (
                      <p className="text-xs text-slate-500 text-center mt-2">
                        Mostrando 500 de {detalhes.length} registros. Refine os filtros para ver menos dados.
                      </p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Medições Ausentes */}
          <TabsContent value="ausentes">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-blue-600" />
                  Medições Ausentes
                </CardTitle>
                <CardDescription>Dias sem medição por posto e tanque no período selecionado</CardDescription>
              </CardHeader>
              <CardContent>
                {!searchParams ? (
                  <p className="text-slate-500 text-center py-8">Clique em "Verificar Coerência" para detectar medições ausentes.</p>
                ) : medicoesAusentesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                    <span className="text-slate-500">Verificando medições...</span>
                  </div>
                ) : medicoesAusentes.length === 0 ? (
                  <Alert className="bg-emerald-50 border-emerald-200">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    <AlertDescription className="text-emerald-700">
                      Todas as medições estão em dia para o período selecionado.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="space-y-4">
                    {medicoesAusentes.map((item: any, i: number) => (
                      <div key={i} className="border rounded-lg p-4 bg-blue-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Fuel className="h-4 w-4 text-blue-600" />
                            <span className="font-medium">{item.postoNome}</span>
                            <Badge variant="outline" className="text-xs">{item.tanqueCodigo}</Badge>
                            {item.produtoNome && (
                              <span className="text-xs text-slate-500">({item.produtoNome})</span>
                            )}
                          </div>
                          <Badge variant="destructive" className="text-xs">
                            {item.datasAusentes.length} dia(s)
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {item.datasAusentes.slice(0, 20).map((data: string) => (
                            <span
                              key={data}
                              className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs font-mono text-blue-700"
                            >
                              {data}
                            </span>
                          ))}
                          {item.datasAusentes.length > 20 && (
                            <span className="px-2 py-0.5 text-xs text-slate-500">
                              +{item.datasAusentes.length - 20} mais...
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
