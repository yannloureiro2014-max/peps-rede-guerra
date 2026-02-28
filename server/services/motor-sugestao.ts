/**
 * Motor de Sugestão Inteligente
 * 
 * Cruza alertas de coerência complementares (sobra em A + falta em B) para sugerir
 * transferências automáticas. Identifica NFes candidatas e volumes prováveis.
 * 
 * Fluxo:
 * 1. Busca alertas de coerência pendentes (tipo "alerta")
 * 2. Identifica pares complementares: posto com sobra + posto com falta
 * 3. Para cada par, busca NFes provisórias que possam explicar a discrepância
 * 4. Gera sugestão com: NFe candidata, volume provável, direção da transferência
 */

import { eq, and, gte, lte, sql, desc, asc, ne } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  postos,
  tanques,
  produtos,
  lotes,
  medicoes,
  vendas,
  alertas,
  verificacaoCoerencia,
} from "../../drizzle/schema";

export interface SugestaoTransferencia {
  id: string; // ID único da sugestão (para referência)
  confianca: "alta" | "media" | "baixa";
  tipo: "correcao_alocacao" | "transferencia_fisica";
  
  // Posto com sobra (origem da transferência)
  postoSobraId: number;
  postoSobraNome: string;
  tanqueSobraId: number;
  tanqueSobraCodigo: string;
  volumeSobra: number; // Diferença positiva (estoque a mais)
  
  // Posto com falta (destino da transferência)
  postoFaltaId: number;
  postoFaltaNome: string;
  tanqueFaltaId: number;
  tanqueFaltaCodigo: string;
  volumeFalta: number; // Diferença negativa (estoque a menos)
  
  // NFe candidata
  loteOrigemId: number;
  nfeNumero: string;
  nfeFornecedor: string | null;
  nfeVolume: number;
  nfeCustoUnitario: number;
  nfeDataEntrada: string;
  
  // Sugestão
  volumeSugerido: number; // Volume a transferir
  dataReferencia: string; // Data do alerta
  justificativaSugerida: string;
  explicacao: string; // Texto explicativo para o usuário
}

export interface PendenciaEstoque {
  id: number;
  postoId: number;
  postoNome: string;
  tanqueId: number;
  tanqueCodigo: string;
  produtoNome: string | null;
  dataVerificacao: string;
  tipo: "sobra" | "falta" | "sem_medicao";
  diferenca: number; // Positivo = sobra, negativo = falta
  diferencaAbsoluta: number;
  medicaoInicial: number | null;
  vendasDia: number;
  comprasDia: number;
  estoqueProjetado: number | null;
  medicaoDiaSeguinte: number | null;
  sugestoes: SugestaoTransferencia[];
  alertaId?: number;
}

async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return drizzle(process.env.DATABASE_URL);
}

/**
 * Busca pendências de estoque (alertas de coerência não resolvidos)
 * Retorna lista de pendências com sugestões de transferência
 */
export async function buscarPendenciasEstoque(
  dataInicio: string,
  dataFim: string,
  postoId?: number
): Promise<PendenciaEstoque[]> {
  const db = await getDb();

  // Buscar verificações com status "alerta" no período
  const conditions = [
    eq(verificacaoCoerencia.statusCoerencia, "alerta"),
    gte(verificacaoCoerencia.dataVerificacao, new Date(dataInicio + "T00:00:00Z")),
    lte(verificacaoCoerencia.dataVerificacao, new Date(dataFim + "T23:59:59Z")),
  ];
  if (postoId) {
    conditions.push(eq(verificacaoCoerencia.postoId, postoId));
  }

  const verificacoes = await db
    .select({
      id: verificacaoCoerencia.id,
      postoId: verificacaoCoerencia.postoId,
      postoNome: postos.nome,
      tanqueId: verificacaoCoerencia.tanqueId,
      tanqueCodigo: tanques.codigoAcs,
      produtoId: verificacaoCoerencia.produtoId,
      produtoNome: produtos.descricao,
      dataVerificacao: verificacaoCoerencia.dataVerificacao,
      medicaoInicial: verificacaoCoerencia.medicaoInicial,
      vendasDia: verificacaoCoerencia.vendasDia,
      comprasDia: verificacaoCoerencia.comprasDia,
      estoqueProjetado: verificacaoCoerencia.estoqueProjetado,
      medicaoDiaSeguinte: verificacaoCoerencia.medicaoDiaSeguinte,
      diferenca: verificacaoCoerencia.diferenca,
      diferencaAbsoluta: verificacaoCoerencia.diferencaAbsoluta,
    })
    .from(verificacaoCoerencia)
    .innerJoin(postos, eq(verificacaoCoerencia.postoId, postos.id))
    .leftJoin(tanques, eq(verificacaoCoerencia.tanqueId, tanques.id))
    .leftJoin(produtos, eq(verificacaoCoerencia.produtoId, produtos.id))
    .where(and(...conditions))
    .orderBy(asc(verificacaoCoerencia.dataVerificacao), postos.nome);

  // Classificar em sobras e faltas
  const pendencias: PendenciaEstoque[] = verificacoes.map((v) => {
    const dif = parseFloat(String(v.diferenca || "0"));
    return {
      id: v.id,
      postoId: v.postoId,
      postoNome: v.postoNome,
      tanqueId: v.tanqueId,
      tanqueCodigo: v.tanqueCodigo || "",
      produtoNome: v.produtoNome || null,
      dataVerificacao: v.dataVerificacao instanceof Date
        ? v.dataVerificacao.toISOString().split("T")[0]
        : String(v.dataVerificacao),
      tipo: dif > 0 ? "sobra" : "falta",
      diferenca: dif,
      diferencaAbsoluta: Math.abs(dif),
      medicaoInicial: v.medicaoInicial ? parseFloat(String(v.medicaoInicial)) : null,
      vendasDia: parseFloat(String(v.vendasDia || "0")),
      comprasDia: parseFloat(String(v.comprasDia || "0")),
      estoqueProjetado: v.estoqueProjetado ? parseFloat(String(v.estoqueProjetado)) : null,
      medicaoDiaSeguinte: v.medicaoDiaSeguinte ? parseFloat(String(v.medicaoDiaSeguinte)) : null,
      sugestoes: [],
    };
  });

  // Gerar sugestões cruzando sobras com faltas
  await gerarSugestoes(db, pendencias);

  return pendencias;
}

/**
 * Motor de sugestão: cruza sobras com faltas para sugerir transferências
 */
async function gerarSugestoes(
  db: ReturnType<typeof drizzle>,
  pendencias: PendenciaEstoque[]
): Promise<void> {
  const sobras = pendencias.filter((p) => p.tipo === "sobra");
  const faltas = pendencias.filter((p) => p.tipo === "falta");

  if (sobras.length === 0 || faltas.length === 0) return;

  // Para cada sobra, procurar faltas complementares na mesma data ou próximas
  for (const sobra of sobras) {
    // Buscar lotes provisórios ou recentes no posto com sobra que possam ser a NFe errada
    const lotesProvisorisSobra = await db
      .select({
        id: lotes.id,
        postoId: lotes.postoId,
        tanqueId: lotes.tanqueId,
        numeroNf: lotes.numeroNf,
        nomeFornecedor: lotes.nomeFornecedor,
        quantidadeOriginal: lotes.quantidadeOriginal,
        quantidadeDisponivel: lotes.quantidadeDisponivel,
        custoUnitario: lotes.custoUnitario,
        dataEntrada: lotes.dataEntrada,
        statusNfe: lotes.statusNfe,
        produtoId: lotes.produtoId,
      })
      .from(lotes)
      .where(
        and(
          eq(lotes.postoId, sobra.postoId),
          eq(lotes.tanqueId, sobra.tanqueId),
          ne(lotes.status, "cancelado"),
          // Buscar lotes com data próxima ao alerta
          gte(lotes.dataEntrada, new Date(sobra.dataVerificacao + "T00:00:00Z")),
          lte(lotes.dataEntrada, sql`DATE_ADD(${new Date(sobra.dataVerificacao + "T00:00:00Z")}, INTERVAL 3 DAY)`)
        )
      )
      .orderBy(desc(lotes.quantidadeDisponivel));

    // Também buscar lotes provisórios (não confirmados) no posto com sobra
    const lotesProvSobra = await db
      .select({
        id: lotes.id,
        postoId: lotes.postoId,
        tanqueId: lotes.tanqueId,
        numeroNf: lotes.numeroNf,
        nomeFornecedor: lotes.nomeFornecedor,
        quantidadeOriginal: lotes.quantidadeOriginal,
        quantidadeDisponivel: lotes.quantidadeDisponivel,
        custoUnitario: lotes.custoUnitario,
        dataEntrada: lotes.dataEntrada,
        statusNfe: lotes.statusNfe,
        produtoId: lotes.produtoId,
      })
      .from(lotes)
      .where(
        and(
          eq(lotes.postoId, sobra.postoId),
          eq(lotes.statusNfe, "provisoria"),
          ne(lotes.status, "cancelado")
        )
      )
      .orderBy(desc(lotes.quantidadeDisponivel));

    // Combinar lotes candidatos (provisórios primeiro, depois recentes)
    const lotesCandidate = [
      ...lotesProvSobra,
      ...lotesProvisorisSobra.filter(
        (l) => !lotesProvSobra.some((p) => p.id === l.id)
      ),
    ];

    // Para cada falta complementar
    for (const falta of faltas) {
      // Pular se é o mesmo posto
      if (falta.postoId === sobra.postoId) continue;

      // Verificar se as datas são próximas (mesma data ou ±2 dias)
      const dataSobra = new Date(sobra.dataVerificacao);
      const dataFalta = new Date(falta.dataVerificacao);
      const diffDias = Math.abs(dataSobra.getTime() - dataFalta.getTime()) / (1000 * 60 * 60 * 24);
      if (diffDias > 3) continue;

      // Verificar se os volumes são compatíveis (diferença similar)
      const volumeSobra = Math.abs(sobra.diferenca);
      const volumeFalta = Math.abs(falta.diferenca);
      const diferencaVolumes = Math.abs(volumeSobra - volumeFalta);
      const volumeMaior = Math.max(volumeSobra, volumeFalta);
      const percentualDiferenca = volumeMaior > 0 ? (diferencaVolumes / volumeMaior) * 100 : 0;

      // Buscar tanques do posto de falta que aceitem o mesmo produto
      const tanquesDestino = await db
        .select({ id: tanques.id, codigoAcs: tanques.codigoAcs, capacidade: tanques.capacidade, saldoAtual: tanques.saldoAtual })
        .from(tanques)
        .where(
          and(
            eq(tanques.postoId, falta.postoId),
            eq(tanques.ativo, 1)
          )
        );

      const tanqueDestinoInfo = tanquesDestino.find((t) => t.id === falta.tanqueId) || tanquesDestino[0];
      if (!tanqueDestinoInfo) continue;

      // Para cada lote candidato, gerar sugestão
      for (const lote of lotesCandidate) {
        const volumeLote = parseFloat(String(lote.quantidadeDisponivel || "0"));
        if (volumeLote <= 0) continue;

        // Calcular volume sugerido (menor entre: saldo do lote, sobra e falta)
        // Arredondar para múltiplos de 1.000 litros
        const volumeBruto = Math.min(volumeLote, volumeSobra, volumeFalta);
        const volumeSugerido = Math.round(volumeBruto / 1000) * 1000;

        // Calcular confiança
        let confianca: "alta" | "media" | "baixa" = "baixa";
        if (lote.statusNfe === "provisoria" && percentualDiferenca < 20 && diffDias <= 1) {
          confianca = "alta";
        } else if (percentualDiferenca < 30 && diffDias <= 2) {
          confianca = "media";
        }

        const nfeNumero = lote.numeroNf || "S/N";
        const dataEntradaStr = lote.dataEntrada instanceof Date
          ? lote.dataEntrada.toISOString().split("T")[0]
          : String(lote.dataEntrada);

        const sugestao: SugestaoTransferencia = {
          id: `sug-${sobra.id}-${falta.id}-${lote.id}`,
          confianca,
          tipo: "correcao_alocacao",
          postoSobraId: sobra.postoId,
          postoSobraNome: sobra.postoNome,
          tanqueSobraId: sobra.tanqueId,
          tanqueSobraCodigo: sobra.tanqueCodigo,
          volumeSobra: volumeSobra,
          postoFaltaId: falta.postoId,
          postoFaltaNome: falta.postoNome,
          tanqueFaltaId: falta.tanqueId,
          tanqueFaltaCodigo: falta.tanqueCodigo,
          volumeFalta: volumeFalta,
          loteOrigemId: lote.id,
          nfeNumero,
          nfeFornecedor: lote.nomeFornecedor || null,
          nfeVolume: parseFloat(String(lote.quantidadeOriginal || "0")),
          nfeCustoUnitario: parseFloat(String(lote.custoUnitario || "0")),
          nfeDataEntrada: dataEntradaStr,
          volumeSugerido: volumeSugerido > 0 ? volumeSugerido : 1000, // Mínimo de 1.000L
          dataReferencia: sobra.dataVerificacao,
          justificativaSugerida: `Correção de alocação: NFe ${nfeNumero} provavelmente descarregou em ${falta.postoNome} (${falta.tanqueCodigo}), não em ${sobra.postoNome} (${sobra.tanqueCodigo}). Sobra de ${volumeSobra.toFixed(0)}L em ${sobra.postoNome} e falta de ${volumeFalta.toFixed(0)}L em ${falta.postoNome}.`,
          explicacao: buildExplicacao(sobra, falta, lote, volumeSugerido, confianca),
        };

        sobra.sugestoes.push(sugestao);
        // Também adicionar referência na falta
        falta.sugestoes.push(sugestao);
      }
    }
  }
}

function buildExplicacao(
  sobra: PendenciaEstoque,
  falta: PendenciaEstoque,
  lote: any,
  volumeSugerido: number,
  confianca: string
): string {
  const nfeNumero = lote.numeroNf || "S/N";
  const volumeLote = parseFloat(String(lote.quantidadeOriginal || "0"));
  const isProvisoria = lote.statusNfe === "provisoria";

  let texto = `📊 **Análise:**\n`;
  texto += `• ${sobra.postoNome} (${sobra.tanqueCodigo}): sobra de ${Math.abs(sobra.diferenca).toFixed(0)}L no dia ${sobra.dataVerificacao}\n`;
  texto += `• ${falta.postoNome} (${falta.tanqueCodigo}): falta de ${Math.abs(falta.diferenca).toFixed(0)}L no dia ${falta.dataVerificacao}\n\n`;
  
  texto += `📦 **NFe candidata:** ${nfeNumero}`;
  if (isProvisoria) texto += ` (PROVISÓRIA)`;
  texto += `\n`;
  texto += `• Volume: ${volumeLote.toFixed(0)}L | Custo: R$ ${parseFloat(String(lote.custoUnitario || "0")).toFixed(4)}/L\n`;
  texto += `• Fornecedor: ${lote.nomeFornecedor || "N/A"}\n\n`;
  
  texto += `🔄 **Sugestão:** Transferir ${volumeSugerido.toFixed(0)}L de ${sobra.postoNome} → ${falta.postoNome}\n`;
  texto += `• Confiança: ${confianca.toUpperCase()}\n`;
  
  if (confianca === "alta") {
    texto += `• Volumes compatíveis e NFe provisória — alta probabilidade de alocação incorreta`;
  } else if (confianca === "media") {
    texto += `• Volumes parcialmente compatíveis — verificar com dados do ACS`;
  } else {
    texto += `• Sugestão baseada em proximidade de datas — confirmar manualmente`;
  }

  return texto;
}

/**
 * Confirmar uma NFe como corretamente alocada (muda status para CONFIRMADA)
 */
export async function confirmarNfe(loteId: number): Promise<{ sucesso: boolean; mensagem: string }> {
  const db = await getDb();

  // Verificar se o lote existe
  const [lote] = await db.select({ id: lotes.id, statusNfe: lotes.statusNfe }).from(lotes).where(eq(lotes.id, loteId)).limit(1);
  if (!lote) {
    return { sucesso: false, mensagem: `Lote ${loteId} não encontrado.` };
  }
  if (lote.statusNfe === "confirmada") {
    return { sucesso: false, mensagem: `Lote ${loteId} já está confirmado.` };
  }

  await db
    .update(lotes)
    .set({ statusNfe: "confirmada" })
    .where(eq(lotes.id, loteId));

  return {
    sucesso: true,
    mensagem: `Lote ${loteId} confirmado como corretamente alocado.`,
  };
}

/**
 * Busca lotes provisórios (NFes não confirmadas) para um posto
 */
export async function buscarLotesProvisorisPosto(postoId?: number): Promise<any[]> {
  const db = await getDb();

  const conditions = [
    eq(lotes.statusNfe, "provisoria"),
    ne(lotes.status, "cancelado"),
  ];
  if (postoId) {
    conditions.push(eq(lotes.postoId, postoId));
  }

  return db
    .select({
      id: lotes.id,
      postoId: lotes.postoId,
      postoNome: postos.nome,
      tanqueId: lotes.tanqueId,
      tanqueCodigo: tanques.codigoAcs,
      produtoNome: produtos.descricao,
      numeroNf: lotes.numeroNf,
      nomeFornecedor: lotes.nomeFornecedor,
      dataEntrada: lotes.dataEntrada,
      quantidadeOriginal: lotes.quantidadeOriginal,
      quantidadeDisponivel: lotes.quantidadeDisponivel,
      custoUnitario: lotes.custoUnitario,
      statusNfe: lotes.statusNfe,
    })
    .from(lotes)
    .innerJoin(postos, eq(lotes.postoId, postos.id))
    .leftJoin(tanques, eq(lotes.tanqueId, tanques.id))
    .leftJoin(produtos, eq(lotes.produtoId, produtos.id))
    .where(and(...conditions))
    .orderBy(desc(lotes.dataEntrada))
    .limit(200);
}

/**
 * Validação: verificar capacidade do tanque antes de transferência
 * NOTA: Validação desabilitada para permitir alocações/transferências históricas.
 * Se a alocação estiver errada, será detectada nas pendências de coerência física.
 * Saldo atual é sempre de hoje, não da data histórica da transferência.
 */
export async function validarCapacidadeTanque(
  tanqueId: number,
  volumeAdicional: number
): Promise<{ valido: boolean; capacidade: number; saldoAtual: number; espacoLivre: number; mensagem: string }> {
  const db = await getDb();

  const tanque = await db
    .select({
      id: tanques.id,
      capacidade: tanques.capacidade,
      saldoAtual: tanques.saldoAtual,
      codigoAcs: tanques.codigoAcs,
    })
    .from(tanques)
    .where(eq(tanques.id, tanqueId))
    .limit(1);

  if (!tanque[0]) {
    return { valido: false, capacidade: 0, saldoAtual: 0, espacoLivre: 0, mensagem: "Tanque não encontrado" };
  }

  const cap = parseFloat(String(tanque[0].capacidade || "0"));
  const saldo = parseFloat(String(tanque[0].saldoAtual || "0"));
  const espacoLivre = cap - saldo;

  // DESABILITADO: Permitir alocações históricas sem validação de capacidade
  // Inconsistências serão detectadas nas pendências de coerência física
  // if (cap > 0 && volumeAdicional > espacoLivre + 500) { // 500L de tolerância
  //   return {
  //     valido: false,
  //     capacidade: cap,
  //     saldoAtual: saldo,
  //     espacoLivre,
  //     mensagem: `Tanque ${tanque[0].codigoAcs} não tem capacidade suficiente. Capacidade: ${cap.toFixed(0)}L, Saldo: ${saldo.toFixed(0)}L, Espaço livre: ${espacoLivre.toFixed(0)}L, Volume solicitado: ${volumeAdicional.toFixed(0)}L`,
  //   };
  // }

  return {
    valido: true,
    capacidade: cap,
    saldoAtual: saldo,
    espacoLivre,
    mensagem: "OK",
  };
}

/**
 * Validação: verificar se transferência não gera estoque negativo na origem
 */
export async function validarEstoqueNegativo(
  loteId: number,
  volumeTransferido: number
): Promise<{ valido: boolean; saldoAtual: number; mensagem: string }> {
  const db = await getDb();

  const lote = await db
    .select({ quantidadeDisponivel: lotes.quantidadeDisponivel, numeroNf: lotes.numeroNf })
    .from(lotes)
    .where(eq(lotes.id, loteId))
    .limit(1);

  if (!lote[0]) {
    return { valido: false, saldoAtual: 0, mensagem: "Lote não encontrado" };
  }

  const saldo = parseFloat(String(lote[0].quantidadeDisponivel || "0"));
  if (volumeTransferido > saldo + 0.001) {
    return {
      valido: false,
      saldoAtual: saldo,
      mensagem: `Volume solicitado (${volumeTransferido.toFixed(3)}L) excede saldo disponível do lote ${lote[0].numeroNf || loteId} (${saldo.toFixed(3)}L)`,
    };
  }

  return { valido: true, saldoAtual: saldo, mensagem: "OK" };
}
