import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose } from "@/components/ui/dialog";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Users, UserPlus, Pencil, Trash2, Shield, Eye, User } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

function formatDate(date: Date | string | null): string {
  if (!date) return "-";
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR');
}

function getRoleBadge(role: string) {
  switch (role) {
    case 'admin_geral':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200"><Shield className="h-3 w-3 mr-1" />Admin Geral</Badge>;
    case 'visualizacao':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Eye className="h-3 w-3 mr-1" />Visualização</Badge>;
    default:
      return <Badge variant="outline"><User className="h-3 w-3 mr-1" />Usuário</Badge>;
  }
}

export default function GestaoUsuarios() {
  const { user: currentUser } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);
  
  // Form state
  const [formEmail, setFormEmail] = useState("");
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<"user" | "admin_geral" | "visualizacao">("user");
  const [formPostoId, setFormPostoId] = useState<string>("");

  const { data: usuarios, refetch } = trpc.usuarios.list.useQuery(undefined, {
    enabled: currentUser?.role === "admin_geral"
  });
  const { data: postos } = trpc.postos.list.useQuery();

  const createMutation = trpc.usuarios.create.useMutation({
    onSuccess: () => {
      toast.success("Usuário criado com sucesso!");
      refetch();
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao criar usuário");
    }
  });

  const updateMutation = trpc.usuarios.update.useMutation({
    onSuccess: () => {
      toast.success("Usuário atualizado com sucesso!");
      refetch();
      resetForm();
      setDialogOpen(false);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao atualizar usuário");
    }
  });

  const deleteMutation = trpc.usuarios.delete.useMutation({
    onSuccess: () => {
      toast.success("Usuário excluído com sucesso!");
      refetch();
      setDeleteConfirmId(null);
    },
    onError: (error) => {
      toast.error(error.message || "Erro ao excluir usuário");
    }
  });

  const resetForm = () => {
    setFormEmail("");
    setFormName("");
    setFormRole("user");
    setFormPostoId("");
    setEditingUser(null);
  };

  const openEditDialog = (usuario: any) => {
    setEditingUser(usuario);
    setFormEmail(usuario.email || "");
    setFormName(usuario.name || "");
    setFormRole(usuario.role || "user");
    setFormPostoId(usuario.postoId?.toString() || "");
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (editingUser) {
      updateMutation.mutate({
        id: editingUser.id,
        name: formName,
        role: formRole,
        postoId: formPostoId ? parseInt(formPostoId) : null
      });
    } else {
      if (!formEmail || !formName) {
        toast.error("Preencha email e nome");
        return;
      }
      createMutation.mutate({
        email: formEmail,
        name: formName,
        role: formRole,
        postoId: formPostoId ? parseInt(formPostoId) : undefined
      });
    }
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
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Users className="h-7 w-7" />
              Gestão de Usuários
            </h1>
            <p className="text-muted-foreground">
              Gerencie os usuários do sistema e suas permissões
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={openCreateDialog}>
                <UserPlus className="h-4 w-4 mr-2" />
                Novo Usuário
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>
                  {editingUser ? "Editar Usuário" : "Novo Usuário"}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formEmail}
                    onChange={(e) => setFormEmail(e.target.value)}
                    disabled={!!editingUser}
                    placeholder="usuario@email.com"
                  />
                  {editingUser && (
                    <p className="text-xs text-muted-foreground">
                      O email não pode ser alterado após o cadastro
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="Nome completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Nível de Acesso</Label>
                  <Select value={formRole} onValueChange={(v) => setFormRole(v as any)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="user">Usuário (acesso padrão)</SelectItem>
                      <SelectItem value="admin_geral">Administrador Geral (acesso total)</SelectItem>
                      <SelectItem value="visualizacao">Visualização (somente leitura)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formRole === "visualizacao" && (
                  <div className="space-y-2">
                    <Label>Posto Vinculado (opcional)</Label>
                    <Select value={formPostoId} onValueChange={setFormPostoId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Todos os postos" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Todos os postos</SelectItem>
                        {postos?.map(posto => (
                          <SelectItem key={posto.id} value={posto.id.toString()}>
                            {posto.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Se vinculado, o usuário só verá dados deste posto
                    </p>
                  </div>
                )}
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancelar</Button>
                </DialogClose>
                <Button 
                  onClick={handleSubmit}
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  {editingUser ? "Salvar" : "Criar"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Usuários */}
        <Card>
          <CardHeader>
            <CardTitle>Usuários Cadastrados</CardTitle>
          </CardHeader>
          <CardContent>
            {!usuarios || usuarios.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">
                Nenhum usuário cadastrado
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-medium">Nome</th>
                      <th className="text-left p-3 font-medium">Email</th>
                      <th className="text-left p-3 font-medium">Nível de Acesso</th>
                      <th className="text-left p-3 font-medium">Posto Vinculado</th>
                      <th className="text-left p-3 font-medium">Último Acesso</th>
                      <th className="text-center p-3 font-medium">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {usuarios.map((usuario) => (
                      <tr key={usuario.id} className="border-b hover:bg-muted/50">
                        <td className="p-3 font-medium">{usuario.name || "-"}</td>
                        <td className="p-3">{usuario.email || "-"}</td>
                        <td className="p-3">{getRoleBadge(usuario.role)}</td>
                        <td className="p-3">{usuario.postoNome || "Todos"}</td>
                        <td className="p-3">{formatDate(usuario.lastSignedIn)}</td>
                        <td className="p-3">
                          <div className="flex items-center justify-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => openEditDialog(usuario)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Dialog open={deleteConfirmId === usuario.id} onOpenChange={(open) => !open && setDeleteConfirmId(null)}>
                              <DialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-destructive hover:text-destructive"
                                  onClick={() => setDeleteConfirmId(usuario.id)}
                                  disabled={usuario.id === currentUser?.id}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Confirmar Exclusão</DialogTitle>
                                </DialogHeader>
                                <p className="py-4">
                                  Tem certeza que deseja excluir o usuário <strong>{usuario.name}</strong>?
                                  Esta ação não pode ser desfeita.
                                </p>
                                <DialogFooter>
                                  <DialogClose asChild>
                                    <Button variant="outline">Cancelar</Button>
                                  </DialogClose>
                                  <Button
                                    variant="destructive"
                                    onClick={() => deleteMutation.mutate({ id: usuario.id })}
                                    disabled={deleteMutation.isPending}
                                  >
                                    Excluir
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Legenda de Níveis */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Níveis de Acesso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-5 w-5 text-purple-600" />
                  <span className="font-semibold">Administrador Geral</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso total ao sistema. Pode gerenciar usuários, inicializar meses, 
                  editar lotes e acessar todas as configurações.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <User className="h-5 w-5 text-gray-600" />
                  <span className="font-semibold">Usuário</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Acesso padrão. Pode visualizar e editar dados operacionais, 
                  mas não pode gerenciar usuários ou inicializar meses.
                </p>
              </div>
              <div className="p-4 border rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold">Visualização</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Somente leitura. Pode consultar DRE, ver lotes e relatórios. 
                  Se vinculado a um posto, vê apenas dados daquele posto.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
