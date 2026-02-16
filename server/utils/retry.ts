/**
 * Retry Logic com Exponential Backoff
 * Implementa mecanismo de retry automático com backoff exponencial para operações críticas
 */

export interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 2000,
  maxDelayMs: 30000,
  backoffMultiplier: 2,
};

/**
 * Aguarda um período de tempo
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Calcula o tempo de espera com backoff exponencial
 * Exemplo: 2s, 4s, 8s
 */
function calculateBackoffDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number
): number {
  const delay = initialDelayMs * Math.pow(backoffMultiplier, attempt - 1);
  return Math.min(delay, maxDelayMs);
}

/**
 * Executa uma função com retry automático e exponential backoff
 * @param fn - Função a ser executada
 * @param functionName - Nome da função para logging
 * @param options - Opções de retry
 * @returns Resultado da função
 * @throws Erro após todas as tentativas falharem
 */
export async function executeWithRetry<T>(
  fn: () => Promise<T>,
  functionName: string,
  options?: RetryOptions
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      console.log(`[RETRY] Tentativa ${attempt}/${opts.maxAttempts} de ${functionName}...`);
      const result = await fn();
      if (attempt > 1) {
        console.log(`[RETRY] ${functionName} sucesso na tentativa ${attempt}`);
      }
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (attempt < opts.maxAttempts) {
        const delayMs = calculateBackoffDelay(
          attempt,
          opts.initialDelayMs,
          opts.maxDelayMs,
          opts.backoffMultiplier
        );
        console.error(
          `[RETRY] Erro em ${functionName} (tentativa ${attempt}): ${lastError.message}`
        );
        console.log(
          `[RETRY] Aguardando ${delayMs / 1000}s antes de re-tentar ${functionName}...`
        );
        await sleep(delayMs);
      } else {
        console.error(
          `[RETRY] Falha crítica em ${functionName} após ${opts.maxAttempts} tentativas: ${lastError.message}`
        );
      }
    }
  }

  throw new Error(
    `Falha ao executar ${functionName} após ${opts.maxAttempts} tentativas: ${lastError?.message}`
  );
}

/**
 * Executa múltiplas funções com retry sequencial
 * Útil para sincronização completa com retry em cada etapa
 */
export async function executeSequentialWithRetry<T>(
  functions: Array<{
    fn: () => Promise<T>;
    name: string;
    options?: RetryOptions;
  }>
): Promise<Array<{ name: string; success: boolean; result?: T; error?: string }>> {
  const results = [];

  for (const { fn, name, options } of functions) {
    try {
      const result = await executeWithRetry(fn, name, options);
      results.push({ name, success: true, result });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      results.push({ name, success: false, error: errorMessage });
    }
  }

  return results;
}
