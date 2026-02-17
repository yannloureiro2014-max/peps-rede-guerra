/**
 * Dashboard de Reconciliação Fiscal vs Físico
 * 
 * Compara estoque fiscal (NFe) com estoque físico (alocações reais)
 * Identifica divergências e recomenda ajustes
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, AlertCircle, TrendingDown, TrendingUp, Home, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";

interface DivergenciaItem {
  id: string;
  postoId: number;
  postoNome: string;
  tanqueId: number;
  tanqueNome: string;
  produto: string;
  estoqueFiscal: number;
  estoqueFisico: number;
  divergencia: number;
  percentualDivergencia: number;
  tipo: "sobra" | "falta" | "ok";
  severidade: "critica" | "alta" | "media" | "baixa";
  recomendacao: string;
}

const DIVERGENCIAS_SIMULADAS: DivergenciaItem[] = [
  {
    id: "1",
    postoId: 1,
    postoNome: "Aracati",
    tanqueId: 1,
    tanqueNome: "Gasolina 1",
    produto: "Gasolina Comum",
    estoqueFiscal: 5000,
    estoqueFisico: 4850,
    divergencia: -150,
    percentualDivergencia: -3.0,
    tipo: "falta",
    severidade: "media",
    recomendacao: "Verificar medição física. Possível perda por evaporação ou vazamento.",
  },
  {
    id: "2",
    postoId: 1,
    postoNome: "Aracati",
    tanqueId: 2,
    tanqueNome: "Diesel 1",
    produto: "Diesel S10",
    estoqueFiscal: 3000,
    estoqueFisico: 3050,
    divergencia: 50,
    percentualDivergencia: 1.67,
    tipo: "sobra",
    severidade: "baixa",
    recomendacao: "Pequena sobra dentro da margem aceitável (< 2%). Monitorar.",
  },
  {
    id: "3",
    postoId: 2,
    postoNome: "Fortaleza Centro",
    tanqueId: 3,
    tanqueNome: "Gasolina 1",
    produto: "Gasolina Comum",
    estoqueFiscal: 8000,
    estoqueFisico: 7200,
    divergencia: -800,
    percentualDivergencia: -10.0,
    tipo: "falta",
    severidade: "critica",
    recomendacao: "CRÍTICO: Falta significativa. Investigar imediatamente. Possível roubo ou erro de medição.",
  },
  {
    id: "4",
    postoId: 3,
    postoNome: "Fortaleza Beira Mar",
    tanqueId: 4,
    tanqueNome: "Gasolina 2",
    produto: "Gasolina Aditivada",
    estoqueFiscal: 2000,
    estoqueFisico: 2000,
    divergencia: 0,
    percentualDivergencia: 0,
    tipo: "ok",
    severidade: "baixa",
    recomendacao: "Estoque em conformidade. Sem ações necessárias.",
  },
];

export default function Reconciliacao() {
  const [, setLocation] = useLocation();
  const [carregando, setCarregando] = useState(false);
  const [filtroSeveridade, setFiltroSeveridade] = useState<string>("todas");

  const divergencias = DIVERGENCIAS_SIMULADAS.filter((d) => {
    if (filtroSeveridade === "todas") return true;
    return d.severidade === filtroSeveridade;
  });

  const stats = {
    total: DIVERGENCIAS_SIMULADAS.length,
    criticas: DIVERGENCIAS_SIMULADAS.filter((d) => d.severidade === "critica").length,
    altas: DIVERGENCIAS_SIMULADAS.filter((d) => d.severidade === "alta").length,
    conformes: DIVERGENCIAS_SIMULADAS.filter((d) => d.tipo === "ok").length,
    totalDivergencia: DIVERGENCIAS_SIMULADAS.reduce((sum, d) => sum + Math.abs(d.divergencia), 0),
  };

  const handleAtualizar = async () => {
    setCarregando(true);
    // Simular busca de dados
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setCarregando(false);
  };

  const getSeveridadeColor = (severidade: string) => {
    switch (severidade) {
      case "critica":
        return "bg-red-100 text-red-800 border-red-300";
      case "alta":
        return "bg-orange-100 text-orange-800 border-orange-300";
      case "media":
        return "bg-yellow-100 text-yellow-800 border-yellow-300";
      case "baixa":
        return "bg-green-100 text-green-800 border-green-300";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getTipoIcon = (tipo: string) => {
    switch (tipo) {
      case "falta":
        return <TrendingDown className="w-4 h-4 text-red-600" />;
      case "sobra":
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case "ok":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reconciliação Fiscal vs Físico</h1>
          <p className="text-gray-600 mt-2">
            Compare estoque fiscal (NFe) com estoque físico (alocações reais)
          </p>
        </div>
        <div className="space-x-2">
          <Button
            variant="outline"
            onClick={() => setLocation("/dashboard")}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Voltar
          </Button>
          <Button
            onClick={handleAtualizar}
            disabled={carregando}
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${carregando ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total de Tanques</p>
            <p className="text-3xl font-bold">{stats.total}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-sm text-red-700 font-semibold">Críticas</p>
            <p className="text-3xl font-bold text-red-700">{stats.criticas}</p>
          </CardContent>
        </Card>
        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="pt-6">
            <p className="text-sm text-orange-700 font-semibold">Altas</p>
            <p className="text-3xl font-bold text-orange-700">{stats.altas}</p>
          </CardContent>
        </Card>
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <p className="text-sm text-green-700 font-semibold">Conformes</p>
            <p className="text-3xl font-bold text-green-700">{stats.conformes}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-sm text-gray-600">Total Divergência</p>
            <p className="text-3xl font-bold">{stats.totalDivergencia.toLocaleString()} L</p>
          </CardContent>
        </Card>
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <Button
          variant={filtroSeveridade === "todas" ? "default" : "outline"}
          onClick={() => setFiltroSeveridade("todas")}
          size="sm"
        >
          Todas ({DIVERGENCIAS_SIMULADAS.length})
        </Button>
        <Button
          variant={filtroSeveridade === "critica" ? "default" : "outline"}
          onClick={() => setFiltroSeveridade("critica")}
          size="sm"
          className="border-red-300"
        >
          Críticas ({stats.criticas})
        </Button>
        <Button
          variant={filtroSeveridade === "alta" ? "default" : "outline"}
          onClick={() => setFiltroSeveridade("alta")}
          size="sm"
          className="border-orange-300"
        >
          Altas ({stats.altas})
        </Button>
        <Button
          variant={filtroSeveridade === "baixa" ? "default" : "outline"}
          onClick={() => setFiltroSeveridade("baixa")}
          size="sm"
          className="border-green-300"
        >
          Conformes ({stats.conformes})
        </Button>
      </div>

      {/* Tabela de Divergências */}
      <Card>
        <CardHeader>
          <CardTitle>Divergências Identificadas</CardTitle>
          <CardDescription>
            {divergencias.length} item(ns) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {divergencias.length > 0 ? (
              divergencias.map((div) => (
                <div
                  key={div.id}
                  className={`p-4 rounded-lg border-2 ${getSeveridadeColor(div.severidade)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-3">
                      {getTipoIcon(div.tipo)}
                      <div>
                        <p className="font-semibold">
                          {div.postoNome} - {div.tanqueNome}
                        </p>
                        <p className="text-sm opacity-75">{div.produto}</p>
                      </div>
                    </div>
                    <Badge className={getSeveridadeColor(div.severidade)}>
                      {div.severidade.toUpperCase()}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4 mb-3 text-sm">
                    <div>
                      <p className="opacity-75">Estoque Fiscal</p>
                      <p className="font-semibold">{div.estoqueFiscal.toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="opacity-75">Estoque Físico</p>
                      <p className="font-semibold">{div.estoqueFisico.toLocaleString()} L</p>
                    </div>
                    <div>
                      <p className="opacity-75">Divergência</p>
                      <p className={`font-semibold ${
                        div.divergencia < 0 ? "text-red-600" : "text-green-600"
                      }`}>
                        {div.divergencia > 0 ? "+" : ""}{div.divergencia.toLocaleString()} L ({div.percentualDivergencia.toFixed(2)}%)
                      </p>
                    </div>
                  </div>

                  <div className="bg-white bg-opacity-50 p-3 rounded text-sm">
                    <div className="flex gap-2 items-start">
                      <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>{div.recomendacao}</p>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-gray-500">
                Nenhuma divergência encontrada com este filtro
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recomendações Gerais */}
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-lg">Recomendações Gerais</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          {stats.criticas > 0 && (
            <div className="flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <p>
                <strong>CRÍTICO:</strong> Existem {stats.criticas} divergência(s) crítica(s). Investigar imediatamente.
              </p>
            </div>
          )}
          {stats.altas > 0 && (
            <div className="flex gap-2 items-start">
              <AlertCircle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
              <p>
                <strong>ATENÇÃO:</strong> Existem {stats.altas} divergência(s) de alta prioridade. Agendar verificação.
              </p>
            </div>
          )}
          <div className="flex gap-2 items-start">
            <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
            <p>
              <strong>CONFORMIDADE:</strong> {stats.conformes} tanque(s) em conformidade com estoque fiscal.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
