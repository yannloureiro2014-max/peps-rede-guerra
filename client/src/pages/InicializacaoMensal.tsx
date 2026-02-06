import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Package, Shield, Save, History, AlertTriangle, Trash2, Edit, Eye, X, RefreshCw, Info, CheckCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3 }).format(num);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  if (typeof date === 'string') {
    const match = date.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) return `${match[3]}/${match[2]}/${match[1]}`;
  }
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

interface LoteConfig {
  loteId: number;
  numeroNf: string;
  dataEntrada: Date | string;
  quantidadeOriginal: string;
  quantidadeDisponivel: string;
  saldoInicial: string;
  ordemConsumo: number;
}

export default function InicializacaoMensal() {
  const { user: currentUser } = useAuth();
  
  // Filtros
  const [mesReferencia, setMesReferencia] = useState(() => {
    const hoje = new Date();
    return `${hoje.getFullYear()}-${String(hoje.getMonth() + 1).padStart(2, '0')}`;
  });
  const [postoId, setPostoId] = useState<string>("");
  const [produtoId, setProdutoId] = useState<string>("");
  const [observacoes, setObservacoes] = useState("");
  const [medicaoFisica, setMedicaoFisica] = useState<string>("");
  
  // Configuração de lotes
  const [lotesConfig, setLotesConfig] = useState<LoteConfig[]>([]);
  
  // Estados de edição
  const [modoEdicao, setModoEdicao] = useState(false);
  const [inicializacaoEditandoId, setInicializacaoEditandoId] = useState<number | null>(null);
  
  // Modal de visualização
  const [modalVisualizarAberto, setModalVisualizarAberto] = useState(false);
  const [inicializacaoVisualizando, setInicializacaoVisualizando] = useState<any>(null);
  
  // Modal de confirmação de exclusão
  const [modalExcluirAberto, setModalExcluirAberto] = useState(false);
  const [inicializacaoExcluindo, setInicializacaoExcluindo] = useState<any>(null);

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();
  
  const { data: lotes, refetch: refetchLotes } = trpc.lotes.list.useQuery({
    postoId: postoId ? parseInt(postoId) : undefined,
    status: undefined // Buscar todos os lotes, não apenas ativos
  }, {
    enabled: !!postoId
  });

  const { data: inicializacoes, refetch: refetchInicializacoes } = trpc.inicializacaoMensal.listar.useQuery({
    postoId: postoId ? parseInt(postoId) : undefined,
    produtoId: produtoId ? parseInt(produtoId) : undefined
  });

  const { data: jaInicializado, refetch: refetchJaInicializado } = trpc.inicializacaoMensal.verificarExistente.useQuery({
    mesReferencia,
    postoId: parseInt(postoId) || 0,
    produtoId: parseInt(produtoId) || 0
  }, {
    enabled: !!postoId && !!produtoId && !!mesReferencia
  });

  const inicializarMutation = trpc.inicializacaoMensal.inicializar.useMutation({
    onSuccess: (data: any) => {
      toast.success("Mês inicializado com sucesso! Os saldos dos lotes foram atualizados.");
      if (data.recalculo?.vendasRecalculadas) {
        toast.info(`${data.recalculo.vendasRecalculadas} vendas tiveram o CMV recalculado.`);
      }
      refetchLotes();
      refetchInicializacoes();
      refetchJaInicializado();
      setLotesConfig([]);
      setModoEdicao(false);
      setInicializacaoEditandoId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao inicializar mês");
    }
  });

  const atualizarMutation = trpc.inicializacaoMensal.update.useMutation({
    onSuccess: (data: any) => {
      toast.success("Inicialização atualizada com sucesso!");
      if (data.recalculo?.vendasRecalculadas) {
        toast.info(`${data.recalculo.vendasRecalculadas} vendas tiveram o CMV recalculado.`);
      }
      refetchLotes();
      refetchInicializacoes();
      setLotesConfig([]);
      setModoEdicao(false);
      setInicializacaoEditandoId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar inicialização");
    }
  });

  const excluirMutation = trpc.inicializacaoMensal.delete.useMutation({
    onSuccess: (data: any) => {
      toast.success("Inicialização excluída! Os lotes foram resetados para quantidade original.");
      if (data.recalculo?.vendasRecalculadas) {
        toast.info(`${data.recalculo.vendasRecalculadas} vendas tiveram o CMV recalculado.`);
      }
      refetchLotes();
      refetchInicializacoes();
      refetchJaInicializado();
      setModalExcluirAberto(false);
      setInicializacaoExcluindo(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir inicialização");
    }
  });

  // Filtrar lotes pelo produto selecionado E pela data (apenas lotes até o mês de referência)
  const lotesFiltrados = useMemo(() => {
    if (!lotes || !produtoId || !mesReferencia) return [];
    
    // Calcular o último dia do mês de referência
    const [ano, mes] = mesReferencia.split('-').map(Number);
    const ultimoDiaMes = new Date(ano, mes, 0); // Último dia do mês
    ultimoDiaMes.setHours(23, 59, 59, 999);
    
    return lotes
      .filter(l => {
        // Filtrar por produto
        if (l.produtoId !== parseInt(produtoId)) return false;
        
        // Filtrar por data: apenas lotes com dataEntrada <= último dia do mês de referência
        const dataEntrada = new Date(l.dataEntrada);
        return dataEntrada.getTime() <= ultimoDiaMes.getTime();
      })
      .sort((a, b) => new Date(a.dataEntrada).getTime() - new Date(b.dataEntrada).getTime());
  }, [lotes, produtoId, mesReferencia]);

  // Carregar lotes na configuração quando mudar filtros
  const carregarLotes = () => {
    if (!lotesFiltrados.length) {
      toast.error("Nenhum lote encontrado para este posto/produto até o mês de referência");
      return;
    }
    
    const config: LoteConfig[] = lotesFiltrados.map((lote, idx) => ({
      loteId: lote.id,
      numeroNf: lote.numeroNf || `Lote ${lote.id}`,
      dataEntrada: lote.dataEntrada,
      quantidadeOriginal: lote.quantidadeOriginal || "0",
      quantidadeDisponivel: lote.quantidadeDisponivel || "0",
      // Usar saldo disponível atual como sugestão inicial
      saldoInicial: lote.quantidadeDisponivel || "0",
      ordemConsumo: (lote as any).ordemConsumo || (idx + 1)
    }));
    
    setLotesConfig(config);
    setModoEdicao(false);
    setInicializacaoEditandoId(null);
    toast.success(`${config.length} lotes carregados para configuração`);
  };

  // Carregar inicialização existente para edição
  const carregarParaEdicao = (init: any) => {
    try {
      const lotesConfigurados = JSON.parse(init.lotesConfigurados || "[]");
      
      // Mapear lotes configurados com dados atuais
      const config: LoteConfig[] = lotesConfigurados.map((lc: any, idx: number) => {
        const loteOriginal = lotes?.find(l => l.id === lc.loteId);
        return {
          loteId: lc.loteId,
          numeroNf: loteOriginal?.numeroNf || `Lote ${lc.loteId}`,
          dataEntrada: loteOriginal?.dataEntrada || new Date(),
          quantidadeOriginal: loteOriginal?.quantidadeOriginal || "0",
          quantidadeDisponivel: loteOriginal?.quantidadeDisponivel || "0",
          saldoInicial: lc.saldoInicial || "0",
          ordemConsumo: lc.ordemConsumo || (idx + 1)
        };
      });
      
      setMesReferencia(init.mesReferencia);
      setPostoId(String(init.postoId));
      setProdutoId(String(init.produtoId));
      setObservacoes(init.observacoes || "");
      setLotesConfig(config);
      setModoEdicao(true);
      setInicializacaoEditandoId(init.id);
      
      toast.info("Inicialização carregada para edição");
    } catch (e) {
      toast.error("Erro ao carregar inicialização para edição");
    }
  };

  // Visualizar detalhes de uma inicialização
  const visualizarInicializacao = (init: any) => {
    setInicializacaoVisualizando(init);
    setModalVisualizarAberto(true);
  };

  // Confirmar exclusão
  const confirmarExclusao = (init: any) => {
    setInicializacaoExcluindo(init);
    setModalExcluirAberto(true);
  };

  const executarExclusao = () => {
    if (!inicializacaoExcluindo) return;
    excluirMutation.mutate({
      id: inicializacaoExcluindo.id,
      postoId: inicializacaoExcluindo.postoId,
      produtoId: inicializacaoExcluindo.produtoId
    });
  };

  const atualizarLoteConfig = (loteId: number, campo: keyof LoteConfig, valor: string | number) => {
    setLotesConfig(prev => prev.map(l => 
      l.loteId === loteId ? { ...l, [campo]: valor } : l
    ));
  };

  const zerarLote = (loteId: number) => {
    atualizarLoteConfig(loteId, 'saldoInicial', '0');
  };

  // Calcular total dos saldos iniciais
  const totalSaldoInicial = useMemo(() => {
    return lotesConfig.reduce((acc, l) => acc + parseFloat(l.saldoInicial || "0"), 0);
  }, [lotesConfig]);

  // Calcular diferença com medição física
  const diferencaMedicao = useMemo(() => {
    const medicao = parseFloat(medicaoFisica || "0");
    if (medicao === 0) return null;
    return totalSaldoInicial - medicao;
  }, [totalSaldoInicial, medicaoFisica]);

  const handleSalvar = () => {
    if (!postoId || !produtoId || !mesReferencia) {
      toast.error("Selecione posto, produto e mês de referência");
      return;
    }
    
    if (lotesConfig.length === 0) {
      toast.error("Carregue os lotes antes de salvar");
      return;
    }
    
    // Verificar ordens duplicadas
    const ordens = lotesConfig.map(l => l.ordemConsumo);
    const ordensUnicas = new Set(ordens);
    if (ordens.length !== ordensUnicas.size) {
      toast.error("As ordens de consumo PEPS não podem ser duplicadas");
      return;
    }
    
    // Verificar saldos válidos
    for (const lote of lotesConfig) {
      const saldo = parseFloat(lote.saldoInicial || "0");
      const original = parseFloat(lote.quantidadeOriginal || "0");
      
      if (saldo < 0) {
        toast.error(`Saldo inicial não pode ser negativo (Lote ${lote.numeroNf})`);
        return;
      }
      
      if (saldo > original) {
        toast.error(`Saldo inicial não pode ser maior que quantidade original (Lote ${lote.numeroNf})`);
        return;
      }
    }
    
    const lotesParaSalvar = lotesConfig.map(l => ({
      loteId: l.loteId,
      saldoInicial: l.saldoInicial,
      ordemConsumo: l.ordemConsumo
    }));
    
    if (modoEdicao && inicializacaoEditandoId) {
      // Atualizar existente
      atualizarMutation.mutate({
        id: inicializacaoEditandoId,
        postoId: parseInt(postoId),
        produtoId: parseInt(produtoId),
        lotesConfigurados: lotesParaSalvar,
        observacoes: observacoes || undefined
      });
    } else {
      // Criar nova
      inicializarMutation.mutate({
        mesReferencia,
        postoId: parseInt(postoId),
        produtoId: parseInt(produtoId),
        lotesConfigurados: lotesParaSalvar,
        observacoes: observacoes || undefined
      });
    }
  };

  const cancelarEdicao = () => {
    setLotesConfig([]);
    setModoEdicao(false);
    setInicializacaoEditandoId(null);
    setObservacoes("");
    setMedicaoFisica("");
  };

  // Verificar permissão
  if (currentUser?.role !== "admin_geral") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Card className="p-8 text-center">
            <Shield className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">Acesso Restrito</h2>
            <p className="text-muted-foreground">
              Apenas administradores gerais podem acessar esta página.
            </p>
          </Card>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Calendar className="h-7 w-7" />
            Inicialização Mensal de Lotes
          </h1>
          <p className="text-muted-foreground">
            Defina os saldos iniciais e a ordem de consumo PEPS para cada mês
          </p>
        </div>

        {/* Alerta informativo */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertTitle>Como funciona</AlertTitle>
          <AlertDescription>
            A inicialização mensal define os saldos de abertura dos lotes para o mês. 
            O sistema mostra apenas lotes com data de entrada até o mês de referência.
            Após salvar, o CMV das vendas do mês será recalculado automaticamente.
          </AlertDescription>
        </Alert>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Selecione o Período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Mês de Referência</Label>
                <Input
                  type="month"
                  value={mesReferencia}
                  onChange={(e) => { setMesReferencia(e.target.value); setLotesConfig([]); }}
                  disabled={modoEdicao}
                />
              </div>
              <div className="space-y-2">
                <Label>Posto</Label>
                <Select value={postoId} onValueChange={(v) => { setPostoId(v); setLotesConfig([]); }} disabled={modoEdicao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o posto" />
                  </SelectTrigger>
                  <SelectContent>
                    {postos?.map(posto => (
                      <SelectItem key={`posto-${posto.id}`} value={posto.id.toString()}>
                        {posto.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Produto</Label>
                <Select value={produtoId} onValueChange={(v) => { setProdutoId(v); setLotesConfig([]); }} disabled={modoEdicao}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos?.map(produto => (
                      <SelectItem key={`produto-${produto.id}`} value={produto.id.toString()}>
                        {produto.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end gap-2">
                <Button 
                  onClick={carregarLotes}
                  disabled={!postoId || !produtoId || modoEdicao}
                  className="flex-1"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Carregar Lotes
                </Button>
              </div>
            </div>
            
            {jaInicializado && !modoEdicao && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-yellow-800">
                  Este mês/posto/produto já foi inicializado. Use o histórico abaixo para editar ou excluir.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Configuração de Lotes */}
        {lotesConfig.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>
                  {modoEdicao ? "Editar" : "Configurar"} Saldos Iniciais - {mesReferencia}
                </span>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{lotesConfig.length} lotes</Badge>
                  {modoEdicao && (
                    <Badge variant="secondary">Modo Edição</Badge>
                  )}
                </div>
              </CardTitle>
              <CardDescription>
                Defina o saldo inicial de cada lote para o início do mês. Lotes totalmente consumidos devem ter saldo 0.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Campo de medição física para referência */}
              <div className="flex items-end gap-4 p-4 bg-muted/50 rounded-lg">
                <div className="flex-1 space-y-2">
                  <Label>Medição Física do Dia 01 (referência)</Label>
                  <Input
                    type="number"
                    step="0.001"
                    placeholder="Ex: 6121.000"
                    value={medicaoFisica}
                    onChange={(e) => setMedicaoFisica(e.target.value)}
                  />
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Total Configurado</p>
                  <p className="text-2xl font-bold">{formatNumber(totalSaldoInicial)} L</p>
                </div>
                {diferencaMedicao !== null && (
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Diferença</p>
                    <p className={`text-2xl font-bold ${Math.abs(diferencaMedicao) > parseFloat(medicaoFisica) * 0.01 ? 'text-red-600' : 'text-green-600'}`}>
                      {diferencaMedicao > 0 ? '+' : ''}{formatNumber(diferencaMedicao)} L
                    </p>
                  </div>
                )}
              </div>

              {diferencaMedicao !== null && Math.abs(diferencaMedicao) > parseFloat(medicaoFisica) * 0.01 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Diferença significativa</AlertTitle>
                  <AlertDescription>
                    A diferença entre o total configurado e a medição física é maior que 1%. 
                    Verifique se os saldos estão corretos.
                  </AlertDescription>
                </Alert>
              )}

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium w-20">Ordem PEPS</th>
                      <th className="text-left p-3 font-medium">NF-e</th>
                      <th className="text-left p-3 font-medium">Data Entrada</th>
                      <th className="text-right p-3 font-medium">Qtd Original</th>
                      <th className="text-right p-3 font-medium">Saldo Atual Banco</th>
                      <th className="text-right p-3 font-medium">Saldo Inicial Mês</th>
                      <th className="text-center p-3 font-medium w-24">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesConfig
                      .sort((a, b) => a.ordemConsumo - b.ordemConsumo)
                      .map((lote) => (
                        <tr key={`lote-config-${lote.loteId}`} className="border-b hover:bg-muted/50">
                          <td className="p-3">
                            <Input
                              type="number"
                              min={1}
                              value={lote.ordemConsumo}
                              onChange={(e) => atualizarLoteConfig(lote.loteId, 'ordemConsumo', parseInt(e.target.value) || 1)}
                              className="w-20"
                            />
                          </td>
                          <td className="p-3 font-medium">{lote.numeroNf}</td>
                          <td className="p-3">{formatDate(lote.dataEntrada)}</td>
                          <td className="p-3 text-right">{formatNumber(lote.quantidadeOriginal)} L</td>
                          <td className="p-3 text-right text-muted-foreground">{formatNumber(lote.quantidadeDisponivel)} L</td>
                          <td className="p-3">
                            <Input
                              type="number"
                              step="0.001"
                              min={0}
                              max={parseFloat(lote.quantidadeOriginal)}
                              value={lote.saldoInicial}
                              onChange={(e) => atualizarLoteConfig(lote.loteId, 'saldoInicial', e.target.value)}
                              className="w-32 text-right ml-auto"
                            />
                          </td>
                          <td className="p-3 text-center">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => zerarLote(lote.loteId)}
                              title="Zerar saldo"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-muted font-bold">
                      <td colSpan={5} className="p-3 text-right">TOTAL:</td>
                      <td className="p-3 text-right">{formatNumber(totalSaldoInicial)} L</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Observações */}
              <div className="space-y-2">
                <Label>Observações (opcional)</Label>
                <Textarea
                  placeholder="Adicione observações sobre esta inicialização..."
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  rows={2}
                />
              </div>

              {/* Botões de ação */}
              <div className="flex justify-end gap-3 pt-4 border-t">
                <Button variant="outline" onClick={cancelarEdicao}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleSalvar}
                  disabled={inicializarMutation.isPending || atualizarMutation.isPending || (jaInicializado && !modoEdicao)}
                >
                  {(inicializarMutation.isPending || atualizarMutation.isPending) ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      {modoEdicao ? "Atualizar Inicialização" : "Salvar Inicialização"}
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Histórico de Inicializações */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Histórico de Inicializações
            </CardTitle>
            <CardDescription>
              Inicializações já realizadas. Clique em Editar para modificar ou Excluir para remover.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {inicializacoes && inicializacoes.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Mês</th>
                      <th className="text-left p-3 font-medium">Posto</th>
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-left p-3 font-medium">Data Inicialização</th>
                      <th className="text-center p-3 font-medium">Lotes</th>
                      <th className="text-center p-3 font-medium w-32">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inicializacoes.map((init) => {
                      let numLotes = 0;
                      try {
                        numLotes = JSON.parse(init.lotesConfigurados || "[]").length;
                      } catch (e) {}
                      
                      return (
                        <tr key={`init-${init.id}`} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{init.mesReferencia}</td>
                          <td className="p-3">{init.postoNome}</td>
                          <td className="p-3">{init.produtoDescricao}</td>
                          <td className="p-3">{formatDate(init.dataInicializacao)}</td>
                          <td className="p-3 text-center">
                            <Badge variant="outline">{numLotes}</Badge>
                          </td>
                          <td className="p-3">
                            <div className="flex justify-center gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => visualizarInicializacao(init)}
                                title="Visualizar detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => carregarParaEdicao(init)}
                                title="Editar inicialização"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => confirmarExclusao(init)}
                                title="Excluir inicialização"
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8">
                Nenhuma inicialização encontrada para os filtros selecionados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal de Visualização */}
      <Dialog open={modalVisualizarAberto} onOpenChange={setModalVisualizarAberto}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da Inicialização</DialogTitle>
            <DialogDescription>
              {inicializacaoVisualizando?.mesReferencia} - {inicializacaoVisualizando?.postoNome} - {inicializacaoVisualizando?.produtoDescricao}
            </DialogDescription>
          </DialogHeader>
          
          {inicializacaoVisualizando && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Data de Inicialização</p>
                  <p className="font-medium">{formatDate(inicializacaoVisualizando.dataInicializacao)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Observações</p>
                  <p className="font-medium">{inicializacaoVisualizando.observacoes || "-"}</p>
                </div>
              </div>
              
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted">
                      <th className="text-left p-2">Ordem</th>
                      <th className="text-left p-2">Lote ID</th>
                      <th className="text-right p-2">Saldo Inicial</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      try {
                        const lotesConfig = JSON.parse(inicializacaoVisualizando.lotesConfigurados || "[]");
                        return lotesConfig.map((lc: any) => (
                          <tr key={`view-lote-${lc.loteId}`} className="border-t">
                            <td className="p-2">{lc.ordemConsumo}</td>
                            <td className="p-2">{lc.loteId}</td>
                            <td className="p-2 text-right">{formatNumber(lc.saldoInicial)} L</td>
                          </tr>
                        ));
                      } catch (e) {
                        return <tr><td colSpan={3} className="p-2 text-center text-muted-foreground">Erro ao carregar lotes</td></tr>;
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalVisualizarAberto(false)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={modalExcluirAberto} onOpenChange={setModalExcluirAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja excluir esta inicialização?
            </DialogDescription>
          </DialogHeader>
          
          {inicializacaoExcluindo && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <p><strong>Mês:</strong> {inicializacaoExcluindo.mesReferencia}</p>
                <p><strong>Posto:</strong> {inicializacaoExcluindo.postoNome}</p>
                <p><strong>Produto:</strong> {inicializacaoExcluindo.produtoDescricao}</p>
              </div>
              
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Atenção</AlertTitle>
                <AlertDescription>
                  Os saldos dos lotes serão resetados para a quantidade original e o CMV das vendas do mês será recalculado.
                </AlertDescription>
              </Alert>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setModalExcluirAberto(false)}>
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              onClick={executarExclusao}
              disabled={excluirMutation.isPending}
            >
              {excluirMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Excluir
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
