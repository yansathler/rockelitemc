import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // 1. Cria o cliente Supabase Server Side para ler os cookies de sessão
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // 2. Obtém o usuário ativo na sessão
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname

  // Sua tela de login é a raiz '/'
  const isLoginPage = pathname === '/'

  // 3. REGRA 1: Usuário DESLOGADO tentando acessar qualquer página privada
  if (!user && !isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/' // Redireciona para o login na raiz
    return NextResponse.redirect(url)
  }

  // 4. REGRA 2: Usuário LOGADO tentando acessar a raiz '/'
  if (user && isLoginPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard' // Manda direto pro painel
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

// 5. Matcher para interceptar TODAS as rotas e sub-rotas privadas
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}