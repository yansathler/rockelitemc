'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface MembroRelacionado {
  nome_completo: string
}

interface RotaViagem {
  id: string
  numero_cadastro: number
  nome_rota: string
  itinerario_resumido: string | null
  tipo_role: string // 'Curto', 'Longo', etc.
  km_total: number
  tempo_total_rodagem: string | null // Formato: 00h00m
  qtd_total_paradas: number
  tempo_total_paradas: string | null
  tempo_total_geral: string | null
  comando_instrucional: string | null
  comando_operacional: string | null
  
  // Joins relacionais com a tabela de membros
  road_captain?: MembroRelacionado | null
  sweep?: MembroRelacionado | null
}

export default function GestaoRotas() {
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  
  // Estados de Dados
  const [rotas, setRotas] = useState<RotaViagem[]>([])
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaViagem | null>(null)

  // Estados Analíticos (Cards Superiores)
  const [totalRotas, setTotalRotas] = useState(0)
  const [kmTotalRodado, setKmTotalRodado] = useState(0)
  const [tempoTotalEstrada, setTempoTotalEstrada] = useState('00h00m')
  const [qtdRotasCurtas, setQtdRotasCurtas] = useState(0)
  const [qtdRotasLongas, setQtdRotasLongas] = useState(0)

  // Estados de Filtros de Tela
  const [filtroTipoRole, setFiltroTipoRole] = useState<string>('Todos')
  const [filtroTexto, setFiltroTexto] = useState('')

  useEffect(() => {
    async function checarAcesso() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setAutenticado(true)
        await carregarPainelRotas()
      }
    }
    checarAcesso()
  }, [])

  async function carregarPainelRotas() {
    try {
      setCarregando(true)

      const { data, error } = await supabase
        .from('rotas')
        .select(`
          *,
          road_captain:road_captain_id(nome_completo),
          sweep:sweep_id(nome_completo)
        `)
        .order('numero_cadastro', { ascending: false })

      if (error) throw error

      const listaRotas = (data || []) as RotaViagem[]
      setRotas(listaRotas)

      if (listaRotas.length > 0) {
        setRotaSelecionada(listaRotas[0])
      }

      calcularMetricasLogisticas(listaRotas)

    } catch (err) {
      console.error('Erro ao consolidar torre de controle de rotas:', err)
    } finally {
      setCarregando(false)
    }
  }

  function calcularMetricasLogisticas(lista: RotaViagem[]) {
    setTotalRotas(lista.length)

    let acumuladorKm = 0
    let curtas = 0
    let longas = 0
    let totalMinutos = 0

    lista.forEach(r => {
      const km = Number(r.km_total) || 0
      acumuladorKm += km

      if (km <= 150) {
        curtas++
      } else {
        longas++
      }

      if (r.tempo_total_rodagem) {
        const regexTempo = /(\d+)h(\d+)m/
        const match = r.tempo_total_rodagem.match(regexTempo)
        if (match) {
          const horas = parseInt(match[1], 10) || 0
          const minutos = parseInt(match[2], 10) || 0
          totalMinutos += (horas * 60) + minutos
        }
      }
    })

    const horasFinais = Math.floor(totalMinutos / 60)
    const minutosFinais = totalMinutos % 60
    const strHoras = horasFinais.toString().padStart(2, '0')
    const strMinutos = minutosFinais.toString().padStart(2, '0')

    setKmTotalRodado(acumuladorKm)
    setQtdRotasCurtas(curtas)
    setQtdRotasLongas(longas)
    setTempoTotalEstrada(`${strHoras}h${strMinutos}m`)
  }

  const rotasFiltradas = rotas.filter(r => {
    if (filtroTipoRole !== 'Todos' && r.tipo_role?.toLowerCase() !== filtroTipoRole.toLowerCase()) return false
    
    if (filtroTexto) {
      const textoLower = filtroTexto.toLowerCase()
      const nomeRotaMatch = r.nome_rota?.toLowerCase().includes(textoLower)
      const rcMatch = r.road_captain?.nome_completo?.toLowerCase().includes(textoLower)
      return nomeRotaMatch || rcMatch
    }
    return true
  })

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 font-medium text-xs tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl animate-spin">🛣️</span>
          <span>Sincronizando Malha Rodoviária e Comboios...</span>
        </div>
      </div>
    )
  }

  if (!autenticado) return null

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* TOPO DA TELA COM O NOVO BOTÃO ADICIONADO */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">🗺️ Gestão de Rotas</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Torre de monitoramento logístico, quilometragem acumulada e controle de comboios</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            Voltar ao Dash
          </button>
          <button onClick={() => carregarPainelRotas()} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            🔄 Recarregar
          </button>
          <button onClick={() => router.push('/rotas/novo')} className="rounded-lg bg-white px-5 py-2 text-xs font-black uppercase text-zinc-950 hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            ➕ Nova Rota
          </button>
        </div>
      </div>

      {/* PAINEL DE CARDS ANALÍTICOS */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">📋 Total de Rotas</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{totalRotas}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Mapeadas no sistema</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-l-emerald-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">⚡ Distância Total</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">
            {kmTotalRodado.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KM
          </p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Soma de todas as quilometragens</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">⏱️ Tempo Rodado</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{tempoTotalEstrada}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Tempo total de rodagem ativo</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-l-amber-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Perfil de Distância</p>
          <div className="mt-2 flex items-baseline gap-4">
            <div>
              <span className="text-3xl font-black text-white font-mono">{qtdRotasCurtas}</span>
              <span className="text-[9px] text-zinc-500 ml-1 uppercase">Curtas</span>
            </div>
            <div className="border-l border-zinc-800 h-6 self-center" />
            <div>
              <span className="text-3xl font-black text-white font-mono">{qtdRotasLongas}</span>
              <span className="text-[9px] text-zinc-500 ml-1 uppercase">Longas</span>
            </div>
          </div>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Corte: 150 KM</p>
        </div>
      </div>

      {/* SEÇÃO CENTRAL OPERACIONAL */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* COLUNA ESQUERDA: LISTAGEM DE ROTAS */}
        <div className="rounded-2xl bg-[#0f1115] border border-zinc-900 p-6 lg:col-span-2">
          <h2 className="text-base font-bold text-white mb-1">📋 Catálogo de Trajetos do Clube</h2>
          <p className="text-xs text-zinc-500 mb-6">Busque e selecione rotas cadastradas para visualizar diretrizes operacionais.</p>

          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="text"
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              placeholder="Buscar por nome da rota ou road captain..."
              className="flex-1 rounded-lg bg-[#07080a] border border-zinc-800 p-2 text-xs text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-700"
            />
            
            <div className="flex gap-1.5">
              {['Todos', 'Curto', 'Longo'].map((tipo) => (
                <button
                  key={tipo}
                  onClick={() => setFiltroTipoRole(tipo)}
                  className={`rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider border transition-colors whitespace-nowrap ${filtroTipoRole === tipo ? 'bg-zinc-800 text-white border-zinc-700' : 'bg-transparent text-zinc-500 border-zinc-900 hover:text-zinc-300'}`}
                >
                  {tipo === 'Todos' ? 'Todos os Rolês' : `Perfil ${tipo}`}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {rotasFiltradas.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhuma rota encontrada para os critérios informados.</p>
            ) : (
              rotasFiltradas.map((r) => {
                const kmValor = Number(r.km_total) || 0
                const ehPerfilLongo = kmValor > 150
                return (
                  <div
                    key={r.id}
                    onClick={() => setRotaSelecionada(r)}
                    className={`flex items-center justify-between rounded-xl p-3.5 border cursor-pointer transition-all select-none ${rotaSelecionada?.id === r.id ? 'bg-[#161920] border-zinc-700' : 'bg-[#07080a] border-zinc-900/60 hover:border-zinc-800'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white uppercase">{r.nome_rota}</h4>
                        <span className="text-[9px] text-zinc-500 bg-[#0f1115] px-1.5 py-0.5 rounded border border-zinc-800">
                          Nº {r.numero_cadastro}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-mono">
                        <span>RC: <strong className="text-zinc-300 font-sans">{r.road_captain?.nome_completo || 'Não Definido'}</strong></span>
                        <span>•</span>
                        <span>Paradas: {r.qtd_total_paradas}</span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-white">{kmValor} KM</span>
                      <span className={`text-[9px] font-bold uppercase tracking-wide mt-0.5 ${ehPerfilLongo ? 'text-amber-500' : 'text-zinc-500'}`}>
                        {ehPerfilLongo ? '⚡ Longo' : '☕ Curto'}
                      </span>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* COLUNA DIREITA: DETALHES OPERACIONAIS DA ROTA SELECIONADA */}
        <div className="rounded-2xl bg-[#0f1115] border border-zinc-900 p-6 flex flex-col justify-between">
          {rotaSelecionada ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="border-b border-zinc-900 pb-3 mb-4">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block tracking-wider">Prontuário Operacional</span>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">{rotaSelecionada.nome_rota}</h3>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 bg-[#07080a] p-2.5 rounded-xl border border-zinc-900">
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500 block">Autonomia Total</span>
                      <span className="text-xs font-mono font-bold text-white">{rotaSelecionada.km_total} km</span>
                    </div>
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500 block">Tempo Rodagem</span>
                      <span className="text-xs font-mono font-bold text-white">{rotaSelecionada.tempo_total_rodagem || '00h00m'}</span>
                    </div>
                  </div>

                  {rotaSelecionada.itinerario_resumido && (
                    <div>
                      <span className="text-[9px] uppercase tracking-wider text-zinc-500 block mb-1">📍 Itinerário Resumido</span>
                      <p className="text-xs text-zinc-400 bg-[#07080a] p-2.5 rounded-lg border border-zinc-950">{rotaSelecionada.itinerario_resumido}</p>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">🛡️ Oficialato Definido</h4>
                    
                    <div className="rounded-lg border border-zinc-900 bg-[#07080a] p-2 flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Road Captain (Puxador):</span>
                      <span className="font-bold text-zinc-200">{rotaSelecionada.road_captain?.nome_completo || 'Disponível'}</span>
                    </div>

                    <div className="rounded-lg border border-zinc-900 bg-[#07080a] p-2 flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Sweep (Ferrolho):</span>
                      <span className="font-bold text-zinc-200">{rotaSelecionada.sweep?.nome_completo || 'Disponível'}</span>
                    </div>
                  </div>

                  {rotaSelecionada.comando_operacional && (
                    <div className="space-y-2 pt-1">
                      <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">📋 Diretrizes Estratégicas</h4>
                      <div className="text-[11px] text-zinc-400 bg-zinc-950/40 p-2 rounded border border-zinc-900">
                        <strong className="text-zinc-500 block text-[9px] uppercase">Comando Operacional:</strong>
                        {rotaSelecionada.comando_operacional}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-zinc-900 flex gap-2">
                <button
                  onClick={() => router.push(`/rotas/editar/${rotaSelecionada.id}`)}
                  className="w-full py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 transition-colors"
                >
                  ⚙️ Editar Diretrizes da Rota
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500 italic py-12 text-center">
              Nenhuma rota ativa cadastrada no cofre.
            </div>
          )}
        </div>

      </div>

    </main>
  )
}