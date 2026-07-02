'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase' // ajuste o caminho se necessário

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

export default function NovoEvento() {
  const router = useRouter()
  const supabase = createClient()

  // Estados do Formulário
  const [chapterId, setChapterId] = useState('')
  const [titulo, setTitulo] = useState('')
  const [descricao, setDescricao] = useState('')
  const [tipoEvento, setTipoEvento] = useState('Role')
  const [dataEvento, setDataEvento] = useState('')
  const [horarioInicio, setHorarioInicio] = useState('')
  const [pontoEncontro, setPontoEncontro] = useState('')
  const [rotaId, setRotaId] = useState('') // Para quando for Rolê

  // Estados de Carga
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [rotas, setRotas] = useState<Rota[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // 🏁 1. Carga Inicial de Chapters Ativos e Rotas Táticas
  useEffect(() => {
    async function carregarDados() {
      try {
        // Busca os chapters
        const { data: dataChapters } = await supabase
          .from('chapters')
          .select('id, nome, cidade, estado')
          .eq('status_operacional', 'Ativo')
          .order('nome', { ascending: true })

        // Busca as rotas mapeadas
        const { data: dataRotas } = await supabase
          .from('rotas')
          .select('id, numero_cadastro, nome_rota, km_total')
          .order('created_at', { ascending: false })

        if (dataChapters) {
          setChapters(dataChapters)
          if (dataChapters.length > 0) setChapterId(dataChapters[0].id)
        }
        if (dataRotas) {
          setRotas(dataRotas)
        }
      } catch (err) {
        console.error('Erro ao buscar dados na base:', err)
      } finally {
        setCarregandoDados(false)
      }
    }
    carregarDados()
  }, [])

  // 🔄 2. Efeito dinâmico: Modifica o comportamento do Ponto de Encontro baseado nas regras táticas
  useEffect(() => {
    if (tipoEvento === 'Confraria') {
      // Pega o nome do primeiro chapter ativo se existir
      if (chapters.length > 0) {
        const principal = chapters.find(c => c.id === chapterId) || chapters[0]
        setPontoEncontro(principal.nome)
      }
    } else if (tipoEvento === 'Bate-Papo') {
      if (chapters.length > 0) {
        const principal = chapters.find(c => c.id === chapterId) || chapters[0]
        setPontoEncontro(principal.nome) // Sugestão em campo livre
      }
    } else {
      setPontoEncontro('') // Rolê vem limpo
      setRotaId('') // Reseta a rota inicialmente
    }
  }, [tipoEvento, chapterId, chapters])

  // 💾 3. Submit e Validação
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!chapterId || !titulo || !dataEvento || !horarioInicio) {
      setErro('⚠️ Preencha os campos obrigatórios (*).')
      return
    }

    if (tipoEvento === 'Role' && !pontoEncontro.trim()) {
      setErro('⚠️ Para lançar um Rolê, defina o ponto de encontro do comboio.');
      return
    }

    setEnviando(true)
    setErro('')

    try {
      const membroId = localStorage.getItem('@rockelite:membro_id')

      const { error } = await supabase
        .from('eventos')
        .insert([
          {
            chapter_id: chapterId,
            titulo,
            descricao: descricao || null,
            tipo_evento: tipoEvento,
            data_evento: dataEvento,
            horario_inicio: horarioInicio,
            ponto_encontro: pontoEncontro,
            rota_id: tipoEvento === 'Role' && rotaId ? rotaId : null, // Guarda se for rolê
            status: 'Agendado',
            criado_por: membroId || null
          }
        ])

      if (error) throw error

      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setErro(`❌ Falha operacional: ${err.message || 'Erro ao gravar no banco.'}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 flex justify-center items-center">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 md:p-8 backdrop-blur-md">
        
        {/* Cabeçalho */}
        <div className="border-b border-zinc-900 pb-4 mb-6">
          <h1 className="text-xl font-black font-mono text-white uppercase tracking-tight flex items-center gap-2">
            📅 Agendar Missão / Evento REMC
          </h1>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">
            Lançar rolês, confrarias e bate-papos conforme regras de comando
          </p>
        </div>

        {erro && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs font-bold text-red-400 uppercase tracking-wide">
            {erro}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Âncora Territorial & Tipo de Evento */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Chapter Organizador *</label>
              <select
                value={chapterId}
                onChange={(e) => setChapterId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none cursor-pointer"
                disabled={carregandoDados}
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.id} className="bg-zinc-900">
                    {c.nome} ({c.cidade}/{c.estado})
                  </option>
                ))}
              </select>
            </div>

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
          </div>

          {/* Título do Compromisso */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Título do Compromisso *</label>
            <input 
              type="text" 
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder={tipoEvento === 'Role' ? 'Ex: Comboio Destino Tiradentes MG' : 'Ex: Reunião de Pauta e Alinhamento'}
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 outline-none"
              required
            />
          </div>

          {/* Cronograma (Data e Hora) */}
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

          {/* ⚡ CAMPO EXCLUSIVO DE ROTA SE FOR ROLÊ */}
          {tipoEvento === 'Role' && (
            <div className="animate-fadeIn">
              <label className="text-[10px] font-bold uppercase tracking-wider text-purple-400 block mb-1.5">🛣️ Selecionar Rota Tática Reconhecida</label>
              <select
                value={rotaId}
                onChange={(e) => setRotaId(e.target.value)}
                className="w-full rounded-lg border border-purple-900/50 bg-purple-950/10 px-3 py-2 text-sm text-white focus:border-purple-500 outline-none cursor-pointer"
              >
                <option value="" className="bg-zinc-900 text-zinc-500">Definir rota em campo aberto / nenhuma cadastrada</option>
                {rotas.map((r) => (
                  <option key={r.id} value={r.id} className="bg-zinc-900">
                    #{String(r.numero_cadastro).padStart(3, '0')} - {r.nome_rota} ({Number(r.km_total).toFixed(0)} KM)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* 📍 COMPORTAMENTO DINÂMICO DO PONTO DE ENCONTRO */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">
              📍 Ponto de Encontro / Localização {tipoEvento === 'Role' && '*'}
            </label>

            {tipoEvento === 'Confraria' ? (
              /* Confraria: Apenas Sedes via Select */
              <select
                value={pontoEncontro}
                onChange={(e) => setPontoEncontro(e.target.value)}
                className="w-full rounded-lg border border-amber-900/50 bg-amber-950/10 px-3 py-2 text-sm text-white outline-none cursor-pointer"
              >
                {chapters.map((c) => (
                  <option key={c.id} value={c.nome} className="bg-zinc-900">
                    Sede Oficial: {c.nome}
                  </option>
                ))}
              </select>
            ) : (
              /* Bate-Papo (Sugere sede mas é editável) e Rolê (Em branco) */
              <input 
                type="text" 
                value={pontoEncontro}
                onChange={(e) => setPontoEncontro(e.target.value)}
                placeholder={tipoEvento === 'Role' ? 'Ex: Posto BR Trevo da Entrada Principal - KM 4' : 'Digite o local ou mantenha a sede sugerida'}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 outline-none"
                required={tipoEvento === 'Role'}
              />
            )}
            
            {tipoEvento === 'Confraria' && (
              <p className="text-[9px] text-amber-500 uppercase tracking-wide mt-1">🔒 Diretriz: Confrarias são restritas e acontecem obrigatoriamente em uma Sede Oficial.</p>
            )}
          </div>

          {/* Descrição / Pautas */}
          <div>
            <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Detalhamento / Pauta da Ordem do Dia (Opcional)</label>
            <textarea 
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Inserir pauta da reunião, cronograma do comboio ou avisos aos irmãos..."
              className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 outline-none resize-none"
            />
          </div>

          {/* Botões de Comando */}
          <div className="border-t border-zinc-900 pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-xs font-bold uppercase text-zinc-500 border border-zinc-900 rounded-lg bg-transparent hover:bg-zinc-900 transition-colors"
            >
              Abortar
            </button>
            <button
              type="submit"
              disabled={enviando || carregandoDados}
              className="px-6 py-2 text-xs font-black uppercase tracking-widest text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.08)]"
            >
              {enviando ? 'Lançando Ordem...' : 'Gravar na Agenda 🏁'}
            </button>
          </div>

        </form>
      </div>
    </main>
  )
}