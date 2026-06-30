'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  
  const [ocultarFinanceiro, setOcultarFinanceiro] = useState(false)
  const [carregando, setCarregando] = useState(true)
  
  // 🔥 Mudamos para null para saber exatamente quando o Next.js terminou de checar o colete
  const [autenticado, setAutenticado] = useState<boolean | null>(null) 
  
  const [totalMembros, setTotalMembros] = useState(0)
  const [saldoCaixa, setSaldoCaixa] = useState(0)

  // 1. Guardião de Rota Blindado
  useEffect(() => {
    const idMembro = localStorage.getItem('@rockelite:membro_id')
    
    if (!idMembro) {
      setAutenticado(false)
      router.replace('/') // 🔥 O 'replace' substitui a rota no histórico, impedindo o "Voltar" do navegador
    } else {
      setAutenticado(true)
      buscarDadosDoBanco()
    }
  }, [router])

  // ⚡ FUNÇÃO DE SINCRONIZAÇÃO ULTRA RÁPIDA E ATUALIZADA
  const buscarDadosDoBanco = async () => {
    setCarregando(true)
    try {
      // Busca a contagem exata e em tempo real apenas dos irmãos com colete ATIVO
      const { count, error: erroMembros } = await supabase
        .from('membros')
        .select('*', { count: 'exact', head: true })
        .eq('status_ativo', true)

      if (!erroMembros && count !== null) {
        setTotalMembros(count)
      }

      // Aproveita e puxa o financeiro (Exemplo de estrutura base, ajuste conforme suas tabelas)
      // const { data: dataFinanceiro } = await supabase.from('caixa').select('saldo').single()
      // if(dataFinanceiro) setSaldoCaixa(dataFinanceiro.saldo)
      
      setSaldoCaixa(0) // Padrão inicial enquanto não implementa o caixa

    } catch (err) {
      console.error('Erro ao sincronizar dados com a sede:', err)
    } finally {
      setCarregando(false)
    }
  }

  // 🚪 FUNÇÃO PARA DESLOGAR COM SEGURANÇA
  const handleSignOut = async () => {
    const confirmar = window.confirm('Deseja realmente sair do sistema High Command?')
    if (!confirmar) return

    try {
      // Destrói a sessão no Supabase Auth (limpa cookies do navegador)
      await supabase.auth.signOut()
      
      // Limpa os dados locais de controle
      localStorage.removeItem('@rockelite:membro_id')
      
      // Chuta de volta para a tela de login limpando o histórico
      router.replace('/')
    } catch (err) {
      console.error('Erro ao deslogar da sede:', err)
    }
  }

  // 🔥 Enquanto estiver checando (null), ou se falhou a autenticação (false), bloqueia o HTML
  if (autenticado !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm font-bold text-zinc-500 uppercase tracking-widest">
        ⚡ Verificando Credenciais...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* Cabeçalho do Painel */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Painel Administrativo</h1>
          <p className="text-sm text-zinc-400">Visão geral do sistema de Gestão</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={buscarDadosDoBanco}
            disabled={carregando}
            className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            <span>🔄</span> {carregando ? 'Sincronizando...' : 'Atualizar'}
          </button>

          {/* 🚪 BOTÃO DE LOGOUT ADICIONADO */}
          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-950/40 uppercase tracking-wider text-xs transition-colors"
            title="Sair do High Command System"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </div>

      {/* Grid de Resumos (Top Cards) */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        
        {/* Card Membros */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Membros</span>
            <div className="rounded bg-blue-950/40 p-2 text-blue-400 text-sm">👥</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {carregando ? '...' : totalMembros}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Irmãos ativos no banco</p>
        </div>

        {/* Card Viagens */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Viagens</span>
            <div className="rounded bg-purple-950/40 p-2 text-purple-400 text-sm">🛣️</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Pendentes de aprovação</p>
        </div>

        {/* Card Mensagens */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Mensagens</span>
            <div className="rounded bg-zinc-800/40 p-2 text-zinc-400 text-sm">💬</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Pendentes na ouvidoria</p>
        </div>

        {/* Card Aniversariantes */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Aniversariantes</span>
            <div className="rounded bg-orange-950/40 p-2 text-orange-400 text-sm">🎂</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">0</p>
          <p className="mt-1 text-xs text-zinc-500">Este mês</p>
        </div>

        {/* Card Financeiro */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Financeiro</span>
            <button 
              onClick={() => setOcultarFinanceiro(!ocultarFinanceiro)} 
              className="rounded bg-emerald-950/40 p-2 text-emerald-400 text-sm hover:bg-emerald-900/30 transition-colors"
            >
              💵 {ocultarFinanceiro ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-400">
            {ocultarFinanceiro ? '••••••' : `R$ ${saldoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Saldo real calculado</p>
        </div>

      </div>

      {/* Seção Inferior: Atividade Recente vs Ações Rápidas */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* Lado Esquerdo: Atividade Recente */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 lg:col-span-7">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-6">
            <span>🕒</span> Atividade Recente
          </h2>
          
          <div className="space-y-4 max-h-[320px] overflow-y-auto pr-2 text-zinc-500 text-sm italic">
            Nenhuma atividade registrada no sistema por enquanto.
          </div>
        </div>

        {/* Lado Direito: Ações Rápidas */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 lg:col-span-5">
          <h2 className="text-lg font-bold text-white mb-1">Ações Rápidas</h2>
          <p className="text-xs text-zinc-500 mb-6">Acesso rápido às principais funcionalidades</p>
          
          <div className="grid gap-4 grid-cols-2">
            <button 
              onClick={() => router.push('/membros')}
              className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-zinc-700 transition-colors group"
            >
              <div className="mb-4 rounded-lg bg-blue-950/40 p-3 text-blue-400 group-hover:scale-105 transition-transform">👥</div>
              <h4 className="text-sm font-bold text-white">Gerenciar Membros</h4>
              <p className="text-xs text-zinc-500 mt-1">Adicionar ou editar</p>
            </button>

            <button className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-zinc-700 transition-colors group">
              <div className="mb-4 rounded-lg bg-purple-950/40 p-3 text-purple-400 group-hover:scale-105 transition-transform">🛣️</div>
              <h4 className="text-sm font-bold text-white">Gerenciar Viagens</h4>
              <p className="text-xs text-zinc-500 mt-1">Ver viagens</p>
            </button>

            <button className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-zinc-700 transition-colors group">
              <div className="mb-4 rounded-lg bg-orange-950/20 p-3 text-orange-400 group-hover:scale-105 transition-transform">💬</div>
              <h4 className="text-sm font-bold text-white">Ouvidoria</h4>
              <p className="text-xs text-zinc-500 mt-1">Ver mensagens</p>
            </button>

            <button className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-zinc-700 transition-colors group">
              <div className="mb-4 rounded-lg bg-emerald-950/40 p-3 text-emerald-400 group-hover:scale-105 transition-transform">📄</div>
              <h4 className="text-sm font-bold text-white">Relatórios</h4>
              <p className="text-xs text-zinc-500 mt-1">Ver relatórios</p>
            </button>
          </div>
        </div>

      </div>

    </main>
  )
}