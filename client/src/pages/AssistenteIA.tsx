import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Loader2, Send, Lightbulb, TrendingUp, AlertCircle } from "lucide-react";
import { Streamdown } from "streamdown";

export default function AssistenteIA() {
  const [mensagens, setMensagens] = useState<Array<{ role: "user" | "assistant"; content: string }>>([
    { role: "assistant", content: "Olá! Sou seu Assistente de IA. Posso ajudar com análise de vendas, recomendações de compra, validação de notas fiscais e muito mais. Como posso ajudá-lo?" }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [postoId, setPostoId] = useState<number | undefined>();
  const [dataInicio, setDataInicio] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(new Date().toISOString().split('T')[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatMutation = trpc.ia.chat.useMutation();
  const analisarQuery = trpc.ia.analisarDados.useQuery({ postoId, dataInicio, dataFim }, { enabled: false });
  const recomendacoesQuery = trpc.ia.gerarRecomendacoes.useQuery({ postoId, tipo: "geral" }, { enabled: false });

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const enviarMensagem = async () => {
    if (!inputValue.trim()) return;

    const novaMensagem = inputValue;
    setInputValue("");
    setMensagens(prev => [...prev, { role: "user", content: novaMensagem }]);
    setCarregando(true);

    try {
      const resultado = await chatMutation.mutateAsync({
        mensagem: novaMensagem,
        contexto: { postoId, dataInicio, dataFim }
      });

      setMensagens(prev => [...prev, { role: "assistant", content: resultado.resposta }]);
    } catch (error) {
      setMensagens(prev => [...prev, { role: "assistant", content: "Desculpe, ocorreu um erro ao processar sua pergunta." }]);
    } finally {
      setCarregando(false);
    }
  };

  const executarAnalise = async () => {
    setCarregando(true);
    try {
      const resultado = await analisarQuery.refetch();
      if (resultado.data) {
        setMensagens(prev => [...prev, { role: "assistant", content: resultado.data.analise }]);
      }
    } catch (error) {
      setMensagens(prev => [...prev, { role: "assistant", content: "Erro ao executar análise." }]);
    } finally {
      setCarregando(false);
    }
  };

  const executarRecomendacoes = async () => {
    setCarregando(true);
    try {
      const resultado = await recomendacoesQuery.refetch();
      if (resultado.data) {
        setMensagens(prev => [...prev, { role: "assistant", content: resultado.data.recomendacoes }]);
      }
    } catch (error) {
      setMensagens(prev => [...prev, { role: "assistant", content: "Erro ao gerar recomendações." }]);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card p-4">
        <h1 className="text-2xl font-bold mb-4">🤖 Assistente de IA</h1>
        
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div>
            <label className="text-sm font-medium">Data Inicial</label>
            <Input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Data Final</label>
            <Input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="mt-1"
            />
          </div>
          <div className="flex gap-2 items-end">
            <Button onClick={executarAnalise} disabled={carregando} variant="outline" className="flex-1">
              <TrendingUp className="w-4 h-4 mr-2" />
              Analisar
            </Button>
          </div>
          <div className="flex gap-2 items-end">
            <Button onClick={executarRecomendacoes} disabled={carregando} variant="outline" className="flex-1">
              <Lightbulb className="w-4 h-4 mr-2" />
              Recomendações
            </Button>
          </div>
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {mensagens.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-2xl p-4 rounded-lg ${msg.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
              {msg.role === "assistant" ? (
                <Streamdown>{msg.content}</Streamdown>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          </div>
        ))}
        {carregando && (
          <div className="flex justify-start">
            <div className="bg-muted p-4 rounded-lg">
              <Loader2 className="w-5 h-5 animate-spin" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t bg-card p-4">
        <div className="flex gap-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && enviarMensagem()}
            placeholder="Faça uma pergunta sobre suas vendas, estoque, lucro..."
            disabled={carregando}
          />
          <Button onClick={enviarMensagem} disabled={carregando || !inputValue.trim()}>
            {carregando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </Button>
        </div>
      </div>
    </div>
  );
}
