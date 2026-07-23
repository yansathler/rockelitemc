import { NextResponse } from 'next/server'
// Se a sua pasta 'lib' estiver dentro de 'src/lib':
import { supabaseAdmin } from '../../../lib/supabase'
// 1. CADASTRAR NOVO MEMBRO (Auth + Tabela membros)
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { 
      acao, // Para diferenciar se é cadastro novo ou reset de senha
      cpf, 
      email, 
      nome, 
      cargo, 
      status = 'Ativo', 
      idMembro 
    } = body

    // Sub-ação: RESET DE SENHA
    if (acao === 'reset-senha') {
      if (!idMembro) {
        return NextResponse.json({ error: 'ID do membro é obrigatório.' }, { status: 400 })
      }

      const senhaPadrao = process.env.DEFAULT_RESET_PASSWORD || 'RockElite@123'

      const { data, error } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
        password: senhaPadrao,
        user_metadata: { primeiro_acesso: true } // 🔥 Obriga a trocar no próximo login
      })

      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
      return NextResponse.json({ success: true, message: 'Senha resetada com sucesso!' })
    }

    // Ação Padrão: NOVO CADASTRO DE MEMBRO
    if (!cpf || !email || !nome) {
      return NextResponse.json({ error: 'CPF, E-mail e Nome são obrigatórios.' }, { status: 400 })
    }

    const senhaProvisoria = process.env.DEFAULT_RESET_PASSWORD || 'RockElite@123'
    const cpfLimpo = cpf.replace(/\D/g, '')

    // Passso A: Cria o usuário no Supabase Auth com E-MAIL REAL
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senhaProvisoria,
      email_confirm: true, // Já confirma o e-mail no Auth
      user_metadata: { 
        cpf: cpfLimpo,
        primeiro_acesso: true 
      }
    })

    if (authError) {
      return NextResponse.json({ error: `Erro no Auth: ${authError.message}` }, { status: 400 })
    }

    const userId = authData.user.id

    // Passo B: Insere os dados na tabela 'membros' usand o MESMO ID do Auth
    const { data: membroData, error: membroError } = await supabaseAdmin
      .from('membros')
      .insert([
        {
          id: userId, // 🔗 Garante vínculo 1:1 perfeito
          cpf: cpfLimpo,
          email: email.trim().toLowerCase(),
          nome,
          cargo,
          status,
          created_at: new Date().toISOString()
        }
      ])
      .select()
      .single()

    if (membroError) {
      // Rollback: se falhar na tabela, remove o usuário criado no Auth para não sujar
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: `Erro na tabela de membros: ${membroError.message}` }, { status: 400 })
    }

    return NextResponse.json({ success: true, membro: membroData })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 2. ATUALIZAR DADOS DO MEMBRO (NOME, E-MAIL, CARGO)
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, nome, email, cargo, cpf } = body

    if (!id) return NextResponse.json({ error: 'ID do membro é obrigatório.' }, { status: 400 })

    const emailFormatado = email ? email.trim().toLowerCase() : undefined
    const cpfLimpo = cpf ? cpf.replace(/\D/g, '') : undefined

    // Passo A: Se o e-mail ou CPF mudou, atualiza no Supabase Auth
    if (emailFormatado || cpfLimpo) {
      const updatePayload: any = {}
      if (emailFormatado) updatePayload.email = emailFormatado
      if (cpfLimpo) updatePayload.user_metadata = { cpf: cpfLimpo }

      const { error: authUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
        id,
        updatePayload
      )

      if (authUpdateError) {
        return NextResponse.json({ error: `Erro ao atualizar Auth: ${authUpdateError.message}` }, { status: 400 })
      }
    }

    // Passo B: Atualiza na tabela 'membros'
    const { data: membro, error: dbError } = await supabaseAdmin
      .from('membros')
      .update({
        ...(nome && { nome }),
        ...(emailFormatado && { email: emailFormatado }),
        ...(cargo && { cargo }),
        ...(cpfLimpo && { cpf: cpfLimpo }),
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, membro })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 3. ALTERAR STATUS (INATIVAR / REATIVAR COM BAN NO AUTH)
export async function PATCH(request: Request) {
  try {
    const body = await request.json()
    const { id, status } = body // status: 'Ativo' | 'Inativo'

    if (!id || !status) {
      return NextResponse.json({ error: 'ID e novo status são obrigatórios.' }, { status: 400 })
    }

    // Passo A: Bloqueia ou Libera o login no Supabase Auth
    const isInativo = status.toLowerCase() === 'inativo'
    
    const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(id, {
      ban_duration: isInativo ? 'none' : '0s' // 'none' = Ban permanente, '0s' = Sem ban
    })

    if (authError) {
      return NextResponse.json({ error: `Erro ao alterar ban no Auth: ${authError.message}` }, { status: 400 })
    }

    // Passo B: Atualiza o status na tabela 'membros'
    const { data: membro, error: dbError } = await supabaseAdmin
      .from('membros')
      .update({ 
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single()

    if (dbError) {
      return NextResponse.json({ error: dbError.message }, { status: 400 })
    }

    return NextResponse.json({ 
      success: true, 
      message: `Membro ${status === 'Inativo' ? 'inativado e bloqueado' : 'reativado'} com sucesso!`,
      membro 
    })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}