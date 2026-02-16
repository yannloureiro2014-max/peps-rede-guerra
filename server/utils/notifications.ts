/**
 * Notificações Proativas para Alertas Críticos
 * Envia notificações via sistema Manus quando alertas críticos são gerados
 */

import { notifyOwner } from "../_core/notification";

export interface AlertNotification {
  tipo: "estoque_baixo" | "medicao_faltante" | "cmv_pendente" | "lotes_insuficientes";
  titulo: string;
  mensagem: string;
  postoId?: number;
  tanqueId?: number;
  severidade: "baixa" | "media" | "alta" | "critica";
  link?: string;
}

/**
 * Mapeia tipos de alerta para severidade padrão
 */
function getSeveridadeAlerta(tipo: string): "baixa" | "media" | "alta" | "critica" {
  switch (tipo) {
    case "estoque_baixo":
      return "media";
    case "medicao_faltante":
      return "alta";
    case "cmv_pendente":
      return "media";
    case "lotes_insuficientes":
      return "critica";
    default:
      return "media";
  }
}

/**
 * Verifica se o alerta é crítico e deve gerar notificação imediata
 */
function ehAlertaCritico(severidade: string): boolean {
  return severidade === "alta" || severidade === "critica";
}

/**
 * Envia notificação proativa para alertas críticos
 * @param alerta - Dados do alerta
 * @returns true se notificação foi enviada, false caso contrário
 */
export async function enviarNotificacaoAlerta(alerta: AlertNotification): Promise<boolean> {
  try {
    // Apenas enviar notificações para alertas críticos
    if (!ehAlertaCritico(alerta.severidade)) {
      console.log(`[NOTIFICACAO] Alerta ${alerta.tipo} não é crítico, notificação não enviada`);
      return false;
    }

    console.log(`[NOTIFICACAO] Enviando notificação para alerta crítico: ${alerta.titulo}`);

    // Construir conteúdo da notificação
    const conteudo = `
${alerta.mensagem}

Tipo: ${alerta.tipo}
Severidade: ${alerta.severidade}
${alerta.postoId ? `Posto: ${alerta.postoId}` : ""}
${alerta.tanqueId ? `Tanque: ${alerta.tanqueId}` : ""}
${alerta.link ? `Link: ${alerta.link}` : ""}
    `.trim();

    // Enviar notificação via sistema Manus
    const resultado = await notifyOwner({
      title: alerta.titulo,
      content: conteudo,
    });

    if (resultado) {
      console.log(`[NOTIFICACAO] Notificação enviada com sucesso para: ${alerta.titulo}`);
      return true;
    } else {
      console.warn(`[NOTIFICACAO] Falha ao enviar notificação para: ${alerta.titulo}`);
      return false;
    }
  } catch (error) {
    console.error(`[NOTIFICACAO] Erro ao enviar notificação:`, error);
    return false;
  }
}

/**
 * Envia notificação para alerta de estoque baixo
 */
export async function notificarEstoqueBaixo(
  postoId: number,
  tanqueId: number,
  postoNome: string,
  tanqueCodigo: string,
  estoqueAtual: number,
  estoqueMinimo: number
): Promise<boolean> {
  const alerta: AlertNotification = {
    tipo: "estoque_baixo",
    titulo: `⚠️ Estoque Baixo - ${postoNome}`,
    mensagem: `Estoque do tanque ${tanqueCodigo} está abaixo do mínimo. Atual: ${estoqueAtual}L, Mínimo: ${estoqueMinimo}L`,
    postoId,
    tanqueId,
    severidade: "media",
    link: `/dashboard?posto=${postoId}&tanque=${tanqueId}`,
  };

  return enviarNotificacaoAlerta(alerta);
}

/**
 * Envia notificação para alerta de medição faltante
 */
export async function notificarMedicaoFaltante(
  postoId: number,
  postoNome: string,
  datasFaltantes: string[]
): Promise<boolean> {
  const alerta: AlertNotification = {
    tipo: "medicao_faltante",
    titulo: `🔴 Medição Diária Faltante - ${postoNome}`,
    mensagem: `Medições físicas não registradas para ${postoNome} nas datas: ${datasFaltantes.slice(0, 5).join(", ")}${datasFaltantes.length > 5 ? ` e mais ${datasFaltantes.length - 5}` : ""}`,
    postoId,
    severidade: "alta",
    link: `/medicoes?posto=${postoId}`,
  };

  return enviarNotificacaoAlerta(alerta);
}

/**
 * Envia notificação para alerta de CMV pendente
 */
export async function notificarCMVPendente(
  postoId: number,
  postoNome: string,
  quantidadePendente: number
): Promise<boolean> {
  const alerta: AlertNotification = {
    tipo: "cmv_pendente",
    titulo: `📊 CMV Pendente de Cálculo - ${postoNome}`,
    mensagem: `${quantidadePendente} vendas aguardando cálculo de CMV para ${postoNome}. Clique para recalcular.`,
    postoId,
    severidade: "media",
    link: `/recalcular-cmv?posto=${postoId}`,
  };

  return enviarNotificacaoAlerta(alerta);
}

/**
 * Envia notificação para alerta de lotes insuficientes
 */
export async function notificarLotesInsuficientes(
  postoId: number,
  tanqueId: number,
  postoNome: string,
  tanqueCodigo: string,
  quantidadeVenda: number,
  quantidadeDisponivel: number
): Promise<boolean> {
  const alerta: AlertNotification = {
    tipo: "lotes_insuficientes",
    titulo: `🚨 CRÍTICO: Lotes Insuficientes - ${postoNome}`,
    mensagem: `Tentativa de venda de ${quantidadeVenda}L no tanque ${tanqueCodigo}, mas apenas ${quantidadeDisponivel}L disponível. Ação imediata necessária!`,
    postoId,
    tanqueId,
    severidade: "critica",
    link: `/estoque?posto=${postoId}&tanque=${tanqueId}`,
  };

  return enviarNotificacaoAlerta(alerta);
}

/**
 * Envia notificação para erro crítico na sincronização
 */
export async function notificarErroSincronizacao(
  erro: string,
  tentativas: number
): Promise<boolean> {
  const alerta: AlertNotification = {
    tipo: "cmv_pendente", // Usar tipo genérico
    titulo: `🔴 ERRO CRÍTICO: Falha na Sincronização ACS`,
    mensagem: `A sincronização com o banco ACS falhou após ${tentativas} tentativas. Erro: ${erro}. Verifique a conexão e tente novamente.`,
    severidade: "critica",
    link: `/dashboard`,
  };

  return enviarNotificacaoAlerta(alerta);
}
