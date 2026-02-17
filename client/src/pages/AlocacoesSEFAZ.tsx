import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle, Clock, Download, Plus, Search, Trash2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";


interface NFe {
  id: string;
  chaveNfe: string;
  numeroNf: string;
  serieNf: string;
  dataEmissao: string;
  cnpjFaturado: string;
  cnpjFornecedor: string;
  postoDestino: string;
  produto: string;
  quantidade: number;
  custoUnitario: number;
  custoTotal: number;
  statusAlocacao: "pendente" | "parcial" | "alocada";
  quantidadePendente: number;
}

interface Alocacao {
  id: string;
  chaveNfe: string;
  numeroNf: string;
  postoDestino: string;
  tanqueDestino: string;
  volumeAlocado: number;
  dataDescarga: string;
  horaDescarga?: string;
  custoUnitario: number;
  custoTotal: number;
  justificativa?: string;
  dataAlocacao: string;
}

export default function AlocacoesSEFAZ() {
  const [nfes, setNfes] = useState<NFe[]>([]);
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNfe, setSelectedNfe] = useState<NFe | null>(null);

  // Formulário de alocação
  const [novaAlocacao, setNovaAlocacao] = useState({
    volumeAlocado: "",
    postoDestino: "",
    tanqueDestino: "",
    dataDescarga: new Date().toISOString().split("T")[0],
    horaDescarga: "",
    justificativa: "",
  });

  // tRPC mutations
  const criarAlocacaoMutation = trpc.alocacoesFisicas.criarAlocacao.useMutation({
    onSuccess: () => {
      alert("Alocação criada com sucesso!");
      setOpenDialog(false);
      setSelectedNfe(null);
      setNovaAlocacao({
        volumeAlocado: "",
        postoDestino: "",
        tanqueDestino: "",
        dataDescarga: new Date().toISOString().split("T")[0],
        horaDescarga: "",
        justificativa: "",
      });
      buscarNfes();
    },
    onError: (error) => {
      alert("Erro ao criar alocação: " + (error instanceof Error ? error.message : "Erro desconhecido"));
    },
  });

  const recalcularCMVMutation = trpc.alocacoesFisicas.recalcularCMVComAlocacoes.useMutation({
    onSuccess: (data: any) => {
      alert(`CMV Recalculado: ${data?.dados?.totalAlocacoes || 0} alocações processadas`);
    },
  });

  const buscarNfes = async () => {
    setLoading(true);
    try {
      const response = await trpc.alocacoesFisicas.listarNfesPendentes.useQuery({});
      if (response.data?.sucesso) {
        setNfes(response.data.dados);
      }
    } catch (error) {
      alert("Erro ao buscar NFes");
    } finally {
      setLoading(false);
    }
  };

  const handleAlocar = async () => {
    if (!selectedNfe || !novaAlocacao.volumeAlocado || !novaAlocacao.postoDestino || !novaAlocacao.tanqueDestino) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      await criarAlocacaoMutation.mutateAsync({
        chaveNfe: selectedNfe.chaveNfe,
        numeroNf: selectedNfe.numeroNf,
        serieNf: selectedNfe.serieNf,
        dataEmissao: selectedNfe.dataEmissao,
        postoDestinoId: parseInt(novaAlocacao.postoDestino),
        tanqueDestinoId: parseInt(novaAlocacao.tanqueDestino),
        dataDescargaReal: novaAlocacao.dataDescarga,
        horaDescargaReal: novaAlocacao.horaDescarga,
        volumeAlocado: parseFloat(novaAlocacao.volumeAlocado),
        custoUnitarioAplicado: selectedNfe.custoUnitario,
        justificativa: novaAlocacao.justificativa,
      });

      // Recalcular CMV automaticamente
      await recalcularCMVMutation.mutateAsync({
        dataInicio: novaAlocacao.dataDescarga,
        dataFim: novaAlocacao.dataDescarga,
      });
    } catch (error) {
      console.error("Erro ao alocar:", error);
    }
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      pendente: "bg-yellow-100 text-yellow-800",
      parcial: "bg-blue-100 text-blue-800",
      alocada: "bg-green-100 text-green-800",
    };
    return colors[status] || "bg-gray-100 text-gray-800";
  };

  return (
    <DashboardLayout>
      <div className="flex-1 overflow-auto">
        <div className="p-8 max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Alocações SEFAZ</h1>
            <p className="text-slate-600">
              Aloque NFes da SEFAZ para postos e tanques específicos, mesmo quando comprado por CNPJ diferente
            </p>
          </div>

          {/* Alertas */}
          <Alert className="mb-6 border-blue-200 bg-blue-50">
            <AlertCircle className="h-4 w-4 text-blue-600" />
            <AlertDescription className="text-blue-800">
              As alocações utilizam a data de descarga real (não fiscal) para cálculo de PEPS. O sistema busca automaticamente NFes da SEFAZ.
            </AlertDescription>
          </Alert>

          {/* Tabs */}
          <Tabs defaultValue="pendentes" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pendentes">NFes Pendentes</TabsTrigger>
              <TabsTrigger value="alocadas">NFes Alocadas</TabsTrigger>
              <TabsTrigger value="realizadas">Alocações Realizadas</TabsTrigger>
            </TabsList>

            {/* Tab: NFes Pendentes */}
            <TabsContent value="pendentes" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Buscar NFes</CardTitle>
                  <CardDescription>
                    Clique em "Buscar NFes" para carregar as notas fiscais da SEFAZ
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Button onClick={buscarNfes} disabled={loading} className="w-full">
                    <Search className="mr-2 h-4 w-4" />
                    {loading ? "Buscando..." : "Buscar NFes da SEFAZ"}
                  </Button>
                </CardContent>
              </Card>

              {nfes.length > 0 && (
                <div className="space-y-4">
                  {nfes.map((nfe) => (
                    <Card key={nfe.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <Label className="text-xs text-slate-500">Chave NFe</Label>
                            <p className="font-mono text-sm">{nfe.chaveNfe.slice(0, 20)}...</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Produto</Label>
                            <p className="font-medium">{nfe.produto}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Quantidade</Label>
                            <p className="font-medium">{nfe.quantidade.toLocaleString("pt-BR")} L</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Status</Label>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${statusBadge(nfe.statusAlocacao)}`}>
                              {nfe.statusAlocacao}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4 text-sm">
                          <div>
                            <Label className="text-xs text-slate-500">Custo Unitário</Label>
                            <p>R$ {nfe.custoUnitario.toFixed(2)}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Custo Total</Label>
                            <p className="font-medium">R$ {nfe.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Pendente</Label>
                            <p className="text-orange-600 font-medium">{nfe.quantidadePendente.toLocaleString("pt-BR")} L</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Data Emissão</Label>
                            <p>{new Date(nfe.dataEmissao).toLocaleDateString("pt-BR")}</p>
                          </div>
                        </div>

                        <Dialog open={openDialog && selectedNfe?.id === nfe.id} onOpenChange={(open) => {
                          if (!open) {
                            setOpenDialog(false);
                            setSelectedNfe(null);
                          }
                        }}>
                          <DialogTrigger asChild>
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => {
                                setSelectedNfe(nfe);
                                setOpenDialog(true);
                              }}
                              disabled={nfe.statusAlocacao === "alocada"}
                            >
                              <Plus className="mr-2 h-4 w-4" />
                              Alocar
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-md">
                            <DialogHeader>
                              <DialogTitle>Alocar NFe</DialogTitle>
                              <DialogDescription>
                                Aloque a NFe {nfe.numeroNf} para um tanque específico
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              <div>
                                <Label htmlFor="volume">Volume a Alocar (L)*</Label>
                                <Input
                                  id="volume"
                                  type="number"
                                  placeholder="Ex: 1000"
                                  value={novaAlocacao.volumeAlocado}
                                  onChange={(e) =>
                                    setNovaAlocacao({ ...novaAlocacao, volumeAlocado: e.target.value })
                                  }
                                  max={nfe.quantidadePendente}
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                  Máximo: {nfe.quantidadePendente.toLocaleString("pt-BR")} L
                                </p>
                              </div>

                              <div>
                                <Label htmlFor="posto">Posto de Destino*</Label>
                                <Select value={novaAlocacao.postoDestino} onValueChange={(value) =>
                                  setNovaAlocacao({ ...novaAlocacao, postoDestino: value })
                                }>
                                  <SelectTrigger id="posto">
                                    <SelectValue placeholder="Selecione um posto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">Fotim</SelectItem>
                                    <SelectItem value="2">Palhano</SelectItem>
                                    <SelectItem value="3">Itaiçaba (Novo Guerra)</SelectItem>
                                    <SelectItem value="4">Pai Tereza</SelectItem>
                                    <SelectItem value="5">Rede Super Petróleo (Mãe e Filho)</SelectItem>
                                    <SelectItem value="6">Jaguaruana (Novo Jaguaruana)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="tanque">Tanque de Destino*</Label>
                                <Select value={novaAlocacao.tanqueDestino} onValueChange={(value) =>
                                  setNovaAlocacao({ ...novaAlocacao, tanqueDestino: value })
                                }>
                                  <SelectTrigger id="tanque">
                                    <SelectValue placeholder="Selecione um tanque" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="1">Tanque 1</SelectItem>
                                    <SelectItem value="2">Tanque 2</SelectItem>
                                    <SelectItem value="3">Tanque 3</SelectItem>
                                    <SelectItem value="4">Tanque 4</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              <div>
                                <Label htmlFor="data">Data de Descarga Real*</Label>
                                <Input
                                  id="data"
                                  type="date"
                                  value={novaAlocacao.dataDescarga}
                                  onChange={(e) =>
                                    setNovaAlocacao({ ...novaAlocacao, dataDescarga: e.target.value })
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="hora">Hora de Descarga (opcional)</Label>
                                <Input
                                  id="hora"
                                  type="time"
                                  value={novaAlocacao.horaDescarga}
                                  onChange={(e) =>
                                    setNovaAlocacao({ ...novaAlocacao, horaDescarga: e.target.value })
                                  }
                                />
                              </div>

                              <div>
                                <Label htmlFor="justificativa">Justificativa (se necessário)</Label>
                                <Textarea
                                  id="justificativa"
                                  placeholder="Ex: Compra com CNPJ X, descarga em Y"
                                  value={novaAlocacao.justificativa}
                                  onChange={(e) =>
                                    setNovaAlocacao({ ...novaAlocacao, justificativa: e.target.value })
                                  }
                                  rows={3}
                                />
                              </div>

                              <Button onClick={handleAlocar} disabled={criarAlocacaoMutation.isPending} className="w-full">
                                {criarAlocacaoMutation.isPending ? "Alocando..." : "Confirmar Alocação"}
                              </Button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {!loading && nfes.length === 0 && (
                <Card className="text-center py-12">
                  <AlertCircle className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                  <p className="text-slate-500">Nenhuma NFe encontrada. Clique em "Buscar NFes" para carregar.</p>
                </Card>
              )}
            </TabsContent>

            {/* Tab: NFes Alocadas */}
            <TabsContent value="alocadas">
              <Card>
                <CardHeader>
                  <CardTitle>NFes Alocadas</CardTitle>
                  <CardDescription>
                    Notas fiscais que foram alocadas para postos e tanques
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
                    <p className="text-slate-600">As NFes alocadas aparecem aqui</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Alocações Realizadas */}
            <TabsContent value="realizadas">
              <Card>
                <CardHeader>
                  <CardTitle>Histórico de Alocações</CardTitle>
                  <CardDescription>
                    Todas as alocações realizadas com data e detalhes
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12">
                    <Clock className="h-12 w-12 text-blue-500 mx-auto mb-4" />
                    <p className="text-slate-600">O histórico de alocações aparece aqui</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
