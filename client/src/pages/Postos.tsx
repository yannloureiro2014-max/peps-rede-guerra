import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Fuel, CheckCircle2, XCircle } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Postos() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin_geral";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [codigoAcs, setCodigoAcs] = useState("");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");
  const [mostrarInativos, setMostrarInativos] = useState(true);

  // Usar listAll para mostrar todos os postos (incluindo inativos)
  const { data: postos, isLoading } = trpc.postos.listAll.useQuery();
  const { data: tanques } = trpc.tanques.list.useQuery();
  const utils = trpc.useUtils();

  const createPosto = trpc.postos.create.useMutation({
    onSuccess: () => {
      alert("Posto cadastrado com sucesso!");
      setDialogOpen(false);
      resetForm();
      utils.postos.listAll.invalidate();
      utils.postos.list.invalidate();
    },
    onError: (error: any) => {
      alert("Erro ao cadastrar posto: " + error.message);
    }
  });

  const toggleAtivo = trpc.postos.toggleAtivo.useMutation({
    onSuccess: () => {
      utils.postos.listAll.invalidate();
      utils.postos.list.invalidate();
      // Invalidar dashboard e vendas também
      utils.vendas.resumo.invalidate();
      utils.vendas.porPosto.invalidate();
      utils.vendas.porCombustivel.invalidate();
    },
    onError: (error: any) => {
      alert("Erro ao alterar status: " + error.message);
    }
  });

  const resetForm = () => {
    setCodigoAcs("");
    setNome("");
    setCnpj("");
    setEndereco("");
  };

  const handleSubmit = () => {
    if (!codigoAcs || !nome) {
      alert("Preencha os campos obrigatórios");
      return;
    }
    createPosto.mutate({ codigoAcs, nome, cnpj, endereco });
  };

  const handleToggleAtivo = (postoId: number, ativoAtual: number) => {
    const novoStatus = ativoAtual === 1 ? false : true;
    const acao = novoStatus ? "ativar" : "desativar";
    if (confirm(`Deseja ${acao} este posto? ${novoStatus ? "Ele voltará a aparecer no dashboard e sincronização." : "Ele será removido do dashboard e não será mais sincronizado."}`)) {
      toggleAtivo.mutate({ id: postoId, ativo: novoStatus });
    }
  };

  // Contar tanques por posto
  const tanquesPorPosto = tanques?.reduce((acc, t) => {
    acc[t.postoId] = (acc[t.postoId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>) || {};

  // Filtrar postos
  const postosFiltrados = postos?.filter(p => {
    if (!mostrarInativos && p.ativo === 0) return false;
    return true;
  }) || [];

  const totalAtivos = postos?.filter(p => p.ativo === 1).length || 0;
  const totalInativos = postos?.filter(p => p.ativo === 0).length || 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Postos</h1>
            <p className="text-muted-foreground">
              Gerenciamento dos postos da rede — {totalAtivos} ativos
              {totalInativos > 0 ? `, ${totalInativos} inativos` : ""}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={mostrarInativos}
                onCheckedChange={setMostrarInativos}
                id="mostrar-inativos"
              />
              <Label htmlFor="mostrar-inativos" className="text-sm cursor-pointer">
                Mostrar inativos
              </Label>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Novo Posto
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <DialogTitle>Cadastrar Novo Posto</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Código ACS *</Label>
                      <Input value={codigoAcs} onChange={e => setCodigoAcs(e.target.value)} placeholder="01" />
                    </div>
                    <div className="space-y-2">
                      <Label>CNPJ</Label>
                      <Input value={cnpj} onChange={e => setCnpj(e.target.value)} placeholder="00.000.000/0001-00" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Nome *</Label>
                    <Input value={nome} onChange={e => setNome(e.target.value)} placeholder="Nome do posto" />
                  </div>

                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input value={endereco} onChange={e => setEndereco(e.target.value)} placeholder="Endereço completo" />
                  </div>

                  <Button onClick={handleSubmit} className="w-full" disabled={createPosto.isPending}>
                    {createPosto.isPending ? "Salvando..." : "Cadastrar Posto"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Lista de Postos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Postos Cadastrados ({postosFiltrados.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : postosFiltrados.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum posto encontrado.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>CNPJ</TableHead>
                      <TableHead>Endereço</TableHead>
                      <TableHead className="text-center">Tanques</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      {isAdmin ? <TableHead className="text-center">Ação</TableHead> : null}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postosFiltrados.map(posto => (
                      <TableRow key={posto.id} className={posto.ativo === 0 ? "opacity-50" : ""}>
                        <TableCell className="font-mono">{posto.codigoAcs}</TableCell>
                        <TableCell className="font-medium">{posto.nome}</TableCell>
                        <TableCell>{posto.cnpj || '-'}</TableCell>
                        <TableCell className="max-w-[200px] truncate">{posto.endereco || '-'}</TableCell>
                        <TableCell className="text-center">
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded-md text-sm">
                            <Fuel className="h-3 w-3" />
                            {tanquesPorPosto[posto.id] || 0}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {posto.ativo === 1 ? (
                            <Badge variant="default" className="bg-green-600 hover:bg-green-700">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Ativo
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
                              <XCircle className="h-3 w-3 mr-1" />
                              Inativo
                            </Badge>
                          )}
                        </TableCell>
                        {isAdmin ? (
                          <TableCell className="text-center">
                            <Switch
                              checked={posto.ativo === 1}
                              onCheckedChange={() => handleToggleAtivo(posto.id, posto.ativo)}
                              disabled={toggleAtivo.isPending}
                            />
                          </TableCell>
                        ) : null}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Info */}
        <Card>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>Postos ativos:</strong> Aparecem no dashboard, estoque, DRE e são sincronizados com o ACS.</p>
              <p><strong>Postos inativos:</strong> Não aparecem no dashboard, não são sincronizados, mas os dados históricos são mantidos.</p>
              <p><strong>Data de corte:</strong> O sistema sincroniza apenas dados a partir de 01/12/2025.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
