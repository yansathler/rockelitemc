'use client'

import { useState } from 'react'
import { createClient } from '../lib/supabase'

export default function Login() {
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' })

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setMensagem({ tipo: '', texto: '' })

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: senha,
    })

    if (error) {
      setMensagem({ tipo: 'erro', texto: 'Acesso negado. Verifique as credenciais.' })
    } else {
      setMensagem({ tipo: 'sucesso', texto: 'Autenticado! Entrando na sede...' })
      // Aqui depois faremos o redirecionamento para o dashboard
    }
    setCarregando(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 p-4 text-zinc-100">
      <div className="w-full max-w-md rounded-lg border border-zinc-800 bg-zinc-900/50 p-8 backdrop-blur-sm">
        
        {/* Cabeçalho */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-extrabold tracking-wider text-white">
            ROCK ELITE MC
          </h1>
          <p className="mt-2 text-sm text-zinc-400 uppercase tracking-widest">
            High Command System
          </p>
        </div>

        {/* Formulário */}
        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              E-mail do Irmão
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="exemplo@rockelitemc.com"
              className="w-full rounded bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
              Senha de Acesso
            </label>
            <input
              type="password"
              required
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white placeholder-zinc-600 focus:border-zinc-600 focus:outline-none transition-colors"
            />
          </div>

          {/* Mensagens de Feedback */}
          {mensagem.texto && (
            <div className={`p-3 rounded text-xs font-semibold ${
              mensagem.tipo === 'erro' ? 'bg-red-950/40 border border-red-900 text-red-400' : 'bg-emerald-950/40 border border-emerald-900 text-emerald-400'
            }`}>
              {mensagem.texto}
            </div>
          )}

          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded bg-zinc-100 py-3 text-sm font-bold uppercase tracking-wider text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
          >
            {carregando ? 'Checando no colete...' : 'Entrar na Sede'}
          </button>
        </form>

      </div>
    </main>
  )
}