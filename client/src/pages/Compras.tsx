import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Plus, Package } from "lucide-react";
import { useState } from "react";
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

export default function Compras() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [postoSelecionado, setPostoSelecionado] = useState<string>("");
  const [tanqueSelecionado, setTanqueSelecionado] = useState<string>("");
  const [numeroNf, setNumeroNf] = useState("");
  const [fornecedor, setFornecedor] = useState("");
  const [dataEntrada, setDataEntrada] = useState(new Date().toISOString().split('T')[0]);
  const [quantidade, setQuantidade] = useState("");
  const [custoUnitario, setCustoUnitario] = useState("");

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: tanques } = trpc.tanques.byPosto.useQuery(
    { postoId: parseInt(postoSelecionado) },
    { enabled: !!postoSelecionado }
  );
  const { data: lotes, isLoading, refetch } = trpc.lotes.listAtivos.useQuery();
  const utils = trpc.useUtils();

  const createLote = trpc.lotes.create.useMutation({
    onSuccess: () => {
      toast.success("Compra registrada com sucesso!");
      setDialogOpen(false);
      resetForm();
      utils.lotes.listAtivos.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao registrar compra: " + error.message);
    }
  });

  const resetForm = () => {
    setPostoSelecionado("");
    setTanqueSelecionado("");
    setNumeroNf("");
    setFornecedor("");
    setDataEntrada(new Date().toISOString().split('T')[0]);
    setQuantidade("");
    setCustoUnitario("");
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
      fornecedorNome: fornecedor,
      dataEntrada,
      quantidadeOriginal: quantidade,
      custoUnitario,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Compras (Lotes)</h1>
            <p className="text-muted-foreground">Registro de compras de combustível para cálculo PEPS</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Compra
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
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
                  <Label>Fornecedor</Label>
                  <Input value={fornecedor} onChange={e => setFornecedor(e.target.value)} placeholder="Nome do fornecedor" />
                </div>

                <div className="grid grid-cols-2 gap-4">
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

        {/* Lotes Ativos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-5 w-5" />
              Lotes Ativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !lotes || lotes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum lote ativo. Registre compras para criar lotes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Posto</TableHead>
                      <TableHead>Tanque</TableHead>
                      <TableHead>Combustível</TableHead>
                      <TableHead>NF</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">Qtd Original</TableHead>
                      <TableHead className="text-right">Disponível</TableHead>
                      <TableHead className="text-right">Custo Unit.</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {lotes.map(lote => (
                      <TableRow key={lote.id}>
                        <TableCell className="font-medium">{lote.postoNome}</TableCell>
                        <TableCell>{lote.tanqueCodigo}</TableCell>
                        <TableCell>{lote.produtoDescricao}</TableCell>
                        <TableCell>{lote.numeroNf || '-'}</TableCell>
                        <TableCell>{new Date(lote.dataEntrada).toLocaleDateString('pt-BR')}</TableCell>
                        <TableCell className="text-right">{formatNumber(lote.quantidadeOriginal)} L</TableCell>
                        <TableCell className="text-right font-semibold">{formatNumber(lote.quantidadeDisponivel)} L</TableCell>
                        <TableCell className="text-right">{formatCurrency(lote.custoUnitario)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
