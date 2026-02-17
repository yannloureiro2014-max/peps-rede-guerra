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

const POSTOS = [
  { id: "1", nome: "Fotim" },
  { id: "2", nome: "Palhano" },
  { id: "3", nome: "Itaiçaba (Novo Guerra)" },
  { id: "4", nome: "Pai Tereza" },
  { id: "5", nome: "Rede Super Petróleo (Mãe e Filho)" },
  { id: "6", nome: "Jaguaruana (Novo Jaguaruana)" },
];

const TANQUES: Record<string, Array<{ id: string; nome: string }>> = {
  "1": [{ id: "1", nome: "Tanque 1" }, { id: "2", nome: "Tanque 2" }],
  "2": [{ id: "3", nome: "Tanque 1" }, { id: "4", nome: "Tanque 2" }],
  "3": [{ id: "5", nome: "Tanque 1" }],
  "4": [{ id: "6", nome: "Tanque 1" }, { id: "7", nome: "Tanque 2" }],
  "5": [{ id: "8", nome: "Tanque 1" }, { id: "9", nome: "Tanque 2" }],
  "6": [{ id: "10", nome: "Tanque 1" }],
};

export default function AlocacoesSEFAZ() {
  const [nfes, setNfes] = useState<NFe[]>([]);
  const [alocacoes, setAlocacoes] = useState<Alocacao[]>([]);
  const [loading, setLoading] = useState(false);
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNfe, setSelectedNfe] = useState<NFe | null>(null);

  // Filtros
  const [filtros, setFiltros] = useState({
    postoId: "",
    dataInicio: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0],
    dataFim: new Date().toISOString().split("T")[0],
  });

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

  const buscarNfes = async () => {
    setLoading(true);
    try {
      const response = await trpc.alocacoesFisicas.listarNfesPendentes.useQuery({
        dataInicio: filtros.dataInicio,
        dataFim: filtros.dataFim,
      }).data;

      if (response?.sucesso) {
        let nfesFiltered = response.dados || [];

        // Filtrar por posto se selecionado
        if (filtros.postoId) {
          const postoSelecionado = POSTOS.find((p) => p.id === filtros.postoId);
          if (postoSelecionado) {
            nfesFiltered = nfesFiltered.filter(
              (nfe) => nfe.postoDestino.toLowerCase() === postoSelecionado.nome.toLowerCase()
            );
          }
        }

        setNfes(nfesFiltered);
      } else {
        alert("Erro ao buscar NFes: " + response?.erro);
      }
    } catch (error) {
      console.error("Erro ao buscar NFes:", error);
      alert("Erro ao buscar NFes: " + (error instanceof Error ? error.message : "Erro desconhecido"));
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

  const tanquesSelecionados = novaAlocacao.postoDestino ? TANQUES[novaAlocacao.postoDestino] || [] : [];

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
                  <CardTitle>Filtros de Busca</CardTitle>
                  <CardDescription>
                    Selecione o período e o posto para buscar NFes não alocadas
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Filtro: Posto */}
                    <div>
                      <Label htmlFor="posto">Posto</Label>
                      <Select value={filtros.postoId} onValueChange={(value) => setFiltros({ ...filtros, postoId: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um posto" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Todos os postos</SelectItem>
                          {POSTOS.map((posto) => (
                            <SelectItem key={posto.id} value={posto.id}>
                              {posto.nome}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Filtro: Data Início */}
                    <div>
                      <Label htmlFor="dataInicio">Data Inicial</Label>
                      <Input
                        type="date"
                        value={filtros.dataInicio}
                        onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                      />
                    </div>

                    {/* Filtro: Data Fim */}
                    <div>
                      <Label htmlFor="dataFim">Data Final</Label>
                      <Input
                        type="date"
                        value={filtros.dataFim}
                        onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                      />
                    </div>
                  </div>

                  <Button onClick={buscarNfes} disabled={loading} className="w-full">
                    <Search className="mr-2 h-4 w-4" />
                    {loading ? "Buscando..." : "Buscar NFes"}
                  </Button>
                </CardContent>
              </Card>

              {nfes.length > 0 && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600">
                    {nfes.length} NFe(s) encontrada(s) - {nfes.filter((n) => n.statusAlocacao === "pendente").length} pendente(s)
                  </div>

                  {nfes.map((nfe: NFe) => (
                    <Card key={nfe.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                          <div>
                            <Label className="text-xs text-slate-500">Número NF</Label>
                            <p className="font-mono text-sm">{nfe.numeroNf}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Data Emissão</Label>
                            <p className="text-sm">{new Date(nfe.dataEmissao).toLocaleDateString("pt-BR")}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Quantidade (L)</Label>
                            <p className="text-sm font-semibold">{nfe.quantidade.toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Status</Label>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusBadge(nfe.statusAlocacao)}`}>
                              {nfe.statusAlocacao}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 text-sm">
                          <div>
                            <Label className="text-xs text-slate-500">Custo Total</Label>
                            <p className="font-semibold">R$ {nfe.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Custo Unitário</Label>
                            <p className="font-semibold">R$ {nfe.custoUnitario.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        <Dialog open={openDialog && selectedNfe?.id === nfe.id} onOpenChange={setOpenDialog}>
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
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
                                NF {nfe.numeroNf} - {nfe.quantidade.toLocaleString("pt-BR")} L
                              </DialogDescription>
                            </DialogHeader>

                            <div className="space-y-4">
                              {/* Volume */}
                              <div>
                                <Label>Volume a Alocar (L) *</Label>
                                <Input
                                  type="number"
                                  placeholder="0"
                                  value={novaAlocacao.volumeAlocado}
                                  onChange={(e) => setNovaAlocacao({ ...novaAlocacao, volumeAlocado: e.target.value })}
                                  max={nfe.quantidadePendente}
                                />
                                <p className="text-xs text-slate-500 mt-1">Máximo: {nfe.quantidadePendente.toLocaleString("pt-BR")} L</p>
                              </div>

                              {/* Posto */}
                              <div>
                                <Label>Posto de Destino *</Label>
                                <Select value={novaAlocacao.postoDestino} onValueChange={(value) => setNovaAlocacao({ ...novaAlocacao, postoDestino: value, tanqueDestino: "" })}>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione um posto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {POSTOS.map((posto) => (
                                      <SelectItem key={posto.id} value={posto.id}>
                                        {posto.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Tanque */}
                              <div>
                                <Label>Tanque de Destino *</Label>
                                <Select value={novaAlocacao.tanqueDestino} onValueChange={(value) => setNovaAlocacao({ ...novaAlocacao, tanqueDestino: value })}>
                                  <SelectTrigger disabled={!novaAlocacao.postoDestino}>
                                    <SelectValue placeholder="Selecione um tanque" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {tanquesSelecionados.map((tanque) => (
                                      <SelectItem key={tanque.id} value={tanque.id}>
                                        {tanque.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Data de Descarga */}
                              <div>
                                <Label>Data de Descarga Real *</Label>
                                <Input
                                  type="date"
                                  value={novaAlocacao.dataDescarga}
                                  onChange={(e) => setNovaAlocacao({ ...novaAlocacao, dataDescarga: e.target.value })}
                                />
                              </div>

                              {/* Hora de Descarga */}
                              <div>
                                <Label>Hora de Descarga (opcional)</Label>
                                <Input
                                  type="time"
                                  value={novaAlocacao.horaDescarga}
                                  onChange={(e) => setNovaAlocacao({ ...novaAlocacao, horaDescarga: e.target.value })}
                                />
                              </div>

                              {/* Justificativa */}
                              <div>
                                <Label>Justificativa (se CNPJ diferente)</Label>
                                <Textarea
                                  placeholder="Ex: Compra com CNPJ X, descarga em Y"
                                  value={novaAlocacao.justificativa}
                                  onChange={(e) => setNovaAlocacao({ ...novaAlocacao, justificativa: e.target.value })}
                                  rows={3}
                                />
                              </div>

                              <Button onClick={handleAlocar} className="w-full">
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Confirmar Alocação
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
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <p>Nenhuma NFe encontrada com os filtros selecionados</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: NFes Alocadas */}
            <TabsContent value="alocadas" className="space-y-4">
              <Card>
                <CardContent className="pt-6 text-center text-slate-500">
                  <p>Funcionalidade em desenvolvimento</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tab: Alocações Realizadas */}
            <TabsContent value="realizadas" className="space-y-4">
              <Card>
                <CardContent className="pt-6 text-center text-slate-500">
                  <p>Funcionalidade em desenvolvimento</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  );
}
