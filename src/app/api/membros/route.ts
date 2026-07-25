import { NextResponse } from 'next/server'
import { supabaseAdmin } from '../../../lib/supabase'

// 1. POST: Criação de novo membro ou Reset de Senha
export async function POST(request: Request) {
  try {
    const body = await request.json()

    // Se for solicitação de reset de senha
    if (body.acao === 'reset-senha') {
      const { idMembro } = body
      if (!idMembro) {
        return NextResponse.json({ error: 'ID do membro não informado.' }, { status: 400 })
      }

      const { error: resetError } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        password: 'RockElite@123',
        user_metadata: { primeiro_acesso: true }
      })

      if (resetError) throw resetError

      return NextResponse.json({ success: true, message: 'Senha resetada para a padrão com sucesso!' })
    }

    // Fluxo Padrão: Criar novo usuário no Auth
    const { cpf, email, senhaProvisoria } = body

    if (!cpf) {
      return NextResponse.json({ error: 'CPF é obrigatório.' }, { status: 400 })
    }

    const cpfLimpo = cpf.replace(/\D/g, '')
    // Usa o e-mail real enviado pelo front ou gera um sintético de fallback
    const emailFinal = email && email.trim() !== '' ? email.trim() : `${cpfLimpo}@rockelite.internal`

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: emailFinal,
      password: senhaProvisoria || 'RockElite@123',
      email_confirm: true,
      user_metadata: { primeiro_acesso: true }
    })

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, user: authUser.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro interno no servidor.' }, { status: 500 })
  }
}

// 2. PATCH: Inativação / Banimento / Reativação
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { idMembro, statusAtivo, justificativa } = body

    if (!idMembro) {
      return NextResponse.json({ error: 'ID do membro é obrigatório.' }, { status: 400 })
    }

    // A. Atualiza o banco de dados
    const { error: dbError } = await supabaseAdmin
      .from('membros')
      .update({ status_ativo: statusAtivo })
      .eq('id', idMembro)

    if (dbError) throw dbError

    // B. Aplica o Banimento / Desbloqueio no Supabase Auth
    if (statusAtivo === false) {
      // Baniu no Auth (Ban de 100 anos para derrubar sessões e impedir login)
      const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        ban_duration: '876000h'
      })
      if (banError) console.error('Aviso: Erro ao banir no Auth:', banError.message)

      // Registra o log de auditoria se houver justificativa
      if (justificativa) {
        await supabaseAdmin.from('logs_inativacao').insert([{ membro_id: idMembro, justificativa }])
      }
    } else {
      // Reativa no Auth (Remove o Ban)
      const { error: unbanError } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        ban_duration: 'none'
      })
      if (unbanError) console.error('Aviso: Erro ao remover ban do Auth:', unbanError.message)
    }

    return NextResponse.json({ success: true, message: `Status alterado para ${statusAtivo ? 'Ativo' : 'Inativo'}` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Erro ao alterar status.' }, { status: 500 })
  }
}