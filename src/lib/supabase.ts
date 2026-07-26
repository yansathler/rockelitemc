/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente padrão para o navegador (Client Components).
 * Usa a chave anônima pública (sujeito às regras de RLS).
 */
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

// Cache do cliente Admin para evitar reinstanciação contínua (Singleton)
let adminInstance: SupabaseClient<any, 'public', any> | null = null

/**
 * Retorna o cliente Admin (bypass de RLS).
 * STRICTLY SERVER-SIDE: Dispara erro se chamado no browser.
 */
export const getSupabaseAdmin = (): SupabaseClient<any, 'public', any> => {
  // Trava de segurança contra vazamento no Client-side
  if (typeof window !== 'undefined') {
    throw new Error('ERRO CRÍTICO DE SEGURANÇA: getSupabaseAdmin() não pode ser executado no navegador!')
  }

  if (adminInstance) return adminInstance

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error('Supabase URL ou SUPABASE_SERVICE_ROLE_KEY não configuradas no .env')
  }

  adminInstance = createSupabaseClient<any, 'public', any>(url, serviceRoleKey, {
    auth: {
      persistSession: false, // Impede o cliente admin de armazenar/sobrescrever sessões em cookies
      autoRefreshToken: false,
    },
  })

  return adminInstance
}

/**
 * Proxy de conveniência mantido para retrocompatibilidade, 
 * protegendo contra execução fora do ambiente de servidor.
 */
export const supabaseAdmin: SupabaseClient<any, 'public', any> = new Proxy({} as SupabaseClient<any, 'public', any>, {
  get(_target, prop: string) {
    const admin = getSupabaseAdmin()
    const targetProp = (admin as unknown as Record<string, unknown>)[prop]
    return typeof targetProp === 'function' ? targetProp.bind(admin) : targetProp
  }
})