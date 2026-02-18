import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { AlertCircle, Plus, Search, RefreshCw, Undo2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";

export default function AlocacoesNFe() {
  const [openDialog, setOpenDialog] = useState(false);
  const [selectedNfeId, setSelectedNfeId] = useState<string | null>(null);
  const [sincronizando, setSincronizando] = useState(false);

  // Filtros
  const [filtroPostoId, setFiltroPostoId] = useState("todos");
  const [filtroCombustivel, setFiltroCombustivel] = useState("todos");
  const [dataInicioInput, setDataInicioInput] = useState("2025-12-01");
  const [dataFimInput, setDataFimInput] = useState(() => new Date().toISOString().split("T")[0]);

  // Parâmetros de busca estabilizados
  const [searchParams, setSearchParams] = useState<{ dataInicio: string; dataFim: string; postoId?: string } | null>(null);

  // Dialog de confirmação para desfazer
  const [desfazerDialog, setDesfazerDialog] = useState(false);
  const [desfazerLoteId, setDesfazerLoteId] = useState<number | null>(null);
  const [desfazerNf, setDesfazerNf] = useState("");
  const [desfazerJustificativa, setDesfazerJustificativa] = useState("");

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

  // Postos reais do banco (apenas ativos)
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

  // Tipos de combustíveis disponíveis (extraídos das NFes)
  const combustiveisDisponiveis = useMemo(() => {
    const dados = nfesQuery.data?.dados || [];
    const tipos = new Set<string>();
    dados.forEach((nfe: any) => {
      if (nfe.produto) tipos.add(nfe.produto);
    });
    return Array.from(tipos).sort();
  }, [nfesQuery.data]);

  // NFes filtradas (backend + filtro local de combustível)
  const nfesFiltradas = useMemo(() => {
    const dados = nfesQuery.data?.dados || [];
    if (filtroCombustivel === 'todos') return dados;
    return dados.filter((nfe: any) => nfe.produto === filtroCombustivel);
  }, [nfesQuery.data, filtroCombustivel]);

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

  const handleSincronizar = async () => {
    setSincronizando(true);
    try {
      await nfesQuery.refetch();
      alert("Sincronização concluída com sucesso!");
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

  // ========== tRPC Mutation: Desfazer alocação ==========
  const desfazerAlocacaoMutation = trpc.alocacoesFisicas.desfazerAlocacao.useMutation({
    onSuccess: (result: any) => {
      if (result.sucesso) {
        alert(result.dados.mensagem);
      } else {
        alert("Erro: " + result.erro);
      }
      setDesfazerDialog(false);
      setDesfazerLoteId(null);
      setDesfazerNf("");
      setDesfazerJustificativa("");
      alocacoesQuery.refetch();
      // Refetch pendentes também para que a NFe apareça novamente
      if (searchParams) nfesQuery.refetch();
    },
    onError: (error: any) => {
      alert("Erro ao desfazer alocação: " + (error?.message || "Erro desconhecido"));
    },
  });

  const handleDesfazerAlocacao = (loteId: number, numeroNf: string) => {
    setDesfazerLoteId(loteId);
    setDesfazerNf(numeroNf);
    setDesfazerJustificativa("");
    setDesfazerDialog(true);
  };

  const confirmarDesfazerAlocacao = async () => {
    if (!desfazerLoteId) return;
    await desfazerAlocacaoMutation.mutateAsync({
      loteId: desfazerLoteId,
      justificativa: desfazerJustificativa || undefined,
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
      dataEmissao: typeof selectedNfe.dataEmissao === 'string' 
        ? selectedNfe.dataEmissao 
        : new Date(selectedNfe.dataEmissao).toISOString(),
      postoDestinoId: parseInt(novaAlocacao.postoDestino),
      tanqueDestinoId: parseInt(novaAlocacao.tanqueDestino),
      volumeAlocado,
      custoUnitarioAplicado: selectedNfe.custoUnitario,
      dataDescargaReal: novaAlocacao.dataDescarga,
      horaDescargaReal: novaAlocacao.horaDescarga,
      justificativa: novaAlocacao.justificativa,
      // Dados extras da NFe para persistir
      nomeFornecedor: selectedNfe.nomeFornecedor || undefined,
      nomeProduto: selectedNfe.produto || undefined,
      tipoFrete: selectedNfe.tipoFrete || undefined,
      custoUnitarioProduto: selectedNfe.custoUnitarioProduto || undefined,
      custoUnitarioFrete: selectedNfe.custoUnitarioFrete || undefined,
      valorFrete: selectedNfe.frete || undefined,
    });
  };

  // Formatar data brasileira
  const formatDate = (d: any) => {
    if (!d) return '-';
    const date = new Date(d);
    return date.toLocaleDateString('pt-BR');
  };

  // Formatar moeda
  const formatCurrency = (v: number, decimals = 2) => {
    return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold">Alocação NFe</h1>
          <p className="text-gray-600">Sincronize NFes do ACS e aloque para postos e tanques específicos</p>
        </div>

        {/* Info Alert */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Mostrando apenas NFes de <strong>{postosReais.length} postos ativos</strong>.
            Selecione o período e posto, depois clique em <strong>"Buscar NFes"</strong>.
            O custo unitário total inclui produto + frete (quando FOB).
          </AlertDescription>
        </Alert>

        {/* Filtros de Busca */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros de Busca</CardTitle>
            <CardDescription>Selecione o período e o posto para buscar NFes</CardDescription>
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
                    <SelectItem value="todos">Todos os postos ativos</SelectItem>
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
                {sincronizando ? 'Sincronizando...' : 'Atualizar'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Abas */}
        <Tabs defaultValue="pendentes" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pendentes">NFes Pendentes</TabsTrigger>
            <TabsTrigger value="alocadas">NFes Alocadas</TabsTrigger>
          </TabsList>

          {/* NFes Pendentes */}
          <TabsContent value="pendentes" className="space-y-4">
            {nfesQuery.isLoading ? (
              <Card><CardContent className="pt-6 text-center">Buscando NFes do ACS...</CardContent></Card>
            ) : nfesQuery.isError ? (
              <Card><CardContent className="pt-6 text-center text-red-500">Erro ao buscar NFes: {(nfesQuery.error as any)?.message || 'Erro desconhecido'}</CardContent></Card>
            ) : !searchParams ? (
              <Card><CardContent className="pt-6 text-center text-gray-500">Selecione os filtros e clique em "Buscar NFes" para começar</CardContent></Card>
            ) : nfesFiltradas.length === 0 ? (
              <Card><CardContent className="pt-6 text-center text-gray-500">Nenhuma NFe encontrada para o período e posto selecionados</CardContent></Card>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <p className="text-sm text-gray-600 font-semibold">{nfesFiltradas.length} NFe(s) encontrada(s){filtroCombustivel !== 'todos' ? ` (filtro: ${filtroCombustivel})` : ''}</p>
                  <div className="flex items-center gap-2">
                    <Label className="text-xs">Combustível:</Label>
                    <Select value={filtroCombustivel} onValueChange={setFiltroCombustivel}>
                      <SelectTrigger className="w-[220px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="todos">Todos os combustíveis</SelectItem>
                        {combustiveisDisponiveis.map((c: string) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-gray-400">Origem: {nfesQuery.data?.origem || 'ACS'}</p>
                  </div>
                </div>

                {/* Cabeçalho da tabela */}
                <div className="hidden lg:grid grid-cols-10 gap-2 px-4 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 uppercase">
                  <div>NF</div>
                  <div>Data</div>
                  <div>Fornecedor</div>
                  <div>Produto</div>
                  <div>Volume</div>
                  <div>Custo Produto/L</div>
                  <div>Frete</div>
                  <div>Custo Total/L</div>
                  <div>Posto Faturado</div>
                  <div>Ação</div>
                </div>

                {nfesFiltradas.map((nfe: any) => (
                  <Card key={nfe.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="grid grid-cols-2 lg:grid-cols-10 gap-3 items-center">
                        {/* NF */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">NF</p>
                          <p className="font-semibold text-sm">{nfe.numeroNf}</p>
                          <p className="text-xs text-gray-400">Série {nfe.serieNf || '1'}</p>
                        </div>

                        {/* Data */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Data</p>
                          <p className="text-sm">{formatDate(nfe.dataEmissao)}</p>
                        </div>

                        {/* Fornecedor */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Fornecedor</p>
                          <p className="text-sm truncate" title={nfe.nomeFornecedor}>
                            {nfe.nomeFornecedor || `Cód: ${nfe.codFornecedor}`}
                          </p>
                        </div>

                        {/* Produto */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Produto</p>
                          <p className="text-sm truncate" title={nfe.produto}>
                            {nfe.produto || 'Combustível'}
                          </p>
                        </div>

                        {/* Volume */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Volume</p>
                          <p className="font-semibold text-sm">{nfe.quantidade?.toLocaleString('pt-BR')} L</p>
                        </div>

                        {/* Custo Produto/L */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Custo Produto/L</p>
                          <p className="text-sm">{formatCurrency(nfe.custoUnitarioProduto || 0, 4)}</p>
                        </div>

                        {/* Frete */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Frete</p>
                          <div className="flex flex-col">
                            <div className="flex items-center gap-1">
                              <span className={`inline-block w-fit px-2 py-0.5 rounded text-xs font-semibold ${
                                nfe.tipoFrete === 'FOB' 
                                  ? 'bg-amber-100 text-amber-800' 
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {nfe.tipoFrete}
                              </span>
                              {nfe.tipoFreteOriginal && nfe.tipoFreteOriginal !== nfe.tipoFrete && (
                                <span className="text-[10px] text-gray-400">({nfe.tipoFreteOriginal})</span>
                              )}
                            </div>
                            {nfe.tipoFrete === 'FOB' && nfe.custoUnitarioFrete > 0 && (
                              <span className="text-xs text-amber-700 font-semibold mt-0.5">
                                +{formatCurrency(nfe.custoUnitarioFrete, 4)}/L
                              </span>
                            )}
                            {nfe.tipoFrete === 'FOB' && nfe.frete > 0 && (
                              <span className="text-[10px] text-gray-500 mt-0.5">
                                Total frete: {formatCurrency(nfe.frete)}
                              </span>
                            )}
                            {nfe.tipoFrete === 'FOB' && (!nfe.frete || nfe.frete === 0) && (
                              <span className="text-xs text-red-600 font-semibold mt-0.5">
                                ⚠ Sem frete
                              </span>
                            )}
                            {nfe.tipoFrete === 'CIF' && (
                              <span className="text-[10px] text-green-600 mt-0.5">Incluso</span>
                            )}
                          </div>
                        </div>

                        {/* Custo Total/L */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Custo Total/L</p>
                          <p className="font-bold text-sm text-emerald-700">
                            {formatCurrency(nfe.custoUnitario || 0, 4)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Total: {formatCurrency(nfe.custoTotal || 0)}
                          </p>
                        </div>

                        {/* Posto Faturado */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Posto</p>
                          <p className="text-sm truncate" title={nfe.postoDestino}>{nfe.postoDestino}</p>
                        </div>

                        {/* Ação */}
                        <div>
                          <Button 
                            onClick={() => {
                              setSelectedNfeId(nfe.id);
                              setOpenDialog(true);
                            }}
                            size="sm"
                            className="w-full"
                          >
                            <Plus className="w-4 h-4 mr-1" />
                            Alocar
                          </Button>
                        </div>
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
              <Card><CardContent className="pt-6 text-center text-gray-500">Nenhuma alocação encontrada. Comece alocando NFes na aba "NFes Pendentes".</CardContent></Card>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-gray-600 font-semibold">{alocacoesQuery.data?.total || 0} alocação(ões) encontrada(s)</p>

                {/* Cabeçalho da tabela de alocadas */}
                <div className="hidden lg:grid grid-cols-11 gap-2 px-4 py-2 bg-gray-100 rounded-lg text-xs font-semibold text-gray-600 uppercase">
                  <div>NF</div>
                  <div>Data Emissão</div>
                  <div>Fornecedor</div>
                  <div>Produto</div>
                  <div>Volume</div>
                  <div>Custo Produto/L</div>
                  <div>Frete</div>
                  <div>Custo Total/L</div>
                  <div>Posto Destino</div>
                  <div>Tanque</div>
                  <div>Status / Ação</div>
                </div>

                {(alocacoesQuery.data?.dados || []).map((a: any) => (
                  <Card key={a.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-4 pb-4">
                      <div className="grid grid-cols-2 lg:grid-cols-11 gap-3 items-center">
                        {/* NF */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">NF</p>
                          <p className="font-semibold text-sm">{a.numeroNf}</p>
                          <p className="text-xs text-gray-400">Série {a.serieNf || '1'}</p>
                        </div>

                        {/* Data Emissão */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Data Emissão</p>
                          <p className="text-sm">{formatDate(a.dataEmissao)}</p>
                          <p className="text-[10px] text-gray-400">Desc: {formatDate(a.dataEntrada)}</p>
                        </div>

                        {/* Fornecedor */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Fornecedor</p>
                          <p className="text-sm truncate" title={a.nomeFornecedor || '-'}>
                            {a.nomeFornecedor || '-'}
                          </p>
                        </div>

                        {/* Produto */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Produto</p>
                          <p className="text-sm truncate" title={a.nomeProduto || '-'}>
                            {a.nomeProduto || '-'}
                          </p>
                        </div>

                        {/* Volume */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Volume</p>
                          <p className="font-semibold text-sm">{a.volumeAlocado?.toLocaleString('pt-BR')} L</p>
                        </div>

                        {/* Custo Produto/L */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Custo Produto/L</p>
                          <p className="text-sm">{a.custoUnitarioProduto > 0 ? formatCurrency(a.custoUnitarioProduto, 4) : formatCurrency(a.custoUnitario, 4)}</p>
                        </div>

                        {/* Frete */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Frete</p>
                          <div className="flex flex-col">
                            <span className={`inline-block w-fit px-2 py-0.5 rounded text-xs font-semibold ${
                              a.tipoFrete === 'FOB' 
                                ? 'bg-amber-100 text-amber-800' 
                                : 'bg-green-100 text-green-800'
                            }`}>
                              {a.tipoFrete || 'CIF'}
                            </span>
                            {a.tipoFrete === 'FOB' && a.custoUnitarioFrete > 0 && (
                              <span className="text-xs text-amber-700 font-semibold mt-0.5">
                                +{formatCurrency(a.custoUnitarioFrete, 4)}/L
                              </span>
                            )}
                            {a.tipoFrete === 'FOB' && a.valorFrete > 0 && (
                              <span className="text-[10px] text-gray-500 mt-0.5">
                                Total: {formatCurrency(a.valorFrete)}
                              </span>
                            )}
                            {a.tipoFrete === 'FOB' && (!a.valorFrete || a.valorFrete === 0) && (
                              <span className="text-xs text-red-600 font-semibold mt-0.5">⚠ Sem frete</span>
                            )}
                            {(!a.tipoFrete || a.tipoFrete === 'CIF') && (
                              <span className="text-[10px] text-green-600 mt-0.5">Incluso</span>
                            )}
                          </div>
                        </div>

                        {/* Custo Total/L */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Custo Total/L</p>
                          <p className="font-bold text-sm text-emerald-700">
                            {formatCurrency(a.custoUnitario || 0, 4)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Total: {formatCurrency(a.custoTotal || 0)}
                          </p>
                        </div>

                        {/* Posto Destino */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Posto</p>
                          <p className="text-sm truncate" title={a.nomePosto}>{a.nomePosto}</p>
                        </div>

                        {/* Tanque */}
                        <div>
                          <p className="text-xs text-gray-400 lg:hidden">Tanque</p>
                          <p className="text-xs truncate" title={a.nomeTanque}>{a.nomeTanque}</p>
                        </div>

                        {/* Status + Ação */}
                        <div className="flex flex-col gap-1 items-start">
                          <span className={`text-xs font-semibold px-3 py-1 rounded ${
                            a.status === 'ativo' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                          }`}>
                            {a.status === 'ativo' ? 'Ativa' : a.status}
                          </span>
                          {a.status === 'ativo' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 border-red-300 hover:bg-red-50 hover:text-red-700 text-xs h-7 px-2"
                              onClick={() => handleDesfazerAlocacao(a.id, a.numeroNf)}
                            >
                              <Undo2 className="w-3 h-3 mr-1" />
                              Desfazer
                            </Button>
                          )}
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
                Defina o posto e tanque de destino real para esta NFe
              </DialogDescription>
            </DialogHeader>

            {selectedNfe && (
              <div className="space-y-6">
                {/* Info NFe */}
                <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                  <h4 className="font-semibold text-sm text-gray-700 uppercase">Dados da NFe</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-400">Número NF</p>
                      <p className="font-semibold">{selectedNfe.numeroNf} (Série {selectedNfe.serieNf || '1'})</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Data Emissão</p>
                      <p className="font-semibold">{formatDate(selectedNfe.dataEmissao)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Fornecedor</p>
                      <p className="font-semibold">{selectedNfe.nomeFornecedor || `Cód: ${selectedNfe.codFornecedor}`}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Produto</p>
                      <p className="font-semibold">{selectedNfe.produto || 'Combustível'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Volume Total</p>
                      <p className="font-semibold">{selectedNfe.quantidade?.toLocaleString('pt-BR')} L</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400">Posto Faturado</p>
                      <p className="font-semibold">{selectedNfe.postoDestino}</p>
                    </div>
                  </div>
                  
                  {/* Custos detalhados */}
                  <div className="border-t pt-3 mt-3">
                    <h4 className="font-semibold text-sm text-gray-700 uppercase mb-2">Custos</h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs text-gray-400">Custo Produto/L</p>
                        <p className="font-semibold">{formatCurrency(selectedNfe.custoUnitarioProduto || 0, 4)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400">Frete ({selectedNfe.tipoFrete || 'CIF'})</p>
                        <p className="font-semibold">
                          {selectedNfe.tipoFrete === 'FOB' && selectedNfe.custoUnitarioFrete > 0
                            ? `+${formatCurrency(selectedNfe.custoUnitarioFrete, 4)}/L`
                            : selectedNfe.tipoFrete === 'CIF' ? 'Incluso' : 'Sem frete'}
                        </p>
                      </div>
                      <div className="bg-emerald-50 p-2 rounded">
                        <p className="text-xs text-emerald-600 font-semibold">Custo Total/L</p>
                        <p className="font-bold text-emerald-700 text-lg">{formatCurrency(selectedNfe.custoUnitario || 0, 4)}</p>
                      </div>
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
                    <p className="text-xs text-gray-500 mt-1">Máximo: {selectedNfe.quantidade?.toLocaleString('pt-BR')} L</p>
                  </div>

                  <div>
                    <Label>Posto de Destino Real</Label>
                    <Select value={novaAlocacao.postoDestino} onValueChange={(value) => {
                      setNovaAlocacao({...novaAlocacao, postoDestino: value, tanqueDestino: ""});
                    }}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o posto" />
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
                        <SelectValue placeholder={novaAlocacao.postoDestino ? "Selecione o tanque" : "Selecione o posto primeiro"} />
                      </SelectTrigger>
                      <SelectContent>
                        {tanquesDoPosto.map((t: any) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            Tanque {t.codigoAcs} - {t.produtoDescricao || 'Sem produto'} ({Number(t.capacidade)?.toLocaleString('pt-BR')}L)
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

        {/* Dialog de Confirmação para Desfazer Alocação */}
        <Dialog open={desfazerDialog} onOpenChange={setDesfazerDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="text-red-600">Desfazer Alocação</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja desfazer a alocação da NF <strong>{desfazerNf}</strong>?
                O lote será removido e a NFe voltará a aparecer como pendente.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>Atenção:</strong> Esta ação irá deletar o lote do banco de dados.
                  Se o lote já teve consumo PEPS, não será possível desfazer.
                </p>
              </div>

              <div>
                <Label>Justificativa (opcional)</Label>
                <Textarea
                  value={desfazerJustificativa}
                  onChange={(e) => setDesfazerJustificativa(e.target.value)}
                  placeholder="Ex: Alocação feita para o posto errado"
                  rows={2}
                />
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setDesfazerDialog(false)}>
                  Cancelar
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmarDesfazerAlocacao}
                  disabled={desfazerAlocacaoMutation.isPending}
                >
                  <Undo2 className="w-4 h-4 mr-1" />
                  {desfazerAlocacaoMutation.isPending ? 'Desfazendo...' : 'Confirmar Desfazer'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
