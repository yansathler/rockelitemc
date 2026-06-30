'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../lib/supabase'

export default function Login() {
  const router = useRouter()
  const supabase = createClient()

  // Estados padrão de Login (Trocado email por cpf)
  const [cpf, setCpf] = useState('')
  const [senha, setSenha] = useState('')
  const [carregando, setCarregando] = useState(false)
  const [mensagem, setMensagem] = useState({ tipo: '', texto: '' })

  // Estados para o fluxo de Primeiro Acesso
  const [telaPrimeiroAcesso, setTelaPrimeiroAcesso] = useState(false)
  const [novaSenha, setNovaSenha] = useState('')
  const [confirmarNovaSenha, setConfirmarNovaSenha] = useState('')

  // Função para aplicar máscara de CPF (000.000.000-00) dinamicamente
  const formatarCPF = (valor: string) => {
    const apenasNumeros = valor.replace(/\D/g, '')
    return apenasNumeros
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
      .substring(0, 14)
  }

  // 1. Executa o login com pré-validação rigorosa de status no servidor
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setCarregando(true)
    setMensagem({ tipo: '', texto: '' })

    // Remove pontos e traços para obter apenas os números do CPF
    const cpfLimpo = cpf.replace(/\D/g, '')

    if (cpfLimpo.length !== 11) {
      setMensagem({ tipo: 'erro', texto: 'Por favor, digite um CPF válido com 11 dígitos.' })
      setCarregando(false)
      return
    }

    try {
      // 🚨 PASSO 1: Bate na nova API para validar o status do irmão no banco ANTES de abrir sessão
      const respostaPreCheck = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf: cpfLimpo, senha: senha })
      })

      const dadosPreCheck = await respostaPreCheck.json()

      // Se a API retornar erro (ex: Usuário Inativo / Código 403), barra na hora sem criar sessão
      if (!respostaPreCheck.ok || dadosPreCheck.error) {
        setMensagem({ tipo: 'erro', texto: dadosPreCheck.error || 'Erro ao validar acesso.' })
        setCarregando(false)
        return
      }

      // 🚨 PASSO 2: Com o status ATIVO validado pelo servidor, agora sim criamos a sessão com segurança
      const { data, error } = await supabase.auth.signInWithPassword({
        email: dadosPreCheck.emailSintetico,
        password: senha,
      })

      if (error) {
        // Trata erros comuns de credenciais do Supabase
        const textoErro = error.message === 'Invalid login credentials'
          ? 'Acesso negado. CPF ou Senha inválidos.'
          : 'Erro ao conectar com a sede: ' + error.message
          
        setMensagem({ tipo: 'erro', texto: textoErro })
        setCarregando(false)
        return
      }

      const usuario = data?.user

      // Checa se a flag de primeiro_acesso está ativa no user_metadata
      const precisaMudarSenha = usuario?.user_metadata?.primeiro_acesso

      if (precisaMudarSenha) {
        setMensagem({ 
          tipo: 'sucesso', 
          texto: 'Identificamos que este é o seu primeiro acesso! Altere sua senha para continuar.' 
        })
        
        setTimeout(() => {
          setTelaPrimeiroAcesso(true)
          setMensagem({ tipo: '', texto: '' })
          setCarregando(false)
        }, 2000)

      } else {
        setMensagem({ tipo: 'sucesso', texto: 'Autenticado! Entrando na sede...' })
        
        // Salva localmente o ID para compatibilidade com o restante do painel
        if (usuario) {
          localStorage.setItem('@rockelite:membro_id', usuario.id)
        }

        // Com o Middleware ativo, redireciona direto para o dashboard
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh() // Força o Next.js a revalidar o middleware de rotas protegidas
        }, 1200)
      }

    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Erro inesperado ao tentar processar o login.' })
      setCarregando(false)
    }
  }

  // 2. Grava a nova senha definitiva diretamente no Supabase Auth
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
      setMensagem({ tipo: 'erro', texto: 'As senhas digitadas não combinam.' })
      setCarregando(false)
      return
    }

    try {
      // Atualiza a senha do usuário e DESLIGA a flag do primeiro acesso nos metadados
      const { data, error } = await supabase.auth.updateUser({
        password: novaSenha,
        data: { primeiro_acesso: false } // 🔥 Remove a trava permanentemente na tabela auth.users
      })

      if (error) {
        setMensagem({ tipo: 'erro', texto: 'Erro ao atualizar senha no servidor: ' + error.message })
        setCarregando(false)
        return
      }

      setMensagem({ tipo: 'sucesso', texto: 'Senha definitiva forjada com sucesso! Entrando...' })

      // Grava o ID no localStorage para o dashboard carregar os dados do perfil
      if (data?.user) {
        localStorage.setItem('@rockelite:membro_id', data.user.id)
      }

      setTimeout(() => {
        router.push('/dashboard')
        router.refresh()
      }, 1500)

    } catch (err) {
      setMensagem({ tipo: 'erro', texto: 'Erro interno ao atualizar credenciais.' })
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

        {/* FORMULÁRIO 1: TELA DE LOGIN COM CPF */}
        {!telaPrimeiroAcesso ? (
          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-2">
                CPF do Irmão
              </label>
              <input
                type="text"
                required
                value={cpf}
                onChange={(e) => setCpf(formatarCPF(e.target.value))}
                placeholder="000.000.000-00"
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
          <form onSubmit={handleDefinirNovaSenha} className="space-y-6">
            <div className="border-b border-zinc-800 pb-3 mb-2">
              <h2 className="text-sm font-bold uppercase tracking-wider text-red-400">🚨 Nova Senha Obrigatória</h2>
              <p className="text-[11px] text-zinc-500 mt-1">Por segurança, substitua a senha provisória por uma chave pessoal definitiva.</p>
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