'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface Evento {
  id: string
  titulo: string
  tipo_evento: 'Role' | 'Bate-Papo' | 'Confraria'
  data_evento: string
  horario_inicio: string
  ponto_encontro: string
  status: string
  chapters: {
    nome: string
    cidade: string
  }
}

export default function GerenciamentoEventos() {
  const router = useRouter()
  const supabase = createClient()
  
  const [eventos, setEventos] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(true)

  // Métricas Sintéticas
  const [metricas, setMetricas] = useState({
    total: 0,
    roles: 0,
    batePapos: 0,
    confrarias: 0
  })

  useEffect(() => {
    carregarEventosEMetricas()
  }, [])

  async function carregarEventosEMetricas() {
    setCarregando(true)
    try {
      // Busca analítica dos eventos trazendo o nome do Chapter associado
      const { data, error } = await supabase
        .from('eventos')
        .select(`
          id, titulo, tipo_evento, data_evento, horario_inicio, punto_encontro, status,
          chapters ( nome, cidade )
        `)
        .order('data_evento', { ascending: true })

      if (!error && data) {
        const listaEventos = data as any[]
        setEventos(listaEventos)

        // Cálculo da Visão Sintética
        const total = listaEventos.length
        const roles = listaEventos.filter(e => e.tipo_evento === 'Role').length
        const batePapos = listaEventos.filter(e => e.tipo_evento === 'Bate-Papo').length
        const confrarias = listaEventos.filter(e => e.tipo_evento === 'Confraria').length

        setMetricas({ total, roles, batePapos, confrarias })
      }
    } catch (err) {
      console.error('Erro operacional ao carregar agenda:', err)
    } finally {
      setCarregando(false)
    }
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return ''
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 space-y-8">
      
      {/* CABEÇALHO DA CENTRAL */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">📅 Agenda & Eventos Oficiais</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Planejamento, comboios e alinhamentos estratégicos REMC</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={() => router.push('/dashboard')}
            className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors"
          >
            Voltar ao Dash
          </button>
          <button 
            onClick={() => router.push('/eventos/novo')}
            className="rounded-lg bg-white px-5 py-2 text-xs font-black uppercase text-zinc-950 hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]"
          >
            Agendar Evento ➕
          </button>
        </div>
      </div>

      {/* 📊 VISÃO SINTÉTICA (MÉTRICAS DO PAINEL) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5">
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total de Compromissos</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.total}</p>
          <p className="text-[9px] text-zinc-400 uppercase mt-1">Lançados na grade</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-purple-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">⚡ Rolês (Estrada)</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.roles}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Motos no asfalto</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-blue-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">🍺 Bate-Papos</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.batePapos}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Resenhas locais</p>
        </div>

        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-amber-500">
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">🦅 Confrarias</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.confrarias}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Reuniões de Comando</p>
        </div>
      </div>

      {/* 🔍 VISÃO ANALÍTICA (LISTAGEM OPERACIONAL) */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
        <h2 className="text-xs font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-zinc-700 pl-3">
          📋 Cronograma Analítico de Eventos
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <th className="pb-3 pl-2">Missão / Compromisso</th>
                <th className="pb-3">Tipo</th>
                <th className="pb-3">Chapter</th>
                <th className="pb-3">Data / Hora</th>
                <th className="pb-3">Ponto de Encontro / Local</th>
                <th className="pb-3 pr-2 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600 italic uppercase tracking-widest animate-pulse">
                    Mapeando dados operacionais...
                  </td>
                </tr>
              ) : eventos.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600 border border-dashed border-zinc-900 rounded-lg uppercase italic">
                    Nenhum evento agendado no sistema.
                  </td>
                </tr>
              ) : (
                eventos.map((e) => (
                  <tr key={e.id} className="hover:bg-zinc-900/20 transition-colors group">
                    <td className="py-3 pl-2 font-bold text-zinc-200 group-hover:text-white">{e.titulo}</td>
                    <td className="py-3">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        e.tipo_evento === 'Role' ? 'bg-purple-950/60 text-purple-400 border border-purple-900/50' :
                        e.tipo_evento === 'Bate-Papo' ? 'bg-blue-950/60 text-blue-400 border border-blue-900/50' :
                        'bg-amber-950/60 text-amber-400 border border-amber-900/50'
                      }`}>
                        {e.tipo_evento === 'Role' ? '⚡ Rolê' : e.tipo_evento === 'Bate-Papo' ? '🍺 Bate-Papo' : '🦅 Confraria'}
                      </span>
                    </td>
                    <td className="py-3 text-zinc-400 font-medium">{e.chapters?.nome || 'Global'}</td>
                    <td className="py-3 font-mono text-zinc-300">
                      {formatarData(e.data_evento)} <span className="text-zinc-600">às</span> {e.horario_inicio.substring(0, 5)}
                    </td>
                    <td className="py-3 text-zinc-400 italic max-w-xs truncate">{e.ponto_encontro}</td>
                    <td className="py-3 pr-2 text-right">
                      <span className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                        e.status === 'Agendado' ? 'bg-zinc-900 text-zinc-400 border border-zinc-800' :
                        e.status === 'Concluido' ? 'bg-emerald-950 text-emerald-400' : 'bg-red-950 text-red-400'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </main>
  )
}