import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle, Plus, Search, RefreshCw } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

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
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNfeId, setSelectedNfeId] = useState<string | null>(null);

  // Filtros
  const [filtroPostoId, setFiltroPostoId] = useState("todos");
  const [dataInicio] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dataFim] = useState(() => new Date().toISOString().split("T")[0]);
  const [dataInicioInput, setDataInicioInput] = useState(dataInicio);
  const [dataFimInput, setDataFimInput] = useState(dataFim);

  // Parâmetros de busca estabilizados
  const [searchParams, setSearchParams] = useState<{ dataInicio: string; dataFim: string } | null>(null);

  // Formulário de alocação
  const [novaAlocacao, setNovaAlocacao] = useState({
    volumeAlocado: "",
    postoDestino: "",
    tanqueDestino: "",
    dataDescarga: new Date().toISOString().split("T")[0],
    horaDescarga: "",
    justificativa: "",
  });

  // tRPC query - busca NFes pendentes (só executa quando searchParams existe)
  const nfesQuery = trpc.alocacoesFisicas.listarNfesPendentes.useQuery(
    searchParams ?? { dataInicio: dataInicioInput, dataFim: dataFimInput },
    { enabled: searchParams !== null }
  );

  // tRPC query - busca alocações realizadas
  const alocacoesQuery = trpc.alocacoesFisicas.listarAlocacoesRealizadas.useQuery(
    {},
    { enabled: true }
  );

  // tRPC mutation - criar alocação
  const criarAlocacaoMutation = trpc.alocacoesFisicas.criarAlocacao.useMutation({
    onSuccess: () => {
      alert("Alocação criada com sucesso!");
      setOpenDialog(false);
      setSelectedNfeId(null);
      setNovaAlocacao({
        volumeAlocado: "",
        postoDestino: "",
        tanqueDestino: "",
        dataDescarga: new Date().toISOString().split("T")[0],
        horaDescarga: "",
        justificativa: "",
      });
      // Recarregar dados
      nfesQuery.refetch();
      alocacoesQuery.refetch();
    },
    onError: (error: any) => {
      alert("Erro ao criar alocação: " + (error?.message || "Erro desconhecido"));
    },
  });

  // Filtrar NFes por posto selecionado
  const nfesFiltradas = useMemo(() => {
    const dados = nfesQuery.data?.dados || [];
    if (filtroPostoId === "todos") return dados;
    const postoSelecionado = POSTOS.find((p) => p.id === filtroPostoId);
    if (!postoSelecionado) return dados;
    return dados.filter(
      (nfe: any) => nfe.postoDestino?.toLowerCase().includes(postoSelecionado.nome.toLowerCase())
    );
  }, [nfesQuery.data, filtroPostoId]);

  const selectedNfe = useMemo(() => {
    return nfesFiltradas.find((n: any) => n.id === selectedNfeId) || null;
  }, [nfesFiltradas, selectedNfeId]);

  const buscarNfes = () => {
    setSearchParams({ dataInicio: dataInicioInput, dataFim: dataFimInput });
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
        dataEmissao: typeof selectedNfe.dataEmissao === "string" ? selectedNfe.dataEmissao : new Date(selectedNfe.dataEmissao).toISOString(),
        postoDestinoId: parseInt(novaAlocacao.postoDestino),
        tanqueDestinoId: parseInt(novaAlocacao.tanqueDestino),
        dataDescargaReal: novaAlocacao.dataDescarga,
        horaDescargaReal: novaAlocacao.horaDescarga || undefined,
        volumeAlocado: parseFloat(novaAlocacao.volumeAlocado),
        custoUnitarioAplicado: selectedNfe.custoUnitario,
        justificativa: novaAlocacao.justificativa || undefined,
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

  const loading = nfesQuery.isLoading || nfesQuery.isFetching;

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
                      <Select value={filtroPostoId} onValueChange={setFiltroPostoId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Todos os postos" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="todos">Todos os postos</SelectItem>
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
                        value={dataInicioInput}
                        onChange={(e) => setDataInicioInput(e.target.value)}
                      />
                    </div>

                    {/* Filtro: Data Fim */}
                    <div>
                      <Label htmlFor="dataFim">Data Final</Label>
                      <Input
                        type="date"
                        value={dataFimInput}
                        onChange={(e) => setDataFimInput(e.target.value)}
                      />
                    </div>
                  </div>

                  <Button onClick={buscarNfes} disabled={loading} className="w-full">
                    {loading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Buscando...
                      </>
                    ) : (
                      <>
                        <Search className="mr-2 h-4 w-4" />
                        Buscar NFes
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Erro */}
              {nfesQuery.isError && (
                <Alert className="border-red-200 bg-red-50">
                  <AlertCircle className="h-4 w-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    Erro ao buscar NFes: {nfesQuery.error?.message || "Erro desconhecido"}
                  </AlertDescription>
                </Alert>
              )}

              {/* Resultados */}
              {nfesFiltradas.length > 0 && (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600">
                    {nfesFiltradas.length} NFe(s) encontrada(s) - {nfesFiltradas.filter((n: any) => n.statusAlocacao === "pendente").length} pendente(s)
                    {nfesQuery.data?.origem && (
                      <span className="ml-2 text-xs bg-slate-100 px-2 py-1 rounded">
                        Fonte: {nfesQuery.data.origem}
                      </span>
                    )}
                  </div>

                  {nfesFiltradas.map((nfe: any) => (
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
                            <p className="text-sm font-semibold">{Number(nfe.quantidade).toLocaleString("pt-BR")}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Status</Label>
                            <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${statusBadge(nfe.statusAlocacao)}`}>
                              {nfe.statusAlocacao}
                            </span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 text-sm">
                          <div>
                            <Label className="text-xs text-slate-500">Posto Destino</Label>
                            <p>{nfe.postoDestino || "Não identificado"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Produto</Label>
                            <p>{nfe.produto || "Combustível"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Custo Unitário</Label>
                            <p className="font-semibold">R$ {Number(nfe.custoUnitario).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                        </div>

                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedNfeId(nfe.id);
                              setOpenDialog(true);
                            }}
                            disabled={nfe.statusAlocacao === "alocada"}
                          >
                            <Plus className="mr-2 h-4 w-4" />
                            Alocar
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {searchParams && !loading && nfesFiltradas.length === 0 && !nfesQuery.isError && (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <p>Nenhuma NFe encontrada com os filtros selecionados</p>
                  </CardContent>
                </Card>
              )}

              {!searchParams && (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <Search className="mx-auto h-12 w-12 text-slate-300 mb-4" />
                    <p>Selecione os filtros e clique em "Buscar NFes" para começar</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: NFes Alocadas */}
            <TabsContent value="alocadas" className="space-y-4">
              {alocacoesQuery.isLoading ? (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin text-slate-300 mb-4" />
                    <p>Carregando alocações...</p>
                  </CardContent>
                </Card>
              ) : alocacoesQuery.data?.dados && alocacoesQuery.data.dados.length > 0 ? (
                <div className="space-y-4">
                  <div className="text-sm text-slate-600">
                    {alocacoesQuery.data.dados.length} alocação(ões) encontrada(s)
                  </div>
                  {alocacoesQuery.data.dados.map((aloc: any, idx: number) => (
                    <Card key={aloc.id || idx}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                          <div>
                            <Label className="text-xs text-slate-500">NFe</Label>
                            <p className="font-mono text-sm">{aloc.numeroNf || aloc.chaveNfe?.substring(0, 20) || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Volume</Label>
                            <p className="text-sm font-semibold">{Number(aloc.volumeAlocado || aloc.volume || 0).toLocaleString("pt-BR")} L</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Data Descarga</Label>
                            <p className="text-sm">{aloc.dataDescargaReal ? new Date(aloc.dataDescargaReal).toLocaleDateString("pt-BR") : "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Status</Label>
                            <span className="inline-block px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-800">
                              Alocada
                            </span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <p>Nenhuma alocação encontrada</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Tab: Alocações Realizadas */}
            <TabsContent value="realizadas" className="space-y-4">
              {alocacoesQuery.isLoading ? (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <RefreshCw className="mx-auto h-8 w-8 animate-spin text-slate-300 mb-4" />
                    <p>Carregando...</p>
                  </CardContent>
                </Card>
              ) : alocacoesQuery.data?.dados && alocacoesQuery.data.dados.length > 0 ? (
                <div className="space-y-4">
                  {alocacoesQuery.data.dados.map((aloc: any, idx: number) => (
                    <Card key={aloc.id || idx}>
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                          <div>
                            <Label className="text-xs text-slate-500">NFe</Label>
                            <p className="font-mono text-sm">{aloc.numeroNf || "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Volume</Label>
                            <p className="text-sm font-semibold">{Number(aloc.volumeAlocado || aloc.volume || 0).toLocaleString("pt-BR")} L</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Custo Unit.</Label>
                            <p className="text-sm">R$ {Number(aloc.custoUnitario || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Data Descarga</Label>
                            <p className="text-sm">{aloc.dataDescargaReal ? new Date(aloc.dataDescargaReal).toLocaleDateString("pt-BR") : "-"}</p>
                          </div>
                          <div>
                            <Label className="text-xs text-slate-500">Justificativa</Label>
                            <p className="text-sm text-slate-600">{aloc.justificativa || "Sem justificativa"}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6 text-center text-slate-500">
                    <p>Nenhuma alocação realizada ainda</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Dialog de Alocação - fora do loop */}
      <Dialog open={openDialog} onOpenChange={(open) => {
        setOpenDialog(open);
        if (!open) setSelectedNfeId(null);
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Alocar NFe</DialogTitle>
            <DialogDescription>
              {selectedNfe ? (
                <>NF {selectedNfe.numeroNf} - {Number(selectedNfe.quantidade).toLocaleString("pt-BR")} L</>
              ) : "Selecione uma NFe"}
            </DialogDescription>
          </DialogHeader>

          {selectedNfe && (
            <div className="space-y-4">
              {/* Volume */}
              <div>
                <Label>Volume a Alocar (L) *</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={novaAlocacao.volumeAlocado}
                  onChange={(e) => setNovaAlocacao({ ...novaAlocacao, volumeAlocado: e.target.value })}
                  max={selectedNfe.quantidadePendente || selectedNfe.quantidade}
                />
                <p className="text-xs text-slate-500 mt-1">
                  Máximo: {Number(selectedNfe.quantidadePendente || selectedNfe.quantidade).toLocaleString("pt-BR")} L
                </p>
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

              <Button
                onClick={handleAlocar}
                className="w-full"
                disabled={criarAlocacaoMutation.isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                {criarAlocacaoMutation.isPending ? "Alocando..." : "Confirmar Alocação"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
