import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertCircle,
  ArrowRight,
  ArrowLeftRight,
  CheckCircle2,
  RefreshCw,
  Search,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Shield,
  FileCheck,
  XCircle,
  Info,
  Truck,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function PendenciasEstoque() {
  // Filtros de período
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [filtroPostoId, setFiltroPostoId] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");

  // Dialog de resolução (transferência)
  const [resolverDialog, setResolverDialog] = useState(false);
  const [pendenciaSelecionada, setPendenciaSelecionada] = useState<any>(null);
  const [sugestaoSelecionada, setSugestaoSelecionada] = useState<any>(null);

  // Formulário de transferência
  const [formTransf, setFormTransf] = useState({
    loteOrigemId: "",
    postoDestinoId: "",
    tanqueDestinoId: "",
    volumeTransferido: "",
    dataTransferencia: new Date().toISOString().split("T")[0],
    justificativa: "",
    tipo: "correcao_alocacao" as "correcao_alocacao" | "transferencia_fisica" | "divisao_nfe",
  });

  // Queries
  const postosQuery = trpc.postos.list.useQuery();
  const tanquesQuery = trpc.tanques.list.useQuery();

  const pendenciasQuery = trpc.coerenciaTransferencias.buscarPendencias.useQuery({
    dataInicio,
    dataFim,
    postoId: filtroPostoId !== "todos" ? Number(filtroPostoId) : undefined,
  });

  const lotesProvisQuery = trpc.coerenciaTransferencias["buscarLotesProvisórios"].useQuery({
    postoId: filtroPostoId !== "todos" ? Number(filtroPostoId) : undefined,
  });

  // Validação em tempo real
  const validacaoQuery = trpc.coerenciaTransferencias.validarTransferencia.useQuery(
    {
      loteOrigemId: Number(formTransf.loteOrigemId) || 0,
      tanqueDestinoId: Number(formTransf.tanqueDestinoId) || 0,
      volumeTransferido: Number(formTransf.volumeTransferido) || 0,
    },
    {
      enabled: !!(formTransf.loteOrigemId && formTransf.tanqueDestinoId && formTransf.volumeTransferido),
    }
  );

  // Mutations
  const transferirMut = trpc.coerenciaTransferencias.realizarTransferencia.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setResolverDialog(false);
        pendenciasQuery.refetch();
        lotesProvisQuery.refetch();
        resetForm();
      } else {
        toast.error(data.mensagem);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const confirmarNfeMut = trpc.coerenciaTransferencias.confirmarNfe.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        lotesProvisQuery.refetch();
      } else {
        toast.error(data.mensagem);
      }
    },
  });

  const utils = trpc.useUtils();

  function resetForm() {
    setFormTransf({
      loteOrigemId: "",
      postoDestinoId: "",
      tanqueDestinoId: "",
      volumeTransferido: "",
      dataTransferencia: new Date().toISOString().split("T")[0],
      justificativa: "",
      tipo: "correcao_alocacao",
    });
    setPendenciaSelecionada(null);
    setSugestaoSelecionada(null);
  }

  function abrirResolver(pendencia: any, sugestao?: any) {
    setPendenciaSelecionada(pendencia);
    setSugestaoSelecionada(sugestao || null);

    if (sugestao) {
      setFormTransf({
        loteOrigemId: String(sugestao.loteOrigemId),
        postoDestinoId: String(sugestao.postoFaltaId),
        tanqueDestinoId: String(sugestao.tanqueFaltaId),
        volumeTransferido: String(sugestao.volumeSugerido),
        dataTransferencia: sugestao.dataReferencia || new Date().toISOString().split("T")[0],
        justificativa: sugestao.justificativaSugerida || "",
        tipo: sugestao.tipo || "correcao_alocacao",
      });
    } else {
      resetForm();
    }

    setResolverDialog(true);
  }

  function executarTransferencia() {
    if (!formTransf.loteOrigemId || !formTransf.postoDestinoId || !formTransf.tanqueDestinoId || !formTransf.volumeTransferido || !formTransf.justificativa) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    transferirMut.mutate({
      loteOrigemId: Number(formTransf.loteOrigemId),
      postoDestinoId: Number(formTransf.postoDestinoId),
      tanqueDestinoId: Number(formTransf.tanqueDestinoId),
      volumeTransferido: Number(formTransf.volumeTransferido),
      dataTransferencia: formTransf.dataTransferencia,
      justificativa: formTransf.justificativa,
      tipo: formTransf.tipo,
    });
  }

  // Dados filtrados
  const pendencias = pendenciasQuery.data?.dados || [];
  const sobras = pendencias.filter((p: any) => p.tipo === "sobra");
  const faltas = pendencias.filter((p: any) => p.tipo === "falta");
  const lotesProvisórios = lotesProvisQuery.data?.dados || [];

  const pendenciasFiltradas = useMemo(() => {
    if (filtroTipo === "todos") return pendencias;
    return pendencias.filter((p: any) => p.tipo === filtroTipo);
  }, [pendencias, filtroTipo]);

  // Tanques do posto destino selecionado
  const tanquesDestino = useMemo(() => {
    if (!formTransf.postoDestinoId) return [];
    return (tanquesQuery.data || []).filter(
      (t: any) => t.postoId === Number(formTransf.postoDestinoId) && t.ativo
    );
  }, [formTransf.postoDestinoId, tanquesQuery.data]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <AlertCircle className="h-7 w-7 text-amber-500" />
              Pendências de Estoque
            </h1>
            <p className="text-slate-500 mt-1">
              Alertas de coerência física com sugestões inteligentes de transferência
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => {
              pendenciasQuery.refetch();
              lotesProvisQuery.refetch();
            }}
            disabled={pendenciasQuery.isFetching}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${pendenciasQuery.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-4 pb-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs text-slate-500">Data Início</Label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[140px]">
                <Label className="text-xs text-slate-500">Data Fim</Label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
              <div className="flex-1 min-w-[160px]">
                <Label className="text-xs text-slate-500">Posto</Label>
                <Select value={filtroPostoId} onValueChange={setFiltroPostoId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Postos</SelectItem>
                    {(postosQuery.data || []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[120px]">
                <Label className="text-xs text-slate-500">Tipo</Label>
                <Select value={filtroTipo} onValueChange={setFiltroTipo}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="sobra">Sobras</SelectItem>
                    <SelectItem value="falta">Faltas</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resumo */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-50">
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{pendencias.length}</p>
                  <p className="text-xs text-slate-500">Pendências</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-red-50">
                  <TrendingUp className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{sobras.length}</p>
                  <p className="text-xs text-slate-500">Sobras</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-50">
                  <TrendingDown className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{faltas.length}</p>
                  <p className="text-xs text-slate-500">Faltas</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-50">
                  <FileCheck className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-slate-900">{lotesProvisórios.length}</p>
                  <p className="text-xs text-slate-500">NFes Provisórias</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs: Pendências e NFes Provisórias */}
        <Tabs defaultValue="pendencias">
          <TabsList>
            <TabsTrigger value="pendencias">
              Pendências ({pendenciasFiltradas.length})
            </TabsTrigger>
            <TabsTrigger value="provisorias">
              NFes Provisórias ({lotesProvisórios.length})
            </TabsTrigger>
          </TabsList>

          {/* Tab Pendências */}
          <TabsContent value="pendencias" className="space-y-4 mt-4">
            {pendenciasQuery.isLoading ? (
              <Card>
                <CardContent className="py-12 text-center text-slate-400">
                  <RefreshCw className="h-8 w-8 mx-auto mb-3 animate-spin" />
                  Analisando coerência física...
                </CardContent>
              </Card>
            ) : pendenciasFiltradas.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="text-lg font-medium text-slate-700">Nenhuma pendência encontrada</p>
                  <p className="text-sm text-slate-400 mt-1">
                    Todos os estoques estão coerentes no período selecionado.
                  </p>
                </CardContent>
              </Card>
            ) : (
              pendenciasFiltradas.map((pendencia: any) => (
                <PendenciaCard
                  key={pendencia.id}
                  pendencia={pendencia}
                  onResolver={(sugestao) => abrirResolver(pendencia, sugestao)}
                />
              ))
            )}
          </TabsContent>

          {/* Tab NFes Provisórias */}
          <TabsContent value="provisorias" className="space-y-4 mt-4">
            {lotesProvisórios.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-green-500" />
                  <p className="text-lg font-medium text-slate-700">Todas as NFes estão confirmadas</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {lotesProvisórios.map((lote: any) => (
                  <Card key={lote.id} className="border-l-4 border-l-orange-400">
                    <CardContent className="py-4">
                      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
                              PROVISÓRIA
                            </Badge>
                            <span className="font-medium text-slate-900">
                              NFe {lote.numeroNf || "S/N"}
                            </span>
                          </div>
                          <div className="text-sm text-slate-500 space-y-0.5">
                            <p>{lote.postoNome} → {lote.tanqueCodigo} ({lote.produtoNome})</p>
                            <p>
                              Volume: <span className="font-medium text-slate-700">{Number(lote.quantidadeOriginal).toLocaleString("pt-BR")} L</span>
                              {" | "}Custo: R$ {Number(lote.custoUnitario).toFixed(4)}/L
                              {" | "}Entrada: {lote.dataEntrada instanceof Date ? lote.dataEntrada.toLocaleDateString("pt-BR") : new Date(lote.dataEntrada + "T12:00:00").toLocaleDateString("pt-BR")}
                            </p>
                            {lote.nomeFornecedor && <p>Fornecedor: {lote.nomeFornecedor}</p>}
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-green-700 border-green-300 hover:bg-green-50"
                            onClick={() => confirmarNfeMut.mutate({ loteId: lote.id })}
                            disabled={confirmarNfeMut.isPending}
                          >
                            <CheckCircle2 className="h-4 w-4 mr-1" />
                            Confirmar
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-blue-700 border-blue-300 hover:bg-blue-50"
                            onClick={() => {
                              setFormTransf({
                                loteOrigemId: String(lote.id),
                                postoDestinoId: "",
                                tanqueDestinoId: "",
                                volumeTransferido: String(lote.quantidadeDisponivel),
                                dataTransferencia: lote.dataEntrada instanceof Date
                                  ? lote.dataEntrada.toISOString().split("T")[0]
                                  : String(lote.dataEntrada),
                                justificativa: `Transferência de NFe ${lote.numeroNf || "S/N"} provisória de ${lote.postoNome}`,
                                tipo: "correcao_alocacao",
                              });
                              setPendenciaSelecionada(null);
                              setSugestaoSelecionada(null);
                              setResolverDialog(true);
                            }}
                          >
                            <ArrowLeftRight className="h-4 w-4 mr-1" />
                            Transferir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog de Resolução (Transferência) */}
        <Dialog open={resolverDialog} onOpenChange={(open) => { if (!open) { setResolverDialog(false); resetForm(); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-blue-600" />
                Resolver Pendência via Transferência
              </DialogTitle>
              <DialogDescription>
                Transfira o volume do posto com sobra para o posto com falta.
              </DialogDescription>
            </DialogHeader>

            {/* Contexto da sugestão */}
            {sugestaoSelecionada && (
              <Alert className="border-blue-200 bg-blue-50">
                <Lightbulb className="h-4 w-4 text-blue-600" />
                <AlertTitle className="text-blue-800">Sugestão Inteligente</AlertTitle>
                <AlertDescription className="text-blue-700 text-sm whitespace-pre-line mt-1">
                  {sugestaoSelecionada.explicacao?.replace(/\*\*/g, "").replace(/📊|📦|🔄/g, "")}
                </AlertDescription>
              </Alert>
            )}

            {pendenciaSelecionada && !sugestaoSelecionada && (
              <Alert className="border-amber-200 bg-amber-50">
                <Info className="h-4 w-4 text-amber-600" />
                <AlertTitle className="text-amber-800">Pendência Selecionada</AlertTitle>
                <AlertDescription className="text-amber-700 text-sm">
                  {pendenciaSelecionada.postoNome} ({pendenciaSelecionada.tanqueCodigo}):
                  {pendenciaSelecionada.tipo === "sobra" ? " sobra" : " falta"} de{" "}
                  {Math.abs(pendenciaSelecionada.diferenca).toLocaleString("pt-BR")} L
                  em {pendenciaSelecionada.dataVerificacao}
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-4">
              {/* Lote de origem */}
              <div>
                <Label>Lote de Origem (ID) *</Label>
                <Input
                  type="number"
                  value={formTransf.loteOrigemId}
                  onChange={(e) => setFormTransf({ ...formTransf, loteOrigemId: e.target.value })}
                  placeholder="ID do lote a transferir"
                />
              </div>

              {/* Posto destino */}
              <div>
                <Label>Posto Destino *</Label>
                <Select
                  value={formTransf.postoDestinoId}
                  onValueChange={(v) => setFormTransf({ ...formTransf, postoDestinoId: v, tanqueDestinoId: "" })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o posto destino" /></SelectTrigger>
                  <SelectContent>
                    {(postosQuery.data || []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Tanque destino */}
              <div>
                <Label>Tanque Destino *</Label>
                <Select
                  value={formTransf.tanqueDestinoId}
                  onValueChange={(v) => setFormTransf({ ...formTransf, tanqueDestinoId: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione o tanque destino" /></SelectTrigger>
                  <SelectContent>
                    {tanquesDestino.map((t: any) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.codigoAcs} ({t.produtoNome || "Sem produto"}) - Cap: {Number(t.capacidade).toLocaleString("pt-BR")}L
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Volume */}
              <div>
                <Label>Volume a Transferir (L) *</Label>
                <Input
                  type="number"
                  step="0.001"
                  value={formTransf.volumeTransferido}
                  onChange={(e) => setFormTransf({ ...formTransf, volumeTransferido: e.target.value })}
                  placeholder="Volume em litros"
                />
              </div>

              {/* Validação em tempo real */}
              {validacaoQuery.data && formTransf.loteOrigemId && formTransf.tanqueDestinoId && formTransf.volumeTransferido && (
                <div className="space-y-2">
                  {!validacaoQuery.data.estoque.valido && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{validacaoQuery.data.estoque.mensagem}</AlertDescription>
                    </Alert>
                  )}
                  {!validacaoQuery.data.capacidade.valido && (
                    <Alert variant="destructive">
                      <XCircle className="h-4 w-4" />
                      <AlertDescription>{validacaoQuery.data.capacidade.mensagem}</AlertDescription>
                    </Alert>
                  )}
                  {validacaoQuery.data.valido && (
                    <Alert className="border-green-200 bg-green-50">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700">
                        Validação OK. Saldo do lote: {validacaoQuery.data.estoque.saldoAtual.toLocaleString("pt-BR")}L.
                        Espaço no tanque: {validacaoQuery.data.capacidade.espacoLivre.toLocaleString("pt-BR")}L.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              )}

              {/* Data */}
              <div>
                <Label>Data da Transferência</Label>
                <Input
                  type="date"
                  value={formTransf.dataTransferencia}
                  onChange={(e) => setFormTransf({ ...formTransf, dataTransferencia: e.target.value })}
                />
              </div>

              {/* Tipo */}
              <div>
                <Label>Tipo de Transferência</Label>
                <Select
                  value={formTransf.tipo}
                  onValueChange={(v: any) => setFormTransf({ ...formTransf, tipo: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="correcao_alocacao">Correção de Alocação</SelectItem>
                    <SelectItem value="transferencia_fisica">Transferência Física</SelectItem>
                    <SelectItem value="divisao_nfe">Divisão de NFe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Justificativa */}
              <div>
                <Label>Justificativa *</Label>
                <Textarea
                  value={formTransf.justificativa}
                  onChange={(e) => setFormTransf({ ...formTransf, justificativa: e.target.value })}
                  placeholder="Descreva o motivo da transferência..."
                  rows={3}
                />
              </div>
            </div>

            <DialogFooter className="mt-4">
              <Button variant="outline" onClick={() => { setResolverDialog(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={executarTransferencia}
                disabled={
                  transferirMut.isPending ||
                  !formTransf.loteOrigemId ||
                  !formTransf.postoDestinoId ||
                  !formTransf.tanqueDestinoId ||
                  !formTransf.volumeTransferido ||
                  !formTransf.justificativa ||
                  (validacaoQuery.data && !validacaoQuery.data.valido)
                }
                className="bg-blue-600 hover:bg-blue-700"
              >
                {transferirMut.isPending ? (
                  <><RefreshCw className="h-4 w-4 mr-2 animate-spin" /> Processando...</>
                ) : (
                  <><ArrowLeftRight className="h-4 w-4 mr-2" /> Executar Transferência</>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// Componente de card de pendência individual
function PendenciaCard({ pendencia, onResolver }: { pendencia: any; onResolver: (sugestao?: any) => void }) {
  const isSobra = pendencia.tipo === "sobra";
  const borderColor = isSobra ? "border-l-red-400" : "border-l-blue-400";
  const bgColor = isSobra ? "bg-red-50" : "bg-blue-50";
  const textColor = isSobra ? "text-red-700" : "text-blue-700";
  const IconComp = isSobra ? TrendingUp : TrendingDown;
  const tipoLabel = isSobra ? "SOBRA" : "FALTA";

  const dataFormatada = (() => {
    try {
      return new Date(pendencia.dataVerificacao + "T12:00:00").toLocaleDateString("pt-BR");
    } catch {
      return pendencia.dataVerificacao;
    }
  })();

  return (
    <Card className={`${borderColor} border-l-4`}>
      <CardContent className="py-4">
        <div className="flex flex-col gap-3">
          {/* Header da pendência */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${bgColor}`}>
                <IconComp className={`h-5 w-5 ${textColor}`} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${bgColor} ${textColor} border-current`}>
                    {tipoLabel}
                  </Badge>
                  <span className="font-semibold text-slate-900">
                    {pendencia.postoNome}
                  </span>
                  <span className="text-slate-400">→</span>
                  <span className="text-slate-600">
                    {pendencia.tanqueCodigo} ({pendencia.produtoNome || "N/A"})
                  </span>
                </div>
                <p className="text-sm text-slate-500 mt-0.5">
                  {dataFormatada} | Diferença: <span className={`font-bold ${textColor}`}>
                    {pendencia.diferenca > 0 ? "+" : ""}{Number(pendencia.diferenca).toLocaleString("pt-BR")} L
                  </span>
                </p>
              </div>
            </div>
            <Button
              size="sm"
              onClick={() => onResolver()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <ArrowLeftRight className="h-4 w-4 mr-1" />
              Resolver
            </Button>
          </div>

          {/* Detalhes */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
            <div>
              <span className="block text-slate-400">Medição Inicial</span>
              <span className="font-medium text-slate-700">
                {pendencia.medicaoInicial != null ? Number(pendencia.medicaoInicial).toLocaleString("pt-BR") + " L" : "—"}
              </span>
            </div>
            <div>
              <span className="block text-slate-400">Vendas</span>
              <span className="font-medium text-slate-700">
                {Number(pendencia.vendasDia).toLocaleString("pt-BR")} L
              </span>
            </div>
            <div>
              <span className="block text-slate-400">Compras</span>
              <span className="font-medium text-slate-700">
                {Number(pendencia.comprasDia).toLocaleString("pt-BR")} L
              </span>
            </div>
            <div>
              <span className="block text-slate-400">Projetado</span>
              <span className="font-medium text-slate-700">
                {pendencia.estoqueProjetado != null ? Number(pendencia.estoqueProjetado).toLocaleString("pt-BR") + " L" : "—"}
              </span>
            </div>
            <div>
              <span className="block text-slate-400">Medido (dia seg.)</span>
              <span className="font-medium text-slate-700">
                {pendencia.medicaoDiaSeguinte != null ? Number(pendencia.medicaoDiaSeguinte).toLocaleString("pt-BR") + " L" : "—"}
              </span>
            </div>
          </div>

          {/* Sugestões */}
          {pendencia.sugestoes && pendencia.sugestoes.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Lightbulb className="h-3.5 w-3.5 text-amber-500" />
                Sugestões de Transferência:
              </p>
              {pendencia.sugestoes.slice(0, 3).map((sug: any, idx: number) => (
                <div
                  key={sug.id || idx}
                  className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg"
                >
                  <div className="flex-1 text-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge
                        variant="outline"
                        className={
                          sug.confianca === "alta"
                            ? "bg-green-50 text-green-700 border-green-300"
                            : sug.confianca === "media"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-300"
                            : "bg-slate-50 text-slate-600 border-slate-300"
                        }
                      >
                        {sug.confianca.toUpperCase()}
                      </Badge>
                      <span className="text-slate-700">
                        NFe <span className="font-medium">{sug.nfeNumero}</span>
                      </span>
                    </div>
                    <p className="text-slate-600">
                      {sug.postoSobraNome} ({sug.tanqueSobraCodigo})
                      <ArrowRight className="h-3 w-3 inline mx-1" />
                      {sug.postoFaltaNome} ({sug.tanqueFaltaCodigo})
                      {" | "}
                      <span className="font-medium">{Number(sug.volumeSugerido).toLocaleString("pt-BR")} L</span>
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-amber-700 border-amber-300 hover:bg-amber-100"
                    onClick={() => onResolver(sug)}
                  >
                    <Truck className="h-4 w-4 mr-1" />
                    Usar Sugestão
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
