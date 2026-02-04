import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Bell, CheckCircle, AlertTriangle, Fuel, Ruler, RefreshCw } from "lucide-react";


export default function Alertas() {
  const { data: alertas, isLoading, refetch } = trpc.alertas.pendentes.useQuery();
  const utils = trpc.useUtils();

  const resolverAlerta = trpc.alertas.resolver.useMutation({
    onSuccess: () => {
      alert("Alerta resolvido!");
      utils.alertas.pendentes.invalidate();
    },
    onError: (error) => {
      alert("Erro ao resolver alerta: " + error.message);
    }
  });

  const getIcone = (tipo: string) => {
    switch (tipo) {
      case 'estoque_baixo': return <Fuel className="h-5 w-5 text-orange-500" />;
      case 'diferenca_medicao': return <Ruler className="h-5 w-5 text-red-500" />;
      case 'cmv_pendente': return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case 'sincronizacao': return <RefreshCw className="h-5 w-5 text-blue-500" />;
      default: return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  const getTipoBadge = (tipo: string) => {
    switch (tipo) {
      case 'estoque_baixo': return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">Estoque Baixo</Badge>;
      case 'diferenca_medicao': return <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">Diferença Medição</Badge>;
      case 'cmv_pendente': return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">CMV Pendente</Badge>;
      case 'sincronizacao': return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Sincronização</Badge>;
      default: return <Badge variant="outline">Outro</Badge>;
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Alertas</h1>
            <p className="text-muted-foreground">Notificações e alertas do sistema</p>
          </div>
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        {/* Lista de Alertas */}
        {isLoading ? (
          <div className="text-center py-12 text-muted-foreground">Carregando...</div>
        ) : !alertas || alertas.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground">Tudo em ordem!</h3>
              <p className="text-muted-foreground mt-2">Não há alertas pendentes no momento.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {alertas.map(alerta => (
              <Card key={alerta.id} className="border-l-4 border-l-orange-400">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      {getIcone(alerta.tipo)}
                      <div>
                        <CardTitle className="text-base">{alerta.titulo}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          {getTipoBadge(alerta.tipo)}
                          <span className="text-xs text-muted-foreground">
                            {new Date(alerta.createdAt).toLocaleString('pt-BR')}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => resolverAlerta.mutate({ id: alerta.id })}
                      disabled={resolverAlerta.isPending}
                    >
                      <CheckCircle className="h-4 w-4 mr-1" />
                      Resolver
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">{alerta.mensagem}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
