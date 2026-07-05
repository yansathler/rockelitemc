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
  status: 'Agendado' | 'Concluido' | 'Cancelado'
  chapters: {
    nome: string
    cidade: string
  }
}

export default function GerenciamentoEventos() {
  const router = useRouter()
  const supabase = createClient()
  
  const [eventosOriginais, setEventosOriginais] = useState<Evento[]>([])
  const [eventosFiltrados, setEventosFiltrados] = useState<Evento[]>([])
  const [carregando, setCarregando] = useState(true)

  // 🗓️ Estado do Filtro Global de Mês (Vem setado por padrão no mês atual de 1 a 12, ou '' para todos)
  const [mesSelecionado, setMesSelecionado] = useState<string>(
    String(new Date().getMonth() + 1)
  )

  // 🎯 Estado do Filtro por Card ('all' | 'Role' | 'Bate-Papo' | 'Confraria')
  const [tipoSelecionado, setTipoSelecionado] = useState<string>('all')

  // Métricas Sintéticas
  const [metricas, setMetricas] = useState({
    total: 0,
    roles: 0,
    batePapos: 0,
    confrarias: 0
  })

  const mesesAno = [
    { value: '', label: '⚡ Todos os Meses' },
    { value: '1', label: 'Janeiro' },
    { value: '2', label: 'Fevereiro' },
    { value: '3', label: 'Março' },
    { value: '4', label: 'Abril' },
    { value: '5', label: 'Maio' },
    { value: '6', label: 'Junho' },
    { value: '7', label: 'Julho' },
    { value: '8', label: 'Agosto' },
    { value: '9', label: 'Setembro' },
    { value: '10', label: 'Outubro' },
    { value: '11', label: 'Novembro' },
    { value: '12', label: 'Dezembro' }
  ]

  useEffect(() => {
    carregarEventosDoBanco()
  }, [])

  // 🔄 Aplica os Filtros Combinados (Mês + Card) e Garante a Ordenação Ascendente
  useEffect(() => {
    // 1. Filtragem por Mês (Baseada no universo completo vindo do banco)
    let escopoPorMes = [...eventosOriginais]
    if (mesSelecionado !== '') {
      escopoPorMes = eventosOriginais.filter((e) => {
        if (!e.data_evento) return false
        const mesEvento = parseInt(e.data_evento.split('-')[1], 10)
        return mesEvento === parseInt(mesSelecionado, 10)
      })
    }

    // 2. Cálculo dinâmico das métricas baseando-se APENAS no filtro de Mês (Exatamente como o financeiro)
    const total = escopoPorMes.length
    const roles = escopoPorMes.filter(e => e.tipo_evento === 'Role').length
    const batePapos = escopoPorMes.filter(e => e.tipo_evento === 'Bate-Papo').length
    const confrarias = escopoPorMes.filter(e => e.tipo_evento === 'Confraria').length
    setMetricas({ total, roles, batePapos, confrarias })

    // 3. Aplica o segundo nível do Filtro Combinado (Clique no Card) para a Tabela Analítica
    let resultadoFinal = [...escopoPorMes]
    if (tipoSelecionado !== 'all') {
      resultadoFinal = escopoPorMes.filter(e => e.tipo_evento === tipoSelecionado)
    }

    // 4. 🔥 Ordenação Absoluta por Data de Forma Ascendente (Mais antiga/próxima para a mais distante)
    resultadoFinal.sort((a, b) => {
      const dataA = new Date(`${a.data_evento}T${a.horario_inicio || '00:00:00'}`)
      const dataB = new Date(`${b.data_evento}T${b.horario_inicio || '00:00:00'}`)
      return dataA.getTime() - dataB.getTime()
    })

    setEventosFiltrados(resultadoFinal)
  }, [mesSelecionado, tipoSelecionado, eventosOriginais])

  async function carregarEventosDoBanco() {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('eventos')
        .select(`
          id, titulo, tipo_evento, data_evento, horario_inicio, ponto_encontro, status,
          chapters ( nome, cidade )
        `)
        .order('data_evento', { ascending: true })

      if (!error && data) {
        setEventosOriginais(data as any[])
      } else if (error) {
        console.error('Erro na query do Supabase:', error.message)
      }
    } catch (err) {
      console.error('Erro operacional ao carregar agenda:', err)
    } finally {
      setCarregando(false)
    }
  }

  // ⚡ AÇÃO RÁPIDA: Atualiza o status do evento diretamente na linha da tabela
  async function handleMudarStatus(idEvento: string, novoStatus: 'Agendado' | 'Concluido' | 'Cancelado') {
    try {
      const { error } = await supabase
        .from('eventos')
        .update({ status: novoStatus })
        .eq('id', idEvento)

      if (error) throw error

      setEventosOriginais(prev => 
        prev.map(evt => evt.id === idEvento ? { ...evt, status: novoStatus } : evt)
      )
    } catch (err: any) {
      console.error('Falha ao atualizar status do compromisso:', err.message)
      alert('❌ Erro operacional ao alterar status.')
    }
  }

  const formatarData = (dataStr: string) => {
    if (!dataStr) return ''
    const [ano, mes, dia] = dataStr.split('-')
    return `${dia}/${mes}/${ano}`
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 space-y-8">
      
      {/* CABEÇALHO DA CENTRAL COMPLETO */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">📅 Agenda & Eventos Oficiais</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Planejamento, comboios e alinhamentos estratégicos REMC</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          {/* 🔍 FILTRO GLOBAL DE MÊS INTEGRADO */}
          <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-lg">
            <span className="text-xs text-zinc-500 font-bold uppercase font-mono">Competência:</span>
            <select 
              value={mesSelecionado} 
              onChange={(e) => setMesSelecionado(e.target.value)}
              className="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-2 font-sans"
            >
              {mesesAno.map((m) => (
                <option key={m.value} value={m.value} className="bg-zinc-900 text-zinc-100">
                  {m.label}
                </option>
              ))}
            </select>
          </div>

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

      {/* 📊 VISÃO SINTÉTICA DINÂMICA (CARDS QUE AGORA ATUAM COMO FILTROS SELECIONÁVEIS) */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Card Total */}
        <div 
          onClick={() => setTipoSelecionado('all')}
          className={`rounded-xl border p-5 cursor-pointer transition-all ${
            tipoSelecionado === 'all' 
              ? 'bg-zinc-900 border-white shadow-[0_0_10px_rgba(255,255,255,0.05)] scale-[1.02]' 
              : 'bg-zinc-900/20 border-zinc-900 hover:border-zinc-700 opacity-70 hover:opacity-100'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Compromissos no Escopo</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.total}</p>
          <p className="text-[9px] text-zinc-400 uppercase mt-1">
            {tipoSelecionado === 'all' ? '● Exibindo Todos' : 'Ver Todos'}
          </p>
        </div>

        {/* Card Rolês */}
        <div 
          onClick={() => setTipoSelecionado('Role')}
          className={`rounded-xl border p-5 border-l-2 border-l-purple-500 cursor-pointer transition-all ${
            tipoSelecionado === 'Role' 
              ? 'bg-purple-950/20 border-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.1)] scale-[1.02]' 
              : 'bg-zinc-900/20 border-zinc-900 hover:border-zinc-700 opacity-70 hover:opacity-100'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-purple-400">⚡ Rolês (Estrada)</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.roles}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">
            {tipoSelecionado === 'Role' ? '● Filtrado ativos' : 'Filtrar Missões'}
          </p>
        </div>

        {/* Card Bate-Papos */}
        <div 
          onClick={() => setTipoSelecionado('Bate-Papo')}
          className={`rounded-xl border p-5 border-l-2 border-l-blue-500 cursor-pointer transition-all ${
            tipoSelecionado === 'Bate-Papo' 
              ? 'bg-blue-950/20 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.1)] scale-[1.02]' 
              : 'bg-zinc-900/20 border-zinc-900 hover:border-zinc-700 opacity-70 hover:opacity-100'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400">🍺 Bate-Papos</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.batePapos}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">
            {tipoSelecionado === 'Bate-Papo' ? '● Filtrado ativos' : 'Filtrar Resenhas'}
          </p>
        </div>

        {/* Card Confrarias */}
        <div 
          onClick={() => setTipoSelecionado('Confraria')}
          className={`rounded-xl border p-5 border-l-2 border-l-amber-500 cursor-pointer transition-all ${
            tipoSelecionado === 'Confraria' 
              ? 'bg-amber-950/20 border-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.1)] scale-[1.02]' 
              : 'bg-zinc-900/20 border-zinc-900 hover:border-zinc-700 opacity-70 hover:opacity-100'
          }`}
        >
          <p className="text-[10px] font-bold uppercase tracking-wider text-amber-400">🦅 Confrarias</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">{carregando ? '...' : metricas.confrarias}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">
            {tipoSelecionado === 'Confraria' ? '● Filtrado ativos' : 'Filtrar Comandos'}
          </p>
        </div>
      </div>

      {/* 🔍 VISÃO ANALÍTICA RECONFIGURADA */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
        <div className="flex justify-between items-center mb-4 border-l-2 border-zinc-700 pl-3">
          <h2 className="text-xs font-bold text-white uppercase tracking-wider">
            📋 Cronograma Analítico de Eventos 
            {tipoSelecionado !== 'all' && <span className="text-zinc-500 font-normal"> / Filtrado por {tipoSelecionado}</span>}
          </h2>
          <span className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
            Ordenação: Data Ascendente ⬆
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-900 text-[10px] font-black uppercase tracking-wider text-zinc-500">
                <th className="pb-3 pl-2">Missão / Compromisso</th>
                <th className="pb-3">Tipo</th>
                <th className="pb-3">Chapter</th>
                <th className="pb-3">Data / Hora</th>
                <th className="pb-3">Ponto de Encontro / Local</th>
                <th className="pb-3 pr-2 text-right">Alterar Status Tático / Real</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-900/50 text-xs">
              {carregando ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-600 italic uppercase tracking-widest animate-pulse">
                    Mapeando dados operacionais...
                  </td>
                </tr>
              ) : eventosFiltrados.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-zinc-500 border border-dashed border-zinc-900 rounded-lg uppercase italic">
                    Nenhum evento localizado com os filtros aplicados.
                  </td>
                </tr>
              ) : (
                eventosFiltrados.map((e) => (
                  <tr 
                    key={e.id} 
                    onClick={() => router.push(`/eventos/editar/${e.id}`)}
                    className="hover:bg-zinc-900/30 transition-colors group cursor-pointer"
                  >
                    <td className="py-3.5 pl-2 font-bold text-zinc-200 group-hover:text-white group-hover:underline decoration-zinc-600 decoration-1">
                      {e.titulo}
                    </td>
                    <td className="py-3.5">
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${
                        e.tipo_evento === 'Role' ? 'bg-purple-950/60 text-purple-400 border border-purple-900/50' :
                        e.tipo_evento === 'Bate-Papo' ? 'bg-blue-950/60 text-blue-400 border border-blue-900/50' :
                        'bg-amber-950/60 text-amber-400 border border-amber-900/50'
                      }`}>
                        {e.tipo_evento === 'Role' ? '⚡ Rolê' : e.tipo_evento === 'Bate-Papo' ? '🍺 Bate-Papo' : '🦅 Confraria'}
                      </span>
                    </td>
                    <td className="py-3.5 text-zinc-400 font-medium">{e.chapters?.nome || 'Global'}</td>
                    <td className="py-3.5 font-mono text-zinc-300">
                      {formatarData(e.data_evento)} <span className="text-zinc-600">às</span> {e.horario_inicio.substring(0, 5)}
                    </td>
                    <td className="py-3.5 text-zinc-400 italic max-w-xs truncate">{e.ponto_encontro}</td>
                    
                    <td className="py-3.5 pr-2 text-right" onClick={(event) => event.stopPropagation()}>
                      <select
                        value={e.status}
                        onChange={(event) => handleMudarStatus(e.id, event.target.value as any)}
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded cursor-pointer border outline-none ${
                          e.status === 'Agendado' ? 'bg-zinc-900 text-zinc-400 border-zinc-800 focus:border-zinc-500' :
                          e.status === 'Concluido' ? 'bg-emerald-950/80 text-emerald-400 border-emerald-900 focus:border-emerald-500' : 
                          'bg-red-950/80 text-red-400 border-red-900 focus:border-red-500'
                        }`}
                      >
                        <option value="Agendado" className="bg-zinc-900 text-zinc-400 font-sans">📅 Agendado</option>
                        <option value="Concluido" className="bg-zinc-900 text-emerald-400 font-sans">✅ Concluído</option>
                        <option value="Cancelado" className="bg-zinc-900 text-red-400 font-sans">❌ Cancelado</option>
                      </select>
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