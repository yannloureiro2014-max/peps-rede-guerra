import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, CheckCircle, Plus, Search, RefreshCw, Fuel } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

export default function AlocacoesNFe() {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNfeId, setSelectedNfeId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  // Filtros
  const [filtroPostoId, setFiltroPostoId] = useState("todos");
  const [dataInicioInput, setDataInicioInput] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [dataFimInput, setDataFimInput] = useState(() => new Date().toISOString().split("T")[0]);

  // Parâmetros de busca estabilizados
  const [searchParams, setSearchParams] = useState<{ dataInicio: string; dataFim: string; postoId?: string } | null>(null);

  // Formulário de alocação
  const [novaAlocacao, setNovaAlocacao] = useState({
    volumeAlocado: "",
    postoDestino: "",
    tanqueDestino: "",
    dataDescarga: new Date().toISOString().split("T")[0],
    horaDescarga: "",
    justificativa: "",
  });

  // ========== tRPC Queries: Postos e Tanques REAIS do banco ==========
  const postosQuery = trpc.postos.list.useQuery();
  const tanquesQuery = trpc.tanques.list.useQuery();

  // Postos reais do banco
  const postosReais = useMemo(() => {
    return postosQuery.data || [];
  }, [postosQuery.data]);

  // Tanques filtrados pelo posto selecionado no formulário de alocação
  const tanquesDoPosto = useMemo(() => {
    if (!novaAlocacao.postoDestino || !tanquesQuery.data) return [];
    const postoId = parseInt(novaAlocacao.postoDestino);
    return (tanquesQuery.data as any[]).filter((t: any) => t.postoId === postoId);
  }, [novaAlocacao.postoDestino, tanquesQuery.data]);

  // ========== tRPC Query: NFes pendentes ==========
  const nfesQuery = trpc.alocacoesFisicas.listarNfesPendentes.useQuery(
    searchParams ?? { 
      dataInicio: dataInicioInput, 
      dataFim: dataFimInput,
      postoId: filtroPostoId !== "todos" ? filtroPostoId : undefined
    },
    { enabled: searchParams !== null }
  );

  // ========== tRPC Query: Alocações realizadas ==========
  const alocacoesQuery = trpc.alocacoesFisicas.listarAlocacoesRealizadas.useQuery(
    { postoId: filtroPostoId !== "todos" ? parseInt(filtroPostoId) : undefined },
    { enabled: true }
  );

  // ========== Sincronizar NFes ==========
  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      const resultado = await trpc.alocacoesFisicas.sincronizarNfes.useQuery().refetch();
      alert("Sincronização concluída com sucesso!");
      nfesQuery.refetch();
    } catch (error: any) {
      alert("Erro ao sincronizar: " + (error?.message || "Erro desconhecido"));
    } finally {
      setSincronizando(false);
    }
  };

  // ========== tRPC Mutation: Criar alocação ==========
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
    const postoSelecionado = postosReais.find((p: any) => String(p.id) === filtroPostoId);
    if (!postoSelecionado) return dados;
    return dados.filter((nfe: any) => nfe.postoDestino === postoSelecionado.nome);
  }, [nfesQuery.data, filtroPostoId, postosReais]);

  // Encontrar NFe selecionada
  const selectedNfe = useMemo(() => {
    return nfesFiltradas.find((n: any) => n.id === selectedNfeId) || null;
  }, [nfesFiltradas, selectedNfeId]);

  const handleBuscarNfes = () => {
    setSearchParams({ 
      dataInicio: dataInicioInput, 
      dataFim: dataFimInput,
      postoId: filtroPostoId !== "todos" ? filtroPostoId : undefined
    });
  };

  const handleConfirmarAlocacao = async () => {
    if (!selectedNfe || !novaAlocacao.postoDestino || !novaAlocacao.tanqueDestino || !novaAlocacao.volumeAlocado) {
      alert("Preencha todos os campos obrigatórios!");
      return;
    }

    const volumeAlocado = parseFloat(novaAlocacao.volumeAlocado);
    if (volumeAlocado <= 0 || volumeAlocado > selectedNfe.quantidade) {
      alert("Volume inválido!");
      return;
    }

    await criarAlocacaoMutation.mutateAsync({
      chaveNfe: selectedNfe.chaveNfe,
      numeroNf: selectedNfe.numeroNf,
      serieNf: selectedNfe.serieNf || '1',
      dataEmissao: selectedNfe.dataEmissao,
      postoDestinoId: parseInt(novaAlocacao.postoDestino),
      tanqueDestinoId: parseInt(novaAlocacao.tanqueDestino),
      volumeAlocado,
      custoUnitarioAplicado: selectedNfe.custoUnitario,
      dataDescargaReal: novaAlocacao.dataDescarga,
      horaDescargaReal: novaAlocacao.horaDescarga,
      justificativa: novaAlocacao.justificativa,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Alocações NFe</h1>
          <p className="text-gray-600">Aloque NFes do ACS para postos e tanques específicos, mesmo quando comprado por CNPJ diferente</p>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            As alocações utilizam a data de descarga real (não fiscal) para cálculo de PEPS.
            <br />
            <strong>6 postos ativos</strong> e <strong>17 tanques</strong> carregados do banco.
          </AlertDescription>
        </Alert>

        {/* Filtros de Busca */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Busca</CardTitle>
            <CardDescription>Selecione o período e o posto para buscar NFes não alocadas</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label>Posto</Label>
                <Select value={filtroPostoId} onValueChange={setFiltroPostoId}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os postos</SelectItem>
                    {postosReais.map((p: any) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Data Inicial</Label>
                <Input type="date" value={dataInicioInput} onChange={(e) => setDataInicioInput(e.target.value)} />
              </div>
              <div>
                <Label>Data Final</Label>
                <Input type="date" value={dataFimInput} onChange={(e) => setDataFimInput(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleBuscarNfes} className="flex-1">
                <Search className="w-4 h-4 mr-2" />
                Buscar NFes
              </Button>
              <Button 
                onClick={handleSincronizar} 
                variant="outline" 
                disabled={sincronizando}
                className="flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${sincronizando ? 'animate-spin' : ''}`} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar Agora'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Abas */}
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="pendentes">NFes Pendentes</TabsTrigger>
            <TabsTrigger value="alocadas">NFes Alocadas</TabsTrigger>
            <TabsTrigger value="realizadas">Alocações Realizadas</TabsTrigger>
          </TabsList>

          {/* NFes Pendentes */}
          <TabsContent value="pendentes" className="space-y-4">
            {nfesQuery.isLoading ? (
              <Card><CardContent className="pt-6">Carregando...</CardContent></Card>
            ) : nfesFiltradas.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-gray-500">Selecione os filtros e clique em "Buscar NFes" para começar</CardContent></Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{nfesFiltradas.length} NFe(s) encontrada(s)</p>
                {nfesFiltradas.map((nfe: any) => (
                  <Card key={nfe.id}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-8 gap-4 items-center">
                        <div>
                          <p className="text-sm text-gray-500">NF</p>
                          <p className="font-semibold">{nfe.numeroNf}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Data</p>
                          <p className="font-semibold">{new Date(nfe.dataEmissao).toLocaleDateString()}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Volume</p>
                          <p className="font-semibold">{nfe.quantidade.toLocaleString()} L</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Custo Unit.</p>
                          <p className="font-semibold">R$ {nfe.custoUnitario.toFixed(4)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Tipo Frete</p>
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded text-xs font-semibold ${
                              nfe.tipoFrete === 'FOB' 
                                ? 'bg-blue-100 text-blue-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {nfe.tipoFrete || 'CIF'}
                            </span>
                            {nfe.tipoFrete === 'FOB' && !nfe.frete && (
                              <span className="text-xs text-red-600 font-semibold">⚠ Sem frete</span>
                            )}
                          </div>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Valor Frete</p>
                          <p className="font-semibold">{nfe.frete ? `R$ ${nfe.frete.toFixed(2)}` : '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Posto</p>
                          <p className="font-semibold">{nfe.postoDestino}</p>
                        </div>
                        <Button 
                          onClick={() => {
                            setSelectedNfeId(nfe.id);
                            setOpenDialog(true);
                          }}
                          size="sm"
                        >
                          <Plus className="w-4 h-4 mr-1" />
                          Alocar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* NFes Alocadas */}
          <TabsContent value="alocadas" className="space-y-4">
            {alocacoesQuery.isLoading ? (
              <Card><CardContent className="pt-6">Carregando...</CardContent></Card>
            ) : alocacoesQuery.data?.total === 0 ? (
              <Card><CardContent className="pt-6 text-center text-gray-500">Nenhuma alocação encontrada</CardContent></Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{alocacoesQuery.data?.total || 0} alocação(ões) encontrada(s)</p>
                {(alocacoesQuery.data?.dados || []).map((alocacao: any) => (
                  <Card key={alocacao.id}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-center">
                        <div>
                          <p className="text-sm text-gray-500">NF</p>
                          <p className="font-semibold">{alocacao.numeroNf}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Volume</p>
                          <p className="font-semibold">{alocacao.volume?.toLocaleString()} L</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Posto</p>
                          <p className="font-semibold">{alocacao.postoDestino}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Data Descarga</p>
                          <p className="font-semibold">{alocacao.dataDescarga ? new Date(alocacao.dataDescarga).toLocaleDateString() : '-'}</p>
                        </div>
                        <div>
                          <span className="bg-green-100 text-green-800 text-xs font-semibold px-3 py-1 rounded">Alocada</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Alocações Realizadas */}
          <TabsContent value="realizadas" className="space-y-4">
            {alocacoesQuery.isLoading ? (
              <Card><CardContent className="pt-6">Carregando...</CardContent></Card>
            ) : alocacoesQuery.data?.total === 0 ? (
              <Card><CardContent className="pt-6 text-center text-gray-500">Nenhuma alocação realizada</CardContent></Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600">{alocacoesQuery.data?.total || 0} alocação(ões) realizada(s)</p>
                {(alocacoesQuery.data?.dados || []).map((alocacao: any) => (
                  <Card key={alocacao.id}>
                    <CardContent className="pt-6">
                      <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-center">
                        <div>
                          <p className="text-sm text-gray-500">NF</p>
                          <p className="font-semibold">{alocacao.numeroNf}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Volume</p>
                          <p className="font-semibold">{alocacao.volume?.toLocaleString()} L</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Tanque</p>
                          <p className="font-semibold">{alocacao.tanqueDestino || '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Data Descarga</p>
                          <p className="font-semibold">{alocacao.dataDescarga ? new Date(alocacao.dataDescarga).toLocaleDateString() : '-'}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-500">Custo Total</p>
                          <p className="font-semibold">R$ {alocacao.custoTotal?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '-'}</p>
                        </div>
                        <div>
                          <span className="bg-blue-100 text-blue-800 text-xs font-semibold px-3 py-1 rounded">Realizada</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Dialog de Alocação */}
        <Dialog open={openDialog} onOpenChange={setOpenDialog}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Alocar NFe</DialogTitle>
              <DialogDescription>
                Preencha os dados para alocar a NFe a um tanque específico
              </DialogDescription>
            </DialogHeader>

            {selectedNfe && (
              <div className="space-y-6">
                {/* Info NFe */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">NF</p>
                      <p className="font-semibold">{selectedNfe.numeroNf} - {selectedNfe.quantidade.toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Produto</p>
                      <p className="font-semibold">{selectedNfe.produtoDescricao || 'Combustível'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Custo Unit.</p>
                      <p className="font-semibold">R$ {selectedNfe.custoUnitario.toFixed(4)}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Posto NF</p>
                      <p className="font-semibold">{selectedNfe.postoDestino}</p>
                    </div>
                  </div>
                </div>

                {/* Formulário */}
                <div className="space-y-4">
                  <div>
                    <Label>Volume a Alocar (L)</Label>
                    <Input 
                      type="number" 
                      value={novaAlocacao.volumeAlocado}
                      onChange={(e) => setNovaAlocacao({...novaAlocacao, volumeAlocado: e.target.value})}
                      max={selectedNfe.quantidade}
                      placeholder="0"
                    />
                    <p className="text-xs text-gray-500 mt-1">Máximo: {selectedNfe.quantidade.toLocaleString()} L</p>
                  </div>

                  <div>
                    <Label>Posto de Destino Real</Label>
                    <Select value={novaAlocacao.postoDestino} onValueChange={(value) => {
                      setNovaAlocacao({...novaAlocacao, postoDestino: value, tanqueDestino: ""});
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {postosReais.map((p: any) => (
                          <SelectItem key={p.id} value={String(p.id)}>
                            {p.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Tanque de Destino</Label>
                    <Select value={novaAlocacao.tanqueDestino} onValueChange={(value) => setNovaAlocacao({...novaAlocacao, tanqueDestino: value})} disabled={!novaAlocacao.postoDestino}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {tanquesDoPosto.map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.numero} - {t.combustivel} ({t.capacidade?.toLocaleString()}L)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Data de Descarga Real</Label>
                    <Input 
                      type="date" 
                      value={novaAlocacao.dataDescarga}
                      onChange={(e) => setNovaAlocacao({...novaAlocacao, dataDescarga: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label>Hora de Descarga (opcional)</Label>
                    <Input 
                      type="time" 
                      value={novaAlocacao.horaDescarga}
                      onChange={(e) => setNovaAlocacao({...novaAlocacao, horaDescarga: e.target.value})}
                    />
                  </div>

                  <div>
                    <Label>Justificativa (se compra com CNPJ diferente)</Label>
                    <Textarea 
                      value={novaAlocacao.justificativa}
                      onChange={(e) => setNovaAlocacao({...novaAlocacao, justificativa: e.target.value})}
                      placeholder="Ex: Compra faturada para matriz, descarregada na filial"
                      rows={3}
                    />
                  </div>
                </div>

                {/* Botões */}
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
                  <Button onClick={handleConfirmarAlocacao} disabled={criarAlocacaoMutation.isPending}>
                    {criarAlocacaoMutation.isPending ? 'Confirmando...' : 'Confirmar Alocação'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
