/**
 * Alocações Físicas - Fuel Physical Allocation Engine
 * 
 * Tela onde o usuário determina onde e quando cada compra foi descarregada
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { AlertCircle, CheckCircle, Clock, MapPin, Truck, Home, RefreshCw, AlertTriangle } from "lucide-react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function AlocacoesFisicas() {
  const [, setLocation] = useLocation();
  const [tab, setTab] = useState("nfes-pendentes");
  const [carregando, setCarregando] = useState(false);
  const [filtroPostoNfes, setFiltroPostoNfes] = useState("");
  const [novaAlocacao, setNovaAlocacao] = useState({
    nfeStagingId: "",
    chaveNfe: "",
    postoDestino: "",
    tanqueDestino: "",
    dataDescarga: "",
    horaDescarga: "",
    volumeAlocado: "",
    justificativa: "",
  });

  // Buscar dados do backend via tRPC
  const { data: nfesData, isLoading: carregandoNfes, refetch: refetchNfes } = trpc.alocacoesFisicas.listarNfesPendentes.useQuery();
  const { data: alocacoesData } = trpc.alocacoesFisicas.listarAlocacoesRealizadas.useQuery();
  const { data: lotesFisicosData } = trpc.alocacoesFisicas.listarLotesFisicos.useQuery();
  const criarAlocacaoMutation = trpc.alocacoesFisicas.criarAlocacao.useMutation();
  const recalcularCMVMutation = trpc.alocacoesFisicas.recalcularCMVComAlocacoes.useMutation();
  const [impactoCMV, setImpactoCMV] = useState<any>(null);

  // Usar dados do backend ou fallback para dados simulados
  let nfesPendentes = nfesData?.dados || [];
  const alocacoesRealizadas = alocacoesData?.dados || [];
  const lotesFisicos = lotesFisicosData?.dados || [];

  // Filtrar NFes por Posto se selecionado
  if (filtroPostoNfes) {
    nfesPendentes = nfesPendentes.filter((nfe: any) => nfe.postoDestino === filtroPostoNfes);
  }

  // Dados simulados - Postos e tanques (em produção viriam do backend)
  const postos = [
    { id: 1, nome: "Fortaleza Centro", cnpj: "07.526.847/0001-01" },
    { id: 2, nome: "Fortaleza Bairro", cnpj: "07.526.847/0001-02" },
    { id: 3, nome: "Aracati", cnpj: "07.526.847/0001-00" },
  ];

  const tanquesPorPosto: Record<number, any[]> = {
    1: [
      { id: 1, codigo: "GAL-001", capacidade: 10000, saldo: 8500 },
      { id: 2, codigo: "DIE-001", capacidade: 8000, saldo: 6200 },
    ],
    2: [
      { id: 3, codigo: "GAL-002", capacidade: 10000, saldo: 7800 },
      { id: 4, codigo: "DIE-002", capacidade: 8000, saldo: 5900 },
    ],
    3: [
      { id: 5, codigo: "GAL-003", capacidade: 10000, saldo: 9200 },
      { id: 6, codigo: "DIE-003", capacidade: 8000, saldo: 7100 },
    ],
  };

  const handleAlocar = async () => {
    if (
      !novaAlocacao.nfeStagingId ||
      !novaAlocacao.postoDestino ||
      !novaAlocacao.tanqueDestino ||
      !novaAlocacao.dataDescarga ||
      !novaAlocacao.volumeAlocado
    ) {
      alert("Preencha todos os campos obrigatórios");
      return;
    }

    try {
      // Chamar tRPC para criar alocação
      await criarAlocacaoMutation.mutateAsync({
        nfeStagingId: novaAlocacao.nfeStagingId,
        chaveNfe: novaAlocacao.chaveNfe,
        postoDestinoId: parseInt(novaAlocacao.postoDestino),
        tanqueDestinoId: parseInt(novaAlocacao.tanqueDestino),
        dataDescargaReal: novaAlocacao.dataDescarga,
        horaDescargaReal: novaAlocacao.horaDescarga,
        volumeAlocado: parseFloat(novaAlocacao.volumeAlocado),
        custoUnitarioAplicado: 5.42, // Pegar do NFe
        justificativa: novaAlocacao.justificativa,
      });

      // Recalcular CMV automaticamente
      const resultadoCMV = await recalcularCMVMutation.mutateAsync({
        dataInicio: novaAlocacao.dataDescarga,
        dataFim: novaAlocacao.dataDescarga,
      });
      
      // Armazenar impacto CMV para exibição
      if (resultadoCMV.dados) {
        setImpactoCMV(resultadoCMV.dados);
      }

      alert("Alocação criada e CMV recalculado com sucesso!");
      
      // Recarregar dados
      refetchNfes();

      // Limpar formulário
      setNovaAlocacao({
        nfeStagingId: "",
        chaveNfe: "",
        postoDestino: "",
        tanqueDestino: "",
        dataDescarga: "",
        horaDescarga: "",
        volumeAlocado: "",
        justificativa: "",
      });
    } catch (erro) {
      console.error("Erro ao criar alocação:", erro);
      alert("Erro ao criar alocação");
    }
  };

  const handleSelecionarNfe = (nfe: any) => {
    setNovaAlocacao({
      ...novaAlocacao,
      nfeStagingId: nfe.id.toString(),
      chaveNfe: nfe.chaveNfe,
    });
  };

  const handleAtualizar = async () => {
    setCarregando(true);
    try {
      await refetchNfes();
      alert("NFes atualizadas do ACS com sucesso!");
    } catch (erro) {
      console.error("Erro ao atualizar NFes:", erro);
      alert("Erro ao atualizar NFes do ACS");
    } finally {
      setCarregando(false);
    }
  };

  const handleVoltar = () => {
    setLocation("/");
  };

  // Verificar se fornecedor = CNPJ faturado
  const verificarFornecedorValido = (nfe: any) => {
    return nfe.cnpjFaturado === nfe.cnpjFornecedor;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pendente":
        return <Badge variant="destructive">Pendente</Badge>;
      case "parcialmente_alocado":
        return <Badge variant="secondary">Parcialmente Alocado</Badge>;
      case "alocado":
        return <Badge variant="default">Alocado</Badge>;
      case "confirmado":
        return <Badge variant="default">Confirmado</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  // Verificar se está carregando
  if (carregandoNfes) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-pulse flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-slate-200"></div>
          <div className="h-4 w-32 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  // Verificar se está criando alocação
  const criadoAlocacao = criarAlocacaoMutation.isPending;
  const recalculandoCMV = recalcularCMVMutation.isPending;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Alocações Físicas</h1>
          <p className="text-gray-600 mt-2">
            Determine onde e quando cada compra foi descarregada
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handleAtualizar}
            disabled={carregando}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            {carregando ? "Atualizando..." : "Atualizar"}
          </Button>
          <Button
            variant="outline"
            onClick={handleVoltar}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Voltar
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="nfes-pendentes">
            <AlertCircle className="w-4 h-4 mr-2" />
            NFes
          </TabsTrigger>
          <TabsTrigger value="alocacoes">
            <CheckCircle className="w-4 h-4 mr-2" />
            Alocacoes
          </TabsTrigger>
          <TabsTrigger value="impacto-cmv">
            <Truck className="w-4 h-4 mr-2" />
            Impacto CMV
          </TabsTrigger>
          <TabsTrigger value="lotes">
            <MapPin className="w-4 h-4 mr-2" />
            Lotes
          </TabsTrigger>
          <TabsTrigger value="compras">
            <Truck className="w-4 h-4 mr-2" />
            Compras
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: NFes Pendentes */}
        <TabsContent value="nfes-pendentes" className="space-y-4">
          <div className="flex gap-4 mb-4">
            <div className="flex-1 max-w-xs">
              <Label className="text-sm font-medium">Filtrar por Posto</Label>
              <Select value={filtroPostoNfes} onValueChange={setFiltroPostoNfes}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os postos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos os postos</SelectItem>
                  {postos.map((posto) => (
                    <SelectItem key={posto.id} value={posto.nome}>
                      {posto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid gap-4">
            {nfesPendentes && nfesPendentes.length > 0 ? (
              nfesPendentes.map((nfe: any) => {
                const fornecedorValido = nfe.cnpjFaturado === "07.526.847/0001-00";
                return (
                  <Card key={nfe.id} className={`hover:shadow-lg transition-shadow ${
                    !fornecedorValido ? "border-orange-300 bg-orange-50" : ""
                  }`}>
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">NF {nfe.numeroNf}</CardTitle>
                          <CardDescription className="text-xs font-mono mt-1">
                            {nfe.chaveNfe}
                          </CardDescription>
                          {!fornecedorValido && (
                            <div className="flex items-center gap-1 mt-2 text-orange-700 text-xs">
                              <AlertTriangle className="w-3 h-3" />
                              Fornecedor diferente do CNPJ faturado
                            </div>
                          )}
                        </div>
                        {getStatusBadge(nfe.statusAlocacao)}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Data Emissão</p>
                          <p className="font-semibold">
                            {new Date(nfe.dataEmissao).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Posto Fiscal</p>
                          <p className="font-semibold">{nfe.postoFiscal}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Fornecedor</p>
                          <p className={`font-semibold ${
                            fornecedorValido ? "text-green-700" : "text-orange-700"
                          }`}>
                            {nfe.postoFiscal}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Produto</p>
                          <p className="font-semibold">{nfe.produto}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Quantidade</p>
                          <p className="font-semibold">{nfe.quantidade.toLocaleString()} L</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4 pb-4 border-b">
                        <div>
                          <p className="text-sm text-gray-600">Custo Unitário</p>
                          <p className="font-semibold">R$ {nfe.custoUnitario.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Custo Total</p>
                          <p className="font-semibold">R$ {nfe.custoTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Pendente</p>
                          <p className="font-semibold text-orange-600">
                            {nfe.quantidadePendente.toLocaleString()} L
                          </p>
                        </div>
                      </div>

                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            onClick={() => handleSelecionarNfe(nfe)}
                            className="w-full"
                          >
                            <MapPin className="w-4 h-4 mr-2" />
                            Alocar Fisicamente
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Alocar NFe Fisicamente</DialogTitle>
                          </DialogHeader>

                          <div className="space-y-4">
                            {/* Informações da NFe */}
                            <div className="bg-blue-50 p-4 rounded-lg">
                              <p className="text-sm text-gray-600">NFe Selecionada</p>
                              <p className="font-semibold">
                                NF {nfe.numeroNf} - {nfe.produto}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                Quantidade disponível: {nfe.quantidadePendente.toLocaleString()} L
                              </p>
                            </div>

                            {/* Formulário de Alocação */}
                            <div className="grid grid-cols-2 gap-4">
                              {/* Posto Destino */}
                              <div>
                                <Label htmlFor="posto">Posto Destino *</Label>
                                <Select
                                  value={novaAlocacao.postoDestino}
                                  onValueChange={(value) =>
                                    setNovaAlocacao({
                                      ...novaAlocacao,
                                      postoDestino: value,
                                      tanqueDestino: "",
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o posto" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {postos.map((p) => (
                                      <SelectItem key={p.id} value={p.id.toString()}>
                                        {p.nome}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Tanque Destino */}
                              <div>
                                <Label htmlFor="tanque">Tanque Destino *</Label>
                                <Select
                                  value={novaAlocacao.tanqueDestino}
                                  onValueChange={(value) =>
                                    setNovaAlocacao({
                                      ...novaAlocacao,
                                      tanqueDestino: value,
                                    })
                                  }
                                  disabled={!novaAlocacao.postoDestino}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione o tanque" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {novaAlocacao.postoDestino &&
                                      tanquesPorPosto[parseInt(novaAlocacao.postoDestino)]?.map(
                                        (t) => (
                                          <SelectItem key={t.id} value={t.id.toString()}>
                                            {t.codigo} (Saldo: {t.saldo.toLocaleString()} L)
                                          </SelectItem>
                                        )
                                      )}
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Data Descarga */}
                              <div>
                                <Label htmlFor="data">Data Descarga Real *</Label>
                                <Input
                                  type="date"
                                  value={novaAlocacao.dataDescarga}
                                  onChange={(e) =>
                                    setNovaAlocacao({
                                      ...novaAlocacao,
                                      dataDescarga: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              {/* Hora Descarga */}
                              <div>
                                <Label htmlFor="hora">Hora Descarga (HH:MM)</Label>
                                <Input
                                  type="time"
                                  value={novaAlocacao.horaDescarga}
                                  onChange={(e) =>
                                    setNovaAlocacao({
                                      ...novaAlocacao,
                                      horaDescarga: e.target.value,
                                    })
                                  }
                                />
                              </div>

                              {/* Volume Alocado */}
                              <div>
                                <Label htmlFor="volume">Volume Alocado (L) *</Label>
                                <Input
                                  type="number"
                                  placeholder="0.00"
                                  value={novaAlocacao.volumeAlocado}
                                  onChange={(e) =>
                                    setNovaAlocacao({
                                      ...novaAlocacao,
                                      volumeAlocado: e.target.value,
                                    })
                                  }
                                  max={nfe.quantidadePendente}
                                />
                                <p className="text-xs text-gray-600 mt-1">
                                  Máximo: {nfe.quantidadePendente.toLocaleString()} L
                                </p>
                              </div>
                            </div>

                            {/* Justificativa */}
                            <div>
                              <Label htmlFor="justificativa">Justificativa (opcional)</Label>
                              <Input
                                placeholder="Ex: Compra com CNPJ Aracati, descarga em Fortaleza"
                                value={novaAlocacao.justificativa}
                                onChange={(e) =>
                                  setNovaAlocacao({
                                    ...novaAlocacao,
                                    justificativa: e.target.value,
                                  })
                                }
                              />
                            </div>

                            {/* Botões */}
                            <div className="flex gap-2 justify-end pt-4">
                              <Button variant="outline">Cancelar</Button>
                              <Button 
                                onClick={handleAlocar} 
                                disabled={criadoAlocacao || recalculandoCMV}
                                className="bg-green-600 hover:bg-green-700"
                              >
                                <CheckCircle className="w-4 h-4 mr-2" />
                                {criadoAlocacao ? "Criando..." : recalculandoCMV ? "Recalculando CMV..." : "Confirmar Alocação"}
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </CardContent>
                  </Card>
                );
              })
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhuma NFe pendente de alocação
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 2: Alocações Realizadas */}
        <TabsContent value="alocacoes" className="space-y-4">
          <div className="grid gap-4">
            {alocacoesRealizadas && alocacoesRealizadas.length > 0 ? (
              alocacoesRealizadas.map((alocacao: any) => (
                <Card key={alocacao.id} className="border-green-200 bg-green-50">
                  <CardHeader>
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-lg">NF {alocacao.numeroNf}</CardTitle>
                        <CardDescription className="text-xs font-mono mt-1">
                          {alocacao.chaveNfe}
                        </CardDescription>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        ✓ Confirmado
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Data Emissão</p>
                        <p className="font-semibold">
                          {new Date(alocacao.dataEmissao).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Posto Fiscal</p>
                        <p className="font-semibold">{alocacao.postoFiscal}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Posto Destino</p>
                        <p className="font-semibold text-green-700">{alocacao.postoDestino}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Tanque Destino</p>
                        <p className="font-semibold">{alocacao.tanqueDestino}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 pb-4 border-b">
                      <div>
                        <p className="text-sm text-gray-600">Data Descarga Real</p>
                        <p className="font-semibold">
                          {new Date(alocacao.dataDescarga).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Hora Descarga</p>
                        <p className="font-semibold">{alocacao.horaDescarga}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Volume Alocado</p>
                        <p className="font-semibold">{alocacao.volumeAlocado.toLocaleString()} L</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Usuário</p>
                        <p className="font-semibold text-sm">{alocacao.usuarioAlocacao}</p>
                      </div>
                    </div>

                    {alocacao.justificativa && (
                      <div className="bg-white p-3 rounded border border-gray-200">
                        <p className="text-sm text-gray-600">Justificativa</p>
                        <p className="text-sm">{alocacao.justificativa}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhuma alocação realizada
              </div>
            )}
          </div>
        </TabsContent>

        {/* TAB 3: Impacto CMV */}
        <TabsContent value="impacto-cmv" className="space-y-4">
          {impactoCMV ? (
            <div className="space-y-4">
              <Card className="border-blue-200 bg-blue-50">
                <CardHeader>
                  <CardTitle className="text-lg">Impacto da Alocação no CMV</CardTitle>
                  <CardDescription>
                    Resultado do recalcular CMV com PEPS baseado em data de descarga real
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="bg-white p-4 rounded border">
                      <p className="text-sm text-gray-600">Vendas Processadas</p>
                      <p className="text-2xl font-bold text-blue-600">
                        {impactoCMV.vendasProcessadas}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded border">
                      <p className="text-sm text-gray-600">Lotes Reordenados</p>
                      <p className="text-2xl font-bold text-orange-600">
                        {impactoCMV.lotesPEPSReordenados}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded border">
                      <p className="text-sm text-gray-600">CMV Anterior</p>
                      <p className="text-lg font-semibold">
                        R$ {impactoCMV.cmvAnterior.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                    <div className="bg-white p-4 rounded border">
                      <p className="text-sm text-gray-600">CMV Novo</p>
                      <p className="text-lg font-semibold text-green-700">
                        R$ {impactoCMV.cmvNovo.toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </p>
                    </div>
                  </div>

                  <div className="bg-white p-4 rounded border mb-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Diferença CMV</p>
                        <p className={`text-2xl font-bold ${
                          impactoCMV.diferenca > 0 ? "text-red-600" : "text-green-600"
                        }`}>
                          {impactoCMV.diferenca > 0 ? "+" : ""}
                          R$ {impactoCMV.diferenca.toLocaleString("pt-BR", {
                            minimumFractionDigits: 2,
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Percentual de Mudança</p>
                        <p className={`text-2xl font-bold ${
                          impactoCMV.percentualMudanca > 0 ? "text-red-600" : "text-green-600"
                        }`}>
                          {impactoCMV.percentualMudanca > 0 ? "+" : ""}
                          {impactoCMV.percentualMudanca.toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded">
                    <p className="text-sm font-semibold text-yellow-800 mb-2">
                      ℹ️ Análise da Reordenação PEPS
                    </p>
                    <ul className="text-sm text-yellow-700 space-y-1">
                      <li>
                        • {impactoCMV.lotesPEPSReordenados} lote(s) teve(m) sua ordem PEPS
                        alterada
                      </li>
                      <li>
                        • CMV {impactoCMV.diferenca > 0 ? "aumentou" : "diminuiu"} em R$
                        {Math.abs(impactoCMV.diferenca).toLocaleString("pt-BR", {
                          minimumFractionDigits: 2,
                        })}
                      </li>
                      <li>
                        • Percentual de impacto:{" "}
                        {Math.abs(impactoCMV.percentualMudanca).toFixed(2)}% do CMV anterior
                      </li>
                    </ul>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              Nenhuma alocação realizada. Realize uma alocação para ver o impacto no CMV.
            </div>
          )}
        </TabsContent>

        {/* TAB 4: Lotes Físicos */}
        <TabsContent value="lotes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Lotes Físicos Criados</CardTitle>
              <CardDescription>
                Lotes gerados automaticamente a partir das alocações físicas
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">Lote ID</th>
                      <th className="text-left py-2 px-2">Posto Destino</th>
                      <th className="text-left py-2 px-2">Tanque</th>
                      <th className="text-left py-2 px-2">Data Descarga Real</th>
                      <th className="text-right py-2 px-2">Volume</th>
                      <th className="text-right py-2 px-2">Ordem PEPS</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesFisicos && lotesFisicos.length > 0 ? (
                      lotesFisicos.map((lote: any) => (
                        <tr key={lote.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-mono text-xs">{lote.id}</td>
                          <td className="py-2 px-2">{lote.postoDestino}</td>
                          <td className="py-2 px-2">{lote.tanque}</td>
                          <td className="py-2 px-2">{new Date(lote.dataDescargaReal).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2 px-2 text-right">{lote.volume.toLocaleString()} L</td>
                          <td className="py-2 px-2 text-right font-semibold">{lote.ordemPEPS}</td>
                          <td className="py-2 px-2">
                            <Badge variant="default">{lote.status}</Badge>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-b hover:bg-gray-50">
                        <td colSpan={7} className="py-2 px-2 text-center text-gray-500">
                          Nenhum lote físico criado
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: Compras */}
        <TabsContent value="compras" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Compras Realizadas</CardTitle>
              <CardDescription>
                Histórico de todas as compras (NFes) importadas do ACS
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b">
                    <tr>
                      <th className="text-left py-2 px-2">NF</th>
                      <th className="text-left py-2 px-2">Série</th>
                      <th className="text-left py-2 px-2">Data Emissão</th>
                      <th className="text-left py-2 px-2">Fornecedor</th>
                      <th className="text-left py-2 px-2">Posto Fiscal</th>
                      <th className="text-right py-2 px-2">Valor Total</th>
                      <th className="text-left py-2 px-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {nfesPendentes && nfesPendentes.length > 0 ? (
                      nfesPendentes.map((nfe: any) => (
                        <tr key={nfe.id} className="border-b hover:bg-gray-50">
                          <td className="py-2 px-2 font-mono text-xs">{nfe.numeroNf}</td>
                          <td className="py-2 px-2">{nfe.serieNf}</td>
                          <td className="py-2 px-2">{new Date(nfe.dataEmissao).toLocaleDateString("pt-BR")}</td>
                          <td className="py-2 px-2 text-sm">{nfe.fornecedor || "N/A"}</td>
                          <td className="py-2 px-2">{nfe.postoDestino}</td>
                          <td className="py-2 px-2 text-right font-semibold">R$ {(nfe.custoTotal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 px-2">{getStatusBadge(nfe.statusAlocacao)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr className="border-b hover:bg-gray-50">
                        <td colSpan={7} className="py-2 px-2 text-center text-gray-500">
                          Nenhuma compra registrada
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
