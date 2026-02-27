import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeftRight,
  Plus,
  Search,
  RefreshCw,
  XCircle,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

export default function Transferencias() {

  const [openDialog, setOpenDialog] = useState(false);
  const [cancelarDialog, setCancelarDialog] = useState(false);
  const [cancelarId, setCancelarId] = useState<number | null>(null);
  const [cancelarJustificativa, setCancelarJustificativa] = useState("");

  // Filtros
  const [filtroPostoId, setFiltroPostoId] = useState("todos");
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().split("T")[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split("T")[0]);

  // Formulário de transferência
  const [form, setForm] = useState({
    loteOrigemId: "",
    postoDestinoId: "",
    tanqueDestinoId: "",
    volumeTransferido: "",
    dataTransferencia: new Date().toISOString().split("T")[0],
    justificativa: "",
    tipo: "transferencia_fisica" as "correcao_alocacao" | "transferencia_fisica" | "divisao_nfe",
  });

  // Queries
  const postosQuery = trpc.postos.list.useQuery();
  const tanquesQuery = trpc.tanques.list.useQuery();
  const lotesQuery = trpc.lotes.listAtivos.useQuery();

  const transferenciasQuery = trpc.coerenciaTransferencias.listarTransferencias.useQuery({
    postoOrigemId: filtroPostoId !== "todos" ? parseInt(filtroPostoId) : undefined,
    dataInicio,
    dataFim,
  });

  // Mutations
  const realizarMutation = trpc.coerenciaTransferencias.realizarTransferencia.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setOpenDialog(false);
        resetForm();
        transferenciasQuery.refetch();
        lotesQuery.refetch();
      } else {
        toast.error(data.mensagem);
      }
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const cancelarMutation = trpc.coerenciaTransferencias.cancelarTransferencia.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setCancelarDialog(false);
        setCancelarId(null);
        setCancelarJustificativa("");
        transferenciasQuery.refetch();
        lotesQuery.refetch();
      } else {
        toast.error(data.mensagem);
      }
    },
  });

  const resetForm = () => {
    setForm({
      loteOrigemId: "",
      postoDestinoId: "",
      tanqueDestinoId: "",
      volumeTransferido: "",
      dataTransferencia: new Date().toISOString().split("T")[0],
      justificativa: "",
      tipo: "transferencia_fisica",
    });
  };

  // Lotes disponíveis para transferência
  const lotesDisponiveis = useMemo(() => {
    if (!lotesQuery.data) return [];
    return (lotesQuery.data as any[]).filter(
      (l: any) => parseFloat(l.quantidadeDisponivel || "0") > 0
    );
  }, [lotesQuery.data]);

  // Lote selecionado
  const loteSelecionado = useMemo(() => {
    if (!form.loteOrigemId) return null;
    return lotesDisponiveis.find((l: any) => l.id === parseInt(form.loteOrigemId));
  }, [form.loteOrigemId, lotesDisponiveis]);

  // Tanques do posto de destino
  const tanquesDestino = useMemo(() => {
    if (!form.postoDestinoId || !tanquesQuery.data) return [];
    return (tanquesQuery.data as any[]).filter(
      (t: any) => t.postoId === parseInt(form.postoDestinoId)
    );
  }, [form.postoDestinoId, tanquesQuery.data]);

  // Transferências
  const transferencias = useMemo(() => {
    if (!transferenciasQuery.data?.sucesso) return [];
    return transferenciasQuery.data.dados || [];
  }, [transferenciasQuery.data]);

  const handleSubmit = () => {
    if (!form.loteOrigemId || !form.postoDestinoId || !form.tanqueDestinoId || !form.volumeTransferido || !form.justificativa) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    realizarMutation.mutate({
      loteOrigemId: parseInt(form.loteOrigemId),
      postoDestinoId: parseInt(form.postoDestinoId),
      tanqueDestinoId: parseInt(form.tanqueDestinoId),
      volumeTransferido: parseFloat(form.volumeTransferido),
      dataTransferencia: form.dataTransferencia,
      justificativa: form.justificativa,
      tipo: form.tipo,
      numeroNf: loteSelecionado?.numeroNf,
    });
  };

  const tipoLabel = (tipo: string) => {
    switch (tipo) {
      case "correcao_alocacao": return "Correção de Alocação";
      case "transferencia_fisica": return "Transferência Física";
      case "divisao_nfe": return "Divisão de NFe";
      default: return tipo;
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <ArrowLeftRight className="h-7 w-7 text-indigo-600" />
              Transferências Físicas
            </h1>
            <p className="text-slate-500 mt-1">
              Transferir combustível entre postos/tanques com rastreabilidade completa e recálculo automático de CMV.
            </p>
          </div>
          <Button onClick={() => setOpenDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Transferência
          </Button>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label>Posto Origem</Label>
                <Select value={filtroPostoId} onValueChange={setFiltroPostoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os postos</SelectItem>
                    {(postosQuery.data || []).map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
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
              <Button variant="outline" onClick={() => transferenciasQuery.refetch()}>
                <Search className="h-4 w-4 mr-2" /> Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Transferências */}
        <Card>
          <CardHeader>
            <CardTitle>Histórico de Transferências</CardTitle>
            <CardDescription>{transferencias.length} transferência(s) encontrada(s)</CardDescription>
          </CardHeader>
          <CardContent>
            {transferenciasQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                <span className="text-slate-500">Carregando...</span>
              </div>
            ) : transferencias.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhuma transferência encontrada no período.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-2 font-medium">Data</th>
                      <th className="text-left p-2 font-medium">Tipo</th>
                      <th className="text-left p-2 font-medium">Origem</th>
                      <th className="text-center p-2 font-medium"></th>
                      <th className="text-left p-2 font-medium">Destino</th>
                      <th className="text-left p-2 font-medium">Produto</th>
                      <th className="text-right p-2 font-medium">Volume</th>
                      <th className="text-right p-2 font-medium">Custo/L</th>
                      <th className="text-right p-2 font-medium">Custo Total</th>
                      <th className="text-left p-2 font-medium">NF</th>
                      <th className="text-left p-2 font-medium">Usuário</th>
                      <th className="text-center p-2 font-medium">Status</th>
                      <th className="text-center p-2 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transferencias.map((t: any) => (
                      <tr key={t.id} className={`border-b ${t.status === "cancelada" ? "opacity-50 bg-red-50" : "hover:bg-slate-50"}`}>
                        <td className="p-2 font-mono text-xs">
                          {t.dataTransferencia instanceof Date
                            ? t.dataTransferencia.toISOString().split("T")[0]
                            : String(t.dataTransferencia).split("T")[0]}
                        </td>
                        <td className="p-2">
                          <Badge variant="outline" className="text-xs">
                            {tipoLabel(t.tipo)}
                          </Badge>
                        </td>
                        <td className="p-2 text-xs">
                          <div>{t.postoOrigemNome}</div>
                          <div className="text-slate-400">{t.tanqueOrigemCodigo}</div>
                        </td>
                        <td className="p-2 text-center">
                          <ArrowRight className="h-4 w-4 text-slate-400 mx-auto" />
                        </td>
                        <td className="p-2 text-xs">
                          <div>{t.postoDestinoNome}</div>
                          <div className="text-slate-400">{t.tanqueDestinoCodigo}</div>
                        </td>
                        <td className="p-2 text-xs">{t.produtoNome || "-"}</td>
                        <td className="p-2 text-right font-mono text-xs font-bold">
                          {Number(t.volumeTransferido).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L
                        </td>
                        <td className="p-2 text-right font-mono text-xs">
                          R$ {Number(t.custoUnitario).toFixed(4)}
                        </td>
                        <td className="p-2 text-right font-mono text-xs">
                          R$ {Number(t.custoTotal).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                        </td>
                        <td className="p-2 text-xs">{t.numeroNf || "-"}</td>
                        <td className="p-2 text-xs">{t.usuarioNome || "-"}</td>
                        <td className="p-2 text-center">
                          {t.status === "confirmada" ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Confirmada
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200 text-xs">
                              <XCircle className="h-3 w-3 mr-1" /> Cancelada
                            </Badge>
                          )}
                        </td>
                        <td className="p-2 text-center">
                          {t.status === "confirmada" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                              onClick={() => {
                                setCancelarId(t.id);
                                setCancelarDialog(true);
                              }}
                            >
                              <XCircle className="h-3 w-3 mr-1" /> Cancelar
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog Nova Transferência */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ArrowLeftRight className="h-5 w-5 text-indigo-600" />
                Nova Transferência Física
              </DialogTitle>
              <DialogDescription>
                Transferir combustível de um lote para outro posto/tanque. O CMV será recalculado automaticamente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Tipo de transferência */}
              <div>
                <Label>Tipo de Transferência</Label>
                <Select value={form.tipo} onValueChange={(v: any) => setForm({ ...form, tipo: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="transferencia_fisica">Transferência Física</SelectItem>
                    <SelectItem value="correcao_alocacao">Correção de Alocação</SelectItem>
                    <SelectItem value="divisao_nfe">Divisão de NFe</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Lote de origem */}
              <div>
                <Label>Lote de Origem</Label>
                <Select value={form.loteOrigemId} onValueChange={(v) => setForm({ ...form, loteOrigemId: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o lote" />
                  </SelectTrigger>
                  <SelectContent>
                    {lotesDisponiveis.map((l: any) => (
                      <SelectItem key={l.id} value={String(l.id)}>
                        NF {l.numeroNf || "s/n"} | {l.postoNome} | {l.tanqueCodigo} | {Number(l.quantidadeDisponivel).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L | R$ {Number(l.custoUnitario).toFixed(4)}/L
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {loteSelecionado && (
                  <div className="mt-2 p-3 bg-slate-50 rounded-lg text-sm">
                    <div className="grid grid-cols-2 gap-2">
                      <div><span className="text-slate-500">Posto:</span> {loteSelecionado.postoNome}</div>
                      <div><span className="text-slate-500">Tanque:</span> {loteSelecionado.tanqueCodigo}</div>
                      <div><span className="text-slate-500">NF:</span> {loteSelecionado.numeroNf || "s/n"}</div>
                      <div><span className="text-slate-500">Saldo:</span> <strong>{Number(loteSelecionado.quantidadeDisponivel).toLocaleString("pt-BR", { maximumFractionDigits: 0 })} L</strong></div>
                      <div><span className="text-slate-500">Custo/L:</span> R$ {Number(loteSelecionado.custoUnitario).toFixed(4)}</div>
                      <div><span className="text-slate-500">Produto:</span> {loteSelecionado.produtoDescricao || "-"}</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Posto destino */}
                <div>
                  <Label>Posto Destino</Label>
                  <Select value={form.postoDestinoId} onValueChange={(v) => setForm({ ...form, postoDestinoId: v, tanqueDestinoId: "" })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o posto" />
                    </SelectTrigger>
                    <SelectContent>
                      {(postosQuery.data || []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.nome}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Tanque destino */}
                <div>
                  <Label>Tanque Destino</Label>
                  <Select value={form.tanqueDestinoId} onValueChange={(v) => setForm({ ...form, tanqueDestinoId: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tanque" />
                    </SelectTrigger>
                    <SelectContent>
                      {tanquesDestino.map((t: any) => (
                        <SelectItem key={t.id} value={String(t.id)}>
                          {t.codigoAcs} - {t.produtoDescricao || "Sem produto"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Volume */}
                <div>
                  <Label>Volume (litros)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    value={form.volumeTransferido}
                    onChange={(e) => setForm({ ...form, volumeTransferido: e.target.value })}
                    placeholder="Ex: 5000"
                  />
                  {loteSelecionado && form.volumeTransferido && (
                    <p className="text-xs text-slate-500 mt-1">
                      Custo total: R$ {(parseFloat(form.volumeTransferido) * parseFloat(loteSelecionado.custoUnitario)).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  )}
                </div>

                {/* Data */}
                <div>
                  <Label>Data da Transferência</Label>
                  <Input
                    type="date"
                    value={form.dataTransferencia}
                    onChange={(e) => setForm({ ...form, dataTransferencia: e.target.value })}
                  />
                </div>
              </div>

              {/* Justificativa */}
              <div>
                <Label>Justificativa (obrigatória)</Label>
                <Textarea
                  value={form.justificativa}
                  onChange={(e) => setForm({ ...form, justificativa: e.target.value })}
                  placeholder="Descreva o motivo da transferência..."
                  rows={3}
                />
              </div>

              {/* Alerta de recálculo */}
              <Alert className="bg-amber-50 border-amber-200">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-amber-700 text-sm">
                  Após a transferência, o CMV será recalculado automaticamente para os postos de origem e destino a partir da data da transferência.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setOpenDialog(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={realizarMutation.isPending}
                className="gap-2"
              >
                {realizarMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowLeftRight className="h-4 w-4" />
                )}
                Confirmar Transferência
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog Cancelar Transferência */}
        <Dialog open={cancelarDialog} onOpenChange={setCancelarDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-600">Cancelar Transferência</DialogTitle>
              <DialogDescription>
                Esta ação irá restaurar o saldo do lote de origem e cancelar o lote de destino.
              </DialogDescription>
            </DialogHeader>
            <div>
              <Label>Justificativa (opcional)</Label>
              <Textarea
                value={cancelarJustificativa}
                onChange={(e) => setCancelarJustificativa(e.target.value)}
                placeholder="Motivo do cancelamento..."
                rows={2}
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCancelarDialog(false)}>
                Voltar
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  if (cancelarId) {
                    cancelarMutation.mutate({
                      transferenciaId: cancelarId,
                      justificativa: cancelarJustificativa || undefined,
                    });
                  }
                }}
                disabled={cancelarMutation.isPending}
              >
                {cancelarMutation.isPending ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <XCircle className="h-4 w-4 mr-2" />
                )}
                Confirmar Cancelamento
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
