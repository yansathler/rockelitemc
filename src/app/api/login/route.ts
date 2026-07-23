import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase' // Ajuste o caminho do import conforme a sua estrutura

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cpf, senha } = body

    if (!cpf || !senha) {
      return NextResponse.json(
        { error: 'CPF e Senha são obrigatórios.' },
        { status: 400 }
      )
    }

    const cpfLimpo = cpf.replace(/\D/g, '')

    // 1. Busca o e-mail real e o status do irmão pelo CPF no banco de dados
    const { data: membro, error: membroError } = await supabaseAdmin
      .from('membros')
      .select('id, email, status, nome')
      .eq('cpf', cpfLimpo)
      .maybeSingle()

    if (membroError || !membro) {
      return NextResponse.json(
        { error: 'CPF ou senha inválidos.' },
        { status: 401 }
      )
    }

    // 2. Valida se o membro está ativo
    if (membro.status && membro.status.toLowerCase() !== 'ativo') {
      return NextResponse.json(
        { error: 'Acesso negado. Membro com cadastro inativo.' },
        { status: 403 }
      )
    }

    // 3. Prepara os cookies do Next.js para o Supabase SSR
    const cookieStore = await cookies()
    const supabaseServer = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch {
              // O método setAll pode falhar se chamado dentro de um Server Component puro,
              // mas dentro de uma Rota de API (Route Handler) ele funciona perfeitamente.
            }
          },
        },
      }
    )

    // 4. Autentica no Supabase Auth usando o E-mail Real
    const { data: authData, error: authError } =
      await supabaseServer.auth.signInWithPassword({
        email: membro.email,
        password: senha,
      })

    if (authError) {
      return NextResponse.json(
        { error: 'CPF ou senha inválidos.' },
        { status: 401 }
      )
    }

    // 5. Verifica se é Primeiro Acesso
    const isPrimeiroAcesso =
      authData.user?.user_metadata?.primeiro_acesso === true

    return NextResponse.json({
      success: true,
      primeiroAcesso: isPrimeiroAcesso,
      user: {
        id: authData.user.id,
        nome: membro.nome,
        email: membro.email,
      },
    })
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Erro interno no servidor.' },
      { status: 500 }
    )
  }
}