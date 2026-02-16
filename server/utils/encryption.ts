/**
 * Criptografia de Dados Sensíveis
 * Implementa criptografia AES-256 para dados sensíveis no banco de dados
 */

import crypto from "crypto";

// Chave de criptografia (em produção, usar variável de ambiente)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "default-key-change-in-production";
const CIPHER_ALGORITHM = "aes-256-cbc";

/**
 * Gera uma chave de criptografia válida (32 bytes para AES-256)
 */
function obterChaveCriptografia(): Buffer {
  // Criar hash SHA-256 da chave para garantir 32 bytes
  return crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
}

/**
 * Criptografa um valor usando AES-256-CBC
 */
export function criptografar(valor: string | number): string {
  try {
    if (valor === null || valor === undefined) {
      return "";
    }

    const chave = obterChaveCriptografia();
    const iv = crypto.randomBytes(16); // IV aleatório para cada criptografia

    const cipher = crypto.createCipheriv(CIPHER_ALGORITHM, chave, iv);
    let criptografado = cipher.update(String(valor), "utf8", "hex");
    criptografado += cipher.final("hex");

    // Retornar IV + criptografado (IV é necessário para descriptografar)
    return `${iv.toString("hex")}:${criptografado}`;
  } catch (error) {
    console.error("[CRYPTO] Erro ao criptografar:", error);
    throw new Error(`Erro ao criptografar dados: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Descriptografa um valor criptografado
 */
export function descriptografar(valorCriptografado: string): string {
  try {
    if (!valorCriptografado || !valorCriptografado.includes(":")) {
      return "";
    }

    const chave = obterChaveCriptografia();
    const [ivHex, criptografado] = valorCriptografado.split(":");

    const iv = Buffer.from(ivHex, "hex");
    const decipher = crypto.createDecipheriv(CIPHER_ALGORITHM, chave, iv);

    let descriptografado = decipher.update(criptografado, "hex", "utf8");
    descriptografado += decipher.final("utf8");

    return descriptografado;
  } catch (error) {
    console.error("[CRYPTO] Erro ao descriptografar:", error);
    throw new Error(`Erro ao descriptografar dados: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Criptografa múltiplos valores
 */
export function criptografarMultiplos(
  valores: Record<string, string | number>
): Record<string, string> {
  const resultado: Record<string, string> = {};

  for (const [chave, valor] of Object.entries(valores)) {
    try {
      resultado[chave] = criptografar(valor);
    } catch (error) {
      console.error(`[CRYPTO] Erro ao criptografar ${chave}:`, error);
      resultado[chave] = "";
    }
  }

  return resultado;
}

/**
 * Descriptografa múltiplos valores
 */
export function descriptografarMultiplos(
  valores: Record<string, string>
): Record<string, string> {
  const resultado: Record<string, string> = {};

  for (const [chave, valor] of Object.entries(valores)) {
    try {
      resultado[chave] = descriptografar(valor);
    } catch (error) {
      console.error(`[CRYPTO] Erro ao descriptografar ${chave}:`, error);
      resultado[chave] = "";
    }
  }

  return resultado;
}

/**
 * Valida se um valor está criptografado
 */
export function estaCriptografado(valor: string): boolean {
  return typeof valor === "string" && valor.includes(":") && valor.length > 32;
}

/**
 * Hash seguro para senhas (usando bcrypt seria melhor, mas usando crypto aqui)
 */
export function hashSeguro(valor: string): string {
  return crypto
    .createHash("sha256")
    .update(valor + process.env.SALT || "salt")
    .digest("hex");
}

/**
 * Compara hash com valor original
 */
export function compararHash(valor: string, hash: string): boolean {
  return hashSeguro(valor) === hash;
}

// ==================== CAMPOS A CRIPTOGRAFAR ====================

/**
 * Criptografa dados de lote
 */
export function criptografarLote(lote: any): any {
  return {
    ...lote,
    custoUnitario: criptografar(lote.custoUnitario),
    custoTotal: criptografar(lote.custoTotal || 0),
  };
}

/**
 * Descriptografa dados de lote
 */
export function descriptografarLote(lote: any): any {
  return {
    ...lote,
    custoUnitario: parseFloat(descriptografar(lote.custoUnitario)),
    custoTotal: parseFloat(descriptografar(lote.custoTotal || "0")),
  };
}

/**
 * Criptografa dados de venda
 */
export function criptografarVenda(venda: any): any {
  return {
    ...venda,
    valorUnitario: criptografar(venda.valorUnitario),
    valorTotal: criptografar(venda.valorTotal || 0),
    cmvCalculado: criptografar(venda.cmvCalculado || 0),
  };
}

/**
 * Descriptografa dados de venda
 */
export function descriptografarVenda(venda: any): any {
  return {
    ...venda,
    valorUnitario: parseFloat(descriptografar(venda.valorUnitario)),
    valorTotal: parseFloat(descriptografar(venda.valorTotal || "0")),
    cmvCalculado: parseFloat(descriptografar(venda.cmvCalculado || "0")),
  };
}

/**
 * Gera chave de criptografia aleatória para armazenar em .env
 */
export function gerarChaveAleatoria(): string {
  return crypto.randomBytes(32).toString("hex");
}
