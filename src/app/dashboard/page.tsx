'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

// Interface para as sedes vindas do banco (seletor global)
interface Sede {
  id: string
  nome: string
  cidade: string
  estado: string
  tipo: string
}

// Interface para a nova listagem de Chapters mapeados
interface ChapterResumo {
  id: string
  nome: string
  cidade: string
  estado: string
  tipo_chapter: string
  status_operacional: string
}

interface MembroResumo {
  id: string
  nome_completo: string
  telefone_pessoal: string
  data_nascimento: string
  foto_url: string | null
}

interface TransacaoResumo {
  id: string
  descricao: string
  categoria: string
  valor: number
  tipo: 'entrada' | 'saida'
  data_movimentacao: string
}

interface RotaResumo {
  id: string
  numero_cadastro: number
  nome_rota: string
  km_total: number
  tempo_total_geral: string
  tipo_role: string
}

export default function CentralDeComandos() {
  const router = useRouter()
  const supabase = createClient()
  
  const [ocultarFinanceiro, setOcultarFinanceiro] = useState(false)
  const [carregando, setCarregando] = useState(true)
  
  const [autenticado, setAutenticado] = useState<boolean | null>(null) 
  
  const [sedes, setSedes] = useState<Sede[]>([])
  const [sedeAtivaId, setSedeAtivaId] = useState<string>('')

  // Métricas do Painel
  const [totalMembros, setTotalMembros] = useState(0)
  const [totalAniversariantes, setTotalAniversariantes] = useState(0)
  const [saldoCaixa, setSaldoCaixa] = useState(0)
  const [totalRotas, setTotalRotas] = useState(0)
  const [totalChapters, setTotalChapters] = useState(0) // 🏁 Nova Métrica

  // Controle da área dinâmica lateral
  const [abaDinamica, setAbaDinamica] = useState<'membros' | 'caixa' | 'aniversariantes' | 'rotas' | 'chapters'>('caixa')
  const [listaMembros, setListaMembros] = useState<MembroResumo[]>([])
  const [listaAniversariantes, setListaAniversariantes] = useState<MembroResumo[]>([])
  const [movimentacoesMes, setMovimentacoesMes] = useState<TransacaoResumo[]>([])
  const [rotasRecentes, setRotasRecentes] = useState<RotaResumo[]>([])
  const [listaChapters, setListaChapters] = useState<ChapterResumo[]>([]) // 🏁 Nova Lista

  const nomesMeses = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ]
  const mesAtualNome = nomesMeses[new Date().getMonth()]

  useEffect(() => {
    const idMembro = localStorage.getItem('@rockelite:membro_id')
    
    if (!idMembro) {
      setAutenticado(false)
      router.replace('/') 
    } else {
      setAutenticado(true)
      carregarSedesEBanco()
    }
  }, [router])

  useEffect(() => {
    if (autenticado && sedeAtivaId) {
      buscarDadosDoBanco(sedeAtivaId)
    }
  }, [sedeAtivaId, autenticado])

  const formatarDataLegivel = (dataString: string) => {
    if (!dataString) return ''
    const partes = dataString.split('-')
    if (partes.length !== 3) return dataString
    return `${partes[2]}/${partes[1]}/${partes[0]}`
  }

  const carregarSedesEBanco = async () => {
    try {
      const { data: dataSedes, error: errSedes } = await supabase
        .from('sedes')
        .select('*')
        .order('tipo', { ascending: true })

      if (!errSedes && dataSedes && dataSedes.length > 0) {
        setSedes(dataSedes)
        setSedeAtivaId(dataSedes[0].id)
      } else {
        buscarDadosDoBanco()
      }
    } catch (err) {
      console.error('Erro ao carregar mapeamento de sedes:', err)
      buscarDadosDoBanco()
    }
  }

  const buscarDadosDoBanco = async (idSede?: string) => {
    setCarregando(true)
    try {
      // 1. Busca todos os membros ativos
      const { data: membrosAtivos, error: erroMembros } = await supabase
        .from('membros')
        .select('id, nome_completo, telefone_pessoal, data_nascimento, foto_url')
        .eq('status_ativo', true)
        .order('nome_completo', { ascending: true })

      if (!erroMembros && membrosAtivos) {
        setTotalMembros(membrosAtivos.length)
        setListaMembros(membrosAtivos)

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

      // 2. Busca o histórico de fluxo de caixa
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

          if (mov.tipo === 'entrada') {
            totalEntradas += valorNum
          } else if (mov.tipo === 'saida') {
            totalSaidas += valorNum
          }

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

      // 3. Busca de Rotas Táticas
      const { data: rotas, error: erroRotas } = await supabase
        .from('rotas')
        .select('id, numero_cadastro, nome_rota, km_total, tempo_total_geral, tipo_role')
        .order('created_at', { ascending: false })

      if (!erroRotas && rotas) {
        setTotalRotas(rotas.length)
        setRotasRecentes(rotas.slice(0, 5))
      }

      // 🏁 4. Sincronização do Novo Ecossistema de Chapters
      const { data: chapters, error: erroChapters } = await supabase
        .from('chapters')
        .select('id, nome, cidade, estado, tipo_chapter, status_operacional')
        .order('nome', { ascending: true })

      if (!erroChapters && chapters) {
        setListaChapters(chapters)
        // Filtra apenas os que estão operando ativos no asfalto para a métrica superior
        const ativos = chapters.filter(c => c.status_operacional === 'Ativo')
        setTotalChapters(ativos.length)
      }

    } catch (err) {
      console.error('Erro ao sincronizar dados com a sede:', err)
    } finally {
      setCarregando(false)
    }
  }

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
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 space-y-8">
      
      {/* 🟢 BLOCO 1: CABEÇALHO TÁTICO & SELETOR MULTI-SEDE GLOBAL */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        
        <div className="flex items-center gap-4">
          <img 
            src="/logo_remc.png" 
            alt="Brasão REMC" 
            className="h-24 w-auto object-contain drop-shadow-[0_0_12px_rgba(255,255,255,0.12)]" 
          />
          <div>
            <h1 className="text-3xl font-black tracking-tight text-white uppercase font-mono">Central de Comandos</h1>
            <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Painel de Monitoramento Estratégico REMC • 2026</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {sedes.length > 0 && (
            <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-lg">
              <span className="text-xs text-zinc-500 font-bold uppercase font-mono">Sede Ativa:</span>
              <select 
                value={sedeAtivaId} 
                onChange={(e) => setSedeAtivaId(e.target.value)}
                className="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-2"
              >
                {sedes.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900 text-zinc-100 font-sans">
                    {s.nome} ({s.estado})
                  </option>
                ))}
              </select>
            </div>
          )}

          <button 
            onClick={() => buscarDadosDoBanco(sedeAtivaId)}
            disabled={carregando}
            className="flex items-center gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-300 hover:bg-zinc-800 disabled:opacity-50 transition-colors"
          >
            <span>🔄</span> {carregando ? 'Sincronizando...' : 'Sincronizar'}
          </button>

          <button 
            onClick={handleSignOut}
            className="flex items-center gap-2 rounded-lg border border-red-900/40 bg-red-950/20 px-4 py-2 text-xs font-bold text-red-400 hover:bg-red-950/40 uppercase tracking-wider transition-colors"
          >
            <span>🚪</span> Sair
          </button>
        </div>
      </div>

      {/* 📊 Grid de Resumos (Expandido para 6 colunas no desktop) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-6">
        
        {/* Card Membros */}
        <div 
          onClick={() => setAbaDinamica('membros')}
          className={`rounded-xl border p-4 cursor-pointer transition-all group ${abaDinamica === 'membros' ? 'border-blue-900 bg-blue-950/10' : 'border-zinc-900 bg-zinc-900/30 hover:border-blue-900/50'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Membros Comando</span>
            <div className="rounded bg-blue-950/40 p-1.5 text-blue-400 text-xs group-hover:scale-105 transition-transform">👥</div>
          </div>
          <p className="mt-2 text-2xl font-black text-white font-mono">
            {carregando ? '...' : totalMembros}
          </p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Irmãos ativos na base geral</p>
        </div>

        {/* 🏁 NOVO CARD: CHAPTERS ATIVAS */}
        <div 
          onClick={() => setAbaDinamica('chapters')}
          className={`rounded-xl border p-4 cursor-pointer transition-all group ${abaDinamica === 'chapters' ? 'border-cyan-900 bg-cyan-950/10' : 'border-zinc-900 bg-zinc-900/30 hover:border-cyan-900/50'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Chapters Ativas</span>
            <div className="rounded bg-cyan-950/40 p-1.5 text-cyan-400 text-xs group-hover:scale-105 transition-transform">🏁</div>
          </div>
          <p className="mt-2 text-2xl font-black text-white font-mono">
            {carregando ? '...' : totalChapters}
          </p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Frentes ativas mapeadas</p>
        </div>

        {/* Card Rotas Táticas */}
        <div 
          onClick={() => setAbaDinamica('rotas')}
          className={`rounded-xl border p-4 cursor-pointer transition-all group ${abaDinamica === 'rotas' ? 'border-purple-900 bg-purple-950/10' : 'border-zinc-900 bg-zinc-900/30 hover:border-purple-800/50'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Planos de Estrada</span>
            <div className="rounded bg-purple-950/40 p-1.5 text-purple-400 text-xs group-hover:scale-105 transition-transform">🛣️</div>
          </div>
          <p className="mt-2 text-2xl font-black text-white font-mono">
            {carregando ? '...' : totalRotas}
          </p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Reconhecimentos salvos</p>
        </div>

        {/* Slot: Alerta de Eventos do Mês */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 p-4 group cursor-not-allowed">
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Eventos do Mês</span>
            <div className="rounded bg-orange-950/30 p-1.5 text-orange-400 text-xs">📅</div>
          </div>
          <p className="mt-2 text-2xl font-black text-white font-mono">0</p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Agenda activa na sede</p>
        </div>

        {/* Card Aniversariantes */}
        <div 
          onClick={() => setAbaDinamica('aniversariantes')}
          className={`rounded-xl border p-4 cursor-pointer transition-all group ${abaDinamica === 'aniversariantes' ? 'border-amber-900 bg-amber-950/10' : 'border-zinc-900 bg-zinc-900/30 hover:border-zinc-800'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Aniversariantes</span>
            <div className="rounded bg-amber-950/40 p-1.5 text-amber-400 text-xs group-hover:scale-105 transition-transform">🎂</div>
          </div>
          <p className="mt-2 text-2xl font-black text-white font-mono">
            {carregando ? '...' : totalAniversariantes}
          </p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Mês de {mesAtualNome}</p>
        </div>

        {/* Card Financeiro TOTAL INTEGRADO */}
        <div 
          onClick={() => setAbaDinamica('caixa')}
          className={`rounded-xl border p-4 cursor-pointer transition-all group ${abaDinamica === 'caixa' ? 'border-emerald-900 bg-emerald-950/10' : 'border-zinc-900 bg-zinc-900/30 hover:border-emerald-900/50'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Caixa Sede</span>
            <button 
              onClick={(e) => { e.stopPropagation(); setOcultarFinanceiro(!ocultarFinanceiro); }} 
              className="rounded bg-emerald-950/40 p-1 text-emerald-400 text-[10px] hover:bg-emerald-900/30 transition-colors"
            >
              {ocultarFinanceiro ? '🙈' : '👁️'}
            </button>
          </div>
          <p className="mt-2 text-xl font-black text-emerald-400 font-mono">
            {ocultarFinanceiro ? '••••••' : `R$ ${saldoCaixa.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
          </p>
          <p className="mt-2 text-[9px] text-zinc-500 uppercase">Saldo real consolidado ↗</p>
        </div>

      </div>

      {/* 🟡 BLOCO 2: MIOLO OPERACIONAL */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* COLUNA DA ESQUERDA (Quadro Dinâmico Adaptado) */}
        <div className="lg:col-span-7">
          
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 min-h-[380px] flex flex-col justify-between">
            
            {/* 🏁 NOVA ABA DINÂMICA: TERRITÓRIOS E CHAPTERS REMC */}
            {abaDinamica === 'chapters' && (
              <div>
                <div className="mb-1 flex items-center justify-between border-l-2 border-cyan-500 pl-3">
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    🏁 Alistamento de Territórios (Chapters)
                  </h2>
                  <button 
                    onClick={() => setAbaDinamica('caixa')} 
                    className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors"
                  >
                    Fechar ✕
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Frentes operacionais e de expansão mapeadas</p>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-xs text-zinc-500 italic uppercase">Rastreando praças...</p>
                  ) : listaChapters.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic text-center p-4 border border-dashed border-zinc-900 rounded-lg uppercase">
                      Nenhuma filial ou chapter registrado no sistema.
                    </p>
                  ) : (
                    listaChapters.map((chap) => (
                      <div 
                        key={chap.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 hover:border-zinc-800 transition-colors"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-white flex items-center gap-2">
                            {chap.nome}
                            <span className={`text-[8px] font-black uppercase px-1.5 py-0.2 rounded border ${chap.status_operacional === 'Ativo' ? 'bg-emerald-950/60 border-emerald-900 text-emerald-400' : 'bg-zinc-900 border-zinc-800 text-zinc-500'}`}>
                              {chap.status_operacional}
                            </span>
                          </h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">📍 {chap.cidade} / {chap.estado}</p>
                        </div>

                        <div className="text-right">
                          <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded font-mono ${chap.tipo_chapter === 'Chapter' ? 'bg-cyan-950 text-cyan-400 border border-cyan-900/40' : 'bg-zinc-900 text-zinc-400'}`}>
                            {chap.tipo_chapter}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ABA: ALISTAMENTO GERAL DE MEMBROS ACTIVOS */}
            {abaDinamica === 'membros' && (
              <div>
                <div className="mb-1 flex items-center justify-between border-l-2 border-blue-500 pl-3">
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    👥 Alistamento Geral de Membros
                  </h2>
                  <button 
                    onClick={() => setAbaDinamica('caixa')} 
                    className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors"
                  >
                    Fechar ✕
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Efetivo militar ativo e mapeado no motoclube</p>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-xs text-zinc-500 italic uppercase">Carregando alistamento...</p>
                  ) : listaMembros.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic text-center p-4 border border-dashed border-zinc-900 rounded-lg uppercase">
                      Nenhum irmão ativo encontrado na base.
                    </p>
                  ) : (
                    listaMembros.map((membro) => (
                      <div 
                        key={membro.id}
                        className="flex items-center justify-between rounded-lg border border-zinc-900 bg-zinc-950/40 p-3 hover:border-zinc-800 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          {membro.foto_url ? (
                            <img src={membro.foto_url} alt={membro.nome_completo} className="h-9 w-9 rounded-full object-cover border border-zinc-800" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-600">REMC</div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-white">{membro.nome_completo}</h4>
                            <p className="text-[10px] text-zinc-500">{membro.telefone_pessoal || 'Sem Telefone'}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] text-zinc-500 uppercase font-mono tracking-wider">
                            Nasc: {membro.data_nascimento ? formatarDataLegivel(membro.data_nascimento).substring(0, 5) : '••/••'}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ABA: FLUXO DE CAIXA */}
            {abaDinamica === 'caixa' && (
              <div>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider border-l-2 border-emerald-500 pl-3 flex items-center justify-between mb-1">
                  <span>🕒 Extrato de Caixa da Competência</span>
                </h2>
                <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Atividades registradas exclusivamente em {mesAtualNome}</p>
                
                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-xs text-zinc-500 italic uppercase">Sincronizando extrato...</p>
                  ) : movimentacoesMes.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic p-6 text-center border border-dashed border-zinc-900 rounded-lg uppercase">Nenhuma movimentação financeira este mês.</p>
                  ) : (
                    movimentacoesMes.map((t) => (
                      <div key={t.id} className="flex items-center justify-between rounded-lg border border-zinc-900/80 bg-zinc-950/30 p-3">
                        <div className="flex items-center gap-3">
                          <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${t.tipo === 'entrada' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'}`}>
                            {t.tipo === 'entrada' ? 'IN' : 'OUT'}
                          </span>
                          <div>
                            <h4 className="text-xs font-bold text-zinc-200">{t.descricao}</h4>
                            <p className="text-[10px] text-zinc-500 mt-0.5">{t.categoria} • {formatarDataLegivel(t.data_movimentacao)}</p>
                          </div>
                        </div>
                        <span className={`text-xs font-bold font-mono ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.tipo === 'entrada' ? '+' : '-'} R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ABA: ANIVERSARIANTES */}
            {abaDinamica === 'aniversariantes' && (
              <div>
                <div className="mb-1 flex items-center justify-between border-l-2 border-amber-500 pl-3">
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    🎂 Ciclo de Aniversariantes
                  </h2>
                  <button 
                    onClick={() => setAbaDinamica('caixa')} 
                    className="text-[10px] font-black uppercase text-zinc-500 hover:text-white transition-colors"
                  >
                    Fechar ✕
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Irmãos celebrando aniversário na competência atual</p>

                <div className="space-y-3 max-h-[280px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-xs text-zinc-500 italic uppercase">Buscando na sede...</p>
                  ) : listaAniversariantes.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic text-center p-4 border border-dashed border-zinc-900 rounded-lg uppercase">
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
                            <img src={membro.foto_url} alt={membro.nome_completo} className="h-9 w-9 rounded-full object-cover border border-zinc-800" />
                          ) : (
                            <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-600">REMC</div>
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-white">{membro.nome_completo}</h4>
                            <p className="text-[10px] text-zinc-500">{membro.telefone_pessoal}</p>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-[10px] font-black text-amber-400 bg-amber-950/30 border border-amber-900/40 px-2 py-0.5 rounded font-mono">
                            {formatarDataLegivel(membro.data_nascimento)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* ABA: ROTAS */}
            {abaDinamica === 'rotas' && (
              <div>
                <div className="mb-1 flex items-center justify-between border-l-2 border-purple-500 pl-3">
                  <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                    🛣️ Reconhecimentos de Rotas Recentes
                  </h2>
                  <button 
                    onClick={() => router.push('/rotas/novo')} 
                    className="bg-purple-950/60 border border-purple-800 hover:bg-purple-900 text-purple-400 font-bold text-[9px] uppercase tracking-wider px-2 py-0.5 rounded transition-colors"
                  >
                    ⚡ Nova Rota
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Últimos reconhecimentos táticos de asfalto cadastrados</p>

                <div className="space-y-2 max-h-[280px] overflow-y-auto pr-2">
                  {carregando ? (
                    <p className="text-xs text-zinc-500 italic uppercase">Sincronizando rotas...</p>
                  ) : rotasRecentes.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic text-center p-4 border border-dashed border-zinc-900 rounded-lg uppercase">
                      Nenhuma rota tática mapeada até o momento.
                    </p>
                  ) : (
                    rotasRecentes.map((rota) => (
                      <div
                        key={rota.id}
                        onClick={() => router.push(`/rotas/${rota.id}`)}
                        className="flex items-center justify-between p-3 rounded-lg border border-zinc-900 bg-zinc-950/40 hover:bg-zinc-900/40 cursor-pointer transition-all group"
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
            )}
          </div>

        </div>

        {/* 📋 COLUNA DA DIREITA (Quadro de Cadastros Operacionais Compactado) */}
        <div className="lg:col-span-5">
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 h-full flex flex-col justify-between">
            <div>
              <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-1 border-l-2 border-zinc-700 pl-3">Quadro de Cadastros Rápidos</h2>
              <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Inclusão de novos registros e dados no ecossistema</p>
              
              {/* Grid de comandos redimensionado e otimizado */}
              <div className="grid gap-2.5 grid-cols-2">
                <button 
                  onClick={() => router.push('/membros/novo')}
                  className="flex flex-col items-start rounded-lg border border-zinc-900 bg-zinc-900/30 p-2.5 text-left hover:border-blue-700 transition-colors group"
                >
                  <div className="mb-2 rounded-md bg-blue-950/40 p-1.5 text-blue-400 group-hover:scale-105 transition-transform text-[11px]">➕👥</div>
                  <h4 className="text-[11px] font-bold text-white">Novo Membro</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Admitir irmão na base</p>
                </button>

                <button 
                  onClick={() => router.push('/financeiro')}
                  className="flex flex-col items-start rounded-lg border border-zinc-900 bg-zinc-900/30 p-2.5 text-left hover:border-emerald-700 transition-colors group"
                >
                  <div className="mb-2 rounded-md bg-emerald-950/40 p-1.5 text-emerald-400 group-hover:scale-105 transition-transform text-[11px]">➕💵</div>
                  <h4 className="text-[11px] font-bold text-white">Lançar Caixa</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Mensalidades e fluxo</p>
                </button>

                <button 
                  onClick={() => router.push('/rotas/novo')}
                  className="flex flex-col items-start rounded-lg border border-zinc-900 bg-zinc-900/30 p-2.5 text-left hover:border-purple-700 transition-colors group"
                >
                  <div className="mb-2 rounded-md bg-purple-950/40 p-1.5 text-purple-400 group-hover:scale-105 transition-transform text-[11px]">➕🛣️</div>
                  <h4 className="text-[11px] font-bold text-white">Lançar Rota</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Mapear novo asfalto</p>
                </button>

                {/* 🏁 GATILHO ADICIONADO: NOVO CHAPTER */}
                <button 
                  onClick={() => router.push('/chapters/novo')}
                  className="flex flex-col items-start rounded-lg border border-zinc-900 bg-zinc-900/30 p-2.5 text-left hover:border-cyan-700 transition-colors group"
                >
                  <div className="mb-2 rounded-md bg-cyan-950/40 p-1.5 text-cyan-400 group-hover:scale-105 transition-transform text-[11px]">➕🏁</div>
                  <h4 className="text-[11px] font-bold text-white">Novo Chapter</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Bandeirar nova praça</p>
                </button>

                <button 
                  onClick={() => router.push('/eventos/novo')}
                  className="flex flex-col items-start rounded-lg border border-zinc-900 bg-zinc-900/30 p-2.5 text-left hover:border-orange-700 transition-colors group cursor-not-allowed opacity-50"
                  disabled
                >
                  <div className="mb-2 rounded-md bg-orange-950/40 p-1.5 text-orange-400 group-hover:scale-105 transition-transform text-[11px]">➕📅</div>
                  <h4 className="text-[11px] font-bold text-white">Criar Evento</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Rolês e reuniões</p>
                </button>

                <button 
                  onClick={() => router.push('/bar/novo')}
                  className="flex flex-col items-start rounded-lg border border-zinc-900 bg-zinc-900/30 p-2.5 text-left hover:border-red-700 transition-colors group cursor-not-allowed opacity-50"
                  disabled
                >
                  <div className="mb-2 rounded-md bg-red-950/40 p-1.5 text-red-400 group-hover:scale-105 transition-transform text-[11px]">➕🍺</div>
                  <h4 className="text-[11px] font-bold text-white">Lançar no Bar</h4>
                  <p className="text-[9px] text-zinc-500 mt-0.5">Estoque ou comanda</p>
                </button>
              </div>
            </div>
          </div>

        </div>

      </div>

    </main>
  )
}