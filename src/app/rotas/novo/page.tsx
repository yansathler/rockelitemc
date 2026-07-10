'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

// Interfaces para tipagem dos dados
interface Membro {
  id: string
  nome_completo: string
  foto_url: string | null
}

interface ElementoRota {
  id_temp: string // Controle local no array
  tipo: 'trecho' | 'parada'
  origem?: string
  destino?: string
  distancia_km?: number
  tempo_estimado?: string // formato HH:MM
  padrao_comboio?: 'Zig-zag' | 'Fila única' | 'Livre'
  local_nome?: string
  tempo_permanencia?: string // formato HH:MM
}

interface AlertaRota {
  id_temp: string
  tipo_alerta: 'perigo' | 'atencao' | 'informativo'
  descricao: string
}

export default function CadastroRota() {
  const router = useRouter()
  const supabase = createClient()

  // Controle de Abas (Wizard): 1 = Trajeto, 2 = Briefing & Escala, 3 = Padrões & Alertas
  const [passoAtivo, setPassoAtivo] = useState(1)
  const [carregando, setCarregando] = useState(false)
  const [membros, setMembros] = useState<Membro[]>([])

  // --- ESTADOS DO FORMULÁRIO ---
  // Aba 1: Dados Básicos e Itinerário
  const [nomeRota, setNomeRota] = useState('')
  const [itinerarioResumido, setItinerarioResumido] = useState('')
  const [elementos, setElementos] = useState<ElementoRota[]>([])

  // Aba 2: Briefing e Escala do Comboio
  const [comandoInstrucional, setComandoInstrucional] = useState('')
  const [comandoOperacional, setComandoOperacional] = useState('')
  
  const [batedorId, setBatedorId] = useState('')
  const [roadCaptainId, setRoadCaptainId] = useState('')
  const [suporteRcId, setSuporteRcId] = useState('')
  const [anjoId, setAnjoId] = useState('')
  const [cinegrafistaId, setCinegrafistaId] = useState('')
  const [suporteSweepId, setSuporteSweepId] = useState('')
  const [sweepId, setSweepId] = useState('')
  const [balizadorId, setBalizadorId] = useState('')
  const [balizadorVeiculo, setBalizadorVeiculo] = useState('moto')

  // Aba 3: Alertas de Segurança
  const [alertas, setAlertas] = useState<AlertaRota[]>([])

  // --- MÉTRICAS CALCULADAS EM TEMPO REAL ---
  const [kmTotal, setKmTotal] = useState(0)
  const [tempoRodagemMinutos, setTempoRodagemMinutos] = useState(0)
  const [qtdParadas, setQtdParadas] = useState(0)
  const [tempoParadasMinutos, setTempoParadasMinutos] = useState(0)

  // Carrega lista de membros ativos para as escalas
  useEffect(() => {
    async function obterMembros() {
      const { data, error } = await supabase
        .from('membros')
        .select('id, nome_completo, foto_url')
        .eq('status_ativo', true)
        .order('nome_completo')
      
      if (!error && data) setMembros(data)
    }
    obterMembros()
  }, [])

  // Recalcula totais automaticamente sempre que os elementos mudam
  useEffect(() => {
    let km = 0
    let minRodagem = 0
    let paradasCount = 0
    let minParadas = 0

    elementos.forEach(el => {
      if (el.tipo === 'trecho') {
        km += Number(el.distancia_km || 0)
        if (el.tempo_estimado) {
          const [h, m] = el.tempo_estimado.split(':').map(Number)
          minRodagem += (h * 60) + (m || 0)
        }
      } else {
        paradasCount++
        if (el.tempo_permanencia) {
          const [h, m] = el.tempo_permanencia.split(':').map(Number)
          minParadas += (h * 60) + (m || 0)
        }
      }
    })

    setKmTotal(km)
    setTempoRodagemMinutos(minRodagem)
    setQtdParadas(paradasCount)
    setTempoParadasMinutos(minParadas)
  }, [elementos])

  // Funções Auxiliares de Formatação de Tempo
  const converterMinutosParaTexto = (totalMinutos: number) => {
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${String(horas).padStart(2, '0')}h${String(minutos).padStart(2, '0')}m`
  }

  // --- MANIPULAÇÃO DINÂMICA DE TRAJETOS E PARADAS ---
  const adicionarTrecho = () => {
    const novo: ElementoRota = {
      id_temp: Math.random().toString(),
      tipo: 'trecho',
      origem: '',
      destino: '',
      distancia_km: 0,
      tempo_estimado: '00:00',
      padrao_comboio: 'Zig-zag'
    }
    setElementos([...elementos, novo])
  }

  const adicionarParada = () => {
    const novo: ElementoRota = {
      id_temp: Math.random().toString(),
      tipo: 'parada',
      local_nome: '',
      tempo_permanencia: '00:00'
    }
    setElementos([...elementos, novo])
  }

  const atualizarElemento = (id_temp: string, camposAlterados: Partial<ElementoRota>) => {
    setElementos(elementos.map(el => el.id_temp === id_temp ? { ...el, ...camposAlterados } : el))
  }

  const removerElemento = (id_temp: string) => {
    setElementos(elementos.filter(el => el.id_temp !== id_temp))
  }

  // --- MANIPULAÇÃO DINÂMICA DE ALERTAS ---
  const adicionarAlerta = () => {
    const novo: AlertaRota = {
      id_temp: Math.random().toString(),
      tipo_alerta: 'perigo',
      descricao: ''
    }
    setAlertas([...alertas, novo])
  }

  const atualizarAlerta = (id_temp: string, descricao: string, tipo_alerta?: 'perigo' | 'atencao' | 'informativo') => {
    setAlertas(alertas.map(al => al.id_temp === id_temp ? { ...al, descricao, ...(tipo_alerta && { tipo_alerta }) } : al))
  }

  const removerAlerta = (id_temp: string) => {
    setAlertas(alertas.filter(al => al.id_temp !== id_temp))
  }

  // --- ENVIO DO FORMULÁRIO COMPLETO ---
  const handleSalvarRota = async () => {
    if (!nomeRota) return alert('Por favor, defina o nome da rota.')
    setCarregando(true)

    try {
      const tipoRoleCalculado = kmTotal <= 150 ? 'Curto' : 'Longo'

      // 1. Insere o cabeçalho na tabela 'rotas'
      const { data: novaRota, error: erroRota } = await supabase
        .from('rotas')
        .insert([{
          nome_rota: nomeRota,
          itinerario_resumido: itinerarioResumido,
          tipo_role: tipoRoleCalculado,
          km_total: kmTotal,
          tempo_total_rodagem: converterMinutosParaTexto(tempoRodagemMinutos),
          qtd_total_paradas: qtdParadas,
          tempo_total_paradas: converterMinutosParaTexto(tempoParadasMinutos),
          tempo_total_geral: converterMinutosParaTexto(tempoRodagemMinutos + tempoParadasMinutos),
          comando_instrucional: comandoInstrucional,
          comando_operacional: comandoOperacional,
          batedor_id: batedorId || null,
          road_captain_id: roadCaptainId || null,
          suporte_rc_id: suporteRcId || null,
          anjo_id: anjoId || null,
          cinegrafista_id: cinegrafistaId || null,
          suporte_sweep_id: suporteSweepId || null,
          sweep_id: sweepId || null,
          balizador_id: balizadorId || null,
          balizador_veiculo: balizadorVeiculo
        }])
        .select()
        .single()

      if (erroRota) throw erroRota

      // 2. Insere os elementos secundários (Trechos e Paradas) sequentially
      if (elementos.length > 0) {
        const elementosParaInserir = elementos.map((el, index) => ({
          rota_id: novaRota.id,
          ordem: index + 1,
          tipo: el.tipo,
          origem: el.origem || null,
          destino: el.destino || null,
          distancia_km: el.distancia_km || 0,
          tempo_estimado: el.tempo_estimado || null,
          padrao_comboio: el.padrao_comboio || 'Zig-zag',
          local_nome: el.local_nome || null,
          tempo_permanencia: el.tempo_permanencia || null
        }))

        const { error: erroElementos } = await supabase
          .from('rota_elementos')
          .insert(elementosParaInserir)

        if (erroElementos) throw erroElementos
      }

      // 3. Insere os Alertas de segurança
      if (alertas.length > 0) {
        const alertasParaInserir = alertas.map((al, index) => ({
          rota_id: novaRota.id,
          tipo_alerta: al.tipo_alerta,
          descricao: al.descricao,
          ordem: index + 1
        }))

        const { error: erroAlertas } = await supabase
          .from('rota_alertas')
          .insert(alertasParaInserir)

        if (erroAlertas) throw erroAlertas
      }

      alert('⚡ Missão Cumprida! Rota tática cadastrada com sucesso!')
      router.push('/rotas')

    } catch (err) {
      console.error('Erro ao salvar plano de rota:', err)
      alert('Falha crítica ao enviar plano de rota para a sede.')
    } finally {
      setCarregando(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* Título da Página */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">Reconhecimento de Rota Tática</h1>
        <p className="text-sm text-zinc-400">Planejamento operacional e logístico de estrada</p>
      </div>

      {/* Grid Superior: Mapeamento Dinâmico de Indicadores (Métricas Inteligentes) */}
      <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Tipo de Rolê</span>
          <span className={`mt-1 inline-block text-xs font-black uppercase px-2 py-0.5 rounded ${kmTotal <= 150 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-red-950 text-red-400 border border-red-900'}`}>
            {kmTotal <= 150 ? '🟢 Curto' : '🔴 Longo'}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">KM Total</span>
          <p className="text-xl font-black text-white mt-0.5">{kmTotal.toFixed(1)} km</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Tempo de Rodagem</span>
          <p className="text-xl font-black text-blue-400 mt-0.5">{converterMinutosParaTexto(tempoRodagemMinutos)}</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Total de Paradas</span>
          <p className="text-xl font-black text-orange-400 mt-0.5">{qtdParadas} postos</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4 col-span-2 lg:col-span-1">
          <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider block">Tempo Total Geral</span>
          <p className="text-xl font-black text-emerald-400 mt-0.5">{converterMinutosParaTexto(tempoRodagemMinutos + tempoParadasMinutos)}</p>
        </div>
      </div>

      {/* Navegador das Abas (Wizard Header) */}
      <div className="mb-8 flex border-b border-zinc-900 text-xs font-bold uppercase tracking-wider">
        <button onClick={() => setPassoAtivo(1)} className={`pb-3 pr-6 border-b-2 transition-all ${passoAtivo === 1 ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          01. Trajeto & Logística
        </button>
        <button onClick={() => setPassoAtivo(2)} className={`pb-3 px-6 border-b-2 transition-all ${passoAtivo === 2 ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          02. Briefing & Escala
        </button>
        <button onClick={() => setPassoAtivo(3)} className={`pb-3 px-6 border-b-2 transition-all ${passoAtivo === 3 ? 'border-blue-500 text-white' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>
          03. Padrões & Alertas
        </button>
      </div>

      {/* CONTEÚDO DO WIZARD */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 mb-8">
        
        {/* --- PASSO 1: TRAJETO E LOGÍSTICA --- */}
        {passoAtivo === 1 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="md:col-span-1">
                <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">Nome Identificador da Rota</label>
                <input type="text" placeholder="Ex: Rota dos Ventos - Tiradentes" value={nomeRota} onChange={e => setNomeRota(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-zinc-700" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">Itinerário Resumido (Cidades-chave)</label>
                <input type="text" placeholder="Ex: São Paulo -> Atibaia -> Extrema -> Cambuí -> Pouso Alegre" value={itinerarioResumido} onChange={e => setItinerarioResumido(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs font-semibold text-white focus:outline-none focus:border-zinc-700" />
              </div>
            </div>

            <div className="border-t border-zinc-900 pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">Cronograma Sequencial da Estrada</h3>
                  <p className="text-[11px] text-zinc-500">Adicione os trechos rodados e pontos de parada na ordem exata em que acontecerão</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={adicionarTrecho} className="bg-blue-950/40 hover:bg-blue-900/40 text-blue-400 border border-blue-900 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider">➕ Trecho</button>
                  <button type="button" onClick={adicionarParada} className="bg-orange-950/40 hover:bg-orange-900/40 text-orange-400 border border-orange-900 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider">➕ Parada</button>
                </div>
              </div>

              {/* Lista Dinâmica de Elementos */}
              <div className="space-y-3">
                {elementos.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-6 text-center border border-dashed border-zinc-900 rounded-xl">Nenhum trecho ou parada adicionado ao itinerário operacional.</p>
                ) : (
                  elementos.map((el, idx) => (
                    <div key={el.id_temp} className={`flex flex-col md:flex-row gap-3 items-end md:items-center justify-between p-4 rounded-xl border ${el.tipo === 'trecho' ? 'border-zinc-800 bg-zinc-950/40' : 'border-orange-900/30 bg-orange-950/5'}`}>
                      <div className="text-[10px] font-mono font-black uppercase text-zinc-600 self-start md:self-auto pt-1">
                        #{String(idx + 1).padStart(2, '0')}
                      </div>

                      {el.tipo === 'trecho' ? (
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-4 flex-1">
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-1">ORIGEM TRECHO</span>
                            <input type="text" placeholder="Origem" value={el.origem} onChange={e => atualizarElemento(el.id_temp, { origem: e.target.value })} className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1 text-xs text-white" />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-1">DESTINO TRECHO</span>
                            <input type="text" placeholder="Destino" value={el.destino} onChange={e => atualizarElemento(el.id_temp, { destino: e.target.value })} className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1 text-xs text-white" />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-1">QUILOMETRAGEM (KM)</span>
                            <input type="number" placeholder="KM" value={el.distancia_km || ''} onChange={e => atualizarElemento(el.id_temp, { distancia_km: Number(e.target.value) })} className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1 text-xs text-white" />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-zinc-500 block mb-1">TEMPO DE RODAGEM</span>
                            <input type="time" value={el.tempo_estimado} onChange={e => atualizarElemento(el.id_temp, { tempo_estimado: e.target.value })} className="w-full bg-zinc-950 border border-zinc-900 rounded px-2.5 py-1 text-xs text-white" />
                          </div>
                        </div>
                      ) : (
                        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 flex-1">
                          <div>
                            <span className="text-[9px] font-bold text-orange-500 block mb-1">☕ LOCAL / POSTO DE PARADA</span>
                            <input type="text" placeholder="Nome do Posto, Ponto de Encontro..." value={el.local_nome} onChange={e => atualizarElemento(el.id_temp, { local_nome: e.target.value })} className="w-full bg-zinc-950 border border-orange-900/40 rounded px-2.5 py-1 text-xs text-white" />
                          </div>
                          <div>
                            <span className="text-[9px] font-bold text-orange-500 block mb-1">TEMPO DE PERMANÊNCIA</span>
                            <input type="time" value={el.tempo_permanencia} onChange={e => atualizarElemento(el.id_temp, { tempo_permanencia: e.target.value })} className="w-full bg-zinc-950 border border-orange-900/40 rounded px-2.5 py-1 text-xs text-white" />
                          </div>
                        </div>
                      )}

                      <button type="button" onClick={() => removerElemento(el.id_temp)} className="text-xs font-bold text-red-500 bg-red-950/20 hover:bg-red-950/60 border border-red-900/30 px-2 py-1 rounded">
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* --- PASSO 2: BRIEFING E ESCALA DO COMBOIO --- */}
        {passoAtivo === 2 && (
          <div className="space-y-6">
            {/* Ordens e Comandos do Briefing */}
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">Comando Instrucional (Diretrizes Gerais)</label>
                <textarea rows={4} placeholder="Digite as ordens de conduta, documentações e regras gerais da viagem..." value={comandoInstrucional} onChange={e => setComandoInstrucional(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none" />
              </div>
              <div>
                <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">Comando Operacional (Estratégias de Pista)</label>
                <textarea rows={4} placeholder="Instruções para ultrapassagens, abastecimentos em bloco e comboio..." value={comandoOperacional} onChange={e => setComandoOperacional(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-zinc-700 resize-none" />
              </div>
            </div>

            {/* Escala do Comboio Operacional (Filtro conectado direto à base de membros ativos) */}
            <div className="border-t border-zinc-900 pt-6">
              <h3 className="text-sm font-bold text-white mb-1">Comboio Operacional</h3>
              <p className="text-[11px] text-zinc-500 mb-4">Selecione os oficiais encarregados da missão na estrada</p>

              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">ROAD CAPTAIN</span>
                  <select value={roadCaptainId} onChange={e => setRoadCaptainId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">SUPORTE ROAD CAPTAIN</span>
                  <select value={suporteRcId} onChange={e => setSuporteRcId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">BATEDOR</span>
                  <select value={batedorId} onChange={e => setBatedorId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">ANJO (RETAGUARDA/MÉDICO)</span>
                  <select value={anjoId} onChange={e => setAnjoId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">SWEEP (FERROLHO)</span>
                  <select value={sweepId} onChange={e => setSweepId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">SUPORTE DE SWEEP</span>
                  <select value={suporteSweepId} onChange={e => setSuporteSweepId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-zinc-500 block mb-1">CINEGRAFISTA / MIDIA</span>
                  <select value={cinegrafistaId} onChange={e => setCinegrafistaId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                    <option value="">Não Definido</option>
                    {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 block mb-1">BALIZADOR</span>
                    <select value={balizadorId} onChange={e => setBalizadorId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                      <option value="">Não Definido</option>
                      {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                    </select>
                  </div>
                  <div>
                    <span className="text-[10px] font-bold text-zinc-500 block mb-1">VEÍCULO</span>
                    <select value={balizadorVeiculo} onChange={e => setBalizadorVeiculo(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs font-semibold text-white">
                      <option value="moto">Moto</option>
                      <option value="carro">Carro</option>
                      <option value="triciclo">Triciclo</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* --- PASSO 3: PADRÕES OPERACIONAIS E ALERTAS DE SEGURANÇA --- */}
        {passoAtivo === 3 && (
          <div className="space-y-6">
            {/* Formações Dinâmicas mapeando os trechos inseridos no Passo 1 */}
            <div>
              <h3 className="text-sm font-bold text-white mb-1">Padrões de Formação do Comboio</h3>
              <p className="text-[11px] text-zinc-500 mb-4">Escolha o tipo de posicionamento tático exigido para cada trecho cadastrado no passo 1</p>

              <div className="space-y-2">
                {elementos.filter(e => e.tipo === 'trecho').length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-4 text-center border border-zinc-900 rounded-lg">Retorne ao Passo 01 e configure trechos de asfalto para ver os padrões.</p>
                ) : (
                  elementos.filter(e => e.tipo === 'trecho').map((el, index) => (
                    <div key={el.id_temp} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-3 rounded-lg bg-zinc-950/60 border border-zinc-900 text-xs">
                      <span className="font-bold text-zinc-300">Trecho #{index + 1}: <span className="text-zinc-500 font-medium">({el.origem || '...'} → {el.destino || '...'})</span></span>
                      
                      <div className="flex gap-4 mt-2 sm:mt-0 font-semibold">
                        {['Zig-zag', 'Fila única', 'Livre'].map((padrao) => (
                          <label key={padrao} className="flex items-center gap-1.5 cursor-pointer text-zinc-400 hover:text-white">
                            <input type="radio" name={`padrao-${el.id_temp}`} checked={el.padrao_comboio === padrao} onChange={() => atualizarElemento(el.id_temp, { padrao_comboio: padrao as any })} className="accent-blue-500" />
                            {padrao}
                          </label>
                        ))}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Bloco de Alertas de Segurança (Representação das Sirenes Vermelhas) */}
            <div className="border-t border-zinc-900 pt-6">
              <div className="flex justify-between items-center mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white">🚨 Orientações e Avisos de Risco</h3>
                  <p className="text-[11px] text-zinc-500">Mapeie trechos perigosos, curvas críticas ou orientações de segurança para membros e visitantes</p>
                </div>
                <button type="button" onClick={adicionarAlerta} className="bg-red-950/40 hover:bg-red-900/40 text-red-400 border border-red-900 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider">➕ Adicionar Aviso</button>
              </div>

              <div className="space-y-3">
                {alertas.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-6 text-center border border-dashed border-zinc-900 rounded-xl">Nenhum aviso ou ponto crítico registrado para esta rota.</p>
                ) : (
                  alertas.map((al, idx) => (
                    <div key={al.id_temp} className={`flex items-start gap-3 p-4 rounded-xl border ${al.tipo_alerta === 'perigo' ? 'border-red-950 bg-red-950/5' : al.tipo_alerta === 'atencao' ? 'border-orange-950 bg-orange-950/5' : 'border-zinc-800 bg-zinc-950/40'}`}>
                      
                      <div className="flex flex-col gap-1.5">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase block">Gravidade</span>
                        <select value={al.tipo_alerta} onChange={e => atualizarAlerta(al.id_temp, al.descricao, e.target.value as any)} className="bg-zinc-950 border border-zinc-800 text-[11px] font-bold rounded p-1 text-white">
                          <option value="perigo">🚨 Crítico (Sirene)</option>
                          <option value="atencao">⚠️ Atenção</option>
                          <option value="informativo">ℹ️ Informativo</option>
                        </select>
                      </div>

                      <div className="flex-1">
                        <span className="text-[9px] font-bold text-zinc-500 uppercase block mb-1">Descrição do Alerta Operacional</span>
                        <input type="text" placeholder="Ex: KM 84 da BR-116 com buraco profundo logo após a curva fechada à direita." value={al.descricao} onChange={e => atualizarAlerta(al.id_temp, e.target.value)} className="w-full bg-zinc-950 border border-zinc-900 rounded px-3 py-1 text-xs text-white" />
                      </div>

                      <button type="button" onClick={() => removerAlerta(al.id_temp)} className="text-xs font-bold text-red-500 mt-5 bg-red-950/20 hover:bg-red-950/60 border border-red-900/30 px-2 py-1 rounded">
                        ✕
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

      </div>

      {/* Navegador Inferior de Ações (Avançar, Voltar, Salvar) */}
      <div className="flex justify-between items-center border-t border-zinc-900 pt-6">
        <button type="button" onClick={() => passoAtivo > 1 ? setPassoAtivo(passoAtivo - 1) : router.push('/rotas')} className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white uppercase tracking-wider transition-colors">
          {passoAtivo === 1 ? '← Cancelar' : '← Voltar'}
        </button>

        {passoAtivo < 3 ? (
          <button type="button" onClick={() => setPassoAtivo(passoAtivo + 1)} className="rounded bg-blue-600 hover:bg-blue-500 px-5 py-2 text-xs font-bold text-white uppercase tracking-wider transition-colors">
            Próximo Passo →
          </button>
        ) : (
          <button type="button" onClick={handleSalvarRota} disabled={carregando} className="rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2 text-xs font-black text-white uppercase tracking-widest transition-colors">
            {carregando ? 'Gravando Missão...' : '⚡ Lançar Rota Tática'}
          </button>
        )}
      </div>

    </main>
  )
}