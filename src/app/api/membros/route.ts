import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'
import { gerarSenhaProvisoria } from '../../../lib/utils'

// 🛡️ Armazenamento simples em memória para Rate Limiting
const rateLimitStore: Record<string, { count: number; lastReset: number }> = {}

function verificarRateLimit(ip: string, limite = 15, janelaMs = 60 * 1000) {
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

// 1. Cargos permitidos padronizados no formato id/snake_case do banco
const CARGOS_DIRETORIA_PERMITIDOS = [
  'presidente',
  'vice_presidente',
  'diretor_administrativo',
  'secretario',
  'membro' // Adicione se necessário para testes de permissão
]

async function verificarPermissaoAdmin() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {}
      }
    }
  )

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return { autorizado: false, errorResponse: NextResponse.json({ error: 'Acesso não autenticado.' }, { status: 401 }), user: null }
  }

  // Busca o cargo_diretoria usando o ID da sessão autenticada
  const { data: membro, error: dbError } = await supabaseAdmin
    .from('membros')
    .select('cargo_diretoria')
    .eq('id', user.id)
    .single()

  // Converte para minúsculo para evitar divergências de case
  const cargoUsuario = membro?.cargo_diretoria?.toLowerCase()
  const eAdmin = cargoUsuario && CARGOS_DIRETORIA_PERMITIDOS.includes(cargoUsuario)

  if (dbError || !eAdmin) {
    return { 
      autorizado: false, 
      errorResponse: NextResponse.json({ error: 'Acesso negado. Apenas membros da diretoria autorizados.' }, { status: 403 }),
      user 
    }
  }

  return { autorizado: true, user, errorResponse: null }
}

// 1. POST: Criação de novo membro ou Reset de Senha
export async function POST(request: Request) {
  try {
    // 🛡️ RATE LIMITING (Máximo de 15 requisições por minuto por IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    if (!verificarRateLimit(`membros_post_${ip}`, 15, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Muitas requisições enviadas. Aguarde 1 minuto e tente novamente.' },
        { status: 429 }
      )
    }

    const { autorizado, errorResponse } = await verificarPermissaoAdmin()
    if (!autorizado) return errorResponse

    const body = await request.json()

    // --- FLUXO A: RESET DE SENHA ---
    if (body.acao === 'reset-senha') {
      const { idMembro } = body
      if (!idMembro) {
        return NextResponse.json({ error: 'ID do membro não informado.' }, { status: 400 })
      }

      // Gera a senha provisória
      const novaSenhaProvisoria = gerarSenhaProvisoria()

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        password: novaSenhaProvisoria,
        user_metadata: { primeiro_acesso: true }
      })

      if (resetError) throw resetError

      // Retorna tanto 'novaSenha' quanto 'senhaProvisoria' para garantir compatibilidade
      return NextResponse.json({ 
        success: true, 
        message: 'Senha resetada com sucesso!',
        novaSenha: novaSenhaProvisoria,
        senhaProvisoria: novaSenhaProvisoria 
      })
    }

    // --- FLUXO B: CRIAR NOVO USUÁRIO ---
    const { cpf, email, senhaProvisoria, nome_completo, cargo_diretoria } = body

    if (!cpf) {
      return NextResponse.json({ error: 'CPF é obrigatório.' }, { status: 400 })
    }

    const cpfLimpo = cpf.replace(/\D/g, '')
    const emailFinal = email && email.trim() !== '' ? email.trim() : `${cpfLimpo}@rockelite.internal`

    const senhaFinal = senhaProvisoria || process.env.DEFAULT_MEMBER_PASSWORD || gerarSenhaProvisoria()

    // 1. Cria a conta de autenticação
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailFinal,
      password: senhaFinal,
      email_confirm: true,
      user_metadata: { primeiro_acesso: true }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    // 2. Insere os dados do membro na tabela pública
    const { error: dbError } = await supabaseAdmin.from('membros').insert([
      {
        id: authUser.user.id, // Amarra o ID da tabela 'membros' ao ID de 'auth.users'
        cpf: cpfLimpo,
        email: emailFinal,
        nome_completo: nome_completo || 'Novo Membro',
        cargo_diretoria: cargo_diretoria || 'membro',
        status_ativo: true,
      },
    ])

    // 🛡️ COMPENSAÇÃO (ROLLBACK): Se falhar no banco, deleta o usuário criado no Auth para evitar conta órfã
    if (dbError) {
      await supabaseAdmin.auth.admin.deleteUser(authUser.user.id)
      return NextResponse.json(
        { error: 'Erro ao cadastrar dados na tabela de membros: ' + dbError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ 
      success: true, 
      user: authUser.user,
      senhaProvisoria: senhaFinal 
    })
  } catch (err: unknown) {
    const mensagemErro = err instanceof Error ? err.message : 'Erro interno no servidor.'
    return NextResponse.json({ error: mensagemErro }, { status: 500 })
  }
}

// 2. PATCH: Inativação / Banimento / Reativação
export async function PATCH(request: Request) {
  try {
    // 🛡️ RATE LIMITING (Máximo de 15 requisições por minuto por IP)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    if (!verificarRateLimit(`membros_patch_${ip}`, 15, 60 * 1000)) {
      return NextResponse.json(
        { error: 'Muitas requisições enviadas. Aguarde 1 minuto e tente novamente.' },
        { status: 429 }
      )
    }

    const { autorizado, errorResponse, user } = await verificarPermissaoAdmin()
    if (!autorizado) return errorResponse

    const body = await request.json()
    const { idMembro, statusAtivo, justificativa } = body

    if (!idMembro) {
      return NextResponse.json({ error: 'ID do membro é obrigatório.' }, { status: 400 })
    }

    if (idMembro === user?.id && statusAtivo === false) {
      return NextResponse.json({ error: 'Você não pode inativar sua própria conta.' }, { status: 400 })
    }

    const { error: dbError } = await supabaseAdmin
      .from('membros')
      .update({ status_ativo: statusAtivo })
      .eq('id', idMembro)

    if (dbError) throw dbError

    if (statusAtivo === false) {
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        ban_duration: '876000h'
      })
      if (banError) console.error('Aviso: Erro ao banir no Auth:', banError.message)

      if (justificativa) {
        await supabaseAdmin.from('logs_inativacao').insert([{ membro_id: idMembro, justificativa }])
      }
    } else {
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        ban_duration: 'none'
      })
      if (unbanError) console.error('Aviso: Erro ao remover ban do Auth:', unbanError.message)
    }

    return NextResponse.json({ success: true, message: `Status alterado para ${statusAtivo ? 'Ativo' : 'Inativo'}` })
  } catch (err: unknown) {
    const mensagemErro = err instanceof Error ? err.message : 'Erro ao alterar status.'
    return NextResponse.json({ error: mensagemErro }, { status: 500 })
  }
}