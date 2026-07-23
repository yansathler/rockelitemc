import { createBrowserClient } from '@supabase/ssr'

// Cliente Supabase exclusivo para o Navegador / Componentes React
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )