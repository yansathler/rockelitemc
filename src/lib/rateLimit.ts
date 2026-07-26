// lib/rateLimit.ts

interface RateLimitStore {
    [key: string]: { count: number; lastReset: number }
  }
  
  const store: RateLimitStore = {}
  
  /**
   * Limita requisições por IP/Chave
   * @param key Identificador único (ex: IP ou IP + rota)
   * @param limit Número máximo de tentativas
   * @param windowMs Janela de tempo em milissegundos
   */
  export function checkRateLimit(key: string, limit = 5, windowMs = 60 * 1000): { success: boolean; remaining: number } {
    const now = Date.now()
    const record = store[key] || { count: 0, lastReset: now }
  
    // Reset do contador se a janela expirou
    if (now - record.lastReset > windowMs) {
      record.count = 0
      record.lastReset = now
    }
  
    record.count += 1
    store[key] = record
  
    if (record.count > limit) {
      return { success: false, remaining: 0 }
    }
  
    return { success: true, remaining: limit - record.count }
  }