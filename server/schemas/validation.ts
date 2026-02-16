/**
 * Esquemas Zod para Validação Rigorosa
 * Define regras de validação para todas as entradas de dados via tRPC
 */

import { z } from "zod";

// ==================== LOTES ====================
export const CreateLoteSchema = z.object({
  tanqueId: z.number().int().positive("ID do tanque deve ser um número inteiro positivo."),
  postoId: z.number().int().positive("ID do posto é obrigatório."),
  produtoId: z.number().int().positive("ID do produto é obrigatório."),
  numeroNf: z.string().min(1, "Número da NF é obrigatório."),
  serieNf: z.string().length(3, "Série da NF deve ter exatamente 3 caracteres."),
  chaveNfe: z
    .string()
    .length(44, "Chave da NF-e deve ter 44 caracteres.")
    .regex(/^\d+$/, "Chave da NF-e deve conter apenas dígitos."),
  quantidadeOriginal: z
    .number()
    .positive("Quantidade original deve ser um número positivo.")
    .max(100000, "Quantidade máxima permitida é 100.000 L."),
  custoUnitario: z
    .number()
    .positive("Custo unitário deve ser um número positivo.")
    .max(50, "Custo unitário máximo permitido é R$ 50,00."),
  dataEntrada: z.string().datetime("Data de entrada inválida. Formato esperado ISO 8601."),
  origem: z.string().optional(),
  fornecedorId: z.number().int().optional(),
});

export const UpdateLoteSchema = CreateLoteSchema.partial();

// ==================== VENDAS ====================
export const CreateVendaSchema = z.object({
  postoId: z.number().int().positive("ID do posto é obrigatório."),
  tanqueId: z.number().int().positive("ID do tanque é obrigatório."),
  produtoId: z.number().int().positive("ID do produto é obrigatório."),
  dataVenda: z.string().datetime("Data da venda inválida. Formato esperado ISO 8601."),
  quantidade: z
    .number()
    .positive("Quantidade vendida deve ser um número positivo."),
  valorUnitario: z
    .number()
    .positive("Valor unitário deve ser um número positivo."),
  afericao: z.number().int().min(0).max(1).optional(),
});

export const UpdateVendaSchema = CreateVendaSchema.partial();

// ==================== MEDIÇÕES ====================
export const CreateMedicaoSchema = z.object({
  tanqueId: z.number().int().positive("ID do tanque é obrigatório."),
  dataMedicao: z.string().datetime("Data da medição inválida. Formato esperado ISO 8601."),
  volumeAtual: z
    .number()
    .min(0, "Volume atual não pode ser negativo."),
  observacoes: z.string().optional(),
});

export const UpdateMedicaoSchema = CreateMedicaoSchema.partial();

// ==================== ALERTAS ====================
export const CreateAlertaSchema = z.object({
  tipo: z.enum(["estoque_baixo", "medicao_faltante", "cmv_pendente", "lotes_insuficientes"]),
  titulo: z.string().min(1, "Título do alerta é obrigatório."),
  mensagem: z.string().min(1, "Mensagem do alerta é obrigatória."),
  postoId: z.number().int().positive().optional(),
  tanqueId: z.number().int().positive().optional(),
  severidade: z.enum(["baixa", "media", "alta", "critica"]).default("media"),
  link: z.string().url().optional(),
});

// ==================== INICIALIZAÇÃO MENSAL ====================
export const CreateInicializacaoMensalSchema = z.object({
  mesReferencia: z.string().regex(/^\d{4}-\d{2}$/, "Formato esperado: YYYY-MM"),
  postoId: z.number().int().positive("ID do posto é obrigatório."),
  produtoId: z.number().int().positive("ID do produto é obrigatório."),
  lotes: z.array(
    z.object({
      loteId: z.number().int().positive(),
      saldoInicial: z
        .number()
        .min(0, "Saldo inicial não pode ser negativo.")
        .max(100000, "Saldo máximo permitido é 100.000 L."),
    })
  ),
});

// ==================== USUÁRIOS ====================
export const CreateUsuarioSchema = z.object({
  email: z.string().email("Email inválido."),
  nome: z.string().min(1, "Nome é obrigatório."),
  role: z.enum(["user", "admin_geral", "visualizacao"]).default("user"),
  postoId: z.number().int().positive().optional(),
});

export const UpdateUsuarioSchema = CreateUsuarioSchema.partial();

// ==================== POSTOS ====================
export const CreatePostoSchema = z.object({
  codigoAcs: z.string().min(1, "Código ACS é obrigatório."),
  nome: z.string().min(1, "Nome do posto é obrigatório."),
  cnpj: z.string().optional(),
  endereco: z.string().optional(),
  ativo: z.number().int().min(0).max(1).default(1),
});

export const UpdatePostoSchema = CreatePostoSchema.partial();

// ==================== TANQUES ====================
export const CreateTanqueSchema = z.object({
  postoId: z.number().int().positive("ID do posto é obrigatório."),
  produtoId: z.number().int().positive("ID do produto é obrigatório."),
  codigoAcs: z.string().min(1, "Código ACS é obrigatório."),
  capacidade: z
    .number()
    .positive("Capacidade deve ser um número positivo.")
    .max(100000, "Capacidade máxima permitida é 100.000 L."),
  estoqueMinimo: z
    .number()
    .min(0, "Estoque mínimo não pode ser negativo.")
    .max(100000, "Estoque mínimo máximo é 100.000 L."),
});

export const UpdateTanqueSchema = CreateTanqueSchema.partial();

// ==================== FILTROS ====================
export const VendasFiltrosSchema = z.object({
  postoId: z.number().int().positive().optional(),
  produtoId: z.number().int().positive().optional(),
  dataInicio: z.string().datetime().optional(),
  dataFim: z.string().datetime().optional(),
  afericao: z.number().int().min(0).max(1).optional(),
});

export const DREFiltrosSchema = z.object({
  postoId: z.number().int().positive().optional(),
  produtoId: z.number().int().positive().optional(),
  dataInicio: z.string().datetime("Data inválida. Formato esperado ISO 8601."),
  dataFim: z.string().datetime("Data inválida. Formato esperado ISO 8601."),
});

// ==================== TIPOS EXPORTADOS ====================
export type CreateLote = z.infer<typeof CreateLoteSchema>;
export type UpdateLote = z.infer<typeof UpdateLoteSchema>;
export type CreateVenda = z.infer<typeof CreateVendaSchema>;
export type UpdateVenda = z.infer<typeof UpdateVendaSchema>;
export type CreateMedicao = z.infer<typeof CreateMedicaoSchema>;
export type UpdateMedicao = z.infer<typeof UpdateMedicaoSchema>;
export type CreateAlerta = z.infer<typeof CreateAlertaSchema>;
export type CreateInicializacaoMensal = z.infer<typeof CreateInicializacaoMensalSchema>;
export type CreateUsuario = z.infer<typeof CreateUsuarioSchema>;
export type UpdateUsuario = z.infer<typeof UpdateUsuarioSchema>;
export type CreatePosto = z.infer<typeof CreatePostoSchema>;
export type UpdatePosto = z.infer<typeof UpdatePostoSchema>;
export type CreateTanque = z.infer<typeof CreateTanqueSchema>;
export type UpdateTanque = z.infer<typeof UpdateTanqueSchema>;
export type VendasFiltros = z.infer<typeof VendasFiltrosSchema>;
export type DREFiltros = z.infer<typeof DREFiltrosSchema>;
