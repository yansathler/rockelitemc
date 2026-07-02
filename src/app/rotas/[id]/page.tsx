'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

export default function DetalheRota({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [rota, setRota] = useState<any>(null)
  const [elementos, setElementos] = useState<any[]>([])
  const [alertas, setAlertas] = useState<any[]>([])

  useEffect(() => {
    async function carregarDadosCompletos() {
      try {
        // 1. Puxa cabeçalho com o nome dos membros já resolvidos (JOIN tático)
        const { data: dataRota, error: errRota } = await supabase
          .from('rotas')
          .select(`
            *,
            road_captain:membros!road_captain_id(nome_completo),
            batedor:membros!batedor_id(nome_completo),
            anjo:membros!anjo_id(nome_completo),
            sweep:membros!sweep_id(nome_completo),
            balizador:membros!balizador_id(nome_completo)
          `)
          .eq('id', id)
          .single()

        if (errRota) throw errRota
        setRota(dataRota)

        // 2. Puxa elementos (Trechos e Paradas) na ordem certa
        const { data: dataElementos } = await supabase
          .from('rota_elementos')
          .select('*')
          .eq('rota_id', id)
          .order('ordem', { ascending: true })
        
        if (dataElementos) setElementos(dataElementos)

        // 3. Puxa Alertas de Segurança
        const { data: dataAlertas } = await supabase
          .from('rota_alertas')
          .select('*')
          .eq('rota_id', id)
          .order('ordem', { ascending: true })

        if (dataAlertas) setAlertas(dataAlertas)

      } catch (err) {
        console.error(err)
        alert('Erro ao carregar os dados estratégicos da rota.')
      } finally {
        setCarregando(false)
      }
    }

    carregarDadosCompletos()
  }, [id])

  if (carregando) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-xs font-bold text-zinc-500 uppercase tracking-widest">Carregando Plano de Estrada...</div>
  }

  if (!rota) {
    return <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-xs font-bold text-red-500">Rota não encontrada na base do comando.</div>
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 space-y-8">
      
      {/* Header com Ações e Título */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start justify-between border-b border-zinc-900 pb-6">
        <div>
          <span className="text-[10px] font-mono font-black text-zinc-600 block">CADASTRO Nº {String(rota.numero_cadastro).padStart(3, '0')} (2026)</span>
          <h1 className="text-2xl font-black text-white tracking-tight mt-1">{rota.nome_rota}</h1>
          <p className="text-xs text-zinc-400 mt-1">🗺️ Itinerário: {rota.itinerario_resumido}</p>
        </div>
        
        {/* Bloco Tático de Botões */}
        <div className="flex items-center gap-2 self-start sm:self-auto">
          <button 
            onClick={() => router.push(`/rotas/editar/${id}`)} 
            className="flex items-center gap-1.5 border border-purple-900 bg-purple-950/20 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-purple-400 hover:bg-purple-950/40 transition-all"
          >
            ⚙️ Editar Rota
          </button>
          <button 
            onClick={() => router.push('/dashboard')} 
            className="border border-zinc-800 bg-zinc-900 px-3 py-1.5 rounded text-xs font-bold uppercase tracking-wider text-zinc-400 hover:text-white transition-all"
          >
            ← Voltar
          </button>
        </div>
      </div>

      {/* Grid de Métricas Consolidadas */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tipo de Circuito</span>
          <span className={`mt-1.5 inline-block text-[10px] font-black uppercase px-2 py-0.5 rounded ${rota.tipo_role === 'Curto' ? 'bg-emerald-950 text-emerald-400 border border-emerald-900' : 'bg-red-950 text-red-400 border border-red-900'}`}>
            {rota.tipo_role}
          </span>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Quilometragem Total</span>
          <p className="text-lg font-black text-white mt-1">{rota.km_total} km</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Tempo de Rodagem Puro</span>
          <p className="text-lg font-black text-blue-400 mt-1">{rota.tempo_total_rodagem}</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 p-4">
          <span className="text-[10px] font-bold text-zinc-500 uppercase block">Duração Total Estimada</span>
          <p className="text-lg font-black text-emerald-400 mt-1">{rota.tempo_total_geral}</p>
        </div>
      </div>

      {/* Cronograma do Percurso */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-blue-500 pl-3">Cronograma da Estrada</h2>
        <div className="space-y-3">
          {elementos.map((el, idx) => (
            <div key={el.id} className={`flex justify-between items-center p-3 rounded-lg border text-xs ${el.tipo === 'trecho' ? 'border-zinc-900 bg-zinc-950/60' : 'border-orange-950/20 bg-orange-950/5'}`}>
              <div className="flex items-center gap-3">
                <span className="font-mono text-zinc-600 font-bold">#{String(idx + 1).padStart(2, '0')}</span>
                {el.tipo === 'trecho' ? (
                  <div>
                    <span className="font-semibold text-zinc-200">{el.origem} → {el.destino}</span>
                    <span className="ml-3 text-[10px] bg-zinc-900 text-zinc-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Formação: {el.padrao_comboio}</span>
                  </div>
                ) : (
                  <span className="font-bold text-orange-400">☕ Parada: {el.local_nome}</span>
                )}
              </div>
              <div className="font-semibold text-zinc-400">
                {el.tipo === 'trecho' ? `🏁 ${el.distancia_km} km (${el.tempo_estimado})` : `⏳ Parada de ${el.tempo_permanencia}`}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Oficiais de Missão (Escala do Comboio) */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 border-l-2 border-zinc-700 pl-3">Comboio Operacional</h2>
        <div className="grid gap-4 grid-cols-2 md:grid-cols-5 text-xs">
          <div className="bg-zinc-950/40 p-3 rounded border border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase">Road Captain</span>
            <span className="text-zinc-200 font-semibold block mt-1">{rota.road_captain?.nome_completo || 'Não Escalado'}</span>
          </div>
          <div className="bg-zinc-950/40 p-3 rounded border border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase">Batedor</span>
            <span className="text-zinc-200 font-semibold block mt-1">{rota.batedor?.nome_completo || 'Não Escalado'}</span>
          </div>
          <div className="bg-zinc-950/40 p-3 rounded border border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase">Anjo</span>
            <span className="text-zinc-200 font-semibold block mt-1">{rota.anjo?.nome_completo || 'Não Escalado'}</span>
          </div>
          <div className="bg-zinc-950/40 p-3 rounded border border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase">Sweep</span>
            <span className="text-zinc-200 font-semibold block mt-1">{rota.sweep?.nome_completo || 'Não Escalado'}</span>
          </div>
          <div className="bg-zinc-950/40 p-3 rounded border border-zinc-900">
            <span className="text-[10px] text-zinc-500 font-bold block uppercase">Balizador</span>
            <span className="text-zinc-200 font-semibold block mt-1">{rota.balizador?.nome_completo || 'Não Escalado'}</span>
            {rota.balizador_id && <span className="text-[9px] bg-zinc-900 text-zinc-500 px-1 rounded font-bold uppercase mt-1 inline-block">🚗 {rota.balizador_veiculo === 'moto' ? 'Moto' : rota.balizador_veiculo === 'carro' ? 'Carro' : 'Triciclo'}</span>}
          </div>
        </div>
      </div>

      {/* Briefing Operacional */}
      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Comando Instrucional</h2>
          <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed bg-zinc-950/50 p-4 rounded border border-zinc-900">{rota.comando_instrucional || 'Nenhuma diretriz instrucional lançada.'}</p>
        </div>
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6">
          <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-3">Comando Operacional</h2>
          <p className="text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed bg-zinc-950/50 p-4 rounded border border-zinc-900">{rota.comando_operacional || 'Nenhuma ordem operacional lançada.'}</p>
        </div>
      </div>

      {/* Alertas de Risco (Sirenes) */}
      {alertas.length > 0 && (
        <div className="rounded-xl border border-red-950/40 bg-red-950/5 p-6">
          <h2 className="text-sm font-bold text-red-400 uppercase tracking-wider mb-4 flex items-center gap-2">🚨 Alertas Críticos e Segurança de Estrada</h2>
          <div className="space-y-2">
            {alertas.map((al) => (
              <div key={al.id} className="text-xs bg-zinc-950/60 p-3 rounded border border-red-900/30 text-zinc-300">
                <span className="font-black text-red-500 uppercase tracking-widest text-[9px] mr-2">
                  {al.tipo_alerta === 'perigo' ? '[CRÍTICO]' : al.tipo_alerta === 'atencao' ? '[ATENÇÃO]' : '[INFO]'}
                </span>
                {al.descricao}
              </div>
            ))}
          </div>
        </div>
      )}

    </main>
  )
}