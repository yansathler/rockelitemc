/* eslint-disable @typescript-eslint/no-explicit-any */
import { createBrowserClient } from '@supabase/ssr'
import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

// Cliente padrão para o navegador
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

// Cliente Admin via Função (só roda quando chamado no servidor)
export const getSupabaseAdmin = (): SupabaseClient<any, 'public', any> => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceKey) {
    throw new Error('Supabase URL ou Service Role Key não configuradas no .env.local')
  }

  return createSupabaseClient<any, 'public', any>(url, serviceKey)
}

// Mantém retrocompatibilidade via Proxy seguro (instanciado dinamicamente no servidor)
export const supabaseAdmin: SupabaseClient<any, 'public', any> = new Proxy({} as SupabaseClient<any, 'public', any>, {
  get(_target, prop: string) {
    const admin = getSupabaseAdmin()
    const targetProp = (admin as unknown as Record<string, unknown>)[prop]
    return typeof targetProp === 'function' ? targetProp.bind(admin) : targetProp
  }
})