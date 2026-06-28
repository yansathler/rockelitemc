'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const supabase = createClient()

  // Estados padrão de Login
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' })

  // Estados para o fluxo de Primeiro Acesso (Troca de Senha Obrigatória)
  const [telaPrimeiroAcesso, setTelaPrimeiroAcesso] = useState(false)
  const [membroIdFocado, setMembroIdFocado] = useState<string | null>(null)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('')

  // 1. Executa a tentativa de login inteligente usando a função RPC do Postgres
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setMensagem({ tipo: '', texto: '' })

    try {
      const { data, error } = await supabase.rpc('validar_login_membro', {
        p_email: email.trim(),
        p_senha: senha
      })

      if (error) {
        setMensagem({ tipo: 'erro', texto: 'Falha na comunicação com a base do MC.' })
        setCarregando(false)
        return
      }

      // O retorno do RPC vem sempre dentro de um array de objetos [ { login_valido, ... } ]
      const resultado = data && data[0]

      if (!resultado || !resultado.login_valido) {
        setMensagem({ tipo: 'erro', texto: resultado?.mensagem || 'Acesso negado. Credenciais inválidas.' })
        setCarregando(false)
        return
      }

      // Se as credenciais estiverem certas, checa se é o primeiro acesso
      if (resultado.primeiro_acesso) {
        setMembroIdFocado(resultado.membro_id)
        setMensagem({ tipo: 'sucesso', texto: `Fala, ${resultado.nome_completo}! Identificamos o seu primeiro acesso. Altere a sua senha para continuar.` })
        
        // Aguarda 2 segundos para o irmão ler a instrução e muda para a tela de nova senha
        setTimeout(() => {
          setTelaPrimeiroAcesso(true)
          setMensagem({ tipo: '', texto: '' })
          setCarregando(false)
        }, 2000)
        
      } else {
        // Se já mudou a senha anteriormente, entra direto na sede
        setMensagem({ tipo: 'sucesso', texto: `Aprovado! Bem-vindo de volta, ${resultado.nome_completo}. Entrando na sede...` })
        
        // Guarda informações básicas temporárias de sessão no localStorage (ou utilize o seu contexto)
        localStorage.setItem('@rockelite:membro_id', resultado.membro_id)
        localStorage.setItem('@rockelite:cargo', resultado.cargo_diretoria || 'membro')

        setTimeout(() => {
          router.push('/dashboard')
        }, 1500)
      }

    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Ocorreu um erro inesperado na autenticação.' })
      setCarregando(false)
    }
  }

  // 2. Executa a gravação da nova senha definitiva usando o segundo RPC
  const handleDefinirNovaSenha = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setMensagem({ tipo: '', texto: '' })

    if (novaSenha.length < 6) {
      setMensagem({ tipo: 'erro', texto: 'A nova senha precisa ter no mínimo 6 caracteres.' })
      setCarregando(false)
      return
    }

    if (novaSenha !== confirmarNovaSenha) {
      setMensagem({ tipo: 'erro', texto: 'As senhas digitadas não batem. Verifique.' })
      setCarregando(false)
      return
    }

    try {
      const { data, error } = await supabase.rpc('alterar_senha_primeiro_acesso', {
        p_membro_id: membroIdFocado,
        p_nova_senha: novaSenha
      })

      if (error || !data) {
        setMensagem({ tipo: 'erro', texto: 'Erro ao salvar a nova senha. Tente novamente.' })
        setCarregando(false)
        return
      }

      setMensagem({ tipo: 'sucesso', texto: 'Senha alterada com sucesso! Fazendo o seu primeiro login...' })

      // Após salvar, simula a entrada bem-sucedida e manda para o dashboard
      setTimeout(() => {
        localStorage.setItem('@rockelite:membro_id', membroIdFocado || '')
        router.push('/dashboard')
      }, 1500)

    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Erro interno ao tentar atualizar credenciais.' })
      setCarregando(false)
    }
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

        {/* FEEDBACK DE MENSAGENS */}
        {mensagem.texto && (
          <div className={`mb-6 p-4 rounded text-xs font-semibold leading-relaxed border ${
            mensagem.tipo === 'erro' 
              ? 'bg-red-950/40 border-red-900 text-red-400' 
              : 'bg-emerald-950/40 border-emerald-900 text-emerald-400'
          }`}>
            {mensagem.texto}
          </div>
        )}

        {/* FORMULÁRIO 1: TELA DE LOGIN COMUM */}
        {!telaPrimeiroAcesso ? (
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

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded bg-zinc-100 py-3 text-sm font-bold uppercase tracking-wider text-zinc-950 hover:bg-zinc-200 disabled:opacity-50 transition-colors"
            >
              {carregando ? 'Checando no colete...' : 'Entrar na Sede'}
            </button>
          </form>
        ) : (
          /* FORMULÁRIO 2: OBRIGATÓRIO PARA DEFINIÇÃO DE NOVA SENHA (PRIMEIRO ACESSO) */
          <form onSubmit={handleDefinirNovaSenha} className="space-y-6 animate-fadeIn">
            <div className="border-b border-zinc-800 pb-3 mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">🚨 Nova Senha Obrigatória</h2>
              <p className="text-[11px] text-zinc-500 mt-1">Por segurança, substitua a senha padrão 'RockElite@123' por uma chave pessoal.</p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Nova Senha Definitiva
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={novaSenha}
                onChange={(e) => setNovaSenha(e.target.value)}
                placeholder="Mínimo 6 dígitos"
                className="w-full rounded bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                Confirme a Nova Senha
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={confirmarNovaSenha}
                onChange={(e) => setConfirmarNovaSenha(e.target.value)}
                placeholder="Digite exatamente igual"
                className="w-full rounded bg-zinc-950 border border-zinc-800 px-4 py-3 text-sm text-white focus:border-zinc-600 focus:outline-none transition-colors"
              />
            </div>

            <button
              type="submit"
              disabled={carregando}
              className="w-full rounded bg-red-600 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-red-700 disabled:opacity-50 transition-colors"
            >
              {carregando ? 'Gravando nova chave...' : 'Forjar Nova Senha 🦅'}
            </button>
          </form>
        )}

      </div>
    </main>
  )
}