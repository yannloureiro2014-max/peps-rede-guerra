import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { Settings, Database, RefreshCw, Save, CheckCircle, Loader2, AlertCircle } from "lucide-react";
import { useState } from "react";

export default function Configuracoes() {
  const [estoqueMinimo, setEstoqueMinimo] = useState("1000");
  const [toleranciaDiferenca, setToleranciaDiferenca] = useState("0.5");
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [mensagem, setMensagem] = useState<string | null>(null);

  const { data: ultimaSync, refetch: refetchSync } = trpc.dashboard.ultimaSincronizacao.useQuery();
  const { data: configuracoes, isLoading } = trpc.configuracoes.list.useQuery();
  const utils = trpc.useUtils();

  const setConfiguracao = trpc.configuracoes.set.useMutation({
    onSuccess: () => {
      setMensagem("Configuração salva com sucesso!");
      utils.configuracoes.list.invalidate();
      setTimeout(() => setMensagem(null), 3000);
    },
    onError: (error: any) => {
      setMensagem("Erro ao salvar: " + error.message);
      setTimeout(() => setMensagem(null), 5000);
    }
  });

  const sincronizarMedicoes = trpc.sync.sincronizarMedicoes.useMutation({
    onMutate: () => {
      setSyncStatus("syncing");
      setMensagem("Sincronizando medições com ACS...");
    },
    onSuccess: (result: any) => {
      if (result.success) {
        setSyncStatus("success");
        setMensagem("Sincronização concluída com sucesso!");
        refetchSync();
      } else {
        setSyncStatus("error");
        setMensagem("Sincronização concluída com erros");
      }
      setTimeout(() => {
        setMensagem(null);
        setSyncStatus("idle");
      }, 5000);
    },
    onError: (error: any) => {
      setSyncStatus("error");
      setMensagem("Erro na sincronização: " + error.message);
      setTimeout(() => {
        setMensagem(null);
        setSyncStatus("idle");
      }, 5000);
    }
  });

  const handleSincronizar = () => {
    sincronizarMedicoes.mutate({});
  };

  const salvarConfiguracoes = () => {
    setConfiguracao.mutate({
      chave: "estoque_minimo",
      valor: estoqueMinimo
    });
    setConfiguracao.mutate({
      chave: "tolerancia_diferenca",
      valor: toleranciaDiferenca
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
          <p className="text-muted-foreground mt-2">Gerencie as configurações do sistema</p>
        </div>

        {mensagem && (
          <div className={`p-4 rounded-lg ${
            syncStatus === "success" 
              ? "bg-green-50 border border-green-200 text-green-800"
              : syncStatus === "error"
              ? "bg-red-50 border border-red-200 text-red-800"
              : "bg-blue-50 border border-blue-200 text-blue-800"
          }`}>
            {mensagem}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Parâmetros do Sistema */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Parâmetros do Sistema
              </CardTitle>
              <CardDescription>Configure os parâmetros padrão do sistema</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Estoque Mínimo Padrão (L)</Label>
                <Input 
                  type="number" 
                  value={estoqueMinimo} 
                  onChange={e => setEstoqueMinimo(e.target.value)}
                  placeholder="1000"
                />
                <p className="text-xs text-muted-foreground">
                  Valor padrão para alertas de estoque baixo em novos tanques
                </p>
              </div>

              <div className="space-y-2">
                <Label>Tolerância de Diferença (%)</Label>
                <Input 
                  type="number" 
                  value={toleranciaDiferenca} 
                  onChange={e => setToleranciaDiferenca(e.target.value)}
                  placeholder="0.5"
                  step="0.1"
                />
                <p className="text-xs text-muted-foreground">
                  Percentual de tolerância para diferenças em medições físicas
                </p>
              </div>

              <Button onClick={salvarConfiguracoes} disabled={setConfiguracao.isPending}>
                <Save className="h-4 w-4 mr-2" />
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>

          {/* Status da Sincronização */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5" />
                Integração ACS
              </CardTitle>
              <CardDescription>Sincronização com o banco de dados ACS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-muted rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status</span>
                  <span className="flex items-center gap-1 text-green-600 font-medium">
                    <CheckCircle className="h-4 w-4" />
                    Conectado
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Última Sincronização</span>
                  <span className="text-sm font-medium">
                    {ultimaSync 
                      ? new Date(ultimaSync.createdAt).toLocaleString('pt-BR')
                      : 'Nunca'
                    }
                  </span>
                </div>
                {ultimaSync && (
                  <>
                    <Separator />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Registros Processados</span>
                      <span className="text-sm font-medium">{ultimaSync.registrosProcessados || 0}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Registros Inseridos</span>
                      <span className="text-sm font-medium">{ultimaSync.registrosInseridos || 0}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Botão de Sincronização */}
              <Button 
                onClick={handleSincronizar} 
                disabled={syncStatus === "syncing"}
                className="w-full"
                variant={syncStatus === "success" ? "outline" : "default"}
              >
                {syncStatus === "syncing" ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Sincronizando...
                  </>
                ) : syncStatus === "success" ? (
                  <>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Sincronizado!
                  </>
                ) : syncStatus === "error" ? (
                  <>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Tentar Novamente
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Sincronizar com ACS
                  </>
                )}
              </Button>

              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Sincronização:</strong> Importa medições físicas diárias do banco de dados ACS em lotes de 7 dias para melhor performance.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Configurações Atuais */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Configurações Salvas</CardTitle>
              <CardDescription>Lista de todas as configurações do sistema</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-4 text-muted-foreground">Carregando...</div>
              ) : !configuracoes || configuracoes.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  Nenhuma configuração salva ainda.
                </div>
              ) : (
                <div className="space-y-2">
                  {configuracoes.map(config => (
                    <div key={config.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                      <div>
                        <p className="font-medium text-sm">{config.chave}</p>
                        <p className="text-xs text-muted-foreground">{config.valor}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
