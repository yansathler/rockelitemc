'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface VigenciaValor {
  mes_inicio: number
  ano_inicio: number
  valor_prospect: number
  valor_full_patch: number
}

interface ConfigFinanceiro {
  dia_vencimento: number
  historico_valores: VigenciaValor[]
}

interface CompetenciaPendente {
  mes: number
  ano: number
  label: string
  valor_calculado: number // Guarda o valor exato daquele mês histórico
}

interface MembroCompleto {
  id: string
  nome_completo: string
  tp_membro: string
  data_filiacao: string
  foto_url: string | null
  tarjeta_escrita: string | null
  status_ativo: boolean
  valor_pendente?: number
  mensalidades_pendentes?: CompetenciaPendente[]
}

interface Transacao {
  id: string
  descricao: string
  categoria: string
  data_movimentacao: string
  valor: number
  tipo: 'entrada' | 'saida'
}

interface MensalidadePaga {
  id: string
  membro_id: string
  mes: number
  ano: number
  valor_pago: number
}

export default function Financeiro() {
  const router = useRouter()
  const supabase = createClient()

  // Estados de controle e autenticação
  const [carregando, setCarregando] = useState(true)
  const [autenticado, setAutenticado] = useState<boolean | null>(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [lancandoMovimentacao, setLancandoMovimentacao] = useState(false)

  // Estados de dados do Painel Dinâmicos
  const [saldoGeral, setSaldoGeral] = useState(0)
  const [entradasMes, setEntradasMes] = useState(0)
  const [saidasMes, setSaidasMes] = useState(0)
  const [pendenciasAReceber, setPendenciasAReceber] = useState(0)

  // Dados da Sidebar de membros (Métricas Dinâmicas)
  const [totalMembros, setTotalMembros] = useState(0)
  const [membrosEmDiaCount, setMembrosEmDiaCount] = useState(0)
  const [membrosEmAtrasoCount, setMembrosEmAtrasoCount] = useState(0)
  const [taxaAdimplencia, setTaxaAdimplencia] = useState(100)

  // Controle de visualização interativa do Extrato Principal
  const [visualizacaoAtiva, setVisualizacaoAtiva] = useState<'transacoes' | 'em_dia' | 'em_atraso'>('transacoes')

  // Listas reais e filtradas
  const [membrosCompletos, setMembrosCompletos] = useState<MembroCompleto[]>([])
  const [membrosEmDiaList, setMembrosEmDiaList] = useState<MembroCompleto[]>([])
  const [membrosEmAtrasoList, setMembrosEmAtrasoList] = useState<MembroCompleto[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([])
  
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroTempo, setFiltroTempo] = useState('Este Mês')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')

  // Modais e formulários
  const [exibirMenuConfig, setExibirMenuConfig] = useState(false)
  const [exibirModalNovaTransacao, setExibirModalNovaTransacao] = useState(false)

  // Configuração unificada englobando o histórico
  const [config, setConfig] = useState<ConfigFinanceiro>({
    dia_vencimento: 15,
    historico_valores: []
  })

  // Estado auxiliar para capturar o formulário de cadastro de novo reajuste
  const [novaVigenciaForm, setNovaVigenciaForm] = useState({
    valor_prospect: '',
    valor_full_patch: '',
    mes_inicio: new Date().getMonth() + 1,
    ano_inicio: new Date().getFullYear(),
    dia_vencimento: 15
  })

  const [novoLancamento, setNovoLancamento] = useState({
    tipo: 'entrada',
    categoria: 'mensalidade',
    descricao: '',
    valor: '',
    membro_id: '',
    competencia_selecionada: '' // Formato "MÊS-ANO-VALOR"
  })

  // Lista local para preencher o combobox das mensalidades devidas
  const [mensalidadesDisponiveis, setMensalidadesDisponiveis] = useState<CompetenciaPendente[]>([])

  // Guardião de Rota
  useEffect(() => {
    const idMembro = localStorage.getItem('@rockelite:membro_id')
    if (!idMembro) {
      setAutenticado(false)
      router.replace('/')
    } else {
      setAutenticado(true)
      inicializarModulo()
    }
  }, [router])

  // Monitor de preenchimento automático baseado na competência selecionada
  useEffect(() => {
    if (novoLancamento.categoria === 'mensalidade' && novoLancamento.membro_id) {
      const irmao = membrosCompletos.find(m => m.id === novoLancamento.membro_id)
      if (irmao) {
        const pendencias = irmao.mensalidades_pendentes || []
        setMensalidadesDisponiveis(pendencias)

        if (pendencias.length > 0) {
          // Se houver competência pendente, assume por padrão os dados da primeira da fila (mais antiga)
          const primeiraFila = pendencias[0]
          setNovoLancamento(prev => ({
            ...prev,
            valor: primeiraFila.valor_calculado.toFixed(2),
            descricao: `Mensalidade Ref. ${primeiraFila.label} - ${irmao.nome_completo}`,
            competencia_selecionada: `${primeiraFila.mes}-${primeiraFila.ano}-${primeiraFila.valor_calculado}`
          }))
        } else {
          setNovoLancamento(prev => ({ ...prev, valor: '', descricao: `Mensalidade - ${irmao.nome_completo}`, competencia_selecionada: '' }))
        }
      }
    } else {
      setMensalidadesDisponiveis([])
    }
  }, [novoLancamento.membro_id, novoLancamento.categoria, membrosCompletos])

  // Monitor para recalcular o valor se ele mudar a competência manualmente no combobox
  const handleMudarCompetencia = (valorCombo: string) => {
    if (!valorCombo) return
    const [mes, ano, valorHistorico] = valorCombo.split('-')
    const irmao = membrosCompletos.find(m => m.id === novoLancamento.membro_id)
    
    const nomesMeses = [
      'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
      'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ]
    const labelMes = nomesMeses[Number(mes) - 1]

    setNovoLancamento(prev => ({
      ...prev,
      competencia_selecionada: valorCombo,
      valor: Number(valorHistorico).toFixed(2),
      descricao: `Mensalidade Ref. ${labelMes}/${ano} - ${irmao?.nome_completo || ''}`
    }))
  }

  const inicializarModulo = async () => {
    setCarregando(true)
    const configAtualizada = await carregandoConfiguracoes()
    if (configAtualizada) {
      await calcularPainelFinanceiro(configAtualizada)
    }
    setCarregando(false)
  }

  const carregandoConfiguracoes = async (): Promise<ConfigFinanceiro | null> => {
    try {
      // Busca o dia de vencimento na tabela antiga
      const { data: configBase } = await supabase.from('config_financeiro').select('dia_vencimento').eq('id', 1).single()
      const diaVenc = configBase ? Number(configBase.dia_vencimento) : 15

      // Busca todo o histórico de reajustes ordenados por vigência
      const { data: historicoDb } = await supabase
        .from('historico_valores_mensalidade')
        .select('*')
        .order('ano_inicio', { ascending: true })
        .order('mes_inicio', { ascending: true })

      const listaVigencias: VigenciaValor[] = (historicoDb || []).map(h => ({
        mes_inicio: Number(h.mes_inicio),
        ano_inicio: Number(h.ano_inicio),
        valor_prospect: Number(h.valor_prospect),
        valor_full_patch: Number(h.valor_full_patch)
      }))

      const payloadConfig = {
        dia_vencimento: diaVenc,
        historico_valores: listaVigencias
      }

      setConfig(payloadConfig)

      // Alimenta os inputs do formulário com os dados mais recentes encontrados para facilitar a edição
      if (listaVigencias.length > 0) {
        const ultima = listaVigencias[listaVigencias.length - 1]
        setNovaVigenciaForm({
          valor_prospect: ultima.valor_prospect.toString(),
          valor_full_patch: ultima.valor_full_patch.toString(),
          mes_inicio: new Date().getMonth() + 1,
          ano_inicio: new Date().getFullYear(),
          dia_vencimento: diaVenc
        })
      }

      return payloadConfig
    } catch (err) {
      console.error('Erro ao buscar configurações históricas:', err)
    }
    return null
  }

  // FUNÇÃO AUXILIAR MATEMÁTICA: Descobre o valor histórico exato de uma competência
  const obterValorHistoricoMembro = (mes: number, ano: number, tipoMembro: string, historico: VigenciaValor[]): number => {
    let valorEncontrado = tipoMembro?.toLowerCase().includes('prospect') ? 45.00 : 55.00 // Fallback seguro
    
    // Varre as regras de vigência e fica com a mais atualizada que seja menor ou igual à data pesquisada
    for (const vigencia of historico) {
      if (ano > vigencia.ano_inicio || (ano === vigencia.ano_inicio && mes >= vigencia.mes_inicio)) {
        valorEncontrado = tipoMembro?.toLowerCase().includes('prospect') 
          ? vigencia.valor_prospect 
          : vigencia.valor_full_patch
      }
    }
    return valorEncontrado
  }

  const calcularPainelFinanceiro = async (configFinanceira: ConfigFinanceiro) => {
    try {
      const { data: movimentacoes } = await supabase
        .from('caixa_movimentacoes')
        .select('*')
        .order('data_movimentacao', { ascending: false })

      const { data: membrosDb } = await supabase
        .from('membros')
        .select('id, nome_completo, tp_membro, data_filiacao, foto_url, tarjeta_escrita, status_ativo')
        .eq('status_ativo', true)

      const { data: mensalidadesDb } = await supabase.from('mensalidades').select('*')

      const listaMembros: MembroCompleto[] = membrosDb || []
      const listaMensalidades: MensalidadePaga[] = mensalidadesDb || []

      let totalEntradas = 0
      let totalSaidas = 0
      let entMes = 0
      let saiMes = 0

      const hoje = new Date()
      const diaAtual = hoje.getDate()
      const mesAtual = hoje.getMonth() // 0-11
      const anoAtual = hoje.getFullYear()

      const formatadas: Transacao[] = (movimentacoes || []).map(mov => {
        const valorNum = Number(mov.valor)
        const dataMov = mov.data_movimentacao ? new Date(mov.data_movimentacao) : new Date()

        if (mov.tipo === 'entrada') {
          totalEntradas += valorNum
          if (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual) {
            entMes += valorNum
          }
        } else if (mov.tipo === 'saida') {
          totalSaidas += valorNum
          if (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual) {
            saiMes += valorNum
          }
        }

        return {
          id: mov.id,
          descricao: mov.descricao,
          categoria: mov.categoria === 'mensalidade' ? 'Mensalidades' : mov.categoria,
          data_movimentacao: mov.data_movimentacao ? mov.data_movimentacao.split('T')[0] : hoje.toISOString().split('T')[0],
          valor: valorNum,
          tipo: mov.tipo
        }
      })

      setTransacoes(formatadas)
      setSaldoGeral(totalEntradas - totalSaidas)
      setEntradasMes(entMes)
      setSaidasMes(saiMes)

      let boloPendenciasTotal = 0
      const adimplentes: MembroCompleto[] = []
      const inadimplentes: MembroCompleto[] = []

      const nomesMeses = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
      ]

      listaMembros.forEach(membro => {
        const dataFiliacao = membro.data_filiacao ? new Date(membro.data_filiacao) : new Date()
        
        let anoVarredura = dataFiliacao.getFullYear()
        let mesVarredura = dataFiliacao.getMonth()

        let debitoAcumulado = 0
        let possuiInadimplenciaVencida = false
        const pendenciasDoMembro: CompetenciaPendente[] = []

        while (anoVarredura < anoAtual || (anoVarredura === anoAtual && mesVarredura <= mesAtual)) {
          const mesBanco = mesVarredura + 1

          const jaFoiPago = listaMensalidades.some(
            mens => mens.membro_id === membro.id && mens.mes === mesBanco && mens.ano === anoVarredura
          )

          if (!jaFoiPago) {
            // Descobre dinamicamente qual era a regra de preço para esse mês/ano específico
            const valorHistoricoCompetencia = obterValorHistoricoMembro(
              mesBanco, 
              anoVarredura, 
              membro.tp_membro || '', 
              configFinanceira.historico_valores
            )

            pendenciasDoMembro.push({
              mes: mesBanco,
              ano: anoVarredura,
              label: `${nomesMeses[mesVarredura]} / ${anoVarredura}`,
              valor_calculado: valorHistoricoCompetencia
            })

            const ehMesAnterior = anoVarredura < anoAtual || mesVarredura < mesAtual
            const ehMesAtualVencido = anoVarredura === anoAtual && mesVarredura === mesAtual && diaAtual > configFinanceira.dia_vencimento

            if (ehMesAnterior || ehMesAtualVencido) {
              debitoAcumulado += valorHistoricoCompetencia
              possuiInadimplenciaVencida = true
            }
          }

          mesVarredura++
          if (mesVarredura > 11) {
            mesVarredura = 0
            anoVarredura++
          }
        }

        const membroFormatado = {
          ...membro,
          valor_pendente: debitoAcumulado,
          mensalidades_pendentes: pendenciasDoMembro
        }

        if (possuiInadimplenciaVencida) {
          boloPendenciasTotal += debitoAcumulado
          inadimplentes.push(membroFormatado)
        } else {
          adimplentes.push(membroFormatado)
        }
      })

      setMembrosCompletos(listaMembros.map(m => {
        const correspondenteInad = inadimplentes.find(i => i.id === m.id)
        const correspondenteDia = adimplentes.find(d => d.id === m.id)
        return correspondenteInad ? correspondenteInad : (correspondenteDia || { ...m, mensalidades_pendentes: [] })
      }))
      
      setMembrosEmDiaList(adimplentes)
      setMembrosEmAtrasoList(inadimplentes)
      
      setTotalMembros(listaMembros.length)
      setMembrosEmDiaCount(adimplentes.length)
      setMembrosEmAtrasoCount(inadimplentes.length)
      setPendenciasAReceber(boloPendenciasTotal)

      if (listaMembros.length > 0) {
        const taxa = Math.round((adimplentes.length / listaMembros.length) * 100)
        setTaxaAdimplencia(taxa)
      } else {
        setTaxaAdimplencia(100)
      }

    } catch (err) {
      console.error('Erro crítico no motor financeiro:', err)
    }
  }

  // GRAVAÇÃO DE CONFIGURAÇÃO DE REAJUSTES HISTÓRICOS AUTOMÁTICA
  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvandoConfig(true)
    try {
      // 1. Atualiza o dia padrão de vencimento na tabela geral
      await supabase.from('config_financeiro').update({ dia_vencimento: Number(novaVigenciaForm.dia_vencimento) }).eq('id', 1)

      // 2. Registra o novo valor histórico na tabela de vigências
      const { error: erroInsert } = await supabase
        .from('historico_valores_mensalidade')
        .insert({
          mes_inicio: Number(novaVigenciaForm.mes_inicio),
          ano_inicio: Number(novaVigenciaForm.ano_inicio),
          valor_prospect: Number(novaVigenciaForm.valor_prospect),
          valor_full_patch: Number(novaVigenciaForm.valor_full_patch)
        })

      if (erroInsert) throw erroInsert

      alert('Reajuste de mensalidade programado e salvo no histórico! ⚡')
      setExibirMenuConfig(false)
      
      const configAtualizada = await carregandoConfiguracoes()
      if (configAtualizada) await calcularPainelFinanceiro(configAtualizada)

    } catch (err) {
      console.error(err)
      alert('Erro ao gravar reajuste histórico.')
    } finally {
      setSalvandoConfig(false)
    }
  }

  const handleCriarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoLancamento.valor || Number(novoLancamento.valor) <= 0) return alert('Insira um valor válido.')
    setLancandoMovimentacao(true)

    try {
      let mensalidadeIdGerada = null

      if (novoLancamento.categoria === 'mensalidade') {
        if (!novoLancamento.membro_id) {
          alert('Por favor, selecione um irmão para realizar a baixa.')
          setLancandoMovimentacao(false)
          return
        }
        if (!novoLancamento.competencia_selecionada) {
          alert('Por favor, selecione qual mês de referência está sendo pago.')
          setLancandoMovimentacao(false)
          return
        }

        const [mesEscolhido, anoEscolhido, valorOrigem] = novoLancamento.competencia_selecionada.split('-').map(Number)

        const { data: jaPago } = await supabase
          .from('mensalidades')
          .select('id')
          .eq('membro_id', novoLancamento.membro_id)
          .eq('mes', mesEscolhido)
          .eq('ano', anoEscolhido)
          .maybeSingle()

        if (jaPago) {
          alert('❌ Operação Interrompida: Esta mensalidade específica já consta como paga!')
          setLancandoMovimentacao(false)
          return
        }

        const { data: novaMensalidade, error: erroMensalidade } = await supabase
          .from('mensalidades')
          .insert({
            membro_id: novoLancamento.membro_id,
            mes: mesEscolhido,
            ano: anoEscolhido,
            valor_pago: Number(novoLancamento.valor) // Aceita alteração/desconto caso modificado na hora
          })
          .select()
          .single()

        if (erroMensalidade) throw erroMensalidade
        if (novaMensalidade) mensalidadeIdGerada = novaMensalidade.id
      }

      const { error: erroCaixa } = await supabase.from('caixa_movimentacoes').insert({
        tipo: novoLancamento.tipo,
        categoria: novoLancamento.categoria,
        descricao: novoLancamento.descricao,
        valor: Number(novoLancamento.valor),
        membro_id: novoLancamento.membro_id || null,
        mensalidade_id: mensalidadeIdGerada
      })

      if (erroCaixa) throw erroCaixa

      alert('Lançamento registrado com sucesso! 💵⚡')
      setExibirModalNovaTransacao(false)
      
      setNovoLancamento({
        tipo: 'entrada',
        categoria: 'mensalidade',
        descricao: '',
        valor: '',
        membro_id: '',
        competencia_selecionada: ''
      })
      
      await calcularPainelFinanceiro(config)
    } catch (err) {
      console.error(err)
      alert('Erro crítico ao salvar no banco.')
    } finally {
      setLancandoMovimentacao(false)
    }
  }

  const limparFiltros = () => {
    setFiltroTexto('')
    setFiltroTempo('Este Mês')
    setFiltroCategoria('Todos')
  }

  const transacoesFiltradas = transacoes.filter(t => {
    if (filtroCategoria !== 'Todos' && t.categoria !== filtroCategoria) return false
    if (filtroTexto) {
      return t.descricao.toLowerCase().includes(filtroTexto.toLowerCase())
    }
    return true
  })

  if (autenticado !== true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0d0e11] text-xs font-bold text-zinc-600 uppercase tracking-widest">
        ⚡ Carregando Cofre do High Command...
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#0d0e11] p-6 text-[#f3f4f6] md:p-10 font-sans">
      
      {/* TOPO DA TELA */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">💵</span>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase">Financeiro</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">Gerencie as finanças do seu Moto Clube com adimplência e histórico de reajustes</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => router.push('/dashboard')}
            className="rounded-lg bg-[#161920] border border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors uppercase tracking-wider"
          >
            Voltar ao Dash
          </button>
          <button 
            onClick={() => calcularPainelFinanceiro(config)}
            className="flex items-center gap-1.5 rounded-lg bg-[#161920] border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            🔄 Atualizar
          </button>
          <button 
            onClick={() => setExibirMenuConfig(true)}
            className="flex items-center gap-1.5 rounded-lg bg-[#161920] border border-zinc-800 px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
          >
            Parametrização
          </button>
          <button 
            onClick={() => setExibirModalNovaTransacao(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg"
          >
            + Nova Transação <span className="text-[10px] opacity-70">▼</span>
          </button>
        </div>
      </div>

      {/* PAINEL DE CARDS DINÂMICOS */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Saldo</span>
            <span className="text-sm opacity-60">📁</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">
            R$ {saldoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Saldo acumulado atual</p>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Receitas</span>
            <span className="text-sm text-emerald-500 font-bold">↗</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-500">
            R$ {entradasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Somatório deste mês</p>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Despesas</span>
            <span className="text-sm text-red-400 font-bold">↘</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#f87171]">
            R$ {saidasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Somatório deste mês</p>
        </div>

        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Pendências</span>
            <span className="text-sm opacity-60">💳</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-500">
            R$ {pendenciasAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Inadimplência retroativa absoluta</p>
        </div>
      </div>

      {/* FILTROS */}
      {visualizacaoAtiva === 'transacoes' && (
        <div className="mb-6 rounded-xl border border-zinc-800/60 bg-[#12141c] p-4">
          <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
            <span>⚙️</span> Filtros de Extrato
          </div>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
            <input
              type="text"
              placeholder="Buscar transações..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600"
            />
            <select
              value={filtroTempo}
              onChange={(e) => setFiltroTempo(e.target.value)}
              className="rounded-lg bg-[#0d0e11] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
            >
              <option value="Este Mês">Este Mês</option>
              <option value="Todos">Todos os períodos</option>
            </select>
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="rounded-lg bg-[#0d0e11] border border-zinc-800 px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-zinc-700 cursor-pointer"
            >
              <option value="Todos">Todos</option>
              <option value="Mensalidades">Mensalidades</option>
              <option value="Combustível">Combustível</option>
            </select>
            <button onClick={limparFiltros} className="rounded-lg border border-zinc-800 bg-[#0d0e11] py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-colors">
              Limpar Filtros
            </button>
          </div>
        </div>
      )}

      {/* GRID DE DUAS COLUNAS PRINCIPAIS */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* COLUNA ESQUERDA */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-800/40 bg-[#12141c]/50 p-6">
          
          {visualizacaoAtiva === 'transacoes' && (
            <>
              <h2 className="text-base font-bold text-white mb-1">$ Transações Recentes</h2>
              <p className="text-xs text-zinc-500 mb-6">Últimas movimentações financeiras de caixa</p>

              {/* AJUSTE VISUAL: Altura máxima definida para caber exatamente 5 transações confortavelmente. 
                Se passar disso, a barra de rolagem é ativada suavemente.
              */}
              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {transacoesFiltradas.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhuma movimentação encontrada.</p>
                ) : (
                  transacoesFiltradas.map((t) => (
                    <div key={t.id} className="flex items-center justify-between rounded-xl bg-[#12141c] border border-zinc-800/80 p-4 hover:border-zinc-700/80 transition-all mr-1">
                      <div className="flex items-center gap-3">
                        <div className={`h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold ${t.tipo === 'entrada' ? 'bg-emerald-950/40 text-emerald-400' : 'bg-red-950/40 text-red-400'}`}>
                          {t.tipo === 'entrada' ? '↗' : '↘'}
                        </div>
                        <div>
                          <h4 className="text-xs font-bold text-zinc-200">{t.descricao}</h4>
                          <p className="text-[10px] text-zinc-500 mt-0.5">{t.categoria}</p>
                          <p className="text-[9px] text-zinc-600 mt-0.5">{t.data_movimentacao}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className={`text-xs font-bold block ${t.tipo === 'entrada' ? 'text-emerald-400' : 'text-red-400'}`}>
                          {t.tipo === 'entrada' ? '+' : '-'}R$ {t.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <span className="inline-block mt-1 text-[9px] text-emerald-500/90 bg-emerald-950/30 border border-emerald-900/40 px-2 py-0.5 rounded-full font-medium">
                          Concluído
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

          {visualizacaoAtiva === 'em_dia' && (
            <>
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-bold text-emerald-400">👥 Membros Regularizados (Adimplentes)</h2>
                <button onClick={() => setVisualizacaoAtiva('transacoes')} className="text-xs font-bold uppercase text-zinc-400 hover:text-white bg-zinc-800/50 border border-zinc-700 px-3 py-1 rounded">← Ver Transações</button>
              </div>
              <p className="text-xs text-zinc-500 mb-6">Lista dos irmãos que estão com o colete e mensalidades em dia.</p>

              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1">
                {membrosEmDiaList.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhum irmão nesta categoria no momento.</p>
                ) : (
                  membrosEmDiaList.map((m) => (
                    <div key={m.id} className="flex items-center justify-between rounded-xl bg-[#12141c] border border-emerald-900/30 p-4 mr-1">
                      <div className="flex items-center gap-3">
                        {m.foto_url ? (
                          <img src={m.foto_url} alt="Membro" className="h-9 w-9 rounded-full object-cover border border-zinc-800" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-600">MC</div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white">{m.nome_completo}</h4>
                          <span className="inline-block border border-zinc-800 bg-zinc-950 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider text-zinc-300 mt-1 font-bold">{m.tarjeta_escrita || 'Sem Tarjeta'}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase tracking-widest bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 px-3 py-1 rounded-full">✓ Regular</span>
                    </div>
                  ))
                )}
              </div>
            </>
          )}

{visualizacaoAtiva === 'em_atraso' && (
            <>
              <div className="flex justify-between items-center mb-1">
                <h2 className="text-base font-bold text-red-400">⚠️ Linha de Inadimplência</h2>
                <button onClick={() => setVisualizacaoAtiva('transacoes')} className="text-xs font-bold uppercase text-zinc-400 hover:text-white bg-zinc-800/50 border border-zinc-700 px-3 py-1 rounded">← Ver Transações</button>
              </div>
              <p className="text-xs text-zinc-500 mb-6">Lista de irmãos com pendências financeiras calculadas conforme histórico de reajustes.</p>

              <div className="space-y-3 max-h-[440px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                {membrosEmAtrasoList.length === 0 ? (
                  <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhuma pendência encontrada! 🦅</p>
                ) : (
                  membrosEmAtrasoList.map((m) => (
                    <div key={m.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-xl bg-[#12141c] border border-red-900/30 p-4 hover:border-red-900/60 transition-all mr-1">
                      
                      {/* LADO ESQUERDO: FOTO E INFORMAÇÕES DO MEMBRO */}
                      <div className="flex items-start gap-3">
                        {m.foto_url ? (
                          <img src={m.foto_url} alt="Membro" className="h-9 w-9 rounded-full object-cover border border-zinc-800 mt-0.5" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-900 flex items-center justify-center text-[10px] font-bold text-zinc-600 mt-0.5">MC</div>
                        )}
                        <div>
                          <h4 className="text-xs font-bold text-white">{m.nome_completo}</h4>
                          
                          {/* Tags de Tarjeta e Contador de meses acumulados */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-1">
                            <span className="inline-block border border-zinc-800 bg-zinc-950 px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider text-zinc-300 font-bold">
                              {m.tarjeta_escrita || 'Sem Tarjeta'}
                            </span>
                            <span className="inline-block bg-red-950/40 border border-red-900/40 text-red-400 px-2 py-0.5 rounded text-[10px] font-bold">
                              {m.mensalidades_pendentes?.length || 0} {m.mensalidades_pendentes?.length === 1 ? 'mês devido' : 'meses devidos'}
                            </span>
                          </div>

                          {/* Lista textual detalhada dos meses devidos */}
                          {m.mensalidades_pendentes && m.mensalidades_pendentes.length > 0 && (
                            <p className="text-[10px] text-zinc-500 mt-1.5 max-w-xs sm:max-w-md">
                              <span className="text-zinc-400 font-medium">Competências:</span>{' '}
                              <span className="italic text-zinc-300 font-mono">
                                {m.mensalidades_pendentes.map((p) => p.label).join(', ')}
                              </span>
                            </p>
                          )}
                        </div>
                      </div>
                      
                      {/* LADO DIREITO: VALOR TOTAL E AÇÃO DE BAIXA */}
                      <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t border-zinc-800/50 pt-2 sm:pt-0 sm:border-0">
                        <span className="text-xs font-bold text-red-400 block">
                          R$ {m.valor_pendente?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                        </span>
                        <button 
                          onClick={() => {
                            setNovoLancamento({
                              tipo: 'entrada',
                              categoria: 'mensalidade',
                              membro_id: m.id,
                              valor: '',
                              descricao: '',
                              competencia_selecionada: ''
                            })
                            setExibirModalNovaTransacao(true)
                          }}
                          className="mt-1 text-[9px] uppercase font-bold text-zinc-300 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 px-2 py-1 rounded transition-colors"
                        >
                          💸 Dar Baixa
                        </button>
                      </div>

                    </div>
                  ))
                )}
              </div>
            </>
          )}

        </div>

        {/* COLUNA DIREITA */}
        <div className="lg:col-span-4 rounded-xl border border-zinc-800/40 bg-[#12141c]/50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <span>👥</span> Gestão de Membros
            </h2>

            <div className="space-y-3 text-xs font-medium">
              <div 
                onClick={() => setVisualizacaoAtiva('transacoes')}
                className={`flex justify-between items-center py-2 px-3 rounded-lg border cursor-pointer transition-all ${visualizacaoAtiva === 'transacoes' ? 'bg-[#161920] border-zinc-700' : 'border-transparent hover:bg-zinc-900/30'}`}
              >
                <span className="text-zinc-400">Total de Membros Ativos</span>
                <span className="text-white font-bold text-sm">{totalMembros}</span>
              </div>
              
              <div 
                onClick={() => setVisualizacaoAtiva('em_dia')}
                className={`flex justify-between items-center py-2 px-3 rounded-lg border cursor-pointer transition-all ${visualizacaoAtiva === 'em_dia' ? 'bg-emerald-950/20 border-emerald-800/50' : 'border-transparent hover:bg-emerald-950/10'}`}
              >
                <span className="text-zinc-400 flex items-center gap-1.5">🟢 Membros em dia</span>
                <span className="text-emerald-400 font-bold text-sm">{membrosEmDiaCount} <span className="text-[10px] text-zinc-600">▶</span></span>
              </div>

              <div 
                onClick={() => setVisualizacaoAtiva('em_atraso')}
                className={`flex justify-between items-center py-2 px-3 rounded-lg border cursor-pointer transition-all ${visualizacaoAtiva === 'em_atraso' ? 'bg-red-950/20 border-red-800/50' : 'border-transparent hover:bg-red-950/10'}`}
              >
                <span className="text-zinc-400 flex items-center gap-1.5">🔴 Membros em atraso</span>
                <span className="text-red-400 font-bold text-sm">{membrosEmAtrasoCount} <span className="text-[10px] text-zinc-600">▶</span></span>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-zinc-800/60 mt-6">
            <div className="flex justify-between items-center text-xs font-medium mb-2">
              <span className="text-zinc-400">Taxa de Adimplência Real</span>
              <span className="text-white font-bold">{taxaAdimplencia}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${taxaAdimplencia}%` }} />
            </div>
          </div>

        </div>
      </div>

      {/* MODAL DE NOVO LANÇAMENTO */}
      {exibirModalNovaTransacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#12141c] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white">📝 Novo Lançamento de Caixa</h3>
              <button onClick={() => setExibirModalNovaTransacao(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleCriarLancamento} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Tipo de Movimentação</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNovoLancamento({ ...novoLancamento, tipo: 'entrada', categoria: 'mensalidade', membro_id: '', valor: '', descricao: '', competencia_selecionada: '' })}
                    className={`py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${novoLancamento.tipo === 'entrada' ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400' : 'bg-[#0d0e11] border-zinc-800 text-zinc-500'}`}
                  >
                    🟢 Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoLancamento({ ...novoLancamento, tipo: 'saida', categoria: 'sede', membro_id: '', valor: '', descricao: '', competencia_selecionada: '' })}
                    className={`py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${novoLancamento.tipo === 'saida' ? 'bg-red-950/30 border-red-500 text-red-400' : 'bg-[#0d0e11] border-zinc-800 text-zinc-500'}`}
                  >
                    🔴 Saída
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Categoria</label>
                <select
                  value={novoLancamento.categoria}
                  onChange={(e) => setNovoLancamento(prev => ({ ...prev, categoria: e.target.value, membro_id: '', valor: '', descricao: '', competencia_selecionada: '' }))}
                  className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                >
                  {novoLancamento.tipo === 'entrada' ? (
                    <>
                      <option value="mensalidade">Mensalidade de Irmão</option>
                      <option value="colete">Venda de Colete</option>
                      <option value="doacao">Doação Externa</option>
                      <option value="evento">Arrecadação de Evento</option>
                    </>
                  ) : (
                    <>
                      <option value="sede">Manutenção de Sede / Aluguel</option>
                      <option value="coletes">Confecção de Coletes</option>
                      <option value="estrada">Despesa de Estrada</option>
                    </>
                  )}
                </select>
              </div>

              {(novoLancamento.categoria === 'mensalidade' || novoLancamento.categoria === 'colete') && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Irmão Responsável</label>
                  <select
                    required
                    value={novoLancamento.membro_id}
                    onChange={(e) => setNovoLancamento({ ...novoLancamento, membro_id: e.target.value })}
                    className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">Selecione o Membro...</option>
                    {membrosCompletos.map(m => (
                      <option key={m.id} value={m.id}>{m.nome_completo}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* COMBOBOX DE MENSALIDADES HISTÓRICAS DISPONÍVEIS */}
              {novoLancamento.categoria === 'mensalidade' && novoLancamento.membro_id && (
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Mensalidade Ref. / Competência
                  </label>
                  <select
                    required
                    value={novoLancamento.competencia_selecionada}
                    onChange={(e) => handleMudarCompetencia(e.target.value)}
                    className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                  >
                    <option value="">Selecione o mês devido...</option>
                    {mensalidadesDisponiveis.map((m, idx) => (
                      <option key={idx} value={`${m.mes}-${m.ano}-${m.valor_calculado}`}>
                        {m.label} (Valor Regra: R$ {m.valor_calculado})
                      </option>
                    ))}
                  </select>
                  {mensalidadesDisponiveis.length === 0 && (
                    <p className="text-[10px] text-emerald-400 mt-1 font-semibold">
                      ✅ Este irmão está totalmente em dia no sistema!
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Descrição</label>
                <input
                  type="text"
                  required
                  value={novoLancamento.descricao}
                  onChange={(e) => setNovoLancamento({ ...novoLancamento, descricao: e.target.value })}
                  className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-zinc-400 mb-1">Valor</label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0,00"
                  value={novoLancamento.valor}
                  onChange={(e) => setNovoLancamento({ ...novoLancamento, valor: e.target.value })}
                  className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setExibirModalNovaTransacao(false)} className="w-1/2 py-2 rounded-lg bg-zinc-800 text-xs font-semibold hover:bg-zinc-700">Cancelar</button>
                <button type="submit" disabled={lancandoMovimentacao} className="w-1/2 py-2 rounded-lg bg-blue-600 text-xs font-semibold text-white hover:bg-blue-700">{lancandoMovimentacao ? 'Processando...' : 'Confirmar ⚡'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER LATERAL DE CONFIGURAÇÕES / HISTÓRICO DE REAJUSTE */}
      {exibirMenuConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#12141c] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white">⚙️ Programar Novo Reajuste Histórico</h3>
              <button onClick={() => setExibirMenuConfig(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSalvarConfig} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Mês de Início</label>
                  <input type="number" min="1" max="12" required value={novaVigenciaForm.mes_inicio} onChange={(e) => setNovaVigenciaForm({ ...novaVigenciaForm, mes_inicio: Number(e.target.value) })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
                </div>
                <div>
                  <label className="block text-[10px] uppercase font-bold text-zinc-400 mb-1">Ano de Início</label>
                  <input type="number" required value={novaVigenciaForm.ano_inicio} onChange={(e) => setNovaVigenciaForm({ ...novaVigenciaForm, ano_inicio: Number(e.target.value) })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Novo Valor Prospect (R$)</label>
                <input type="number" step="0.01" required value={novaVigenciaForm.valor_prospect} onChange={(e) => setNovaVigenciaForm({ ...novaVigenciaForm, valor_prospect: e.target.value })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Novo Valor Full Patch (R$)</label>
                <input type="number" step="0.01" required value={novaVigenciaForm.valor_full_patch} onChange={(e) => setNovaVigenciaForm({ ...novaVigenciaForm, valor_full_patch: e.target.value })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Dia Vencimento Geral</label>
                <input type="number" min="1" max="31" required value={novaVigenciaForm.dia_vencimento} onChange={(e) => setNovaVigenciaForm({ ...novaVigenciaForm, dia_vencimento: parseInt(e.target.value, 10) || 15 })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setExibirMenuConfig(false)} className="w-1/2 py-2 rounded-lg bg-zinc-800 text-xs font-semibold hover:bg-zinc-700">Fechar</button>
                <button type="submit" disabled={salvandoConfig} className="w-1/2 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">{salvandoConfig ? 'Salvando...' : 'Gravar Vigência'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}