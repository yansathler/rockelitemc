'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

// Interface para os dados dinâmicos do painel lateral de membros
interface MembroResumo {
  id: string
  nome_completo: string
  telefone_pessoal: string
  data_nascimento: string
  foto_url: string | null
}

// Interface para as movimentações do mês no Dashboard
interface TransacaoResumo {
  id: string
  descricao: string
  categoria: string
  valor: number
  tipo: 'entrada' | 'saida'
  data_movimentacao: string
}

// Interface para as rotas no Dashboard
interface RotaResumo {
  id: string
  numero_cadastro: number
  nome_rota: string
  km_total: number
  tempo_total_geral: string
  tipo_role: string
}

export default function Dashboard() {
  const router = useRouter()
  const supabase = createClient()
  
  const [ocultarFinanceiro, setOcultarFinanceiro] = useState(false)
  const [carregando, setCarregando] = useState(true)
  
  // Controle de autenticação
  const [autenticado, setAutenticado] = useState<boolean | null>(null) 
  
  const [totalMembros, setTotalMembros] = useState(0)
  const [totalAniversariantes, setTotalAniversariantes] = useState(0)
  const [saldoCaixa, setSaldoCaixa] = useState(0)
  const [totalRotas, setTotalRotas] = useState(0)

  // Controle da área dinâmica lateral (caixa, aniversariantes ou rotas)
  const [abaDinamica, setAbaDinamica] = useState<'caixa' | 'aniversariantes' | 'rotas'>('caixa')
  const [listaAniversariantes, setListaAniversariantes] = useState<MembroResumo[]>([])
  const [movimentacoesMes, setMovimentacoesMes] = useState<TransacaoResumo[]>([])
  const [rotasRecentes, setRotasRecentes] = useState<RotaResumo[]>([])

  // Nomes dos meses para exibir dinamicamente no título
  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const mesAtualNome = nomesMeses[new Date().getMonth()]

  // 1. Guardião de Rota Blindado
  useEffect(() => {
    const idMembro = localStorage.getItem('@rockelite:membro_id')
    
    if (!idMembro) {
      setAutenticado(false)
      router.replace('/') 
    } else {
      setAutenticado(true)
      buscarDadosDoBanco()
    }
  }, [router])

  // Função auxiliar para formatar a data nativa AAAA-MM-DD para DD/MM/AAAA
  const formatarDataLegivel = (dataString: string) => {
    if (!dataString) return ''
    const partes = dataString.split('-')
    if (partes.length !== 3) return dataString
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  // ⚡ FUNÇÃO DE SINCRONIZAÇÃO TOTAL DO CONTROLE ADMINISTRATIVO
  const buscarDadosDoBanco = async () => {
    setCarregando(true)
    try {
      // 1. Busca todos os membros ativos para contagem e processamento de aniversário
      const { data: membrosAtivos, error: erroMembros } = await supabase
        .from('membros')
        .select('id, nome_completo, telefone_pessoal, data_nascimento, foto_url')
        .eq('status_ativo', true)

      if (!erroMembros && membrosAtivos) {
        setTotalMembros(membrosAtivos.length)

        const mesAtual = new Date().getMonth() + 1
        
        const aniversariantesFiltrados = membrosAtivos.filter((membro) => {
          if (!membro.data_nascimento) return false
          const mesMembro = parseInt(membro.data_nascimento.split('-')[1], 10)
          return mesMembro === mesAtual
        })

        aniversariantesFiltrados.sort((a, b) => {
          const diaA = parseInt(a.data_nascimento.split('-')[2], 10)
          const diaB = parseInt(b.data_nascimento.split('-')[2], 10)
          return diaA - diaB
        })

        setListaAniversariantes(aniversariantesFiltrados)
        setTotalAniversariantes(aniversariantesFiltrados.length)
      }

      // 2. Busca o histórico de fluxo de caixa para alimentar o saldo absoluto e o extrato mensal
      const { data: movimentacoes, error: erroCaixa } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .order('data_movimentacao', { ascending: false })

      if (!erroCaixa && movimentacoes) {
        let totalEntradas = 0
        let totalSaidas = 0
        const listaFiltradaMes: TransacaoResumo[] = []

        const hoje = new Date()
        const mesAtualJs = hoje.getMonth()
        const anoAtualJs = hoje.getFullYear()

        movimentacoes.forEach(mov => {
          const valorNum = Number(mov.valor)
          const dataMov = mov.data_movimentacao ? new Date(mov.data_movimentacao) : new Date()

          // Cálculo absoluto do saldo geral
          if (mov.tipo === 'entrada') {
            totalEntradas += valorNum
          } else if (mov.tipo === 'saida') {
            totalSaidas += valorNum
          }

          // Filtra atividades exclusivas da competência do mês corrente
          if (dataMov.getMonth() === mesAtualJs && dataMov.getFullYear() === anoAtualJs) {
            listaFiltradaMes.push({
              id: mov.id,
              descricao: mov.descricao,
              categoria: mov.categoria === 'mensalidade' ? 'Mensalidade' : mov.categoria,
              valor: valorNum,
              tipo: mov.tipo,
              data_movimentacao: mov.data_movimentacao ? mov.data_movimentacao.split('T')[0] : hoje.toISOString().split('T')[0]
            })
          }
        })

        setSaldoCaixa(totalEntradas - totalSaidas)
        setMovimentacoesMes(listaFiltradaMes)
      }

      // 3. Busca de Rotas Táticas para Contador e Feed Dinâmico
      const { data: rotas, error: erroRotas } = await supabase
        .from('rotas')
        .select('id, numero_cadastro, nome_rota, km_total, tempo_total_geral, tipo_role')
        .order('created_at', { ascending: false })

      if (!erroRotas && rotas) {
        setTotalRotas(rotas.length)
        setRotasRecentes(rotas.slice(0, 5)) // Últimas 5 para o feed dinâmico
      }

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
      await supabase.auth.signOut()
      localStorage.removeItem('@rockelite:membro_id')
      router.replace('/')
    } catch (err) {
      console.error('Erro ao deslogar da sede:', err)
    }
  }

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

          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded border border-red-900/40 bg-red-950/20 px-4 py-2 text-sm font-bold text-red-400 hover:bg-red-950/40 uppercase tracking-wider text-xs transition-colors"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </div>

      {/* Grid de Resumos (Top Cards) */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-5">
        
        {/* Card Membros */}
        <div 
          onClick={() => setAbaDinamica('aniversariantes')}
          className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-5 cursor-pointer hover:border-blue-900 transition-all"
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Membros</span>
            <div className="rounded bg-blue-950/40 p-2 text-blue-400 text-sm">👥</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {carregando ? '...' : totalMembros}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Irmãos ativos no banco</p>
        </div>

        {/* Card Rotas Táticas (Antigo Viagens) */}
        <div 
          onClick={() => setAbaDinamica('rotas')}
          className={`rounded-xl border p-5 cursor-pointer transition-all ${abaDinamica === 'rotas' ? 'border-purple-900 bg-purple-950/10' : 'border-zinc-900 bg-zinc-900/40 hover:border-purple-800'}`}
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Rotas Mapeadas</span>
            <div className="rounded bg-purple-950/40 p-2 text-purple-400 text-sm">🛣️</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {carregando ? '...' : totalRotas}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Reconhecimentos salvos</p>
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
        <div 
          onClick={() => setAbaDinamica('aniversariantes')}
          className={`rounded-xl border p-5 cursor-pointer transition-all ${abaDinamica === 'aniversariantes' ? 'border-orange-900 bg-orange-950/10' : 'border-zinc-900 bg-zinc-900/40 hover:border-zinc-800'}`}
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Aniversariantes</span>
            <div className="rounded bg-orange-950/40 p-2 text-orange-400 text-sm">🎂</div>
          </div>
          <p className="mt-2 text-3xl font-bold text-white">
            {carregando ? '...' : totalAniversariantes}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Este mês ({mesAtualNome})</p>
        </div>

        {/* Card Financeiro TOTAL INTEGRADO */}
        <div 
          onClick={() => setAbaDinamica('caixa')}
          className={`rounded-xl border p-5 cursor-pointer transition-all ${abaDinamica === 'caixa' ? 'border-emerald-900 bg-emerald-950/10' : 'border-zinc-900 bg-zinc-900/40 hover:border-emerald-900'}`}
        >
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-semibold uppercase tracking-wider">Caixa Geral</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setOcultarFinanceiro(!ocultarFinanceiro); }} 
              className="rounded bg-emerald-950/40 p-2 text-emerald-400 text-sm hover:bg-emerald-900/30 transition-colors"
            >
              💵 {ocultarFinanceiro ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-400">
            {ocultarFinanceiro ? '••••••' : `R$ ${saldoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Saldo real consolidado ↗</p>
        </div>

      </div>

      {/* Seção Inferior: Painel Dinâmico vs Ações Rápidas */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* Lado Esquerdo: Área Dinâmica Multifuncional (Caixa, Aniversariantes ou Rotas) */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 lg:col-span-7 flex flex-col justify-between">
          
          {abaDinamica === 'caixa' && (
            <>
              <div>
                <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-1">
                  <span>🕒</span> Fluxo de Caixa Recente
                </h2>
                <p className="text-xs text-zinc-500 mb-6">Atividades registradas exclusivamente em {mesAtualNome}</p>
                
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-sm text-zinc-500 italic">Sincronizando extrato...</p>
                  ) : movimentacoesMes.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic p-6 text-center">Nenhuma movimentação financeira este mês.</p>
                  ) : (
                    movimentacoesMes.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-900/80 bg-zinc-950/30 p-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded ${t.tipo === 'entrada' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}>
                            {t.tipo === 'entrada' ? '↗' : '↘'}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-200">{t.descricao}</h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{t.categoria} • {formatarDataLegivel(t.data_movimentacao)}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.tipo === 'entrada' ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-900">
                <button 
                  onClick={() => router.push('/financeiro')}
                  className="w-full rounded-lg bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 py-2 text-xs font-bold text-zinc-300 transition-colors uppercase tracking-wider flex items-center justify-center gap-2"
                >
                  📊 Abrir Módulo Financeiro Completo →
                </button>
              </div>
            </>
          )}

          {abaDinamica === 'aniversariantes' && (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🎂</span> Aniversariantes de {mesAtualNome}
                  </h2>
                  <button 
                    onClick={() => setAbaDinamica('caixa')} 
                    className="text-xs font-semibold uppercase text-zinc-500 hover:text-white transition-colors"
                  >
                    Ver Caixa ✕
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mb-6">Irmãos celebrando aniversário na competência atual</p>

                <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-sm text-zinc-500 italic">Buscando na sede...</p>
                  ) : listaAniversariantes.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic text-center p-4 border border-dashed border-zinc-900 rounded-lg">
                      Nenhum irmão faz aniversário este mês. 🛣️
                    </p>
                  ) : (
                    listaAniversariantes.map((membro) => (
                      <div 
                        key={membro.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 hover:border-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {membro.foto_url ? (
                            <img src={membro.foto_url} alt={membro.nome_completo} className="h-10 w-10 rounded-full object-cover border border-zinc-800" />
                          ) : (
                            <div className="h-10 w-10 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-600">MC</div>
                          )}
                          <div>
                            <h4 className="text-sm font-bold text-white">{membro.nome_completo}</h4>
                            <p className="text-xs text-zinc-500">{membro.telefone_pessoal}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-bold text-orange-400 bg-orange-950/30 border border-orange-900/50 px-2.5 py-1 rounded">
                            {formatarDataLegivel(membro.data_nascimento)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div />
            </>
          )}

          {abaDinamica === 'rotas' && (
            <>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🛣️</span> Reconhecimentos de Rotas Recentes
                  </h2>
                  <button 
                    onClick={() => router.push('/rotas/novo')} 
                    className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-[10px] uppercase tracking-wider px-2.5 py-1 rounded transition-colors"
                  >
                    ⚡ Nova Rota
                  </button>
                </div>
                <p className="text-xs text-zinc-500 mb-6">Últimos planejamentos táticos de asfalto cadastrados</p>

                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-sm text-zinc-500 italic">Sincronizando rotas...</p>
                  ) : rotasRecentes.length === 0 ? (
                    <p className="text-sm text-zinc-500 italic text-center p-4 border border-dashed border-zinc-900 rounded-lg">
                      Nenhuma rota tática mapeada até o momento.
                    </p>
                  ) : (
                    rotasRecentes.map((rota) => (
                      <div
                        key={rota.id}
                        onClick={() => router.push(`/rotas/${rota.id}`)}
                        className="flex items-center justify-between p-3 rounded-lg border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-900/40 cursor-pointer transition-all group animate-fade-in"
                      >
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-zinc-600 font-bold">#{String(rota.numero_cadastro).padStart(3, '0')}</span>
                            <h4 className="text-xs font-bold text-zinc-200 group-hover:text-purple-400 transition-colors">{rota.nome_rota}</h4>
                          </div>
                          <div className="flex items-center gap-3 text-[10px] text-zinc-500">
                            <span>🛣️ {Number(rota.km_total).toFixed(1)} km</span>
                            <span>⏱️ {rota.tempo_total_geral}</span>
                          </div>
                        </div>

                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${rota.tipo_role === 'Curto' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900/40' : 'bg-red-950 text-red-400 border border-red-900/40'}`}>
                          {rota.tipo_role}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <div />
            </>
          )}

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

            <button 
              onClick={() => router.push('/financeiro')}
              className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-emerald-700 transition-colors group"
            >
              <div className="mb-4 rounded-lg bg-emerald-950/40 p-3 text-emerald-400 group-hover:scale-105 transition-transform">💵</div>
              <h4 className="text-sm font-bold text-white">Fluxo de Caixa</h4>
              <p className="text-xs text-zinc-500 mt-1">Baixas e mensalidades</p>
            </button>

            <button 
              onClick={() => setAbaDinamica('rotas')}
              className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-purple-700 transition-colors group"
            >
              <div className="mb-4 rounded-lg bg-purple-950/40 p-3 text-purple-400 group-hover:scale-105 transition-transform">🛣️</div>
              <h4 className="text-sm font-bold text-white">Rotas Táticas</h4>
              <p className="text-xs text-zinc-500 mt-1">Ver reconhecimentos</p>
            </button>

            <button className="flex flex-col items-start rounded-xl border border-zinc-900 bg-zinc-900/30 p-5 text-left hover:border-zinc-700 transition-colors group">
              <div className="mb-4 rounded-lg bg-orange-950/20 p-3 text-orange-400 group-hover:scale-105 transition-transform">💬</div>
              <h4 className="text-sm font-bold text-white">Ouvidoria</h4>
              <p className="text-xs text-zinc-500 mt-1">Ver mensagens</p>
            </button>
          </div>
        </div>

      </div>

    </main>
  )
}