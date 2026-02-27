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
import {
  Lock,
  Unlock,
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Calendar,
  LockOpen,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function BloqueioDRE() {
  const { user } = useAuth();
  const isAdmin = (user?.role as string)?.includes("admin");

  // Filtros
  const [mesReferencia, setMesReferencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  // Dialog
  const [dialogAction, setDialogAction] = useState<"fechar" | "desbloquear" | "fecharTodos" | null>(null);
  const [dialogPostoId, setDialogPostoId] = useState<number | null>(null);
  const [dialogPostoNome, setDialogPostoNome] = useState("");
  const [observacoes, setObservacoes] = useState("");

  // Queries
  const postosQuery = trpc.postos.list.useQuery();
  const statusQuery = trpc.coerenciaTransferencias.listarStatusBloqueio.useQuery(
    { mesReferencia },
    { enabled: !!mesReferencia }
  );

  // Mutations
  const fecharMutation = trpc.coerenciaTransferencias.fecharMes.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setDialogAction(null);
        setObservacoes("");
        statusQuery.refetch();
      } else {
        toast.error(data.mensagem);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const fecharTodosMutation = trpc.coerenciaTransferencias.fecharMesTodosPostos.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setDialogAction(null);
        setObservacoes("");
        statusQuery.refetch();
      } else {
        toast.error(data.mensagem);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const desbloquearMutation = trpc.coerenciaTransferencias.desbloquearMes.useMutation({
    onSuccess: (data) => {
      if (data.sucesso) {
        toast.success(data.mensagem);
        setDialogAction(null);
        setObservacoes("");
        statusQuery.refetch();
      } else {
        toast.error(data.mensagem);
      }
    },
    onError: (err) => toast.error(err.message),
  });

  const statusList = useMemo(() => {
    if (!statusQuery.data?.sucesso) return [];
    return statusQuery.data.dados || [];
  }, [statusQuery.data]);

  const totalFechados = statusList.filter((s: any) => s.status === "fechado").length;
  const totalAbertos = statusList.filter((s: any) => s.status === "aberto").length;

  const handleConfirm = () => {
    if (dialogAction === "fechar" && dialogPostoId) {
      fecharMutation.mutate({
        postoId: dialogPostoId,
        mesReferencia,
        observacoes: observacoes || undefined,
      });
    } else if (dialogAction === "desbloquear" && dialogPostoId) {
      desbloquearMutation.mutate({
        postoId: dialogPostoId,
        mesReferencia,
        observacoes: observacoes || undefined,
      });
    } else if (dialogAction === "fecharTodos") {
      fecharTodosMutation.mutate({
        mesReferencia,
        observacoes: observacoes || undefined,
      });
    }
  };

  const mesFormatado = (mes: string) => {
    const [ano, m] = mes.split("-");
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return `${meses[parseInt(m) - 1]}/${ano}`;
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Lock className="h-7 w-7 text-purple-600" />
              Bloqueio Mensal de DRE
            </h1>
            <p className="text-slate-500 mt-1">
              Feche o mês para impedir alterações em alocações, transferências e recálculos de CMV. Apenas admin pode desbloquear.
            </p>
          </div>
        </div>

        {/* Seletor de mês e ações */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-xs">
                <Label>Mês de Referência</Label>
                <Input
                  type="month"
                  value={mesReferencia}
                  onChange={(e) => setMesReferencia(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                onClick={() => statusQuery.refetch()}
                disabled={statusQuery.isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${statusQuery.isLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
              <Button
                onClick={() => {
                  setDialogAction("fecharTodos");
                  setDialogPostoNome("TODOS OS POSTOS");
                  setObservacoes("");
                }}
                className="gap-2 bg-purple-600 hover:bg-purple-700"
              >
                <Lock className="h-4 w-4" />
                Fechar Mês para Todos
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cards de resumo */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-slate-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-slate-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Mês</p>
                  <p className="text-xl font-bold">{mesFormatado(mesReferencia)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-red-100 rounded-lg">
                  <Lock className="h-5 w-5 text-red-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Fechados</p>
                  <p className="text-xl font-bold text-red-600">{totalFechados}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <LockOpen className="h-5 w-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500">Abertos</p>
                  <p className="text-xl font-bold text-emerald-600">{totalAbertos}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela de status */}
        <Card>
          <CardHeader>
            <CardTitle>Status de Bloqueio por Posto</CardTitle>
            <CardDescription>Gerencie o fechamento mensal de cada posto individualmente</CardDescription>
          </CardHeader>
          <CardContent>
            {statusQuery.isLoading ? (
              <div className="flex items-center justify-center py-8">
                <RefreshCw className="h-6 w-6 animate-spin text-slate-400 mr-2" />
                <span className="text-slate-500">Carregando...</span>
              </div>
            ) : statusList.length === 0 ? (
              <p className="text-slate-500 text-center py-8">Nenhum posto encontrado.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-slate-50">
                      <th className="text-left p-3 font-medium">Posto</th>
                      <th className="text-center p-3 font-medium">Status</th>
                      <th className="text-left p-3 font-medium">Fechado Por</th>
                      <th className="text-left p-3 font-medium">Data Fechamento</th>
                      <th className="text-left p-3 font-medium">Desbloqueado Por</th>
                      <th className="text-left p-3 font-medium">Observações</th>
                      <th className="text-center p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statusList.map((s: any, i: number) => (
                      <tr key={i} className={`border-b ${s.status === "fechado" ? "bg-red-50/50" : "hover:bg-slate-50"}`}>
                        <td className="p-3 font-medium">{s.postoNome}</td>
                        <td className="p-3 text-center">
                          {s.status === "fechado" ? (
                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                              <Lock className="h-3 w-3 mr-1" /> Fechado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              <LockOpen className="h-3 w-3 mr-1" /> Aberto
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 text-xs">{s.fechadoPor || "-"}</td>
                        <td className="p-3 text-xs font-mono">
                          {s.fechadoEm ? new Date(s.fechadoEm).toLocaleString("pt-BR") : "-"}
                        </td>
                        <td className="p-3 text-xs">{s.desbloqueadoPor || "-"}</td>
                        <td className="p-3 text-xs text-slate-500">{s.observacoes || "-"}</td>
                        <td className="p-3 text-center">
                          {s.status === "aberto" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                              onClick={() => {
                                setDialogAction("fechar");
                                setDialogPostoId(s.postoId);
                                setDialogPostoNome(s.postoNome);
                                setObservacoes("");
                              }}
                            >
                              <Lock className="h-3 w-3 mr-1" /> Fechar
                            </Button>
                          ) : isAdmin ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-emerald-600 border-emerald-200 hover:bg-emerald-50 text-xs"
                              onClick={() => {
                                setDialogAction("desbloquear");
                                setDialogPostoId(s.postoId);
                                setDialogPostoNome(s.postoNome);
                                setObservacoes("");
                              }}
                            >
                              <Unlock className="h-3 w-3 mr-1" /> Desbloquear
                            </Button>
                          ) : (
                            <span className="text-xs text-slate-400 flex items-center justify-center gap-1">
                              <Shield className="h-3 w-3" /> Apenas admin
                            </span>
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

        {/* Informação sobre bloqueio */}
        <Alert className="bg-purple-50 border-purple-200">
          <Shield className="h-4 w-4 text-purple-600" />
          <AlertDescription className="text-purple-700 text-sm">
            <strong>Como funciona o bloqueio:</strong> Quando um mês é fechado, nenhuma transferência, alocação de NFe ou recálculo de CMV pode ser feito para aquele posto/mês. Apenas administradores podem desbloquear um mês fechado.
          </AlertDescription>
        </Alert>

        {/* Dialog de confirmação */}
        <Dialog open={dialogAction !== null} onOpenChange={() => setDialogAction(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {dialogAction === "desbloquear" ? (
                  <>
                    <Unlock className="h-5 w-5 text-emerald-600" />
                    Desbloquear DRE
                  </>
                ) : (
                  <>
                    <Lock className="h-5 w-5 text-red-600" />
                    Fechar DRE
                  </>
                )}
              </DialogTitle>
              <DialogDescription>
                {dialogAction === "desbloquear"
                  ? `Desbloquear o mês ${mesFormatado(mesReferencia)} para ${dialogPostoNome}? Isso permitirá alterações novamente.`
                  : dialogAction === "fecharTodos"
                  ? `Fechar o mês ${mesFormatado(mesReferencia)} para TODOS os postos? Nenhuma alteração será permitida até desbloqueio.`
                  : `Fechar o mês ${mesFormatado(mesReferencia)} para ${dialogPostoNome}? Nenhuma alteração será permitida até desbloqueio.`}
              </DialogDescription>
            </DialogHeader>

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Motivo do fechamento/desbloqueio..."
                rows={2}
              />
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogAction(null)}>
                Cancelar
              </Button>
              <Button
                variant={dialogAction === "desbloquear" ? "default" : "destructive"}
                onClick={handleConfirm}
                disabled={fecharMutation.isPending || desbloquearMutation.isPending || fecharTodosMutation.isPending}
              >
                {(fecharMutation.isPending || desbloquearMutation.isPending || fecharTodosMutation.isPending) ? (
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                ) : dialogAction === "desbloquear" ? (
                  <Unlock className="h-4 w-4 mr-2" />
                ) : (
                  <Lock className="h-4 w-4 mr-2" />
                )}
                Confirmar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
