import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Plus, Ruler, AlertTriangle, CheckCircle, TrendingUp } from "lucide-react";
import { useState, useEffect } from "react";
import { toast } from "sonner";

function formatNumber(value: string | number | null | undefined): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  if (num === null || num === undefined || isNaN(num)) return '0';
  return new Intl.NumberFormat('pt-BR').format(num);
}

export default function Medicoes() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [postoSelecionado, setPostoSelecionado] = useState<string>("");
  const [tanqueSelecionado, setTanqueSelecionado] = useState<string>("");
  const [dataMedicao, setDataMedicao] = useState(new Date().toISOString().split('T')[0]);
  const [horaMedicao, setHoraMedicao] = useState(new Date().toTimeString().slice(0, 5));
  const [volumeMedido, setVolumeMedido] = useState("");
  const [temperatura, setTemperatura] = useState("25");
  const [observacoes, setObservacoes] = useState("");
  const [estoqueEscritural, setEstoqueEscritural] = useState<number>(0);

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: tanques } = trpc.tanques.byPosto.useQuery(
    { postoId: parseInt(postoSelecionado) },
    { enabled: !!postoSelecionado }
  );
  const { data: estoque } = trpc.tanques.getEstoque.useQuery(
    { tanqueId: parseInt(tanqueSelecionado) },
    { enabled: !!tanqueSelecionado }
  );
  const { data: medicoes, isLoading } = trpc.medicoes.list.useQuery({ limite: 100 });
  const utils = trpc.useUtils();

  useEffect(() => {
    if (estoque) {
      setEstoqueEscritural(parseFloat(estoque));
    }
  }, [estoque]);

  const createMedicao = trpc.medicoes.create.useMutation({
    onSuccess: () => {
      toast.success("Medição registrada com sucesso!");
      setDialogOpen(false);
      resetForm();
      utils.medicoes.list.invalidate();
    },
    onError: (error) => {
      toast.error("Erro ao registrar medição: " + error.message);
    }
  });

  const resetForm = () => {
    setPostoSelecionado("");
    setTanqueSelecionado("");
    setDataMedicao(new Date().toISOString().split('T')[0]);
    setHoraMedicao(new Date().toTimeString().slice(0, 5));
    setVolumeMedido("");
    setTemperatura("25");
    setObservacoes("");
    setEstoqueEscritural(0);
  };

  const handleSubmit = () => {
    if (!tanqueSelecionado || !volumeMedido) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const volume = parseFloat(volumeMedido);
    const diferenca = volume - estoqueEscritural;
    const percentual = estoqueEscritural > 0 ? (diferenca / estoqueEscritural) * 100 : 0;
    const tipo: "sobra" | "perda" | "ok" = diferenca > 0 ? "sobra" : diferenca < 0 ? "perda" : "ok";

    createMedicao.mutate({
      tanqueId: parseInt(tanqueSelecionado),
      postoId: parseInt(postoSelecionado),
      dataMedicao,
      horaMedicao,
      volumeMedido: volumeMedido,
      temperatura,
      estoqueEscritural: estoqueEscritural.toString(),
      observacoes,
    });
  };

  const diferenca = volumeMedido ? parseFloat(volumeMedido) - estoqueEscritural : 0;
  const percentual = estoqueEscritural > 0 ? (diferenca / estoqueEscritural) * 100 : 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Medições Físicas</h1>
            <p className="text-muted-foreground">Registro de medições para conferência de estoque</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nova Medição
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Registrar Medição Física</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm text-orange-800">
                    <strong>Importante:</strong> A medição física NÃO altera o estoque escritural. 
                    Serve apenas para conferência e identificação de diferenças.
                  </p>
                </div>

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
                    <Label>Data *</Label>
                    <Input type="date" value={dataMedicao} onChange={e => setDataMedicao(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Hora</Label>
                    <Input type="time" value={horaMedicao} onChange={e => setHoraMedicao(e.target.value)} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Volume Medido (L) *</Label>
                    <Input 
                      type="number" 
                      value={volumeMedido} 
                      onChange={e => setVolumeMedido(e.target.value)} 
                      placeholder="5000"
                      step="0.001"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Temperatura (°C)</Label>
                    <Input 
                      type="number" 
                      value={temperatura} 
                      onChange={e => setTemperatura(e.target.value)} 
                      step="0.1"
                    />
                  </div>
                </div>

                {tanqueSelecionado && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Estoque Escritural:</span>
                      <span className="font-semibold">{formatNumber(estoqueEscritural)} L</span>
                    </div>
                    {volumeMedido && (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Volume Medido:</span>
                          <span className="font-semibold">{formatNumber(volumeMedido)} L</span>
                        </div>
                        <div className="flex justify-between text-sm border-t pt-2">
                          <span className="text-muted-foreground">Diferença:</span>
                          <span className={`font-bold ${diferenca > 0 ? 'text-green-600' : diferenca < 0 ? 'text-red-600' : ''}`}>
                            {diferenca > 0 ? '+' : ''}{formatNumber(diferenca)} L ({percentual.toFixed(2)}%)
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea 
                    value={observacoes} 
                    onChange={e => setObservacoes(e.target.value)} 
                    placeholder="Observações sobre a medição..."
                    rows={2}
                  />
                </div>

                <Button onClick={handleSubmit} className="w-full" disabled={createMedicao.isPending}>
                  {createMedicao.isPending ? "Salvando..." : "Registrar Medição"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Histórico de Medições */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Ruler className="h-5 w-5" />
              Histórico de Medições
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !medicoes || medicoes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma medição registrada ainda.
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
                      <TableHead className="text-right">Vol. Medido</TableHead>
                      <TableHead className="text-right">Est. Escritural</TableHead>
                      <TableHead className="text-right">Diferença</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {medicoes.map(med => {
                      const dif = parseFloat(med.diferenca || '0');
                      const pct = parseFloat(med.percentualDiferenca || '0');
                      return (
                        <TableRow key={med.id}>
                          <TableCell>{new Date(med.dataMedicao).toLocaleDateString('pt-BR')}</TableCell>
                          <TableCell className="font-medium">{med.postoNome}</TableCell>
                          <TableCell>{med.tanqueCodigo}</TableCell>
                          <TableCell>{med.produtoDescricao}</TableCell>
                          <TableCell className="text-right">{formatNumber(med.volumeMedido)} L</TableCell>
                          <TableCell className="text-right">{formatNumber(med.estoqueEscritural)} L</TableCell>
                          <TableCell className={`text-right font-semibold ${dif > 0 ? 'text-green-600' : dif < 0 ? 'text-red-600' : ''}`}>
                            {dif > 0 ? '+' : ''}{formatNumber(dif)} L ({pct.toFixed(2)}%)
                          </TableCell>
                          <TableCell>
                            {med.tipoDiferenca === 'ok' ? (
                              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                OK
                              </Badge>
                            ) : med.tipoDiferenca === 'sobra' ? (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                <TrendingUp className="h-3 w-3 mr-1" />
                                Sobra
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Perda
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
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
