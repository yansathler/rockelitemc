import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 1. Inicializa o cliente do Supabase focado no Servidor (lê os cookies)
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          response = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // 2. Recupera o usuário atual logado na sessão do servidor
  const { data: { user } } = await supabase.auth.getUser()

  const url = request.nextUrl.clone()

  // 3. Se tentar acessar páginas internas (dashboard, membros...) SEM estar logado -> Chuta pro Login
  if (!user && (url.pathname.startsWith('/dashboard') || url.pathname.startsWith('/membros'))) {
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  // 4. Se já ESTIVER LOGADO e tentar ir para a página de login raiz -> Manda direto pro Dashboard
  if (user && url.pathname === '/') {
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return response
}

// 🔥 Configura o filtro: O middleware só vai rodar nessas rotas específicas (melhora a performance)
export const config = {
  matcher: ['/', '/dashboard/:path*', '/membros/:path*'],
}