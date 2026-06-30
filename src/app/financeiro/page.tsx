'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface ConfigFinanceiro {
  valor_prospect: number
  valor_full_patch: number
  dia_vencimento: number
}

interface MembroOpcao {
  id: string
  nome_completo: string
  tp_membro: string
}

// Interface para simular ou renderizar transações recentes conforme o print
interface Transacao {
  id: string
  descricao: string
  categoria: string
  data_movimentacao: string
  valor: number
  tipo: 'entrada' | 'saida'
}

export default function Financeiro() {
  const router = useRouter()
  const supabase = createClient()

  // Estados de controle e autenticação
  const [carregando, setCarregando] = useState(true)
  const [autenticado, setAutenticado] = useState<boolean | null>(null)
  const [salvandoConfig, setSalvandoConfig] = useState(false)
  const [lancandoMovimentacao, setLancandoMovimentacao] = useState(false)

  // Estados de dados do Painel (Conforme os cards do print)
  const [saldoGeral, setSaldoGeral] = useState(5352.15) // Valor inicial/exemplo do print ou dinâmico
  const [entradasMes, setEntradasMes] = useState(100.00)
  const [saidasMes, setSaidasMes] = useState(80.00)
  const [pendenciasAReceber, setPendenciasAReceber] = useState(800.00)

  // Dados da Sidebar de membros (Métricas do print)
  const [totalMembros, setTotalMembros] = useState(5)
  const [membrosEmDia, setMembrosEmDia] = useState(2)
  const [membrosEmAtraso, setMembrosEmAtraso] = useState(3)
  const [taxaAdimplencia, setTaxaAdimplencia] = useState(40)

  // Listas e filtros
  const [membrosList, setMembrosList] = useState<MembroOpcao[]>([])
  const [transacoes, setTransacoes] = useState<Transacao[]>([
    // Mocks iniciais baseados exatamente na imagem enviada para não ficar vazio
    { id: '1', descricao: 'Mensalidade - Matheus da Silva', categoria: 'Mensalidades', data_movimentacao: '2025-12-03', valor: 100.00, tipo: 'entrada' },
    { id: '2', descricao: 'Gasolina', categoria: 'Combustível', data_movimentacao: '2025-12-03', valor: 80.00, tipo: 'saida' },
    { id: '3', descricao: 'Mensalidade - Henrique Souza', categoria: 'Mensalidades', data_movimentacao: '2025-11-12', valor: 100.00, tipo: 'entrada' }
  ])
  const [filtroTexto, setFiltroTexto] = useState('')
  const [filtroTempo, setFiltroTempo] = useState('Este Mês')
  const [filtroCategoria, setFiltroCategoria] = useState('Todos')

  // Modais e formulários
  const [exibirMenuConfig, setExibirMenuConfig] = useState(false)
  const [exibirModalNovaTransacao, setExibirModalNovaTransacao] = useState(false)

  const [config, setConfig] = useState<ConfigFinanceiro>({
    valor_prospect: 45.00,
    valor_full_patch: 55.00,
    dia_vencimento: 15
  })

  const [novoLancamento, setNovoLancamento] = useState({
    tipo: 'entrada',
    categoria: 'mensalidade',
    descricao: '',
    valor: '',
    membro_id: ''
  })

  // Guardião de Rota Blindado
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

  // Monitor Inteligente: Puxa o colete (Patente) e preenche os valores + descrição automaticamente
  useEffect(() => {
    if (novoLancamento.categoria === 'mensalidade' && novoLancamento.membro_id) {
      const irmao = membrosList.find(m => m.id === novoLancamento.membro_id)
      if (irmao) {
        // Valida se na string contem prospect ou prospero (conforme as opções da sua page membros)
        const ehProspect = irmao.tp_membro?.toLowerCase().includes('prospect') || 
                          irmao.tp_membro?.toLowerCase().includes('prospect_i')

        const valorCalculado = ehProspect ? config.valor_prospect : config.valor_full_patch
        const mesAtualNome = new Date().toLocaleString('pt-BR', { month: 'long' })
        const anoAtual = new Date().getFullYear()

        setNovoLancamento(prev => ({
          ...prev,
          valor: valorCalculado.toFixed(2),
          descricao: `Mensalidade - ${irmao.nome_completo}`
        }))
      }
    }
  }, [novoLancamento.membro_id, novoLancamento.categoria, config, membrosList])

  const inicializarModulo = async () => {
    setCarregando(true)
    await Promise.all([
      carregandoConfiguracoes(),
      carregarMembrosOpcoes(),
      calcularFluxoDeCaixa()
    ])
    setCarregando(false)
  }

  const carregandoConfiguracoes = async () => {
    try {
      const { data } = await supabase.from('config_financeiro').select('*').eq('id', 1).single()
      if (data) {
        setConfig({
          valor_prospect: Number(data.valor_prospect),
          valor_full_patch: Number(data.valor_full_patch),
          dia_vencimento: Number(data.dia_vencimento)
        })
      }
    } catch (err) {
      console.error('Erro ao buscar configurações:', err)
    }
  }

  const carregarMembrosOpcoes = async () => {
    try {
      const { data } = await supabase
        .from('membros')
        .select('id, nome_completo, tp_membro')
        .eq('status_ativo', true)
        .order('nome_completo')
      if (data) setMembrosList(data)
    } catch (err) {
      console.error('Erro ao listar membros:', err)
    }
  }

  const calcularFluxoDeCaixa = async () => {
    try {
      const { data: movimentacoes } = await supabase.from('caixa_movimentacoes').select('*').order('data_movimentacao', { ascending: false })
      
      if (movimentacoes && movimentacoes.length > 0) {
        let totalEntradas = 0
        let totalSaidas = 0
        let entMes = 0
        let saiMes = 0

        const mesAtual = new Date().getMonth()
        const anoAtual = new Date().getFullYear()

        const formatadas: Transacao[] = movimentacoes.map(mov => ({
          id: mov.id,
          descricao: mov.descricao,
          categoria: mov.categoria === 'mensalidade' ? 'Mensalidades' : mov.categoria,
          data_movimentacao: mov.data_movimentacao ? mov.data_movimentacao.split('T')[0] : '2026-06-30',
          valor: Number(mov.valor),
          tipo: mov.tipo
        }))

        movimentacoes.forEach(mov => {
          const valorNum = Number(mov.valor)
          // Usando fallback seguro de data se nula
          const dataMov = mov.data_movimentacao ? new Date(mov.data_movimentacao) : new Date()

          if (mov.tipo === 'entrada') {
            totalEntradas += valorNum
            if (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual) entMes += valorNum
          } else if (mov.tipo === 'saida') {
            totalSaidas += valorNum
            if (dataMov.getMonth() === mesAtual && dataMov.getFullYear() === anoAtual) saiMes += valorNum
          }
        })

        setTransacoes(formatadas)
        setSaldoGeral(totalEntradas - totalSaidas)
        setEntradasMes(entMes)
        setSaidasMes(saiMes)
      }
    } catch (err) {
      console.error('Erro ao calcular caixa:', err)
    }
  }

  const handleSalvarConfig = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvandoConfig(true)
    try {
      const { error } = await supabase
        .from('config_financeiro')
        .update({
          valor_prospect: config.valor_prospect,
          valor_full_patch: config.valor_full_patch,
          dia_vencimento: config.dia_vencimento,
          updated_at: new Date().toISOString()
        })
        .eq('id', 1)

      if (error) throw error
      alert('Configurações do High Command atualizadas! ⚡')
      setExibirMenuConfig(false)
    } catch (err) {
      console.error(err)
      alert('Erro ao salvar configurações.')
    } finally {
      setSalvandoConfig(false)
    }
  }

  const handleCriarLancamento = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!novoLancamento.valor || Number(novoLancamento.valor) <= 0) return alert('Insira um valor válido.')
    setLancandoMovimentacao(true)

    const mesAtual = new Date().getMonth() + 1
    const anoAtual = new Date().getFullYear()

    try {
      let mensalidadeIdGerada = null

      // 🛡️ TRAVA BLINDADA DE DUPLICIDADE PARA MENSALIDADES
      if (novoLancamento.categoria === 'mensalidade') {
        if (!novoLancamento.membro_id) {
          alert('Por favor, selecione um irmão para realizar a baixa.')
          setLancandoMovimentacao(false)
          return
        }

        const { data: jaPago } = await supabase
          .from('mensalidades')
          .select('id')
          .eq('membro_id', novoLancamento.membro_id)
          .eq('mes', mesAtual)
          .eq('ano', anoAtual)
          .maybeSingle()

        if (jaPago) {
          alert('❌ Operação Interrompida: Este irmão já consta como PAGO no mês atual!')
          setLancandoMovimentacao(false)
          return
        }

        const { data: novaMensalidade, error: erroMensalidade } = await supabase
          .from('mensalidades')
          .insert({
            membro_id: novoLancamento.membro_id,
            mes: mesAtual,
            ano: anoAtual,
            valor_pago: Number(novoLancamento.valor)
          })
          .select()
          .single()

        if (erroMensalidade) throw erroMensalidade
        if (novaMensalidade) mensalidadeIdGerada = novaMensalidade.id
      }

      // 💸 INSERE NO FLUXO DE CAIXA REAL DO BANCO
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
        membro_id: ''
      })
      
      await calcularFluxoDeCaixa()
    } catch (err) {
      console.error(err)
      alert('Erro crítico ao salvar no banco.')
    } finally {
      setLancandoMovimentacao(false)
    }
  }

  const limparFiltros = () => {
    setFiltroTexto('')
    setFiltroTempo('Todos')
    setFiltroCategoria('Todos')
  }

  // Lógica de filtragem inline idêntica ao print
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
      
      {/* 1. TOPO: Título Alinhado à Esquerda e Botões Alinhados à Direita conforme Imagem */}
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Financeiro</h1>
          <p className="text-sm text-zinc-400">Gerencie as finanças do seu Moto Clube</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={() => calcularFluxoDeCaixa()}
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

      {/* 2. GRID DE CARDS: Design idêntico ao print recebido */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        
        {/* Card Saldo */}
        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5 relative">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Saldo</span>
            <span className="text-sm opacity-60">📁</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-white">
            R$ {saldoGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Saldo atual</p>
        </div>

        {/* Card Receitas */}
        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Receitas</span>
            <span className="text-sm text-emerald-500 font-bold">↗</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-emerald-500">
            R$ {entradasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Este mês</p>
        </div>

        {/* Card Despesas */}
        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Despesas</span>
            <span className="text-sm text-red-400 font-bold">↘</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-[#f87171]">
            R$ {saidasMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">Este mês</p>
        </div>

        {/* Card Pendências */}
        <div className="rounded-xl border border-zinc-800/60 bg-[#12141c] p-5">
          <div className="flex justify-between items-center text-zinc-400">
            <span className="text-xs font-medium">Pendências</span>
            <span className="text-sm opacity-60">💳</span>
          </div>
          <p className="mt-3 text-2xl font-bold text-amber-500">
            R$ {pendenciasAReceber.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="mt-1 text-xs text-zinc-500">A receber</p>
        </div>
      </div>

      {/* 3. BLOCO DE FILTROS INLINE (Filtros conforme o print) */}
      <div className="mb-6 rounded-xl border border-zinc-800/60 bg-[#12141c] p-4">
        <div className="flex items-center gap-2 mb-3 text-sm font-semibold text-white">
          <span>⚙️</span> Filtros
        </div>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-4">
          <div className="relative">
            <input
              type="text"
              placeholder="Buscar transações..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-zinc-700 placeholder-zinc-600"
            />
          </div>

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

          <button
            onClick={limparFiltros}
            className="rounded-lg border border-zinc-800 bg-[#0d0e11] py-2 text-xs font-medium text-zinc-400 hover:text-white hover:bg-zinc-800/40 transition-colors"
          >
            Limpar Filtros
          </button>
        </div>
      </div>

      {/* 4. DUAS COLUNAS PRINCIPAIS: Transações Recentes vs Sidebar Membros (Exatamente como o print) */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {/* Coluna Esquerda: Lista de Transações Recentes */}
        <div className="lg:col-span-8 rounded-xl border border-zinc-800/40 bg-[#12141c]/50 p-6">
          <h2 className="text-base font-bold text-white mb-1">$ Transações Recentes</h2>
          <p className="text-xs text-zinc-500 mb-6">Últimas movimentações financeiras</p>

          <div className="space-y-3">
            {transacoesFiltradas.length === 0 ? (
              <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhum registro encontrado.</p>
            ) : (
              transacoesFiltradas.map((t) => (
                <div key={t.id} className="flex items-center justify-between rounded-xl bg-[#12141c] border border-zinc-800/80 p-4 hover:border-zinc-700/80 transition-all">
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
        </div>

        {/* Coluna Direita: Sidebar com Indicadores de Adimplência e Quantidade de Membros */}
        <div className="lg:col-span-4 rounded-xl border border-zinc-800/40 bg-[#12141c]/50 p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-base font-bold text-white mb-6 flex items-center gap-2">
              <span>👥</span> Membros
            </h2>

            <div className="space-y-4 text-xs font-medium">
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400">Total de Membros</span>
                <span className="text-white font-bold">{totalMembros}</span>
              </div>
              
              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400">Membros em dias</span>
                <span className="text-emerald-400 font-bold">{membrosEmDia}</span>
              </div>

              <div className="flex justify-between items-center py-1">
                <span className="text-zinc-400">Membros em atraso</span>
                <span className="text-red-400 font-bold">{membrosEmAtraso}</span>
              </div>
            </div>
          </div>

          {/* Barra de Progresso/Métrica de Adimplência Inferior do Print */}
          <div className="pt-6 border-t border-zinc-800/60 mt-6">
            <div className="flex justify-between items-center text-xs font-medium mb-2">
              <span className="text-zinc-400">Taxa de Adimplência</span>
              <span className="text-white font-bold">{taxaAdimplencia}%</span>
            </div>
            <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-500 h-full transition-all duration-500" 
                style={{ width: `${taxaAdimplencia}%` }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ======================================================== */}
      {/* 🪙 MODAL RETRÁTIL DE NOVO LANÇAMENTO (FORMULÁRIO SEGURO)   */}
      {/* ======================================================== */}
      {exibirModalNovaTransacao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#12141c] p-6 shadow-2xl animate-fadeIn">
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
                    onClick={() => setNovoLancamento({ ...novoLancamento, tipo: 'entrada', categoria: 'mensalidade', membro_id: '', valor: '', descricao: '' })}
                    className={`py-2 rounded-lg text-xs font-bold uppercase border transition-colors ${novoLancamento.tipo === 'entrada' ? 'bg-emerald-950/30 border-emerald-500 text-emerald-400' : 'bg-[#0d0e11] border-zinc-800 text-zinc-500'}`}
                  >
                    🟢 Entrada
                  </button>
                  <button
                    type="button"
                    onClick={() => setNovoLancamento({ ...novoLancamento, tipo: 'saida', categoria: 'sede', membro_id: '', valor: '', descricao: '' })}
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
                  onChange={(e) => setNovoLancamento(prev => ({ ...prev, categoria: e.target.value, membro_id: '', valor: '', descricao: '' }))}
                  className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none"
                >
                  {novoLancamento.tipo === 'entrada' ? (
                    <>
                      <option value="mensalidade">Mensalidade de Irmão</option>
                      <option value="colete">Venda de Colete</option>
                      <option value="doacao">Doação Externa / Padrinho</option>
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
                    {membrosList.map(m => (
                      <option key={m.id} value={m.id}>{m.nome_completo}</option>
                    ))}
                  </select>
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

      {/* ======================================================== */}
      {/* ⚙️ DRAWER LATERAL DE MENSALIDADES / PARÂMETROS BASE        */}
      {/* ======================================================== */}
      {exibirMenuConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#12141c] p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="text-md font-bold text-white">⚙️ Valores Base do Cofre</h3>
              <button onClick={() => setExibirMenuConfig(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSalvarConfig} className="space-y-4">
              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mensalidade Prospect (R$)</label>
                <input type="number" step="0.01" required value={config.valor_prospect} onChange={(e) => setConfig({ ...config, valor_prospect: Number(e.target.value) })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Mensalidade Full Patch (R$)</label>
                <input type="number" step="0.01" required value={config.valor_full_patch} onChange={(e) => setConfig({ ...config, valor_full_patch: Number(e.target.value) })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
              </div>

              <div>
                <label className="block text-xs text-zinc-400 mb-1">Dia Vencimento</label>
                <input type="number" min="1" max="31" required value={config.dia_vencimento} onChange={(e) => setConfig({ ...config, dia_vencimento: parseInt(e.target.value, 10) || config.dia_vencimento })} className="w-full rounded-lg bg-[#0d0e11] border border-zinc-800 p-2 text-xs text-white focus:outline-none" />
              </div>

              <div className="pt-2 flex gap-2">
                <button type="button" onClick={() => setExibirMenuConfig(false)} className="w-1/2 py-2 rounded-lg bg-zinc-800 text-xs font-semibold hover:bg-zinc-700">Fechar</button>
                <button type="submit" disabled={salvandoConfig} className="w-1/2 py-2 rounded-lg bg-emerald-600 text-xs font-semibold text-white hover:bg-emerald-700">{salvandoConfig ? 'Salvando...' : 'Salvar Alterações'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}