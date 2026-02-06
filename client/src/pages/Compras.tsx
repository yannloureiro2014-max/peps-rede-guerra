import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, FileText, Edit, Trash2, RefreshCw, AlertTriangle, Search, X } from "lucide-react";
import { useState, useMemo } from "react";


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
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

function getDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDefaultDataInicio(): string {
  const d = new Date();
  d.setDate(d.getDate() - 60);
  return getDateString(d);
}

export default function Compras() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingLote, setEditingLote] = useState<any>(null);
  const [deletingLote, setDeletingLote] = useState<any>(null);
  const [deleteJustificativa, setDeleteJustificativa] = useState("");
  
  // Form nova compra
  const [postoSelecionado, setPostoSelecionado] = useState<string>("");
  const [tanqueSelecionado, setTanqueSelecionado] = useState<string>("");
  const [numeroNf, setNumeroNf] = useState("");
  const [chaveNfe, setChaveNfe] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataEntrada, setDataEntrada] = useState(getDateString(new Date()));
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");
  const [ordemLote, setOrdemLote] = useState("");

  // Filtros - Data Inicial e Final
  const [filtroPostoId, setFiltroPostoId] = useState<string>("todos");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [dataInicio, setDataInicio] = useState<string>(getDefaultDataInicio());
  const [dataFim, setDataFim] = useState<string>(getDateString(new Date()));

  // Seleção múltipla para exclusão em lote
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [deleteMultiDialogOpen, setDeleteMultiDialogOpen] = useState(false);
  const [deleteMultiJustificativa, setDeleteMultiJustificativa] = useState("");

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: tanques } = trpc.tanques.byPosto.useQuery(
    { postoId: parseInt(postoSelecionado) },
    { enabled: !!postoSelecionado }
  );
  const { data: lotesAtivos, isLoading: loadingAtivos, refetch: refetchAtivos } = trpc.lotes.listAtivos.useQuery();
  const { data: todoLotes, isLoading: loadingTodos, refetch: refetchTodos } = trpc.lotes.list.useQuery();

  // Filtrar lotes por data inicial, data final, posto e status
  const lotesFiltrados = useMemo(() => {
    const lotes = filtroStatus === "ativos" ? lotesAtivos : todoLotes;
    if (!lotes) return [];
    
    return lotes.filter(lote => {
      // Filtro por posto
      if (filtroPostoId !== "todos" && lote.postoId !== parseInt(filtroPostoId)) {
        return false;
      }
      // Filtro por data inicial
      const dataLote = new Date(lote.dataEntrada).toISOString().split('T')[0];
      if (dataInicio && dataLote < dataInicio) {
        return false;
      }
      // Filtro por data final
      if (dataFim && dataLote > dataFim) {
        return false;
      }
      return true;
    });
  }, [filtroStatus, lotesAtivos, todoLotes, filtroPostoId, dataInicio, dataFim]);

  // Totais
  const totais = useMemo(() => {
    return lotesFiltrados.reduce((acc, lote) => ({
      quantidade: acc.quantidade + parseFloat(String(lote.quantidadeOriginal) || "0"),
      valor: acc.valor + parseFloat(String(lote.custoTotal) || "0"),
    }), { quantidade: 0, valor: 0 });
  }, [lotesFiltrados]);

  const createLote = trpc.lotes.create.useMutation({
    onSuccess: () => {
      alert("Compra registrada com sucesso!");
      setDialogOpen(false);
      resetForm();
      refetchAtivos();
      refetchTodos();
    },
    onError: (error: any) => {
      alert("Erro ao registrar compra: " + error.message);
    }
  });

  const updateLote = trpc.lotes.update.useMutation({
    onSuccess: () => {
      alert("Compra atualizada com sucesso!");
      setEditDialogOpen(false);
      setEditingLote(null);
      refetchAtivos();
      refetchTodos();
    },
    onError: (error: any) => {
      alert("Erro ao atualizar compra: " + error.message);
    }
  });

  const deleteLote = trpc.lotes.delete.useMutation({
    onSuccess: () => {
      setDeleteDialogOpen(false);
      setDeletingLote(null);
      setDeleteJustificativa("");
      refetchAtivos();
      refetchTodos();
    },
    onError: (error: any) => {
      alert("Erro ao excluir compra: " + error.message);
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
      alert("Preencha todos os campos obrigatórios");
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
    setEditingLote({ ...lote });
    setEditDialogOpen(true);
  };

  const handleUpdate = () => {
    if (!editingLote) return;
    
    updateLote.mutate({
      id: editingLote.id,
      numeroNf: editingLote.numeroNf,
      chaveNfe: editingLote.chaveNfe,
      custoUnitario: editingLote.custoUnitario?.toString(),
      quantidadeOriginal: editingLote.quantidadeOriginal?.toString(),
      justificativa: "Edição manual via interface",
    });
  };

  const handleDeleteClick = (lote: any) => {
    setDeletingLote(lote);
    setDeleteJustificativa("");
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (!deletingLote) return;
    deleteLote.mutate({ 
      id: deletingLote.id, 
      justificativa: deleteJustificativa || "Nota não necessária para DRE" 
    });
  };

  // Seleção múltipla
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === lotesFiltrados.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(lotesFiltrados.map(l => l.id)));
    }
  };

  const handleDeleteMultiConfirm = async () => {
    const ids = Array.from(selectedIds);
    let successCount = 0;
    let errorCount = 0;
    
    for (const id of ids) {
      try {
        await deleteLote.mutateAsync({ 
          id, 
          justificativa: deleteMultiJustificativa || "Exclusão em lote - Nota não necessária para DRE" 
        });
        successCount++;
      } catch {
        errorCount++;
      }
    }
    
    setDeleteMultiDialogOpen(false);
    setDeleteMultiJustificativa("");
    setSelectedIds(new Set());
    refetchAtivos();
    refetchTodos();
    
    alert(`${successCount} compra(s) excluída(s) com sucesso.${errorCount > 0 ? ` ${errorCount} erro(s).` : ''}`);
  };

  // Atalhos de período
  const setPeriodo = (dias: number) => {
    const fim = new Date();
    const inicio = new Date();
    inicio.setDate(inicio.getDate() - dias);
    setDataInicio(getDateString(inicio));
    setDataFim(getDateString(fim));
  };

  const setMesAtual = () => {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth(), 1);
    setDataInicio(getDateString(inicio));
    setDataFim(getDateString(now));
  };

  const setMesAnterior = () => {
    const now = new Date();
    const inicio = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const fim = new Date(now.getFullYear(), now.getMonth(), 0);
    setDataInicio(getDateString(inicio));
    setDataFim(getDateString(fim));
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
                          <SelectItem key={`novo-posto-${posto.id}`} value={posto.id.toString()}>
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
                          <SelectItem key={`novo-tanque-${tanque.id}`} value={tanque.id.toString()}>
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

                  {quantidade && custoUnitario ? (
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-sm text-muted-foreground">Valor Total:</p>
                      <p className="text-lg font-bold">
                        {formatCurrency(parseFloat(quantidade) * parseFloat(custoUnitario))}
                      </p>
                    </div>
                  ) : null}

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
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Search className="h-4 w-4" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Data Inicial */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Inicial</label>
                <Input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                />
              </div>

              {/* Data Final */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Data Final</label>
                <Input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                />
              </div>

              {/* Posto */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Posto</label>
                <Select value={filtroPostoId} onValueChange={setFiltroPostoId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Todos os postos" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Postos</SelectItem>
                    {postos?.map(posto => (
                      <SelectItem key={`filtro-posto-${posto.id}`} value={posto.id.toString()}>
                        {posto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <label className="text-sm font-medium">Status</label>
                <Select value={filtroStatus} onValueChange={setFiltroStatus}>
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

            {/* Atalhos de período */}
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground mr-2 self-center">Atalhos:</span>
              <Button variant="outline" size="sm" onClick={() => setPeriodo(7)}>7 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPeriodo(15)}>15 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPeriodo(30)}>30 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPeriodo(60)}>60 dias</Button>
              <Button variant="outline" size="sm" onClick={() => setPeriodo(90)}>90 dias</Button>
              <Button variant="outline" size="sm" onClick={setMesAtual}>Mês Atual</Button>
              <Button variant="outline" size="sm" onClick={setMesAnterior}>Mês Anterior</Button>
            </div>

            {/* Indicador de período e totais */}
            <div className="mt-4 pt-4 border-t flex flex-wrap justify-between items-center gap-2">
              <p className="text-sm text-muted-foreground">
                <strong>Período:</strong> {formatDateBR(dataInicio)} a {formatDateBR(dataFim)}
              </p>
              <div className="flex gap-4">
                <p className="text-sm text-muted-foreground">
                  <strong>{lotesFiltrados.length}</strong> registros
                </p>
                <p className="text-sm text-muted-foreground">
                  <strong>{formatNumber(totais.quantidade)}</strong> L
                </p>
                <p className="text-sm font-semibold">
                  {formatCurrency(totais.valor)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Barra de ações de seleção */}
        {selectedIds.size > 0 ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <span className="text-sm font-medium text-red-700">
                    {selectedIds.size} compra(s) selecionada(s)
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => setSelectedIds(new Set())}
                  >
                    <X className="h-4 w-4 mr-1" />
                    Limpar Seleção
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => {
                      setDeleteMultiJustificativa("");
                      setDeleteMultiDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Excluir Selecionadas
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}

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
                      <TableHead className="w-10">
                        <input 
                          type="checkbox" 
                          checked={selectedIds.size === lotesFiltrados.length && lotesFiltrados.length > 0}
                          onChange={toggleSelectAll}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                      </TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Posto</TableHead>
                      <TableHead>Tanque</TableHead>
                      <TableHead>Combustível</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead className="text-right">Quantidade</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Origem</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotesFiltrados.map(lote => (
                      <TableRow 
                        key={`lote-${lote.id}`} 
                        className={selectedIds.has(lote.id) ? "bg-red-50" : undefined}
                      >
                        <TableCell>
                          <input 
                            type="checkbox" 
                            checked={selectedIds.has(lote.id)}
                            onChange={() => toggleSelect(lote.id)}
                            className="h-4 w-4 rounded border-gray-300"
                          />
                        </TableCell>
                        <TableCell className="whitespace-nowrap">{formatDateBR(lote.dataEntrada)}</TableCell>
                        <TableCell className="font-medium">{lote.postoNome}</TableCell>
                        <TableCell>{lote.tanqueCodigo}</TableCell>
                        <TableCell>{lote.produtoDescricao}</TableCell>
                        <TableCell>{lote.numeroNf || '-'}</TableCell>
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
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(lote)} title="Editar compra">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              onClick={() => handleDeleteClick(lote)}
                              title="Excluir compra"
                            >
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
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
            {editingLote ? (
              <div className="space-y-4 py-4">
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm text-muted-foreground">Posto: <strong>{editingLote.postoNome}</strong></p>
                  <p className="text-sm text-muted-foreground">Tanque: <strong>{editingLote.tanqueCodigo}</strong></p>
                  <p className="text-sm text-muted-foreground">Data: <strong>{formatDateBR(editingLote.dataEntrada)}</strong></p>
                  <p className="text-sm text-muted-foreground">Origem: <strong>{editingLote.origem === "acs" ? "ACS" : "Manual"}</strong></p>
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
                  <Label>Quantidade (L)</Label>
                  <Input 
                    type="number"
                    value={editingLote.quantidadeOriginal || ''} 
                    onChange={e => setEditingLote({...editingLote, quantidadeOriginal: e.target.value})} 
                    step="0.001"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Chave NFe</Label>
                  <Input 
                    value={editingLote.chaveNfe || ''} 
                    onChange={e => setEditingLote({...editingLote, chaveNfe: e.target.value})} 
                    maxLength={44}
                  />
                </div>

                {editingLote.quantidadeOriginal && editingLote.custoUnitario ? (
                  <div className="p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">Valor Total Atualizado:</p>
                    <p className="text-lg font-bold">
                      {formatCurrency(parseFloat(editingLote.quantidadeOriginal) * parseFloat(editingLote.custoUnitario))}
                    </p>
                  </div>
                ) : null}

                <Button onClick={handleUpdate} className="w-full" disabled={updateLote.isPending}>
                  {updateLote.isPending ? "Salvando..." : "Salvar Alterações"}
                </Button>
              </div>
            ) : null}
          </DialogContent>
        </Dialog>

        {/* Dialog de Confirmação de Exclusão Individual */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Confirmar Exclusão
              </DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. A compra será removida permanentemente do sistema.
              </DialogDescription>
            </DialogHeader>
            {deletingLote ? (
              <div className="space-y-4 py-2">
                <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                  <p className="text-sm"><strong>Posto:</strong> {deletingLote.postoNome}</p>
                  <p className="text-sm"><strong>NF:</strong> {deletingLote.numeroNf || 'Sem NF'}</p>
                  <p className="text-sm"><strong>Data:</strong> {formatDateBR(deletingLote.dataEntrada)}</p>
                  <p className="text-sm"><strong>Combustível:</strong> {deletingLote.produtoDescricao}</p>
                  <p className="text-sm"><strong>Quantidade:</strong> {formatNumber(deletingLote.quantidadeOriginal)} L</p>
                  <p className="text-sm"><strong>Valor:</strong> {formatCurrency(deletingLote.custoTotal)}</p>
                  <p className="text-sm"><strong>Origem:</strong> {deletingLote.origem === "acs" ? "ACS" : "Manual"}</p>
                </div>

                <div className="space-y-2">
                  <Label>Justificativa (opcional)</Label>
                  <Input 
                    value={deleteJustificativa} 
                    onChange={e => setDeleteJustificativa(e.target.value)}
                    placeholder="Ex: Nota não necessária para DRE, nota duplicada..."
                  />
                </div>
              </div>
            ) : null}
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteConfirm}
                disabled={deleteLote.isPending}
              >
                {deleteLote.isPending ? "Excluindo..." : "Excluir Compra"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de Exclusão em Lote */}
        <Dialog open={deleteMultiDialogOpen} onOpenChange={setDeleteMultiDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="h-5 w-5" />
                Excluir {selectedIds.size} Compra(s)
              </DialogTitle>
              <DialogDescription>
                Esta ação não pode ser desfeita. Todas as compras selecionadas serão removidas permanentemente.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="p-3 bg-red-50 rounded-lg border border-red-200">
                <p className="text-sm font-medium text-red-700">
                  {selectedIds.size} compra(s) serão excluídas permanentemente.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Justificativa (opcional)</Label>
                <Input 
                  value={deleteMultiJustificativa} 
                  onChange={e => setDeleteMultiJustificativa(e.target.value)}
                  placeholder="Ex: Notas não necessárias para DRE..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteMultiDialogOpen(false)}>
                Cancelar
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleDeleteMultiConfirm}
                disabled={deleteLote.isPending}
              >
                {deleteLote.isPending ? "Excluindo..." : `Excluir ${selectedIds.size} Compra(s)`}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
