import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

interface MembroLogin {
  id: string
  email: string
  status_ativo: boolean
  nome_completo: string
  cpf: string
}

// 🛡️ Armazenamento simples em memória para Rate Limiting
const rateLimitStore: Record<string, { count: number; lastReset: number }> = {}

function verificarRateLimit(ip: string, limite = 5, janelaMs = 60 * 1000) {
  const agora = Date.now()
  const registro = rateLimitStore[ip] || { count: 0, lastReset: agora }

  if (agora - registro.lastReset > janelaMs) {
    registro.count = 0
    registro.lastReset = agora
  }

  registro.count += 1
  rateLimitStore[ip] = registro

  return registro.count <= limite
}

export async function POST(request: Request) {
  try {
    // 🛡️ 1. RATE LIMITING (Máximo 5 tentativas por minuto por IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const permitido = verificarRateLimit(ip, 5, 60 * 1000)

    if (!permitido) {
      return NextResponse.json(
        { error: 'Muitas tentativas de login. Por favor, aguarde 1 minuto.' },
        { status: 429 }
      )
    }

    const body = await request.json()
    const { cpf, senha } = body

    // Mensagem de erro genérica padronizada para impedir enumeração
    const ERRO_CREDENCIAS_INVALIDAS = 'CPF ou senha incorretos.'

    if (!cpf || !senha) {
      return NextResponse.json(
        { error: ERRO_CREDENCIAS_INVALIDAS },
        { status: 401 }
      )
    }

    // 2. Prepara as duas variações do CPF
    const cpfLimpo = cpf.replace(/\D/g, '')
    const cpfFormatado = cpfLimpo.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')

    // 3. Busca o membro permitindo encontrar o CPF limpo OU formatado
    const { data: membroData, error: membroError } = await supabaseAdmin
      .from('membros' as string)
      .select('id, email, status_ativo, nome_completo, cpf')
      .or(`cpf.eq.${cpfLimpo},cpf.eq.${cpfFormatado}`)
      .maybeSingle()

    const membro = membroData as MembroLogin | null

    // 🛡️ Se o CPF não existir, retorna 401 genérico em vez de "CPF não encontrado"
    if (membroError || !membro) {
      return NextResponse.json(
        { error: ERRO_CREDENCIAS_INVALIDAS },
        { status: 401 }
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
    let authSucesso = false
    let usuarioAutenticado = null

    const { data: authData, error: authError } =
      await supabaseServer.auth.signInWithPassword({
        email: membro.email,
        password: senha,
      })

    if (!authError && authData.user) {
      authSucesso = true
      usuarioAutenticado = authData.user
    } else {
      // Fallback: Se falhar com e-mail real, tenta o e-mail sintético (para membros legados)
      const emailSintetico = `${cpfLimpo}@rockelite.internal`
      const { data: authSintetico, error: errSintetico } =
        await supabaseServer.auth.signInWithPassword({
          email: emailSintetico,
          password: senha,
        })

      if (!errSintetico && authSintetico.user) {
        authSucesso = true
        usuarioAutenticado = authSintetico.user
      }
    }

    // 🛡️ Se a senha estiver errada, retorna 401 genérico
    if (!authSucesso || !usuarioAutenticado) {
      return NextResponse.json(
        { error: ERRO_CREDENCIAS_INVALIDAS },
        { status: 401 }
      )
    }

    // 🛡️ 6. VALIDAÇÃO DO STATUS ATIVO (Feita APÓS confirmar que a senha está certa)
    if (membro.status_ativo === false) {
      return NextResponse.json(
        { error: 'Acesso negado. Sua conta está inativa. Entre em contato com a diretoria.' },
        { status: 403 }
      )
    }

    // 7. Retorna a resposta de sucesso para o frontend
    return NextResponse.json({
      success: true,
      emailSintetico: usuarioAutenticado.email,
      user: {
        id: usuarioAutenticado.id,
        nome: membro.nome_completo,
        email: membro.email,
      },
    })
  } catch (err: unknown) {
    return NextResponse.json(
      { error: 'Erro interno no servidor ao processar autenticação.' },
      { status: 500 }
    )
  }
}