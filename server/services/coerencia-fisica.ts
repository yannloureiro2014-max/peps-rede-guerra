/**
 * Serviço de Verificação de Coerência Física
 * 
 * Calcula o estoque projetado por tanque/dia e compara com a medição real do dia seguinte.
 * Fórmula: Estoque Projetado = Medição Inicial + Compras - Vendas
 * Se |Estoque Projetado - Medição Dia Seguinte| > TOLERANCIA (1.000 L), gera alerta.
 * 
 * Processamento cronológico: dia 1, dia 2, dia 3...
 * Se dia 5 for corrigido, revalida dias 6+
 */

import { eq, and, gte, lte, sql, desc, asc, sum } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  postos,
  tanques,
  produtos,
  medicoes,
  vendas,
  lotes,
  alertas,
  verificacaoCoerencia,
} from "../../drizzle/schema";

// Tolerância padrão: 1.000 litros
const TOLERANCIA_LITROS = 1000;

// Tipo para resultado de verificação de um dia
export interface ResultadoVerificacaoDia {
  postoId: number;
  postoNome: string;
  tanqueId: number;
  tanqueCodigo: string;
  produtoId: number | null;
  produtoNome: string | null;
  dataVerificacao: string; // YYYY-MM-DD
  medicaoInicial: number | null;
  vendasDia: number;
  comprasDia: number;
  estoqueProjetado: number | null;
  medicaoDiaSeguinte: number | null;
  diferenca: number | null;
  diferencaAbsoluta: number | null;
  statusCoerencia: "coerente" | "alerta" | "sem_medicao";
  mensagem: string;
}

// Tipo para resultado completo de verificação
export interface ResultadoVerificacao {
  postoId: number;
  postoNome: string;
  periodo: { dataInicio: string; dataFim: string };
  totalDias: number;
  diasCoerentes: number;
  diasAlerta: number;
  diasSemMedicao: number;
  detalhes: ResultadoVerificacaoDia[];
  alertasGerados: number;
}

// Tipo para medições ausentes
export interface MedicaoAusente {
  postoId: number;
  postoNome: string;
  tanqueId: number;
  tanqueCodigo: string;
  produtoNome: string | null;
  datasAusentes: string[];
}

/**
 * Obtém a conexão com o banco de dados
 */
async function getDb() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");
  return drizzle(process.env.DATABASE_URL);
}

/**
 * Gera array de datas entre dataInicio e dataFim (inclusive)
 */
function gerarRangeDatas(dataInicio: string, dataFim: string): string[] {
  const datas: string[] = [];
  const inicio = new Date(dataInicio + "T00:00:00Z");
  const fim = new Date(dataFim + "T00:00:00Z");
  
  const current = new Date(inicio);
  while (current <= fim) {
    datas.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }
  
  return datas;
}

/**
 * Busca medições de um tanque em um período
 */
async function buscarMedicoesTanque(
  db: ReturnType<typeof drizzle>,
  tanqueId: number,
  dataInicio: string,
  dataFim: string
): Promise<Map<string, number>> {
  const result = await db
    .select({
      dataMedicao: medicoes.dataMedicao,
      volumeMedido: medicoes.volumeMedido,
    })
    .from(medicoes)
    .where(
      and(
        eq(medicoes.tanqueId, tanqueId),
        gte(medicoes.dataMedicao, new Date(dataInicio + "T00:00:00Z")),
        lte(medicoes.dataMedicao, new Date(dataFim + "T23:59:59Z"))
      )
    )
    .orderBy(asc(medicoes.dataMedicao));

  const mapa = new Map<string, number>();
  for (const m of result) {
    if (m.dataMedicao) {
      const dataStr = m.dataMedicao instanceof Date
        ? m.dataMedicao.toISOString().split("T")[0]
        : String(m.dataMedicao);
      mapa.set(dataStr, parseFloat(String(m.volumeMedido || "0")));
    }
  }
  return mapa;
}

/**
 * Busca vendas diárias de um tanque em um período
 */
async function buscarVendasDiariasTanque(
  db: ReturnType<typeof drizzle>,
  tanqueId: number,
  postoId: number,
  produtoId: number | null,
  dataInicio: string,
  dataFim: string
): Promise<Map<string, number>> {
  const conditions = [
    eq(vendas.postoId, postoId),
    eq(vendas.afericao, 0), // Excluir aferições
    gte(vendas.dataVenda, new Date(dataInicio + "T00:00:00Z")),
    lte(vendas.dataVenda, new Date(dataFim + "T23:59:59Z")),
  ];

  // Filtrar por tanqueId se disponível, senão por produtoId
  if (tanqueId) {
    conditions.push(eq(vendas.tanqueId, tanqueId));
  } else if (produtoId) {
    conditions.push(eq(vendas.produtoId, produtoId));
  }

  const result = await db
    .select({
      dataVenda: vendas.dataVenda,
      totalVendido: sum(vendas.quantidade),
    })
    .from(vendas)
    .where(and(...conditions))
    .groupBy(vendas.dataVenda)
    .orderBy(asc(vendas.dataVenda));

  const mapa = new Map<string, number>();
  for (const v of result) {
    if (v.dataVenda) {
      const dataStr = v.dataVenda instanceof Date
        ? v.dataVenda.toISOString().split("T")[0]
        : String(v.dataVenda);
      mapa.set(dataStr, parseFloat(String(v.totalVendido || "0")));
    }
  }
  return mapa;
}

/**
 * Busca compras (lotes) diárias de um tanque em um período
 */
async function buscarComprasDiariasTanque(
  db: ReturnType<typeof drizzle>,
  tanqueId: number,
  postoId: number,
  dataInicio: string,
  dataFim: string
): Promise<Map<string, number>> {
  const result = await db
    .select({
      dataEntrada: lotes.dataEntrada,
      totalComprado: sum(lotes.quantidadeOriginal),
    })
    .from(lotes)
    .where(
      and(
        eq(lotes.tanqueId, tanqueId),
        eq(lotes.postoId, postoId),
        sql`${lotes.status} != 'cancelado'`,
        gte(lotes.dataEntrada, new Date(dataInicio + "T00:00:00Z")),
        lte(lotes.dataEntrada, new Date(dataFim + "T23:59:59Z"))
      )
    )
    .groupBy(lotes.dataEntrada)
    .orderBy(asc(lotes.dataEntrada));

  const mapa = new Map<string, number>();
  for (const c of result) {
    if (c.dataEntrada) {
      const dataStr = c.dataEntrada instanceof Date
        ? c.dataEntrada.toISOString().split("T")[0]
        : String(c.dataEntrada);
      mapa.set(dataStr, parseFloat(String(c.totalComprado || "0")));
    }
  }
  return mapa;
}

/**
 * Verificação de coerência física para um posto específico
 * Processa cronologicamente: dia 1, dia 2, dia 3...
 */
export async function verificarCoerenciaFisicaPosto(
  postoId: number,
  dataInicio: string,
  dataFim: string,
  tolerancia: number = TOLERANCIA_LITROS
): Promise<ResultadoVerificacao> {
  const db = await getDb();

  // Buscar dados do posto
  const postoResult = await db.select().from(postos).where(eq(postos.id, postoId)).limit(1);
  if (!postoResult[0]) throw new Error(`Posto ${postoId} não encontrado`);
  const posto = postoResult[0];

  // Buscar tanques ativos do posto
  const tanquesResult = await db
    .select({
      id: tanques.id,
      codigoAcs: tanques.codigoAcs,
      produtoId: tanques.produtoId,
      produtoNome: produtos.descricao,
    })
    .from(tanques)
    .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
    .where(and(eq(tanques.postoId, postoId), eq(tanques.ativo, 1)));

  // Expandir período para incluir dia seguinte ao dataFim (para comparação)
  const dataFimExpandida = new Date(dataFim + "T00:00:00Z");
  dataFimExpandida.setUTCDate(dataFimExpandida.getUTCDate() + 1);
  const dataFimExpandidaStr = dataFimExpandida.toISOString().split("T")[0];

  // Gerar range de datas do período
  const datas = gerarRangeDatas(dataInicio, dataFim);

  const detalhes: ResultadoVerificacaoDia[] = [];
  let diasCoerentes = 0;
  let diasAlerta = 0;
  let diasSemMedicao = 0;
  let alertasGerados = 0;

  // Processar cada tanque
  for (const tanque of tanquesResult) {
    // Buscar dados do período expandido
    const medicoesMap = await buscarMedicoesTanque(db, tanque.id, dataInicio, dataFimExpandidaStr);
    const vendasMap = await buscarVendasDiariasTanque(db, tanque.id, postoId, tanque.produtoId, dataInicio, dataFim);
    const comprasMap = await buscarComprasDiariasTanque(db, tanque.id, postoId, dataInicio, dataFim);

    // Processar cada dia cronologicamente
    for (const data of datas) {
      const medicaoInicial = medicoesMap.get(data) ?? null;
      const vendasDia = vendasMap.get(data) ?? 0;
      const comprasDia = comprasMap.get(data) ?? 0;

      // Calcular dia seguinte
      const dataSeguinte = new Date(data + "T00:00:00Z");
      dataSeguinte.setUTCDate(dataSeguinte.getUTCDate() + 1);
      const dataSeguinteStr = dataSeguinte.toISOString().split("T")[0];
      const medicaoDiaSeguinte = medicoesMap.get(dataSeguinteStr) ?? null;

      let estoqueProjetado: number | null = null;
      let diferenca: number | null = null;
      let diferencaAbsoluta: number | null = null;
      let statusCoerencia: "coerente" | "alerta" | "sem_medicao" = "sem_medicao";
      let mensagem = "";

      if (medicaoInicial === null) {
        statusCoerencia = "sem_medicao";
        mensagem = `Sem medição para ${tanque.codigoAcs} em ${data}`;
        diasSemMedicao++;
      } else if (medicaoDiaSeguinte === null) {
        // Temos medição do dia mas não do dia seguinte - não podemos validar
        estoqueProjetado = medicaoInicial + comprasDia - vendasDia;
        statusCoerencia = "sem_medicao";
        mensagem = `Sem medição do dia seguinte (${dataSeguinteStr}) para comparar com projeção de ${estoqueProjetado.toFixed(0)} L`;
        diasSemMedicao++;
      } else {
        // Calcular estoque projetado
        estoqueProjetado = medicaoInicial + comprasDia - vendasDia;
        diferenca = estoqueProjetado - medicaoDiaSeguinte;
        diferencaAbsoluta = Math.abs(diferenca);

        if (diferencaAbsoluta > tolerancia) {
          statusCoerencia = "alerta";
          mensagem = `Diferença de ${diferenca.toFixed(0)} L (projetado: ${estoqueProjetado.toFixed(0)}, medido: ${medicaoDiaSeguinte.toFixed(0)})`;
          diasAlerta++;
        } else {
          statusCoerencia = "coerente";
          mensagem = `OK - Diferença de ${diferenca.toFixed(0)} L dentro da tolerância`;
          diasCoerentes++;
        }
      }

      const resultado: ResultadoVerificacaoDia = {
        postoId,
        postoNome: posto.nome,
        tanqueId: tanque.id,
        tanqueCodigo: tanque.codigoAcs,
        produtoId: tanque.produtoId,
        produtoNome: tanque.produtoNome || null,
        dataVerificacao: data,
        medicaoInicial,
        vendasDia,
        comprasDia,
        estoqueProjetado,
        medicaoDiaSeguinte,
        diferenca,
        diferencaAbsoluta,
        statusCoerencia,
        mensagem,
      };

      detalhes.push(resultado);

      // Salvar resultado na tabela de verificação (upsert)
      try {
        await db
          .insert(verificacaoCoerencia)
          .values({
            postoId,
            tanqueId: tanque.id,
            produtoId: tanque.produtoId,
            dataVerificacao: new Date(data + "T00:00:00Z"),
            medicaoInicial: medicaoInicial?.toFixed(3) || null,
            vendasDia: vendasDia.toFixed(3),
            comprasDia: comprasDia.toFixed(3),
            estoqueProjetado: estoqueProjetado?.toFixed(3) || null,
            medicaoDiaSeguinte: medicaoDiaSeguinte?.toFixed(3) || null,
            diferenca: diferenca?.toFixed(3) || null,
            diferencaAbsoluta: diferencaAbsoluta?.toFixed(3) || null,
            statusCoerencia,
          })
          .onDuplicateKeyUpdate({
            set: {
              medicaoInicial: medicaoInicial?.toFixed(3) || null,
              vendasDia: vendasDia.toFixed(3),
              comprasDia: comprasDia.toFixed(3),
              estoqueProjetado: estoqueProjetado?.toFixed(3) || null,
              medicaoDiaSeguinte: medicaoDiaSeguinte?.toFixed(3) || null,
              diferenca: diferenca?.toFixed(3) || null,
              diferencaAbsoluta: diferencaAbsoluta?.toFixed(3) || null,
              statusCoerencia,
            },
          });
      } catch (err) {
        console.warn(`[COERENCIA] Erro ao salvar verificação ${postoId}/${tanque.id}/${data}:`, err);
      }

      // Gerar alerta se necessário
      if (statusCoerencia === "alerta") {
        try {
          // Verificar se já existe alerta para este tanque/data
          const alertaExistente = await db
            .select({ id: alertas.id })
            .from(alertas)
            .where(
              and(
                eq(alertas.tipo, "coerencia_fisica"),
                eq(alertas.postoId, postoId),
                eq(alertas.tanqueId, tanque.id),
                sql`JSON_EXTRACT(${alertas.dados}, '$.dataVerificacao') = ${data}`
              )
            )
            .limit(1);

          if (alertaExistente.length === 0) {
            await db.insert(alertas).values({
              tipo: "coerencia_fisica",
              postoId,
              tanqueId: tanque.id,
              titulo: `Incoerência Física - ${tanque.codigoAcs} (${data})`,
              mensagem: `${posto.nome}: ${mensagem}. Verifique se houve transferência não registrada ou erro de medição.`,
              dados: JSON.stringify({
                dataVerificacao: data,
                tanqueId: tanque.id,
                tanqueCodigo: tanque.codigoAcs,
                medicaoInicial,
                vendasDia,
                comprasDia,
                estoqueProjetado,
                medicaoDiaSeguinte,
                diferenca,
                tolerancia,
              }),
              status: "pendente",
            });
            alertasGerados++;
          }
        } catch (err) {
          console.warn(`[COERENCIA] Erro ao gerar alerta:`, err);
        }
      }
    }
  }

  return {
    postoId,
    postoNome: posto.nome,
    periodo: { dataInicio, dataFim },
    totalDias: detalhes.length,
    diasCoerentes,
    diasAlerta,
    diasSemMedicao,
    detalhes,
    alertasGerados,
  };
}

/**
 * Verificação de coerência física para todos os postos ativos
 */
export async function verificarCoerenciaFisicaTodosPostos(
  dataInicio: string,
  dataFim: string,
  tolerancia: number = TOLERANCIA_LITROS
): Promise<ResultadoVerificacao[]> {
  const db = await getDb();

  const postosAtivos = await db
    .select({ id: postos.id, nome: postos.nome })
    .from(postos)
    .where(eq(postos.ativo, 1))
    .orderBy(postos.nome);

  const resultados: ResultadoVerificacao[] = [];

  for (const posto of postosAtivos) {
    try {
      const resultado = await verificarCoerenciaFisicaPosto(
        posto.id,
        dataInicio,
        dataFim,
        tolerancia
      );
      resultados.push(resultado);
    } catch (err) {
      console.error(`[COERENCIA] Erro ao verificar posto ${posto.nome}:`, err);
    }
  }

  return resultados;
}

/**
 * Detecta medições ausentes por posto e tanque
 */
export async function detectarMedicoesAusentes(
  dataInicio: string,
  dataFim: string
): Promise<MedicaoAusente[]> {
  const db = await getDb();

  // Buscar postos ativos
  const postosAtivos = await db
    .select({ id: postos.id, nome: postos.nome })
    .from(postos)
    .where(eq(postos.ativo, 1));

  // Buscar tanques ativos com produto
  const tanquesAtivos = await db
    .select({
      id: tanques.id,
      postoId: tanques.postoId,
      codigoAcs: tanques.codigoAcs,
      produtoNome: produtos.descricao,
    })
    .from(tanques)
    .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
    .where(eq(tanques.ativo, 1));

  // Gerar todas as datas do período
  const datas = gerarRangeDatas(dataInicio, dataFim);

  // Buscar todas as medições do período
  const medicoesExistentes = await db
    .select({
      tanqueId: medicoes.tanqueId,
      dataMedicao: medicoes.dataMedicao,
    })
    .from(medicoes)
    .where(
      and(
        gte(medicoes.dataMedicao, new Date(dataInicio + "T00:00:00Z")),
        lte(medicoes.dataMedicao, new Date(dataFim + "T23:59:59Z"))
      )
    );

  // Criar set de medições existentes
  const medicoesSet = new Set(
    medicoesExistentes.map((m) => {
      const dataStr = m.dataMedicao instanceof Date
        ? m.dataMedicao.toISOString().split("T")[0]
        : String(m.dataMedicao);
      return `${m.tanqueId}-${dataStr}`;
    })
  );

  const resultado: MedicaoAusente[] = [];

  for (const posto of postosAtivos) {
    const tanquesDoPosto = tanquesAtivos.filter((t) => t.postoId === posto.id);

    for (const tanque of tanquesDoPosto) {
      const datasAusentes: string[] = [];

      for (const data of datas) {
        if (!medicoesSet.has(`${tanque.id}-${data}`)) {
          datasAusentes.push(data);
        }
      }

      if (datasAusentes.length > 0) {
        resultado.push({
          postoId: posto.id,
          postoNome: posto.nome,
          tanqueId: tanque.id,
          tanqueCodigo: tanque.codigoAcs,
          produtoNome: tanque.produtoNome || null,
          datasAusentes: datasAusentes.sort(),
        });
      }
    }
  }

  // Gerar alertas para medições ausentes
  for (const item of resultado) {
    if (item.datasAusentes.length > 0) {
      try {
        // Verificar se já existe alerta recente para este tanque
        const alertaExistente = await db
          .select({ id: alertas.id })
          .from(alertas)
          .where(
            and(
              eq(alertas.tipo, "medicao_ausente"),
              eq(alertas.postoId, item.postoId),
              eq(alertas.tanqueId, item.tanqueId),
              eq(alertas.status, "pendente")
            )
          )
          .limit(1);

        if (alertaExistente.length === 0) {
          await db.insert(alertas).values({
            tipo: "medicao_ausente",
            postoId: item.postoId,
            tanqueId: item.tanqueId,
            titulo: `Medições Ausentes - ${item.tanqueCodigo} (${item.postoNome})`,
            mensagem: `${item.datasAusentes.length} dia(s) sem medição: ${item.datasAusentes.slice(0, 5).join(", ")}${item.datasAusentes.length > 5 ? "..." : ""}`,
            dados: JSON.stringify({
              tanqueId: item.tanqueId,
              tanqueCodigo: item.tanqueCodigo,
              datasAusentes: item.datasAusentes,
              totalDias: item.datasAusentes.length,
            }),
            status: "pendente",
          });
        }
      } catch (err) {
        console.warn(`[COERENCIA] Erro ao gerar alerta de medição ausente:`, err);
      }
    }
  }

  return resultado;
}

/**
 * Busca resultados de verificação salvos no banco
 */
export async function buscarVerificacoesSalvas(
  postoId?: number,
  dataInicio?: string,
  dataFim?: string,
  statusFiltro?: "coerente" | "alerta" | "sem_medicao"
): Promise<any[]> {
  const db = await getDb();

  const conditions = [];
  if (postoId) conditions.push(eq(verificacaoCoerencia.postoId, postoId));
  if (dataInicio) {
    conditions.push(gte(verificacaoCoerencia.dataVerificacao, new Date(dataInicio + "T00:00:00Z")));
  }
  if (dataFim) {
    conditions.push(lte(verificacaoCoerencia.dataVerificacao, new Date(dataFim + "T23:59:59Z")));
  }
  if (statusFiltro) {
    conditions.push(eq(verificacaoCoerencia.statusCoerencia, statusFiltro));
  }

  return db
    .select({
      id: verificacaoCoerencia.id,
      postoId: verificacaoCoerencia.postoId,
      postoNome: postos.nome,
      tanqueId: verificacaoCoerencia.tanqueId,
      tanqueCodigo: tanques.codigoAcs,
      produtoNome: produtos.descricao,
      dataVerificacao: verificacaoCoerencia.dataVerificacao,
      medicaoInicial: verificacaoCoerencia.medicaoInicial,
      vendasDia: verificacaoCoerencia.vendasDia,
      comprasDia: verificacaoCoerencia.comprasDia,
      estoqueProjetado: verificacaoCoerencia.estoqueProjetado,
      medicaoDiaSeguinte: verificacaoCoerencia.medicaoDiaSeguinte,
      diferenca: verificacaoCoerencia.diferenca,
      diferencaAbsoluta: verificacaoCoerencia.diferencaAbsoluta,
      statusCoerencia: verificacaoCoerencia.statusCoerencia,
      updatedAt: verificacaoCoerencia.updatedAt,
    })
    .from(verificacaoCoerencia)
    .innerJoin(postos, eq(verificacaoCoerencia.postoId, postos.id))
    .leftJoin(tanques, eq(verificacaoCoerencia.tanqueId, tanques.id))
    .leftJoin(produtos, eq(tanques.produtoId, produtos.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(asc(verificacaoCoerencia.dataVerificacao), postos.nome, tanques.codigoAcs)
    .limit(5000);
}

/**
 * Resumo de coerência por posto (para dashboard)
 */
export async function resumoCoerenciaPorPosto(
  dataInicio: string,
  dataFim: string
): Promise<Array<{
  postoId: number;
  postoNome: string;
  totalVerificacoes: number;
  coerentes: number;
  alertas: number;
  semMedicao: number;
  percentualCoerencia: number;
}>> {
  const db = await getDb();

  const result = await db
    .select({
      postoId: verificacaoCoerencia.postoId,
      postoNome: postos.nome,
      totalVerificacoes: sql<number>`COUNT(*)`,
      coerentes: sql<number>`SUM(CASE WHEN ${verificacaoCoerencia.statusCoerencia} = 'coerente' THEN 1 ELSE 0 END)`,
      alertas: sql<number>`SUM(CASE WHEN ${verificacaoCoerencia.statusCoerencia} = 'alerta' THEN 1 ELSE 0 END)`,
      semMedicao: sql<number>`SUM(CASE WHEN ${verificacaoCoerencia.statusCoerencia} = 'sem_medicao' THEN 1 ELSE 0 END)`,
    })
    .from(verificacaoCoerencia)
    .innerJoin(postos, eq(verificacaoCoerencia.postoId, postos.id))
    .where(
      and(
        gte(verificacaoCoerencia.dataVerificacao, new Date(dataInicio + "T00:00:00Z")),
        lte(verificacaoCoerencia.dataVerificacao, new Date(dataFim + "T23:59:59Z"))
      )
    )
    .groupBy(verificacaoCoerencia.postoId, postos.nome)
    .orderBy(postos.nome);

  return result.map((r) => ({
    postoId: r.postoId,
    postoNome: r.postoNome,
    totalVerificacoes: r.totalVerificacoes,
    coerentes: r.coerentes || 0,
    alertas: r.alertas || 0,
    semMedicao: r.semMedicao || 0,
    percentualCoerencia:
      r.totalVerificacoes > 0
        ? ((r.coerentes || 0) / r.totalVerificacoes) * 100
        : 0,
  }));
}
