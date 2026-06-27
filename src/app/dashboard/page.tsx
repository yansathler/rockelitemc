'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

export default function Dashboard() {
  const [ocultarFinanceiro, setOcultarFinanceiro] = useState(false)
  const [carregando, setCarregando] = useState(true)
  
  // Estados para os dados reais do Supabase
  const [totalMembros, setTotalMembros] = useState(0)
  const [saldoCaixa, setSaldoCaixa] = useState(0)

  // Função para buscar dados do banco
  const buscarDadosDoBanco = async () => {
    setCarregando(true)
    const supabase = createClient()

    try {
      // 1. Busca total de membros ativos
      const { count, error: errMembros } = await supabase
        .from('membros')
        .select('*', { count: 'exact', head: true })
        .eq('status_membro', 'ativo')

      if (!errMembros && count !== null) setTotalMembros(count)

      // 2. Busca o fluxo de caixa para calcular o saldo real
      const { data: lancamentos, error: errCaixa } = await supabase
        .from('fluxo_caixa')
        .select('tp_movimentacao, vl_movimentacao')

      if (!errCaixa && lancamentos) {
        const saldoCalculado = lancamentos.reduce((acc, atual) => {
          if (atual.tp_movimentacao === 'entrada') return acc + Number(atual.vl_movimentacao)
          if (atual.tp_movimentacao === 'saida') return acc - Number(atual.vl_movimentacao)
          return acc
        }, 0)
        setSaldoCaixa(saldoCalculado)
      }

    } catch (error) {
      console.error('Erro ao conectar com o cofre do Supabase:', error)
    } finally {
      setCarregando(false)
    }
  }

  // Roda assim que a tela abre
  useEffect(() => {
    buscarDadosDoBanco()
  }, [])

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* Cabeçalho do Painel */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Painel Administrativo</h1>
          <p className="text-sm text-zinc-400">Visão geral do sistema de Gestão</p>
        </div>
        <div>
          <button 
            onClick={buscarDadosDoBanco}
            disabled={carregando}
            className="flex items-center gap-2 rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            <span>🔄</span> {carregando ? 'Sincronizando...' : 'Atualizar'}
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
            <button className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-zinc-700 transition-colors group">
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