import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Loader2, Calculator, RefreshCw, AlertTriangle, CheckCircle, Info } from "lucide-react";

export default function RecalcularCMV() {
  const { user } = useAuth();
  const [postoId, setPostoId] = useState<string>("");
  const [produtoId, setProdutoId] = useState<string>("");
  const [dataInicio, setDataInicio] = useState<string>("");
  const [resultado, setResultado] = useState<any>(null);
  const [resultadoGeral, setResultadoGeral] = useState<any>(null);

  // Queries
  const { data: postos } = trpc.postos.list.useQuery();
  const { data: produtos } = trpc.produtos.list.useQuery();
  const { data: estatisticas, refetch: refetchEstatisticas } = trpc.cmv.estatisticasPendentes.useQuery();

  // Mutations
  const recalcularRetroativo = trpc.cmv.recalcularRetroativo.useMutation({
    onSuccess: (data) => {
      setResultado(data);
      refetchEstatisticas();
    },
    onError: (error) => {
      setResultado({ erro: error.message });
    }
  });

  const recalcularPendentes = trpc.cmv.recalcularPendentes.useMutation({
    onSuccess: (data) => {
      setResultadoGeral(data);
      refetchEstatisticas();
    },
    onError: (error) => {
      setResultadoGeral({ erro: error.message });
    }
  });

  const handleRecalcularRetroativo = () => {
    if (!postoId || !produtoId || !dataInicio) {
      alert("Preencha todos os campos");
      return;
    }
    setResultado(null);
    recalcularRetroativo.mutate({
      postoId: parseInt(postoId),
      produtoId: parseInt(produtoId),
      dataInicio
    });
  };

  const handleRecalcularPendentes = () => {
    if (!confirm("Isso irá recalcular o CMV de TODAS as vendas pendentes no sistema. Deseja continuar?")) {
      return;
    }
    setResultadoGeral(null);
    recalcularPendentes.mutate();
  };

  // Verificar permissão
  if (user?.role !== "admin_geral") {
    return (
      <div className="container py-6">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Acesso Negado</AlertTitle>
          <AlertDescription>
            Apenas administradores gerais podem acessar esta página.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Recálculo de CMV</h1>
        <p className="text-muted-foreground">
          Recalcule o CMV de vendas quando lotes são cadastrados retroativamente
        </p>
      </div>

      {/* Estatísticas de Vendas Pendentes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" />
            Vendas Pendentes de CMV
          </CardTitle>
          <CardDescription>
            Vendas que ainda não tiveram o CMV calculado por falta de lotes disponíveis
          </CardDescription>
        </CardHeader>
        <CardContent>
          {estatisticas ? (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Badge variant={estatisticas.total > 0 ? "destructive" : "secondary"} className="text-lg px-4 py-2">
                  {estatisticas.total.toLocaleString()} vendas pendentes
                </Badge>
                <Button variant="outline" size="sm" onClick={() => refetchEstatisticas()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Atualizar
                </Button>
              </div>
              
              {estatisticas.porPosto && estatisticas.porPosto.length > 0 && (
                <div className="mt-4">
                  <h4 className="font-medium mb-2">Por Posto/Produto:</h4>
                  <div className="grid gap-2 max-h-60 overflow-y-auto">
                    {estatisticas.porPosto.map((item: any, index: number) => (
                      <div key={`stat-${item.postoId}-${item.produtoId}-${index}`} className="flex justify-between items-center p-2 bg-muted rounded">
                        <span className="text-sm">
                          {item.postoNome || `Posto ${item.postoId}`} - {item.produtoDescricao || `Produto ${item.produtoId}`}
                        </span>
                        <Badge variant="outline">{item.total} vendas</Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando estatísticas...
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recálculo em Lote */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Recalcular Todas Pendentes
          </CardTitle>
          <CardDescription>
            Processa todas as vendas pendentes de CMV em lote, agrupando por posto/produto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Este processo pode demorar vários minutos dependendo da quantidade de vendas.
              Os lotes serão resetados e recalculados na ordem cronológica correta (PEPS).
            </AlertDescription>
          </Alert>

          <Button 
            onClick={handleRecalcularPendentes}
            disabled={recalcularPendentes.isPending || (estatisticas?.total || 0) === 0}
            className="w-full"
            size="lg"
          >
            {recalcularPendentes.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 mr-2" />
                Recalcular Todas as Vendas Pendentes ({estatisticas?.total || 0})
              </>
            )}
          </Button>

          {resultadoGeral && (
            <Alert variant={resultadoGeral.erro ? "destructive" : "default"}>
              {resultadoGeral.erro ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{resultadoGeral.erro}</AlertDescription>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Recálculo Concluído</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      <li><strong>{resultadoGeral.totalRecalculadas}</strong> vendas recalculadas</li>
                      <li><strong>{resultadoGeral.totalErros}</strong> erros</li>
                      <li><strong>{resultadoGeral.grupos}</strong> grupos processados</li>
                    </ul>
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Recálculo Específico */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Recálculo Específico
          </CardTitle>
          <CardDescription>
            Recalcula o CMV de um posto/produto específico a partir de uma data
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Posto</Label>
              <Select value={postoId} onValueChange={setPostoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o posto" />
                </SelectTrigger>
                <SelectContent>
                  {postos?.map((posto) => (
                    <SelectItem key={`posto-${posto.id}`} value={String(posto.id)}>
                      {posto.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Produto</Label>
              <Select value={produtoId} onValueChange={setProdutoId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o produto" />
                </SelectTrigger>
                <SelectContent>
                  {produtos?.map((produto) => (
                    <SelectItem key={`produto-${produto.id}`} value={String(produto.id)}>
                      {produto.descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input 
                type="date" 
                value={dataInicio} 
                onChange={(e) => setDataInicio(e.target.value)}
              />
            </div>
          </div>

          <Button 
            onClick={handleRecalcularRetroativo}
            disabled={recalcularRetroativo.isPending || !postoId || !produtoId || !dataInicio}
            className="w-full"
          >
            {recalcularRetroativo.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Recalcular CMV Retroativo
              </>
            )}
          </Button>

          {resultado && (
            <Alert variant={resultado.erro ? "destructive" : "default"}>
              {resultado.erro ? (
                <>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>Erro</AlertTitle>
                  <AlertDescription>{resultado.erro}</AlertDescription>
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  <AlertTitle>Recálculo Concluído</AlertTitle>
                  <AlertDescription>
                    <ul className="list-disc list-inside mt-2">
                      <li><strong>{resultado.recalculadas}</strong> vendas recalculadas</li>
                      <li><strong>{resultado.erros}</strong> erros</li>
                    </ul>
                  </AlertDescription>
                </>
              )}
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Explicação do Processo */}
      <Card>
        <CardHeader>
          <CardTitle>Como funciona o recálculo?</CardTitle>
        </CardHeader>
        <CardContent className="prose prose-sm max-w-none">
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>
              <strong>Reset dos lotes:</strong> Os saldos dos lotes são restaurados para a quantidade original
            </li>
            <li>
              <strong>Ordenação cronológica:</strong> As vendas são processadas na ordem de data (mais antigas primeiro)
            </li>
            <li>
              <strong>Consumo PEPS:</strong> Cada venda consome os lotes na ordem: primeiro por ordemConsumo, depois por dataEntrada
            </li>
            <li>
              <strong>Persistência:</strong> O CMV calculado é salvo na venda e os consumos são registrados na tabela consumoLotes
            </li>
            <li>
              <strong>Alertas:</strong> Se não houver lotes suficientes, a venda fica com status "erro" e um alerta é gerado
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
