import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase' // Ajuste a quantidade de ../ conforme a pasta exata

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

    // 1. Prepara as duas variações do CPF (Apenas Números vs Formatado com Pontos/Traço)
    const cpfLimpo = cpf.replace(/\D/g, '')
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

    // 2. Busca o membro permitindo encontrar o CPF limpo OU formatado
    const { data: membro, error: membroError } = await supabaseAdmin
      .from('membros')
      .select('id, email, status_ativo, nome_completo, cpf')
      .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
      .maybeSingle()

    if (membroError || !membro) {
      return NextResponse.json(
        { error: 'Acesso negado. CPF não encontrado no cadastro.' },
        { status: 401 }
      )
    }

    // 3. Valida a coluna booleana 'status_ativo' da sua tabela
    if (membro.status_ativo === false) {
      return NextResponse.json(
        { error: 'Acesso negado. Membro com cadastro inativo.' },
        { status: 403 }
      )
    }

    // 4. Configura os Cookies do SSR do Supabase
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
              // Tratamento para escopo de Route Handler
            }
          },
        },
      }
    )

    // 5. Tenta autenticar no Supabase Auth usando o E-mail REAL salvo na tabela
    const { data: authData, error: authError } =
      await supabaseServer.auth.signInWithPassword({
        email: membro.email,
        password: senha,
      })

    let usuarioAutenticado = authData.user

    // Fallback: Se falhar com e-mail real, tenta o e-mail sintético (para membros legados)
    if (authError || !usuarioAutenticado) {
      const emailSintetico = `${cpfLimpo}@rockelite.internal`
      const { data: authSintetico, error: errSintetico } =
        await supabaseServer.auth.signInWithPassword({
          email: emailSintetico,
          password: senha,
        })

      if (errSintetico || !authSintetico.user) {
        return NextResponse.json(
          { error: 'Acesso negado. CPF ou Senha inválidos.' },
          { status: 401 }
        )
      }

      usuarioAutenticado = authSintetico.user
    }

    // 6. Retorna a resposta que o seu page.tsx precisa para prosseguir
    return NextResponse.json({
      success: true,
      emailSintetico: usuarioAutenticado.email, // Devolve o e-mail autenticado com segurança
      user: {
        id: usuarioAutenticado.id,
        nome: membro.nome_completo,
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