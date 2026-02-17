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
import { AlertCircle, CheckCircle, Clock, MapPin, Truck } from "lucide-react";

export default function AlocacoesFisicas() {
  const [tab, setTab] = useState("nfes-pendentes");
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

  // Dados simulados - NFes em staging
  const nfesPendentes = [
    {
      id: 1,
      chaveNfe: "35240216123456789012345678901234567890",
      numeroNf: "001234",
      dataEmissao: "2026-02-14",
      cnpjFaturado: "07.526.847/0001-00", // Aracati
      postoFiscal: "Aracati",
      produto: "Gasolina Comum",
      quantidade: 5000,
      custoUnitario: 5.42,
      custoTotal: 27100,
      statusAlocacao: "pendente",
      quantidadePendente: 5000,
    },
    {
      id: 2,
      chaveNfe: "35240216234567890123456789012345678901",
      numeroNf: "001235",
      dataEmissao: "2026-02-15",
      cnpjFaturado: "07.526.847/0001-00", // Aracati
      postoFiscal: "Aracati",
      produto: "Diesel S10",
      quantidade: 3000,
      custoUnitario: 6.15,
      custoTotal: 18450,
      statusAlocacao: "parcialmente_alocado",
      quantidadePendente: 1500,
    },
  ];

  // Dados simulados - Alocações realizadas
  const alocacoesRealizadas = [
    {
      id: 1,
      chaveNfe: "35240216111111111111111111111111111111",
      numeroNf: "001232",
      dataEmissao: "2026-02-13",
      postoFiscal: "Aracati",
      postoDestino: "Fortaleza Centro",
      tanqueDestino: "Gasolina 1",
      dataDescarga: "2026-02-13",
      horaDescarga: "14:30",
      volumeAlocado: 4500,
      status: "confirmado",
      usuarioAlocacao: "Yann Loureiro",
      justificativa: "Compra com CNPJ Aracati, descarga em Fortaleza",
    },
    {
      id: 2,
      chaveNfe: "35240216222222222222222222222222222222",
      numeroNf: "001233",
      dataEmissao: "2026-02-14",
      postoFiscal: "Aracati",
      postoDestino: "Fortaleza Bairro",
      tanqueDestino: "Diesel 1",
      dataDescarga: "2026-02-14",
      horaDescarga: "09:15",
      volumeAlocado: 3000,
      status: "confirmado",
      usuarioAlocacao: "Yann Loureiro",
      justificativa: "Compra com CNPJ Aracati, descarga em Fortaleza Bairro",
    },
  ];

  // Dados simulados - Postos e tanques
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

  const handleAlocar = () => {
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

    console.log("Alocação realizada:", novaAlocacao);
    alert("Alocação criada com sucesso!");

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
  };

  const handleSelecionarNfe = (nfe: any) => {
    setNovaAlocacao({
      ...novaAlocacao,
      nfeStagingId: nfe.id.toString(),
      chaveNfe: nfe.chaveNfe,
    });
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Alocações Físicas</h1>
        <p className="text-gray-600 mt-2">
          Determine onde e quando cada compra foi descarregada
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="nfes-pendentes">
            <AlertCircle className="w-4 h-4 mr-2" />
            NFes Pendentes
          </TabsTrigger>
          <TabsTrigger value="alocacoes">
            <CheckCircle className="w-4 h-4 mr-2" />
            Alocações Realizadas
          </TabsTrigger>
          <TabsTrigger value="lotes">
            <Truck className="w-4 h-4 mr-2" />
            Lotes Físicos
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: NFes Pendentes */}
        <TabsContent value="nfes-pendentes" className="space-y-4">
          <div className="grid gap-4">
            {nfesPendentes.map((nfe) => (
              <Card key={nfe.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">NF {nfe.numeroNf}</CardTitle>
                      <CardDescription className="text-xs font-mono mt-1">
                        {nfe.chaveNfe}
                      </CardDescription>
                    </div>
                    {getStatusBadge(nfe.statusAlocacao)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
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
                                  tanqueDestino: "", // Reset tanque
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
                          <Button onClick={handleAlocar} className="bg-green-600 hover:bg-green-700">
                            <CheckCircle className="w-4 h-4 mr-2" />
                            Confirmar Alocação
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* TAB 2: Alocações Realizadas */}
        <TabsContent value="alocacoes" className="space-y-4">
          <div className="grid gap-4">
            {alocacoesRealizadas.map((alocacao) => (
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
            ))}
          </div>
        </TabsContent>

        {/* TAB 3: Lotes Físicos */}
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
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">LOT-001</td>
                      <td className="py-2 px-2">Fortaleza Centro</td>
                      <td className="py-2 px-2">Gasolina 1</td>
                      <td className="py-2 px-2">13/02/2026</td>
                      <td className="py-2 px-2 text-right">4.500 L</td>
                      <td className="py-2 px-2 text-right font-semibold">1</td>
                      <td className="py-2 px-2">
                        <Badge variant="default">Ativo</Badge>
                      </td>
                    </tr>
                    <tr className="border-b hover:bg-gray-50">
                      <td className="py-2 px-2 font-mono text-xs">LOT-002</td>
                      <td className="py-2 px-2">Fortaleza Bairro</td>
                      <td className="py-2 px-2">Diesel 1</td>
                      <td className="py-2 px-2">14/02/2026</td>
                      <td className="py-2 px-2 text-right">3.000 L</td>
                      <td className="py-2 px-2 text-right font-semibold">2</td>
                      <td className="py-2 px-2">
                        <Badge variant="default">Ativo</Badge>
                      </td>
                    </tr>
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
