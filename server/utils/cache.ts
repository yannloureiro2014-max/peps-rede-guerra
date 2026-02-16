/**
 * Cache com Redis para DRE e Dashboard
 * Implementa caching com TTL (Time To Live) e invalidação automática
 */

// Simulação de Redis em memória (em produção, usar ioredis ou node-redis)
// Para usar Redis real, instale: npm install ioredis
// E descomente as linhas abaixo

// import Redis from 'ioredis';
// const redis = new Redis({
//   host: process.env.REDIS_HOST || 'localhost',
//   port: parseInt(process.env.REDIS_PORT || '6379', 10),
// });

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

// Cache em memória (fallback quando Redis não está disponível)
const memoryCache = new Map<string, CacheEntry<any>>();

export interface CacheConfig {
  ttlSeconds?: number;
  namespace?: string;
}

/**
 * Gera chave de cache baseada em filtros
 */
export function gerarChaveCache(
  tipo: string,
  filtros: Record<string, any> = {}
): string {
  const filtrosStr = Object.entries(filtros)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}:${JSON.stringify(v)}`)
    .join("|");

  return `cache:${tipo}:${filtrosStr || "default"}`;
}

/**
 * Armazena valor em cache com TTL
 */
export async function setCache<T>(
  chave: string,
  valor: T,
  ttlSeconds: number = 3600
): Promise<boolean> {
  try {
    const expiresAt = Date.now() + ttlSeconds * 1000;
    memoryCache.set(chave, { data: valor, expiresAt });

    console.log(
      `[CACHE] Armazenado: ${chave} (TTL: ${ttlSeconds}s)`
    );

    // Se Redis estiver disponível, armazenar lá também
    // await redis.setex(chave, ttlSeconds, JSON.stringify(valor));

    return true;
  } catch (error) {
    console.error(`[CACHE] Erro ao armazenar ${chave}:`, error);
    return false;
  }
}

/**
 * Recupera valor do cache
 */
export async function getCache<T>(chave: string): Promise<T | null> {
  try {
    // Tentar recuperar do cache em memória
    const entry = memoryCache.get(chave);
    if (entry) {
      if (entry.expiresAt > Date.now()) {
        console.log(`[CACHE] HIT: ${chave}`);
        return entry.data as T;
      } else {
        // Expirou, remover
        memoryCache.delete(chave);
        console.log(`[CACHE] EXPIRADO: ${chave}`);
      }
    }

    // Se Redis estiver disponível, tentar lá
    // const cached = await redis.get(chave);
    // if (cached) {
    //   console.log(`[CACHE] HIT (Redis): ${chave}`);
    //   return JSON.parse(cached) as T;
    // }

    console.log(`[CACHE] MISS: ${chave}`);
    return null;
  } catch (error) {
    console.error(`[CACHE] Erro ao recuperar ${chave}:`, error);
    return null;
  }
}

/**
 * Remove valor do cache
 */
export async function deleteCache(chave: string): Promise<boolean> {
  try {
    memoryCache.delete(chave);
    // await redis.del(chave);
    console.log(`[CACHE] Deletado: ${chave}`);
    return true;
  } catch (error) {
    console.error(`[CACHE] Erro ao deletar ${chave}:`, error);
    return false;
  }
}

/**
 * Remove múltiplas chaves com padrão (wildcard)
 */
export async function deleteCachePattern(padrao: string): Promise<number> {
  try {
    let deletados = 0;

    // Deletar do cache em memória
    const chavesParaDeletar: string[] = [];
    memoryCache.forEach((_, chave) => {
      if (chave.includes(padrao)) {
        chavesParaDeletar.push(chave);
      }
    });
    
    for (const chave of chavesParaDeletar) {
      memoryCache.delete(chave);
      deletados++;
    }

    // Se Redis estiver disponível
    // const chaves = await redis.keys(`*${padrao}*`);
    // if (chaves.length > 0) {
    //   await redis.del(...chaves);
    //   deletados = chaves.length;
    // }

    console.log(`[CACHE] Deletados ${deletados} itens com padrão: ${padrao}`);
    return deletados;
  } catch (error) {
    console.error(`[CACHE] Erro ao deletar padrão ${padrao}:`, error);
    return 0;
  }
}

/**
 * Limpa todo o cache
 */
export async function limparCache(): Promise<void> {
  try {
    memoryCache.clear();
    // await redis.flushdb();
    console.log(`[CACHE] Cache limpo completamente`);
  } catch (error) {
    console.error(`[CACHE] Erro ao limpar cache:`, error);
  }
}

/**
 * Obtém estatísticas do cache
 */
export function obterEstatisticasCache(): {
  totalChaves: number;
  chavasValidas: number;
  chavasExpiradas: number;
} {
  let chavasValidas = 0;
  let chavasExpiradas = 0;

  memoryCache.forEach((entry) => {
    if (entry.expiresAt > Date.now()) {
      chavasValidas++;
    } else {
      chavasExpiradas++;
    }
  })

  return {
    totalChaves: memoryCache.size,
    chavasValidas,
    chavasExpiradas,
  };
}

/**
 * Wrapper para obter ou calcular valor com cache
 */
export async function obterComCache<T>(
  chave: string,
  funcaoCalculo: () => Promise<T>,
  ttlSeconds: number = 3600
): Promise<T> {
  // Tentar obter do cache
  const cached = await getCache<T>(chave);
  if (cached !== null) {
    return cached;
  }

  // Se não estiver em cache, calcular
  console.log(`[CACHE] Calculando: ${chave}`);
  const resultado = await funcaoCalculo();

  // Armazenar em cache
  await setCache(chave, resultado, ttlSeconds);

  return resultado;
}

// ==================== INVALIDAÇÃO AUTOMÁTICA ====================

/**
 * Invalida cache de DRE quando dados são alterados
 */
export async function invalidarCacheDRE(postoId?: number): Promise<void> {
  const padrao = postoId ? `dre:${postoId}:` : "dre:";
  await deleteCachePattern(padrao);
}

/**
 * Invalida cache de Dashboard quando dados são alterados
 */
export async function invalidarCacheDashboard(postoId?: number): Promise<void> {
  const padrao = postoId ? `dashboard:${postoId}:` : "dashboard:";
  await deleteCachePattern(padrao);
}

/**
 * Invalida cache de vendas
 */
export async function invalidarCacheVendas(postoId?: number): Promise<void> {
  const padrao = postoId ? `vendas:${postoId}:` : "vendas:";
  await deleteCachePattern(padrao);
}

/**
 * Invalida cache de estoque
 */
export async function invalidarCacheEstoque(postoId?: number): Promise<void> {
  const padrao = postoId ? `estoque:${postoId}:` : "estoque:";
  await deleteCachePattern(padrao);
}

/**
 * Invalida cache de lucro bruto
 */
export async function invalidarCacheLucroBruto(postoId?: number): Promise<void> {
  const padrao = postoId ? `lucro:${postoId}:` : "lucro:";
  await deleteCachePattern(padrao);
}

/**
 * Invalida todos os caches quando há alteração crítica
 */
export async function invalidarTodoCache(): Promise<void> {
  await limparCache();
  console.log(`[CACHE] Todo o cache foi invalidado`);
}
