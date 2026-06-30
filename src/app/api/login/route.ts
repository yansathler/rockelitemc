import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { cpf, senha } = body

    if (!cpf || !senha) {
      return NextResponse.json({ error: 'CPF e Senha são obrigatórios.' }, { status: 400 })
    }

    const cpfLimpo = cpf.replace(/\D/g, '')
    const emailSintetico = `${cpfLimpo}@rockelite.internal`

    // Inicializa o cliente com a Service Role para checar as tabelas sem travas de RLS
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // ⚡ 1. PROVA DOS NOVES: Busca o status do irmão diretamente na tabela antes de qualquer login
    const { data: membro, error: erroMembro } = await supabaseAdmin
      .from('membros')
      .select('status_ativo')
      .eq('cpf', cpfLimpo)
      .maybeSingle()

    // Se o perfil existir e constar como INATIVO, barra imediatamente sem dó
    if (membro && !membro.status_ativo) {
      return NextResponse.json({ 
        error: 'Acesso Negado. Este colete foi inativado pela administração do Moto Clube.' 
      }, { status: 403 })
    }

    // Se o membro não foi encontrado na tabela, avisa que as credenciais são inválidas
    if (!membro) {
      return NextResponse.json({ error: 'Acesso negado. CPF não cadastrado.' }, { status: 401 })
    }

    // ⚡ 2. Só agora tentamos logar, pois sabemos que ele está ATIVO na base
    // Como estamos no servidor, usamos um cliente comum do Supabase para fazer o login
    // e retornar os dados do usuário, mas a sessão definitiva será firmada no front.
    // Para simplificar e manter a segurança de cookies do Supabase padrão do Next.js,
    // nós respondemos que ele está "LIBERADO" para logar.
    
    return NextResponse.json({ liberado: true, emailSintetico })

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}