import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { Plus, Package, FileText, Calendar, Edit, Trash2, RefreshCw } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

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

function formatDateBR(date: Date | string | null | undefined): string {
  if (!date) return '-';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

function getDateString(date: Date): string {
  return date.toISOString().split('T')[0];
}

export default function Compras() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLote, setEditingLote] = useState<any>(null);
  const [postoSelecionado, setPostoSelecionado] = useState<string>("");
  const [tanqueSelecionado, setTanqueSelecionado] = useState<string>("");
  const [numeroNf, setNumeroNf] = useState("");
  const [chaveNfe, setChaveNfe] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataEntrada, setDataEntrada] = useState(getDateString(new Date()));
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [ordemLote, setOrdemLote] = useState("");

  // Filtros
  const [filtroTab, setFiltroTab] = useState("todos");
  const [filtroPostoId, setFiltroPostoId] = useState<string>("todos");
  const [tipoFiltroData, setTipoFiltroData] = useState<string>("periodo");
  const [periodoFiltro, setPeriodoFiltro] = useState<string>("60");
  const [dataEspecifica, setDataEspecifica] = useState<string>(getDateString(new Date()));

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: tanques } = trpc.tanques.byPosto.useQuery(
    { postoId: parseInt(postoSelecionado) },
    { enabled: !!postoSelecionado }
  );
  const { data: lotesAtivos, isLoading: loadingAtivos, refetch: refetchAtivos } = trpc.lotes.listAtivos.useQuery();
  const { data: todoLotes, isLoading: loadingTodos, refetch: refetchTodos } = trpc.lotes.list.useQuery();
  const utils = trpc.useUtils();

  // Calcular datas para filtro
  const { dataInicio, dataFim } = useMemo(() => {
    if (tipoFiltroData === "especifica") {
      return { dataInicio: dataEspecifica, dataFim: dataEspecifica };
    } else {
      const fim = new Date();
      const inicio = new Date();
      inicio.setDate(inicio.getDate() - parseInt(periodoFiltro));
      return { dataInicio: getDateString(inicio), dataFim: getDateString(fim) };
    }
  }, [tipoFiltroData, periodoFiltro, dataEspecifica]);

  // Filtrar lotes
  const lotesFiltrados = useMemo(() => {
    const lotes = filtroTab === "ativos" ? lotesAtivos : todoLotes;
    if (!lotes) return [];
    
    return lotes.filter(lote => {
      // Filtro por posto
      if (filtroPostoId !== "todos" && lote.postoId !== parseInt(filtroPostoId)) {
        return false;
      }
      // Filtro por data
      const dataLote = new Date(lote.dataEntrada).toISOString().split('T')[0];
      if (dataLote < dataInicio || dataLote > dataFim) {
        return false;
      }
      return true;
    });
  }, [filtroTab, lotesAtivos, todoLotes, filtroPostoId, dataInicio, dataFim]);

  const createLote = trpc.lotes.create.useMutation({
    onSuccess: () => {
      toast.success("Compra registrada com sucesso!");
      setDialogOpen(false);
      resetForm();
      refetchAtivos();
      refetchTodos();
    },
    onError: (error) => {
      toast.error("Erro ao registrar compra: " + error.message);
    }
  });

  const updateLote = trpc.lotes.update.useMutation({
    onSuccess: () => {
      toast.success("Compra atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingLote(null);
      refetchAtivos();
      refetchTodos();
    },
    onError: (error) => {
      toast.error("Erro ao atualizar compra: " + error.message);
    }
  });

  const deleteLote = trpc.lotes.delete.useMutation({
    onSuccess: () => {
      toast.success("Compra excluída com sucesso!");
      refetchAtivos();
      refetchTodos();
    },
    onError: (error) => {
      toast.error("Erro ao excluir compra: " + error.message);
    }
  });

  const resetForm = () => {
    setPostoSelecionado("");
    setTanqueSelecionado("");
    setNumeroNf("");
    setChaveNfe("");
    setFornecedor("");
    setDataEntrada(getDateString(new Date()));
    setQuantidade("");
    setCustoUnitario("");
    setOrdemLote("");
  };

  const handleSubmit = () => {
    if (!tanqueSelecionado || !quantidade || !custoUnitario) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    createLote.mutate({
      tanqueId: parseInt(tanqueSelecionado),
      postoId: parseInt(postoSelecionado),
      numeroNf,
      chaveNfe,
      fornecedorNome: fornecedor,
      dataEntrada,
      quantidadeOriginal: quantidade,
      custoUnitario,
    });
  };

  const handleEdit = (lote: any) => {
    setEditingLote(lote);
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingLote) return;
    
    updateLote.mutate({
      id: editingLote.id,
      numeroNf: editingLote.numeroNf,
      chaveNfe: editingLote.chaveNfe,
      custoUnitario: editingLote.custoUnitario,
      justificativa: "Edição manual via interface",
    });
  };

  const handleDelete = (id: number, origem: string) => {
    if (origem === "acs") {
      toast.error("Não é possível excluir compras importadas do ACS");
      return;
    }
    if (confirm("Tem certeza que deseja excluir esta compra?")) {
      deleteLote.mutate({ id, justificativa: "Exclusão manual via interface" });
    }
  };

  // Atalhos de data
  const setDataHoje = () => {
    setTipoFiltroData("especifica");
    setDataEspecifica(getDateString(new Date()));
  };

  const setDataOntem = () => {
    setTipoFiltroData("especifica");
    const ontem = new Date();
    ontem.setDate(ontem.getDate() - 1);
    setDataEspecifica(getDateString(ontem));
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compras / Notas Fiscais</h1>
            <p className="text-muted-foreground">Registro de compras de combustível para cálculo PEPS</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => { refetchAtivos(); refetchTodos(); }}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Atualizar
            </Button>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Compra
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Registrar Nova Compra</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Posto *</Label>
                    <Select value={postoSelecionado} onValueChange={(v) => { setPostoSelecionado(v); setTanqueSelecionado(""); }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o posto" />
                      </SelectTrigger>
                      <SelectContent>
                        {postos?.map(posto => (
                          <SelectItem key={posto.id} value={posto.id.toString()}>
                            {posto.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Tanque *</Label>
                    <Select value={tanqueSelecionado} onValueChange={setTanqueSelecionado} disabled={!postoSelecionado}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o tanque" />
                      </SelectTrigger>
                      <SelectContent>
                        {tanques?.map(tanque => (
                          <SelectItem key={tanque.id} value={tanque.id.toString()}>
                            Tanque {tanque.codigoAcs} - {tanque.produtoDescricao}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Número NF</Label>
                      <Input value={numeroNf} onChange={e => setNumeroNf(e.target.value)} placeholder="123456" />
                    </div>
                    <div className="space-y-2">
                      <Label>Data Entrada *</Label>
                      <Input type="date" value={dataEntrada} onChange={e => setDataEntrada(e.target.value)} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Chave NFe (44 dígitos)</Label>
                    <Input value={chaveNfe} onChange={e => setChaveNfe(e.target.value)} placeholder="Chave de acesso da NFe" maxLength={44} />
                  </div>

                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Quantidade (L) *</Label>
                      <Input 
                        type="number" 
                        value={quantidade} 
                        onChange={e => setQuantidade(e.target.value)} 
                        placeholder="10000"
                        step="0.001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Custo Unit. (R$/L) *</Label>
                      <Input 
                        type="number" 
                        value={custoUnitario} 
                        onChange={e => setCustoUnitario(e.target.value)} 
                        placeholder="5.50"
                        step="0.0001"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Ordem Lote</Label>
                      <Input 
                        type="number" 
                        value={ordemLote} 
                        onChange={e => setOrdemLote(e.target.value)} 
                        placeholder="Auto"
                      />
                    </div>
                  </div>

                  {quantidade && custoUnitario && (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Valor Total:</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(parseFloat(quantidade) * parseFloat(custoUnitario))}
                      </p>
                    </div>
                  )}

                  <Button onClick={handleSubmit} className="w-full" disabled={createLote.isPending}>
                    {createLote.isPending ? "Salvando..." : "Registrar Compra"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Filtros */}
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Posto</label>
                <Select value={filtroPostoId} onValueChange={setFiltroPostoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os postos" />
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

              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Filtro</label>
                <Select value={tipoFiltroData} onValueChange={setTipoFiltroData}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="periodo">Por Período</SelectItem>
                    <SelectItem value="especifica">Data Específica</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {tipoFiltroData === "periodo" ? (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Período</label>
                  <Select value={periodoFiltro} onValueChange={setPeriodoFiltro}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">Últimos 7 dias</SelectItem>
                      <SelectItem value="15">Últimos 15 dias</SelectItem>
                      <SelectItem value="30">Últimos 30 dias</SelectItem>
                      <SelectItem value="60">Últimos 60 dias</SelectItem>
                      <SelectItem value="90">Últimos 90 dias</SelectItem>
                      <SelectItem value="180">Últimos 180 dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Data (dd/mm/aaaa)</label>
                  <Input
                    type="date"
                    value={dataEspecifica}
                    onChange={(e) => setDataEspecifica(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filtroTab} onValueChange={setFiltroTab}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todas as Compras</SelectItem>
                    <SelectItem value="ativos">Apenas Lotes Ativos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Atalhos de data */}
            {tipoFiltroData === "especifica" && (
              <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
                <span className="text-sm text-muted-foreground mr-2 self-center">Atalhos:</span>
                <Button variant="outline" size="sm" onClick={setDataHoje}>
                  <Calendar className="h-3 w-3 mr-1" />
                  Hoje ({formatDateBR(new Date())})
                </Button>
                <Button variant="outline" size="sm" onClick={setDataOntem}>
                  Ontem ({formatDateBR(new Date(Date.now() - 86400000))})
                </Button>
              </div>
            )}

            {/* Indicador de período */}
            <div className="mt-4 pt-4 border-t flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                <strong>Período:</strong>{" "}
                {tipoFiltroData === "especifica" 
                  ? formatDateBR(dataEspecifica)
                  : `${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`
                }
              </p>
              <p className="text-sm text-muted-foreground">
                <strong>{lotesFiltrados.length}</strong> registros encontrados
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tabela de Compras/NFes */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Compras / Notas Fiscais
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(loadingAtivos || loadingTodos) ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : lotesFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma compra encontrada para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Tanque</TableHead>
                      <TableHead>Combustível</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Fornecedor</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotesFiltrados.map(lote => (
                      <TableRow key={lote.id}>
                        <TableCell>{formatDateBR(lote.dataEntrada)}</TableCell>
                        <TableCell className="font-medium">{lote.postoNome}</TableCell>
                        <TableCell>{lote.tanqueCodigo}</TableCell>
                        <TableCell>{lote.produtoDescricao}</TableCell>
                        <TableCell>{lote.numeroNf || '-'}</TableCell>
                        <TableCell>-</TableCell>
                        <TableCell className="text-right">{formatNumber(lote.quantidadeOriginal)} L</TableCell>
                        <TableCell className="text-right">{formatCurrency(lote.custoUnitario)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatCurrency(lote.custoTotal)}</TableCell>
                        <TableCell>
                          <Badge variant={lote.origem === "acs" ? "secondary" : "default"}>
                            {lote.origem === "acs" ? "ACS" : "Manual"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(lote)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            {lote.origem !== "acs" && (
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(lote.id, lote.origem || "manual")}>
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Dialog de Edição */}
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Editar Compra</DialogTitle>
            </DialogHeader>
            {editingLote && (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Posto: <strong>{editingLote.postoNome}</strong></p>
                  <p className="text-sm text-muted-foreground">Tanque: <strong>{editingLote.tanqueCodigo}</strong></p>
                  <p className="text-sm text-muted-foreground">Data: <strong>{formatDateBR(editingLote.dataEntrada)}</strong></p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Número NF</Label>
                    <Input 
                      value={editingLote.numeroNf || ''} 
                      onChange={e => setEditingLote({...editingLote, numeroNf: e.target.value})} 
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Custo Unit. (R$/L)</Label>
                    <Input 
                      type="number"
                      value={editingLote.custoUnitario || ''} 
                      onChange={e => setEditingLote({...editingLote, custoUnitario: e.target.value})} 
                      step="0.0001"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Chave NFe</Label>
                  <Input 
                    value={editingLote.chaveNfe || ''} 
                    onChange={e => setEditingLote({...editingLote, chaveNfe: e.target.value})} 
                    maxLength={44}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Input 
                    value={editingLote.fornecedorNome || ''} 
                    onChange={e => setEditingLote({...editingLote, fornecedorNome: e.target.value})} 
                  />
                </div>

                <div className="space-y-2">
                  <Label>Ordem do Lote (PEPS)</Label>
                  <Input 
                    type="number"
                    value={editingLote.ordemLote || ''} 
                    onChange={e => setEditingLote({...editingLote, ordemLote: parseInt(e.target.value) || null})} 
                    placeholder="Ordem para cálculo PEPS"
                  />
                </div>

                <Button onClick={handleUpdate} className="w-full" disabled={updateLote.isPending}>
                  {updateLote.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
