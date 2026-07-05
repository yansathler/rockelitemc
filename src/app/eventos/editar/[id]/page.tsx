'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'

interface Chapter {
  id: string
  nome: string
  cidade: string
  estado: string
}

interface Rota {
  id: string
  numero_cadastro: number
  nome_rota: string
  km_total: number
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditarEvento({ params }: PageProps) {
  const router = useRouter()
  const supabase = createClient()
  
  // Resolve o ID da rota dinâmica do Next.js
  const { id: eventoId } = use(params)

  const [chapterId, setChapterId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipoEvento, setTipoEvento] = useState('Role')
  const [dataEvento, setDataEvento] = useState('')
  const [horarioInicio, setHorarioInicio] = useState('')
  const [pontoEncontro, setPontoEncontro] = useState('')
  const [rotaId, setRotaId] = useState('')
  const [status, setStatus] = useState('Agendado')

  const [chapters, setChapters] = useState<Chapter[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => {
    async function carregarEstruturaEEvento() {
      try {
        // 1. Carrega as tabelas auxiliares de Chapters e Rotas
        const { data: dataChapters } = await supabase
          .from('chapters')
          .select('id, nome, cidade, estado')
          .order('nome', { ascending: true })

        const { data: dataRotas } = await supabase
          .from('rotas')
          .select('id, numero_cadastro, nome_rota, km_total')
          .order('created_at', { ascending: false })

        if (dataChapters) setChapters(dataChapters)
        if (dataRotas) setRotas(dataRotas)

        // 2. Busca os dados específicos do evento que está sendo editado
        const { data: evento, error: errEvento } = await supabase
          .from('eventos')
          .select('*')
          .eq('id', eventoId)
          .single()

        if (errEvento) throw errEvento

        if (evento) {
          setChapterId(evento.chapter_id)
          setTitulo(evento.titulo)
          setDescricao(evento.descricao || '')
          setTipoEvento(evento.tipo_evento)
          setDataEvento(evento.data_evento)
          setHorarioInicio(evento.horario_inicio ? evento.horario_inicio.substring(0, 5) : '')
          setPontoEncontro(evento.ponto_encontro)
          setRotaId(evento.rota_id || '')
          setStatus(evento.status)
        }
      } catch (err: any) {
        console.error('Erro operacional ao carregar registro:', err)
        setErro('❌ Falha ao recuperar os dados desse compromisso no banco.')
      } finally {
        setCarregandoDados(false)
      }
    }

    carregarEstruturaEEvento()
  }, [eventoId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!chapterId || !titulo || !dataEvento || !horarioInicio) {
      setErro('⚠️ Preencha os campos obrigatórios (*).')
      return
    }

    setEnviando(true)
    setErro('')

    try {
      const { error } = await supabase
        .from('eventos')
        .update({
          chapter_id: chapterId,
          titulo,
          descricao: descricao || null,
          tipo_evento: tipoEvento,
          data_evento: dataEvento,
          horario_inicio: horarioInicio,
          ponto_encontro: pontoEncontro,
          rota_id: tipoEvento === 'Role' && rotaId ? rotaId : null,
          status: status
        })
        .eq('id', eventoId)

      if (error) throw error

      // 🔄 Redireciona rigorosamente de volta para a central gerencial de eventos
      router.push('/eventos')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setErro(`❌ Falha operacional na atualização: ${err.message || 'Erro ao gravar no banco.'}`)
    } finally {
      setEnviando(false)
    }
  }

  if (carregandoDados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-sm font-bold text-zinc-500 uppercase tracking-widest animate-pulse">
        ⚡ Sincronizando Ordem do Dia...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 flex justify-center items-center">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 md:p-8 backdrop-blur-md">
        
        <div className="border-b border-zinc-900 pb-4 mb-6">
          <h1 className="text-xl font-black font-mono text-white uppercase tracking-tight flex items-center gap-2">
            📝 Editar Missão / Registro de Agenda
          </h1>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">
            Alterar pautas, locais ou cronogramas de atividades REMC
          </p>
        </div>

        {erro && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs font-bold text-red-400 uppercase tracking-wide">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Chapter Organizador *</label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none cursor-pointer"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">
                    {c.nome} ({c.cidade}/{c.estado})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Status Atual</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none cursor-pointer font-bold"
              >
                <option value="Agendado" className="bg-zinc-900 text-zinc-400">📅 Agendado</option>
                <option value="Concluido" className="bg-zinc-900 text-emerald-400">✅ Concluído</option>
                <option value="Cancelado" className="bg-zinc-900 text-red-400">❌ Cancelado</option>
              </select>
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Tipo de Missão</label>
              <select
                value={tipoEvento}
                onChange={(e) => setTipoEvento(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none cursor-pointer"
              >
                <option value="Role" className="bg-zinc-900 text-white">⚡ Rolê (Estrada/Comboio)</option>
                <option value="Bate-Papo" className="bg-zinc-900 text-zinc-300">🍺 Bate-Papo (Resenha Local)</option>
                <option value="Confraria" className="bg-zinc-900 text-amber-400">🦅 Confraria (Alinhamento/Comando)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Título do Compromisso *</label>
              <input 
                type="text" 
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none"
                required
              />
            </div>
          </div>

          <div className="grid gap-4 grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Data da Missão *</label>
              <input 
                type="date" 
                value={dataEvento}
                onChange={(e) => setDataEvento(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none font-mono"
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Horário de Concentração *</label>
              <input 
                type="time" 
                value={horarioInicio}
                onChange={(e) => setHorarioInicio(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none font-mono"
                required
              />
            </div>
          </div>

          {tipoEvento === 'Role' && (
            <div className="animate-fadeIn">
              <label className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1.5">🛣️ Selecionar Rota Tática Reconhecida</label>
              <select
                value={rotaId}
                onChange={(e) => setRotaId(e.target.value)}
                className="w-full rounded-lg border border-purple-900/50 bg-purple-950/10 px-3 py-2 text-sm text-white focus:border-purple-500 outline-none cursor-pointer"
              >
                <option value="">Nenhuma rota vinculada</option>
                {rotas.map((r) => (
                  <option key={r.id} value={r.id} className="bg-zinc-900">
                    #{String(r.numero_cadastro).padStart(3, '0')} - {r.nome_rota} ({Number(r.km_total).toFixed(0)} KM)
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">📍 Ponto de Encontro / Localização</label>
            <input 
              type="text" 
              value={pontoEncontro}
              onChange={(e) => setPontoEncontro(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none"
              required
            />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Detalhamento / Pauta da Ordem do Dia</label>
            <textarea 
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none resize-none"
            />
          </div>

          <div className="border-t border-zinc-900 pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/eventos')}
              className="px-4 py-2 text-xs font-bold uppercase text-zinc-500 border border-zinc-900 rounded-lg bg-transparent hover:bg-zinc-900 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={enviando}
              className="px-6 py-2 text-xs font-black uppercase tracking-widest text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.08)]"
            >
              {enviando ? 'Atualizando...' : 'Salvar Alterações 🏁'}
            </button>
          </div>

        </form>
      </div>
    </main>
  )
}