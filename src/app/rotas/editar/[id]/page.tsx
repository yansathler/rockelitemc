'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'

interface Membro {
  id: string
  nome_completo: string
}

interface ElementoRota {
  id_temp?: string
  id?: string // Se já veio do banco
  tipo: 'trecho' | 'parada'
  origem?: string
  destino?: string
  distancia_km?: number
  tempo_estimado?: string
  padrao_comboio?: 'Zig-zag' | 'Fila única' | 'Livre'
  local_nome?: string
  tempo_permanencia?: string
}

interface AlertaRota {
  id_temp?: string
  id?: string // Se já veio do banco
  tipo_alerta: 'perigo' | 'atencao' | 'informativo'
  descricao: string
}

export default function EditarRota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [passoAtivo, setPassoAtivo] = useState(1)
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [membros, setMembros] = useState<Membro[]>([])

  // --- ESTADOS DO FORMULÁRIO ---
  const [nomeRota, setNomeRota] = useState('')
  const [itinerarioResumido, setItinerarioResumido] = useState('')
  const [elementos, setElementos] = useState<ElementoRota[]>([])
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

  const [alertas, setAlertas] = useState<AlertaRota[]>([])

  // Métricas Calculadas
  const [kmTotal, setKmTotal] = useState(0)
  const [tempoRodagemMinutos, setTempoRodagemMinutos] = useState(0)
  const [qtdParadas, setQtdParadas] = useState(0)
  const [tempoParadasMinutos, setTempoParadasMinutos] = useState(0)

  // 1. Carrega Membros e os dados originais da rota
  useEffect(() => {
    async function inicializarTela() {
      // Puxa membros ativos
      const { data: dataMembros } = await supabase
        .from('membros')
        .select('id, nome_completo')
        .eq('status_ativo', true)
        .order('nome_completo')
      if (dataMembros) setMembros(dataMembros)

      try {
        // Puxa cabeçalho da rota
        const { data: dataRota, error: errRota } = await supabase
          .from('rotas')
          .select('*')
          .eq('id', id)
          .single()

        if (errRota) throw errRota

        setNomeRota(dataRota.nome_rota)
        setItinerarioResumido(dataRota.itinerario_resumido || '')
        setComandoInstrucional(dataRota.comando_instrucional || '')
        setComandoOperacional(dataRota.comando_operacional || '')
        setBatedorId(dataRota.batedor_id || '')
        setRoadCaptainId(dataRota.road_captain_id || '')
        setSuporteRcId(dataRota.suporte_rc_id || '')
        setAnjoId(dataRota.anjo_id || '')
        setCinegrafistaId(dataRota.cinegrafista_id || '')
        setSuporteSweepId(dataRota.suporte_sweep_id || '')
        setSweepId(dataRota.sweep_id || '')
        setBalizadorId(dataRota.balizador_id || '')
        setBalizadorVeiculo(dataRota.balizador_veiculo || 'moto')

        // Puxa Elementos existentes
        const { data: dataElementos } = await supabase
          .from('rota_elementos')
          .select('*')
          .eq('rota_id', id)
          .order('ordem', { ascending: true })
        
        if (dataElementos) {
          setElementos(dataElementos.map(el => ({ ...el, id_temp: Math.random().toString() })))
        }

        // Puxa Alertas existentes
        const { data: dataAlertas } = await supabase
          .from('rota_alertas')
          .select('*')
          .eq('rota_id', id)
          .order('ordem', { ascending: true })
        
        if (dataAlertas) {
          setAlertas(dataAlertas.map(al => ({ ...al, id_temp: Math.random().toString() })))
        }

      } catch (err) {
        console.error(err)
        alert('Erro ao carregar dados para edição.')
      } finally {
        setCarregando(false)
      }
    }

    inicializarTela()
  }, [id])

  // Recalcula totais automaticamente
  useEffect(() => {
    let km = 0, minRodagem = 0, paradasCount = 0, minParadas = 0
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

  const converterMinutosParaTexto = (totalMinutos: number) => {
    const horas = Math.floor(totalMinutos / 60)
    const minutos = totalMinutos % 60
    return `${String(horas).padStart(2, '0')}h${String(minutos).padStart(2, '0')}m`
  }

  // --- FUNÇÕES DINÂMICAS DO ITINERÁRIO & ALERTAS ---
  const adicionarTrecho = () => {
    setElementos([...elementos, { id_temp: Math.random().toString(), tipo: 'trecho', origem: '', destino: '', distancia_km: 0, tempo_estimado: '00:00', padrao_comboio: 'Zig-zag' }])
  }
  const adicionarParada = () => {
    setElementos([...elementos, { id_temp: Math.random().toString(), tipo: 'parada', local_nome: '', tempo_permanencia: '00:00' }])
  }
  const atualizarElemento = (id_temp: string, camposAlterados: Partial<ElementoRota>) => {
    setElementos(elementos.map(el => el.id_temp === id_temp ? { ...el, ...camposAlterados } : el))
  }
  const removerElemento = (id_temp: string) => {
    setElementos(elementos.filter(el => el.id_temp !== id_temp))
  }
  const adicionarAlerta = () => {
    setAlertas([...alertas, { id_temp: Math.random().toString(), tipo_alerta: 'perigo', descricao: '' }])
  }
  const atualizarAlerta = (id_temp: string, descricao: string, tipo_alerta?: 'perigo' | 'atencao' | 'informativo') => {
    setAlertas(alertas.map(al => al.id_temp === id_temp ? { ...al, descricao, ...(tipo_alerta && { tipo_alerta }) } : al))
  }
  const removerAlerta = (id_temp: string) => {
    setAlertas(alertas.filter(al => al.id_temp !== id_temp))
  }

  // --- SALVAR ATUALIZAÇÃO RE-GRAVANDO DEPENDÊNCIAS ---
  const handleAtualizarRota = async () => {
    if (!nomeRota) return alert('Defina o nome da rota.')
    setSalvando(true)

    try {
      const tipoRoleCalculado = kmTotal <= 150 ? 'Curto' : 'Longo'

      // 1. Dá UPDATE no cabeçalho
      const { error: errUpdate } = await supabase
        .from('rotas')
        .update({
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
        })
        .eq('id', id)

      if (errUpdate) throw errUpdate

      // Estratégia tática para tabelas dependentes: Limpa o antigo e injeta o novo
      // 2. Limpa e reinjeta Elementos
      await supabase.from('rota_elementos').delete().eq('rota_id', id)
      if (elementos.length > 0) {
        const novosElementos = elementos.map((el, idx) => ({
          rota_id: id,
          ordem: idx + 1,
          tipo: el.tipo,
          origem: el.origem || null,
          destino: el.destino || null,
          distancia_km: el.distancia_km || 0,
          tempo_estimado: el.tempo_estimado || null,
          padrao_comboio: el.padrao_comboio || 'Zig-zag',
          local_nome: el.local_nome || null,
          tempo_permanencia: el.tempo_permanencia || null
        }))
        await supabase.from('rota_elementos').insert(novosElementos)
      }

      // 3. Limpa e reinjeta Alertas
      await supabase.from('rota_alertas').delete().eq('rota_id', id)
      if (alertas.length > 0) {
        const novosAlertas = alertas.map((al, idx) => ({
          rota_id: id,
          tipo_alerta: al.tipo_alerta,
          descricao: al.descricao,
          ordem: idx + 1
        }))
        await supabase.from('rota_alertas').insert(novosAlertas)
      }

      alert('⚡ Plano de Rota Tática Atualizado com Sucesso!')
      router.push(`/rotas/${id}`)

    } catch (err) {
      console.error(err)
      alert('Erro ao atualizar plano na sede.')
    } finally {
      setSalvando(false)
    }
  }

  if (carregando) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-xs font-bold text-zinc-500 uppercase tracking-widest">Puxando Ficha do Arquivo...</div>
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* Título */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-white">⚙️ Ajuste de Rota Tática</h1>
        <p className="text-sm text-zinc-400">Modificando ordens, contingente e perímetros da rota ativa</p>
      </div>

      {/* Grid de Métricas Reativas */}
      <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-5">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tipo</span>
          <span className={`mt-1 inline-block text-xs font-black uppercase px-2 py-0.5 rounded ${kmTotal <= 150 ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-red-950 text-red-400 border border-red-900'}`}>
            {kmTotal <= 150 ? '🟢 Curto' : '🔴 Longo'}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">KM Atualizado</span>
          <p className="text-xl font-black text-white mt-0.5">{kmTotal.toFixed(1)} km</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tempo Rodagem</span>
          <p className="text-xl font-black text-blue-400 mt-0.5">{converterMinutosParaTexto(tempoRodagemMinutos)}</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Paradas</span>
          <p className="text-xl font-black text-orange-400 mt-0.5">{qtdParadas}</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/40 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tempo Geral</span>
          <p className="text-xl font-black text-emerald-400 mt-0.5">{converterMinutosParaTexto(tempoRodagemMinutos + tempoParadasMinutos)}</p>
        </div>
      </div>

      {/* Navegador de Abas */}
      <div className="mb-8 flex border-b border-zinc-900 text-xs font-bold uppercase tracking-wider">
        <button onClick={() => setPassoAtivo(1)} className={`pb-3 pr-6 border-b-2 transition-all ${passoAtivo === 1 ? 'border-purple-500 text-white' : 'border-transparent text-zinc-500'}`}>01. Trajeto</button>
        <button onClick={() => setPassoAtivo(2)} className={`pb-3 px-6 border-b-2 transition-all ${passoAtivo === 2 ? 'border-purple-500 text-white' : 'border-transparent text-zinc-500'}`}>02. Briefing & Escala</button>
        <button onClick={() => setPassoAtivo(3)} className={`pb-3 px-6 border-b-2 transition-all ${passoAtivo === 3 ? 'border-purple-500 text-white' : 'border-transparent text-zinc-500'}`}>03. Alertas</button>
      </div>

      {/* CONTEÚDO DAS ABAS (Mesmo HTML renderizado ontem, adaptado para os estados atuais) */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 mb-8">
        {passoAtivo === 1 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">Nome Identificador</label>
                <input type="text" value={nomeRota} onChange={e => setNomeRota(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="text-xs font-bold uppercase text-zinc-400 block mb-2">Itinerário Resumido</label>
                <input type="text" value={itinerarioResumido} onChange={e => setItinerarioResumido(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded px-3 py-2 text-xs text-white" />
              </div>
            </div>

            <div className="border-t border-zinc-900 pt-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-bold text-white">Cronograma Sequencial</h3>
                <div className="flex gap-2">
                  <button type="button" onClick={adicionarTrecho} className="bg-zinc-900 text-blue-400 border border-zinc-800 px-3 py-1.5 rounded text-xs font-bold uppercase">➕ Trecho</button>
                  <button type="button" onClick={adicionarParada} className="bg-zinc-900 text-orange-400 border border-zinc-800 px-3 py-1.5 rounded text-xs font-bold uppercase">➕ Parada</button>
                </div>
              </div>

              <div className="space-y-3">
                {elementos.map((el, idx) => (
                  <div key={el.id_temp} className={`flex flex-col md:flex-row gap-3 items-center justify-between p-4 rounded-xl border ${el.tipo === 'trecho' ? 'border-zinc-800 bg-zinc-950/40' : 'border-orange-900/30 bg-orange-950/5'}`}>
                    <span className="text-[10px] font-mono font-black text-zinc-600">#{String(idx + 1).padStart(2, '0')}</span>
                    {el.tipo === 'trecho' ? (
                      <div className="grid gap-3 grid-cols-4 flex-1">
                        <input type="text" placeholder="Origem" value={el.origem} onChange={e => atualizarElemento(el.id_temp!, { origem: e.target.value })} className="bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                        <input type="text" placeholder="Destino" value={el.destino} onChange={e => atualizarElemento(el.id_temp!, { destino: e.target.value })} className="bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                        <input type="number" placeholder="KM" value={el.distancia_km || ''} onChange={e => atualizarElemento(el.id_temp!, { distancia_km: Number(e.target.value) })} className="bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                        <input type="time" value={el.tempo_estimado} onChange={e => atualizarElemento(el.id_temp!, { tempo_estimado: e.target.value })} className="bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                      </div>
                    ) : (
                      <div className="grid gap-3 grid-cols-2 flex-1">
                        <input type="text" placeholder="Local de Parada" value={el.local_nome} onChange={e => atualizarElemento(el.id_temp!, { local_nome: e.target.value })} className="bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                        <input type="time" value={el.tempo_permanencia} onChange={e => atualizarElemento(el.id_temp!, { tempo_permanencia: e.target.value })} className="bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                      </div>
                    )}
                    <button type="button" onClick={() => removerElemento(el.id_temp!)} className="text-red-500 font-bold px-2">✕</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {passoAtivo === 2 && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <textarea rows={4} placeholder="Instruções Gerais..." value={comandoInstrucional} onChange={e => setComandoInstrucional(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white resize-none" />
              <textarea rows={4} placeholder="Estratégia de pista..." value={comandoOperacional} onChange={e => setComandoOperacional(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-2 text-xs text-white resize-none" />
            </div>

            <div className="grid gap-4 grid-cols-2 md:grid-cols-4 pt-4">
              {/* Selects da escala operacional */}
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block mb-1">ROAD CAPTAIN</span>
                <select value={roadCaptainId} onChange={e => setRoadCaptainId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white">
                  <option value="">Não Definido</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                </select>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block mb-1">BATEDOR</span>
                <select value={batedorId} onChange={e => setBatedorId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white">
                  <option value="">Não Definido</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                </select>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block mb-1">ANJO</span>
                <select value={anjoId} onChange={e => setAnjoId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white">
                  <option value="">Não Definido</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                </select>
              </div>
              <div>
                <span className="text-[10px] text-zinc-500 font-bold block mb-1">SWEEP</span>
                <select value={sweepId} onChange={e => setSweepId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded p-1.5 text-xs text-white">
                  <option value="">Não Definido</option>
                  {membros.map(m => <option key={m.id} value={m.id}>{m.nome_completo}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {passoAtivo === 3 && (
          <div className="space-y-6">
            <div>
              <h3 className="text-xs font-bold text-zinc-400 uppercase mb-3">Padrões de Formação dos Trechos</h3>
              {elementos.filter(e => e.tipo === 'trecho').map((el, index) => (
                <div key={el.id_temp} className="flex justify-between items-center p-2.5 bg-zinc-950/60 border border-zinc-900 rounded mb-2 text-xs">
                  <span>Trecho #{index + 1}: ({el.origem || '...'} → {el.destino || '...'})</span>
                  <div className="flex gap-4">
                    {['Zig-zag', 'Fila única', 'Livre'].map((padrao) => (
                      <label key={padrao} className="flex items-center gap-1 cursor-pointer">
                        <input type="radio" name={`padrao-${el.id_temp}`} checked={el.padrao_comboio === padrao} onChange={() => atualizarElemento(el.id_temp!, { padrao_comboio: padrao as any })} />
                        {padrao}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-zinc-900 pt-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-xs font-bold text-zinc-400 uppercase">🚨 Alertas e Pontos Críticos</h3>
                <button type="button" onClick={adicionarAlerta} className="bg-zinc-900 text-red-400 border border-zinc-800 px-2.5 py-1 rounded text-xs font-bold uppercase">➕ Adicionar Alerta</button>
              </div>

              {alertas.map((al) => (
                <div key={al.id_temp} className="flex gap-3 items-center mb-2 bg-zinc-950/40 p-2 border border-zinc-900 rounded">
                  <select value={al.tipo_alerta} onChange={e => atualizarAlerta(al.id_temp!, al.descricao, e.target.value as any)} className="bg-zinc-950 border border-zinc-800 text-xs rounded p-1 text-white">
                    <option value="perigo">🚨 Crítico</option>
                    <option value="atencao">⚠️ Atenção</option>
                    <option value="informativo">ℹ️ Info</option>
                  </select>
                  <input type="text" value={al.descricao} onChange={e => atualizarAlerta(al.id_temp!, e.target.value)} className="flex-1 bg-zinc-950 border border-zinc-900 rounded p-1 text-xs text-white" />
                  <button type="button" onClick={() => removerAlerta(al.id_temp!)} className="text-red-500">✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Botões do Rodapé */}
      <div className="flex justify-between items-center border-t border-zinc-900 pt-6">
        <button type="button" onClick={() => passoAtivo > 1 ? setPassoAtivo(passoAtivo - 1) : router.push(`/rotas/${id}`)} className="rounded border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white uppercase">
          {passoAtivo === 1 ? '← Cancelar' : '← Voltar'}
        </button>

        {passoAtivo < 3 ? (
          <button type="button" onClick={() => setPassoAtivo(passoAtivo + 1)} className="rounded bg-purple-600 hover:bg-purple-500 px-5 py-2 text-xs font-bold text-white uppercase">Próximo Passo →</button>
        ) : (
          <button type="button" onClick={handleAtualizarRota} disabled={salvando} className="rounded bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 px-6 py-2 text-xs font-black text-white uppercase tracking-wider">
            {salvando ? 'Salvando Ajustes...' : '💾 Salvar Alterações'}
          </button>
        )}
      </div>

    </main>
  )
}