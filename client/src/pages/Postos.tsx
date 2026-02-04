import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { Building2, Plus, Fuel } from "lucide-react";
import { useState } from "react";


export default function Postos() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [codigoAcs, setCodigoAcs] = useState("");
  const [nome, setNome] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [endereco, setEndereco] = useState("");

  const { data: postos, isLoading, refetch } = trpc.postos.list.useQuery();
  const { data: tanques } = trpc.tanques.list.useQuery();
  const utils = trpc.useUtils();

  const createPosto = trpc.postos.create.useMutation({
    onSuccess: () => {
      alert("Posto cadastrado com sucesso!");
      setDialogOpen(false);
      resetForm();
      utils.postos.list.invalidate();
    },
    onError: (error) => {
      alert("Erro ao cadastrar posto: " + error.message);
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

  // Contar tanques por posto
  const tanquesPorPosto = tanques?.reduce((acc, t) => {
    acc[t.postoId] = (acc[t.postoId] || 0) + 1;
    return acc;
  }, {} as Record<number, number>) || {};

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Postos</h1>
            <p className="text-muted-foreground">Gerenciamento dos postos da rede</p>
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

        {/* Lista de Postos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Postos Cadastrados
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Carregando...</div>
            ) : !postos || postos.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum posto cadastrado. Clique em "Novo Posto" para adicionar.
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
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postos.map(posto => (
                      <TableRow key={posto.id}>
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
