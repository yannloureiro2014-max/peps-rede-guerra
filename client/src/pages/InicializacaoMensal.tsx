import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Calendar, Package, Shield, Save, History, AlertTriangle } from "lucide-react";
import { useState, useMemo } from "react";
import { toast } from "sonner";

function formatNumber(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 3 }).format(num);
}

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
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
  
  // Configuração de lotes
  const [lotesConfig, setLotesConfig] = useState<LoteConfig[]>([]);

  const { data: postos } = trpc.postos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();
  
  const { data: lotes, refetch: refetchLotes } = trpc.lotes.list.useQuery({
    postoId: postoId ? parseInt(postoId) : undefined,
    status: "ativo"
  }, {
    enabled: !!postoId
  });

  const { data: inicializacoes } = trpc.inicializacaoMensal.listar.useQuery({
    postoId: postoId ? parseInt(postoId) : undefined,
    produtoId: produtoId ? parseInt(produtoId) : undefined
  });

  const { data: jaInicializado } = trpc.inicializacaoMensal.verificarExistente.useQuery({
    mesReferencia,
    postoId: parseInt(postoId) || 0,
    produtoId: parseInt(produtoId) || 0
  }, {
    enabled: !!postoId && !!produtoId && !!mesReferencia
  });

  const inicializarMutation = trpc.inicializacaoMensal.inicializar.useMutation({
    onSuccess: () => {
      toast.success("Mês inicializado com sucesso! Os saldos dos lotes foram atualizados.");
      refetchLotes();
      setLotesConfig([]);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao inicializar mês");
    }
  });

  // Filtrar lotes pelo produto selecionado
  const lotesFiltrados = useMemo(() => {
    if (!lotes || !produtoId) return [];
    return lotes.filter(l => l.produtoId === parseInt(produtoId));
  }, [lotes, produtoId]);

  // Carregar lotes na configuração quando mudar filtros
  const carregarLotes = () => {
    if (!lotesFiltrados.length) {
      toast.error("Nenhum lote ativo encontrado para este posto/produto");
      return;
    }
    
    // Ordenar lotes por data de entrada para definir ordem PEPS inicial
    const lotesOrdenados = [...lotesFiltrados].sort((a, b) => 
      new Date(a.dataEntrada).getTime() - new Date(b.dataEntrada).getTime()
    );
    
    const config: LoteConfig[] = lotesOrdenados.map((lote, idx) => ({
      loteId: lote.id,
      numeroNf: lote.numeroNf || `Lote ${lote.id}`,
      dataEntrada: lote.dataEntrada,
      quantidadeOriginal: lote.quantidadeOriginal || "0",
      quantidadeDisponivel: lote.quantidadeDisponivel || "0",
      saldoInicial: lote.quantidadeDisponivel || "0",
      ordemConsumo: idx + 1 // Ordem baseada na data de entrada
    }));
    
    setLotesConfig(config);
    toast.success(`${config.length} lotes carregados para configuração`);
  };

  const atualizarLoteConfig = (loteId: number, campo: keyof LoteConfig, valor: string | number) => {
    setLotesConfig(prev => prev.map(l => 
      l.loteId === loteId ? { ...l, [campo]: valor } : l
    ));
  };

  const handleInicializar = () => {
    if (!postoId || !produtoId || !mesReferencia) {
      toast.error("Selecione posto, produto e mês de referência");
      return;
    }
    
    if (lotesConfig.length === 0) {
      toast.error("Carregue os lotes antes de inicializar");
      return;
    }
    
    // Verificar ordens duplicadas
    const ordens = lotesConfig.map(l => l.ordemConsumo);
    const ordensUnicas = new Set(ordens);
    if (ordens.length !== ordensUnicas.size) {
      toast.error("As ordens de consumo PEPS não podem ser duplicadas");
      return;
    }
    
    inicializarMutation.mutate({
      mesReferencia,
      postoId: parseInt(postoId),
      produtoId: parseInt(produtoId),
      lotesConfigurados: lotesConfig.map(l => ({
        loteId: l.loteId,
        saldoInicial: l.saldoInicial,
        ordemConsumo: l.ordemConsumo
      })),
      observacoes: observacoes || undefined
    });
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
                  onChange={(e) => setMesReferencia(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Posto</Label>
                <Select value={postoId} onValueChange={(v) => { setPostoId(v); setLotesConfig([]); }}>
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
                <Label>Produto</Label>
                <Select value={produtoId} onValueChange={(v) => { setProdutoId(v); setLotesConfig([]); }}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o produto" />
                  </SelectTrigger>
                  <SelectContent>
                    {produtos?.map(produto => (
                      <SelectItem key={produto.id} value={produto.id.toString()}>
                        {produto.descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={carregarLotes}
                  disabled={!postoId || !produtoId}
                  className="w-full"
                >
                  <Package className="h-4 w-4 mr-2" />
                  Carregar Lotes
                </Button>
              </div>
            </div>
            
            {jaInicializado && (
              <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
                <p className="text-yellow-800">
                  Este mês/posto/produto já foi inicializado. Para ajustar saldos, edite os lotes diretamente.
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
                <span>Configurar Saldos Iniciais - {mesReferencia}</span>
                <Badge variant="outline">{lotesConfig.length} lotes</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-3 font-medium">Ordem PEPS</th>
                      <th className="text-left p-3 font-medium">NF-e</th>
                      <th className="text-left p-3 font-medium">Data Entrada</th>
                      <th className="text-right p-3 font-medium">Qtd Original</th>
                      <th className="text-right p-3 font-medium">Saldo Atual</th>
                      <th className="text-right p-3 font-medium">Saldo Inicial Mês</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lotesConfig
                      .sort((a, b) => a.ordemConsumo - b.ordemConsumo)
                      .map((lote) => (
                        <tr key={lote.loteId} className="border-b hover:bg-muted/50">
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
                              value={lote.saldoInicial}
                              onChange={(e) => atualizarLoteConfig(lote.loteId, 'saldoInicial', e.target.value)}
                              className="w-32 text-right"
                            />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              
              <div className="mt-4 space-y-4">
                <div className="space-y-2">
                  <Label>Observações (opcional)</Label>
                  <Input
                    value={observacoes}
                    onChange={(e) => setObservacoes(e.target.value)}
                    placeholder="Ex: Ajuste de inventário, contagem física realizada..."
                  />
                </div>
                
                <div className="flex justify-end gap-4">
                  <Button variant="outline" onClick={() => setLotesConfig([])}>
                    Cancelar
                  </Button>
                  <Button 
                    onClick={handleInicializar}
                    disabled={inicializarMutation.isPending || jaInicializado}
                  >
                    <Save className="h-4 w-4 mr-2" />
                    Confirmar Saldos Iniciais
                  </Button>
                </div>
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
          </CardHeader>
          <CardContent>
            {!inicializacoes || inicializacoes.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhuma inicialização registrada
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Mês</th>
                      <th className="text-left p-3 font-medium">Posto</th>
                      <th className="text-left p-3 font-medium">Produto</th>
                      <th className="text-left p-3 font-medium">Data Inicialização</th>
                      <th className="text-left p-3 font-medium">Lotes</th>
                      <th className="text-left p-3 font-medium">Observações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inicializacoes.map((ini) => {
                      const lotesJson = ini.lotesConfigurados ? JSON.parse(ini.lotesConfigurados) : [];
                      return (
                        <tr key={ini.id} className="border-b hover:bg-muted/50">
                          <td className="p-3 font-medium">{ini.mesReferencia}</td>
                          <td className="p-3">{ini.postoNome}</td>
                          <td className="p-3">{ini.produtoDescricao}</td>
                          <td className="p-3">{formatDate(ini.dataInicializacao)}</td>
                          <td className="p-3">
                            <Badge variant="outline">{lotesJson.length} lotes</Badge>
                          </td>
                          <td className="p-3 text-muted-foreground">{ini.observacoes || "-"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Instruções */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Como Funciona</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm text-muted-foreground">
              <p>
                <strong>1. Selecione o período:</strong> Escolha o mês de referência, posto e produto para inicializar.
              </p>
              <p>
                <strong>2. Carregue os lotes:</strong> O sistema carrega todos os lotes ativos do posto/produto selecionado.
              </p>
              <p>
                <strong>3. Defina a ordem PEPS:</strong> Ordene os lotes pela ordem de consumo (1 = primeiro a ser consumido).
                Geralmente, lotes mais antigos devem ter ordem menor.
              </p>
              <p>
                <strong>4. Ajuste os saldos iniciais:</strong> Informe o saldo real de cada lote no início do mês.
                Isso permite corrigir diferenças entre o sistema e a contagem física.
              </p>
              <p>
                <strong>5. Confirme:</strong> Ao confirmar, os saldos dos lotes serão atualizados e o mês será marcado como inicializado.
                Cada mês/posto/produto só pode ser inicializado uma vez.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
