import { createBrowserClient } from '@supabase/ssr'

// Inicializa o cliente do Supabase para ser usado nas telas do app
export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )