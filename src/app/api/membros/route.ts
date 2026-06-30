import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// 1. Cria novos usuários colocando a flag de Primeiro Acesso
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cpf, senhaProvisoria } = body

    if (!cpf) return NextResponse.json({ error: 'CPF é obrigatório.' }, { status: 400 })

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
    const emailSintetico = `${cpf.replace(/\D/g, '')}@rockelite.internal`

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email: emailSintetico,
      password: senhaProvisoria,
      email_confirm: true,
      // ⚡ Garante que nasce precisando trocar de senha
      user_metadata: { primeiro_acesso: true } 
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ user: data.user })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// 2. Reseta a senha de um usuário para a padrão e reativa o Primeiro Acesso
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { idMembro } = body

    if (!idMembro) {
      return NextResponse.json({ error: 'ID do membro é obrigatório.' }, { status: 400 })
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    // Força a atualização da senha para a padrão e ativa a flag novamente
    const { data, error } = await supabaseAdmin.auth.admin.updateUserById(idMembro, {
      password: 'RockElite@123',
      user_metadata: { primeiro_acesso: true } // 🔥 Obriga a trocar de novo
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ success: true, message: 'Senha resetada com sucesso!' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}