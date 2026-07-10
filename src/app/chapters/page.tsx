'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface MembroRelacionado {
  nome_completo: string
}

interface Chapter {
  id: string
  nome: string
  tipo_chapter: 'Chapter' | 'Prospect Chapter'
  status_operacional: 'Ativo' | 'Inativo'
  rua: string | null
  numero: string | null
  bairro: string | null
  cidade: string | null
  estado: string
  guardiao_id: string | null
  data_oficializacao: string | null
  created_at: string
  
  // Join relacional com o Guardião (Tabela de membros)
  guardiao?: MembroRelacionado | null
  
  // Contagem agregada de membros injetada dinamicamente
  total_membros_count?: number
}

export default function GestaoChapters() {
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [autenticado, setAutenticado] = useState(false)

  // Estados de Dados
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [chapterSelecionado, setChapterSelecionado] = useState<Chapter | null>(null)

  // Estados Analíticos (Cards Superiores)
  const [totalChapters, setTotalChapters] = useState(0)
  const [qtdOficializados, setQtdOficializados] = useState(0)
  const [qtdProspectChapters, setQtdProspectChapters] = useState(0)
  const [qtdEstadosUnicos, setQtdEstadosUnicos] = useState(0)

  // Estados de Filtros
  const [filtroTipo, setFiltroTipo] = useState<string>('Todos')
  const [filtroStatus, setFiltroStatus] = useState<string>('Ativo') // Começa filtrando os Ativos por padrão tático
  const [filtroTexto, setFiltroTexto] = useState('')

  useEffect(() => {
    async function checarAcesso() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setAutenticado(true)
        await carregarPainelChapters()
      }
    }
    checarAcesso()
  }, [])

  async function carregarPainelChapters() {
    try {
      setCarregando(true)

      // 1. Busca os chapters e faz o join relacional com o guardião
      const { data: dataChapters, error: errorChapters } = await supabase
        .from('chapters')
        .select(`
          *,
          guardiao:guardiao_id(nome_completo)
        `)
        .order('nome', { ascending: true })

      if (errorChapters) throw errorChapters

      const listaChapters = (dataChapters || []) as Chapter[]

      // 2. Busca e mapeia a contagem de membros por chapter de forma agregada
      // Fazemos um select na tabela de membros trazendo apenas o chapter_id para contar no front de forma otimizada
      const { data: dataMembros, error: errorMembros } = await supabase
        .from('membros')
        .select('chapter_id')

      if (!errorMembros && dataMembros) {
        listaChapters.forEach(ch => {
          const count = dataMembros.filter(m => m.chapter_id === ch.id).length
          ch.total_membros_count = count
        })
      } else {
        listaChapters.forEach(ch => { ch.total_membros_count = 0 })
      }

      setChapters(listaChapters)

      if (listaChapters.length > 0) {
        setChapterSelecionado(listaChapters[0])
      }

      calcularMetricasChapters(listaChapters)

    } catch (err) {
      console.error('Erro ao consolidar torre de controle de chapters:', err)
    } finally {
      setCarregando(false)
    }
  }

  function calcularMetricasChapters(lista: Chapter[]) {
    setTotalChapters(lista.length)

    let oficiais = 0
    let prospects = 0
    const estadosSet = new Set<string>()

    lista.forEach(ch => {
      if (ch.status_operacional === 'Ativo') {
        if (ch.tipo_chapter === 'Chapter') oficiais++
        if (ch.tipo_chapter === 'Prospect Chapter') prospects++
      }
      if (ch.estado) {
        estadosSet.add(ch.estado.toUpperCase())
      }
    })

    setQtdOficializados(oficiais)
    setQtdProspectChapters(prospects)
    setQtdEstadosUnicos(estadosSet.size)
  }

  // Filtros Reativos baseados na estrutura real do banco
  const chaptersFiltrados = chapters.filter(ch => {
    if (filtroTipo !== 'Todos' && ch.tipo_chapter !== filtroTipo) return false
    if (filtroStatus !== 'Todos' && ch.status_operacional !== filtroStatus) return false
    
    if (filtroTexto) {
      const textoLower = filtroTexto.toLowerCase()
      const nomeMatch = ch.nome?.toLowerCase().includes(textoLower)
      const cidadeMatch = ch.cidade?.toLowerCase().includes(textoLower)
      const guardiaoMatch = ch.guardiao?.nome_completo?.toLowerCase().includes(textoLower)
      return nomeMatch || cidadeMatch || guardiaoMatch
    }
    return true
  })

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 font-medium text-xs tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl animate-spin">🛡️</span>
          <span>Mapeando Divisões Territoriais e Chapters...</span>
        </div>
      </div>
    )
  }

  if (!autenticado) return null

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* TOPO DA TELA */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">🛡️ Gestão de Chapters</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Torre de monitoramento de sedes, chapters de expansão e força de efetivo local</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            Voltar ao Dash
          </button>
          <button onClick={() => carregarPainelChapters()} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            🔄 Recarregar
          </button>
          <button onClick={() => router.push('/chapters/novo')} className="rounded-lg bg-white px-5 py-2 text-xs font-black uppercase text-zinc-950 hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            ➕ Novo Chapter
          </button>
        </div>
      </div>

      {/* PAINEL DE CARDS ANALÍTICOS (MÉTRICAS DO BANCO) */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total de Chapters</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{totalChapters}</p>
          <p className="text-[9px] text-zinc-400 uppercase mt-1">Chapters e Prospects catalogados</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-l-emerald-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">🛡️ Sedes Oficializadas</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{qtdOficializados}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Chapters ativos consolidados</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-l-amber-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">⚡ Em Expansão</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{qtdProspectChapters}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Chapters em fase de provação</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">🗺️ Presença Territorial</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{qtdEstadosUnicos}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">UFs atingidas na malha rodoviária</p>
        </div>
      </div>

      {/* SEÇÃO CENTRAL OPERACIONAL */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* COLUNA ESQUERDA: LISTAGEM DE CHAPTERS */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 lg:col-span-2">
          <div className="mb-4 border-l-2 border-zinc-700 pl-3">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">🗺️ Divisões Territoriais do Clube</h2>
          </div>
          <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Filtre por tipo ou status para gerenciar o efetivo e as mesas de comando local.</p>

          {/* BARRA DE FILTROS REAL */}
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nome, cidade ou guardião..."
              className="flex-1 rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
            />
            
            <div className="flex gap-1.5 overflow-x-auto">
              <select
                value={filtroTipo}
                onChange={(e) => setFiltroTipo(e.target.value)}
                className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="Todos">Todos os Perfis</option>
                <option value="Chapter">Chapter</option>
                <option value="Prospect Chapter">Prospect Chapter</option>
              </select>

              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="rounded-lg bg-zinc-950 border border-zinc-800 p-2 text-xs text-zinc-300 focus:outline-none"
              >
                <option value="Todos">Todos os Status</option>
                <option value="Ativo">Ativos</option>
                <option value="Inativo">Inativos</option>
              </select>
            </div>
          </div>

          {/* LISTA DE CARDS */}
          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {chaptersFiltrados.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhum chapter encontrado para as regras selecionadas.</p>
            ) : (
              chaptersFiltrados.map((ch) => {
                const ehOficial = ch.tipo_chapter === 'Chapter'
                const isInativo = ch.status_operacional === 'Inativo'
                return (
                  <div
                    key={ch.id}
                    onClick={() => setChapterSelecionado(ch)}
                    className={`flex items-center justify-between rounded-xl p-3.5 border cursor-pointer transition-all select-none ${chapterSelecionado?.id === ch.id ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800'} ${isInativo ? 'opacity-50' : ''}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white uppercase">{ch.nome}</h4>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${ehOficial ? 'bg-zinc-950 text-emerald-400 border-emerald-900/40' : 'bg-zinc-900 text-amber-500 border-zinc-800'}`}>
                          {ehOficial ? 'Chapter' : 'Prospect'}
                        </span>
                        {isInativo && (
                          <span className="text-[9px] font-bold bg-red-950/40 text-red-400 border border-red-900/40 px-1.5 py-0.5 rounded uppercase">Inativo</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-mono">
                        <span>Líder/Guardião: <strong className="text-zinc-300 font-sans">{ch.guardiao?.nome_completo || 'Não Definido'}</strong></span>
                        <span>•</span>
                        <span className="uppercase">{ch.cidade} - {ch.estado}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-white">👥 {ch.total_membros_count ?? 0}</span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5 font-sans">Irmãos na Sede</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHES OPERACIONAIS E LOCALIZAÇÃO */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between">
          {chapterSelecionado ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="border-b border-zinc-900 pb-3 mb-4">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block tracking-wider">Prontuário de Comando</span>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">{chapterSelecionado.nome}</h3>
                </div>

                <div className="space-y-4">
                  {/* FORÇA DO EFETIVO DESTAQUE */}
                  <div className="rounded-xl bg-zinc-950/40 border border-zinc-900 p-4 flex justify-between items-center">
                    <div className="text-left">
                      <span className="text-3xl font-mono font-black text-emerald-400">{chapterSelecionado.total_membros_count ?? 0}</span>
                      <span className="text-[10px] text-zinc-400 uppercase block tracking-wider mt-0.5">Membros Integrados</span>
                    </div>
                    <span className="text-xl">👥</span>
                  </div>

                  {/* LIDERANÇA / GUARDIÃO */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">🛡️ Comando da Sede</h4>
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-2.5 flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Guardião Principal:</span>
                      <span className="font-bold text-zinc-200">{chapterSelecionado.guardiao?.nome_completo || 'Disponível / Vago'}</span>
                    </div>
                  </div>

                  {/* DATA OFICIALIZAÇÃO */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">📅 Histórico e Fundação</h4>
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-2.5 text-xs text-zinc-300">
                      {chapterSelecionado.tipo_chapter === 'Chapter' && chapterSelecionado.data_oficializacao ? (
                        <div>
                          <span className="text-zinc-500">Oficializado em:</span>{' '}
                          <strong className="font-mono text-zinc-200">{new Date(chapterSelecionado.data_oficializacao).toLocaleDateString('pt-BR')}</strong>
                        </div>
                      ) : (
                        <div className="text-amber-500/80 font-medium text-[11px] flex items-center gap-1">
                          ⚠️ Célula em período de provação operacional (Prospect).
                        </div>
                      )}
                    </div>
                  </div>

                  {/* VETOR DE LOCALIZAÇÃO (ENDEREÇO DA SEDE) */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">📍 Vetor de Localização (Sede)</h4>
                    <div className="rounded-xl bg-zinc-950/40 border border-zinc-900 p-3 text-xs space-y-1 font-mono text-zinc-400">
                      <p><strong className="text-zinc-500 font-sans">Rua:</strong> {chapterSelecionado.rua || 'Não Informada'}, {chapterSelecionado.numero || 'S/N'}</p>
                      <p><strong className="text-zinc-500 font-sans">Bairro:</strong> {chapterSelecionado.bairro || 'Não Informado'}</p>
                      <p className="uppercase"><strong className="text-zinc-500 font-sans text-initial">Cidade/UF:</strong> {chapterSelecionado.cidade || 'Não vinculada'} - {chapterSelecionado.estado}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* RODAPÉ DO CARD DE DETALHES */}
              <div className="mt-6 pt-4 border-t border-zinc-900 flex gap-2">
                <button
                  onClick={() => router.push(`/chapters/editar/${chapterSelecionado.id}`)}
                  className="w-full py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 transition-colors"
                >
                  ⚙️ Editar Chapter
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500 italic py-12 text-center">
              Nenhuma sede ou filial ativa selecionada no momento.
            </div>
          )}
        </div>

      </div>

    </main>
  )
}