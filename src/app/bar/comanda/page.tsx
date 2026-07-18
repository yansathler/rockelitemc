'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase'

interface Produto {
  id: string
  nome: string
  preco_compra: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
}

interface Membro {
  id: string
  nome_completo: string
}

interface Comanda {
  id: string
  membro_id: string | null
  nome_visitante: string | null
  status: 'Aberta' | 'Paga' // Removido 'Pendurada'
  valor_total: number
  total: number | null
  created_at: string
  closed_at: string | null
  caixa_movimentacao_id: string | null
  membros?: {
    nome_completo: string
  } | null
}

interface ComandaItem {
  id: string
  comanda_id: string
  produto_id: string
  quantidade: number
  preco_custo_aplicado: number
  preco_venda_aplicado: number
  created_at: string
  bar_produtos?: {
    nome: string
  }
}

export default function ComandasPage() {
  const router = useRouter()
  const supabase = createClient()

  // Estados de Controle e Acesso
  const [carregando, setCarregando] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Estados de Dados
  const [comandas, setComandas] = useState<Comanda[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [comandaSelecionada, setComandaSelecionada] = useState<Comanda | null>(null)
  const [itensComanda, setItensComanda] = useState<ComandaItem[]>([])

  // Filtros (Removido 'Pendurada')
  const [filtroStatus, setFiltroStatus] = useState<'Aberta' | 'Paga' | 'Todas'>('Aberta')
  const [filtroTipoCliente, setFiltroTipoCliente] = useState<'todos' | 'membro' | 'visitante'>('todos')

  // Modais
  const [modalNovaComanda, setModalNovaComanda] = useState(false)
  const [modalLancamento, setModalLancamento] = useState(false)
  const [modalFecharComanda, setModalFecharComanda] = useState(false)

  // Formulário Nova Comanda
  const [nomeVisitante, setNomeVisitante] = useState('')
  const [membroSelecionadoId, setMembroSelecionadoId] = useState('')
  const [tipoCliente, setTipoCliente] = useState<'membro' | 'visitante'>('visitante')

  // Formulário Lançamento de Item
  const [produtoLancamentoId, setProdutoLancamentoId] = useState('')
  const [quantidadeLancamento, setQuantidadeLancamento] = useState(1)

  // Formulário de Fechamento de Comanda (Removido 'pendurar')
  const [metodoPagamento, setMetodoPagamento] = useState<'dinheiro' | 'pix' | 'cartao'>('pix')

  // Estado auxiliar para calcular totais das comandas
  const [totaisComandas, setTotaisComandas] = useState<Record<string, number>>({})

  useEffect(() => {
    async function checarAcesso() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setAutenticado(true)
        await Promise.all([carregarComandas(), carregarProdutos(), carregarMembros()])
      }
    }
    checarAcesso()
  }, [])

  useEffect(() => {
    if (comandaSelecionada) {
      carregarItensComanda(comandaSelecionada.id)
    } else {
      setItensComanda([])
    }
  }, [comandaSelecionada])

  const totalComandaSelecionada = itensComanda.reduce(
    (acc, item) => acc + (item.quantidade * item.preco_venda_aplicado), 
    0
  )

  async function carregarMembros() {
    try {
      const { data, error } = await supabase
        .from('membros')
        .select('id, nome_completo')
        .eq('status_ativo', true)
        .order('nome_completo', { ascending: true })

      if (error) throw error
      if (data) setMembros(data)
    } catch (err: any) {
      console.error('Erro ao carregar membros:', err.message)
    }
  }

  async function carregarComandas() {
    try {
      setCarregando(true)
      const { data: comandasData, error: errorComandas } = await supabase
        .from('bar_comandas')
        .select('*, membros(nome_completo)')

      if (errorComandas) throw errorComandas
      
      const listaComandas = (comandasData || []) as Comanda[]
      setComandas(listaComandas)

      if (listaComandas.length > 0) {
        const { data: itensData, error: errorItens } = await supabase
          .from('bar_comanda_itens')
          .select('comanda_id, quantidade, preco_venda_aplicado')

        if (!errorItens && itensData) {
          const mapaTotais: Record<string, number> = {}
          listaComandas.forEach(c => { mapaTotais[c.id] = 0 })
          itensData.forEach(item => {
            if (mapaTotais[item.comanda_id] !== undefined) {
              mapaTotais[item.comanda_id] += (item.quantidade * item.preco_venda_aplicado)
            }
          })
          setTotaisComandas(mapaTotais)
        }
      }
    } catch (error) {
      console.error('Erro ao buscar comandas:', error)
    } finally {
      setCarregando(false)
    }
  }

  async function carregarProdutos() {
    try {
      const { data, error } = await supabase
        .from('bar_produtos')
        .select('id, nome, preco_compra, preco_venda, estoque_atual, estoque_minimo')
        .order('nome', { ascending: true })

      if (error) throw error
      setProdutos(data || [])
    } catch (error) {
      console.error('Erro ao carregar produtos:', error)
    }
  }

  async function carregarItensComanda(comandaId: string) {
    try {
      const { data, error } = await supabase
        .from('bar_comanda_itens')
        .select(`
          id,
          comanda_id,
          produto_id,
          quantidade,
          preco_custo_aplicado,
          preco_venda_aplicado,
          created_at,
          bar_produtos ( nome )
        `)
        .eq('comanda_id', comandaId)

      if (error) throw error
      setItensComanda(data as any || [])
    } catch (error) {
      console.error('Erro ao buscar itens da comanda:', error)
    }
  }

  async function handleCriarComanda(e: React.FormEvent) {
    e.preventDefault()

    let payload: Partial<Comanda> = {
      status: 'Aberta'
    }

    if (tipoCliente === 'membro') {
      if (!membroSelecionadoId) {
        alert('❌ Por favor, selecione um irmão/membro da lista.')
        return
      }
      payload.membro_id = membroSelecionadoId
      payload.nome_visitante = null
    } else {
      if (!nomeVisitante.trim()) {
        alert('❌ Por favor, digite o nome do visitante.')
        return
      }
      payload.membro_id = null
      payload.nome_visitante = nomeVisitante.trim()
    }

    try {
      setSubmitting(true)
      const { data, error } = await supabase
        .from('bar_comandas')
        .insert([payload])
        .select('*, membros(nome_completo)')
        .single()

      if (error) {
        if (error.code === '23505') {
          throw new Error('Este irmão já possui uma comanda ativa em aberto no sistema.')
        }
        throw error
      }

      alert('🎉 Comanda aberta com sucesso!')
      
      setNomeVisitante('')
      setMembroSelecionadoId('')
      setModalNovaComanda(false)
      await carregarComandas()
      
      if (data) {
        setComandaSelecionada(data as Comanda)
      }
    } catch (error: any) {
      alert(error.message || 'Erro ao abrir comanda.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleLancarItem(e: React.FormEvent) {
    e.preventDefault()
    if (!comandaSelecionada || !produtoLancamentoId) return

    const produto = produtos.find(p => p.id === produtoLancamentoId)
    if (!produto) return

    if (produto.estoque_atual < quantidadeLancamento) {
      alert(`❌ Operação bloqueada! Estoque insuficiente de ${produto.nome}. Disponível apenas: ${produto.estoque_atual} unidade(s).`)
      return
    }

    try {
      setSubmitting(true)
      const valorLancamento = produto.preco_venda * quantidadeLancamento

      const { error: errorEstoque } = await supabase
        .from('bar_produtos')
        .update({ estoque_atual: produto.estoque_atual - quantidadeLancamento })
        .eq('id', produto.id)

      if (errorEstoque) throw errorEstoque

      const itemExistente = itensComanda.find(item => item.produto_id === produto.id)

      if (itemExistente) {
        const { error: errorUpdateItem } = await supabase
          .from('bar_comanda_itens')
          .update({ quantidade: itemExistente.quantidade + quantidadeLancamento })
          .eq('id', itemExistente.id)

        if (errorUpdateItem) throw errorUpdateItem
      } else {
        const { error: errorInsertItem } = await supabase
          .from('bar_comanda_itens')
          .insert([{
            comanda_id: comandaSelecionada.id,
            produto_id: produto.id,
            quantidade: quantidadeLancamento,
            preco_custo_aplicado: produto.preco_compra,
            preco_venda_aplicado: produto.preco_venda
          }])

        if (errorInsertItem) throw errorInsertItem
      }

      const novoTotalComanda = (totaisComandas[comandaSelecionada.id] || 0) + valorLancamento
      await supabase
        .from('bar_comandas')
        .update({ valor_total: novoTotalComanda, total: novoTotalComanda })
        .eq('id', comandaSelecionada.id)

      alert('Item lançado com sucesso!')
      setProdutoLancamentoId('')
      setQuantidadeLancamento(1)
      setModalLancamento(false)
      
      await Promise.all([
        carregarProdutos(),
        carregarComandas(),
        carregarItensComanda(comandaSelecionada.id)
      ])

    } catch (error: any) {
      alert(error.message || 'Erro ao lançar item.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRemoverItem(item: ComandaItem) {
    if (!comandaSelecionada) return
    
    const confirmar = confirm(`Deseja realmente estornar o produto? Isso devolverá ${item.quantidade} unidade(s) ao estoque físico.`)
    if (!confirmar) return

    try {
      setSubmitting(true)

      const { data: prodData, error: prodGetError } = await supabase
        .from('bar_produtos')
        .select('estoque_atual')
        .eq('id', item.produto_id)
        .single()

      if (prodGetError) throw prodGetError

      const { error: prodUpdateError } = await supabase
        .from('bar_produtos')
        .update({ estoque_atual: prodData.estoque_atual + item.quantidade })
        .eq('id', item.produto_id)

      if (prodUpdateError) throw prodUpdateError

      const { error: itemDeleteError } = await supabase
        .from('bar_comanda_itens')
        .delete()
        .eq('id', item.id)

      if (itemDeleteError) throw itemDeleteError

      const valorEstornado = item.quantidade * item.preco_venda_aplicado
      const novoTotalComanda = Math.max(0, (totaisComandas[comandaSelecionada.id] || 0) - valorEstornado)
      
      await supabase
        .from('bar_comandas')
        .update({ valor_total: novoTotalComanda, total: novoTotalComanda })
        .eq('id', comandaSelecionada.id)

      alert('Item estornado com sucesso!')
      
      await Promise.all([
        carregarProdutos(),
        carregarComandas(),
        carregarItensComanda(comandaSelecionada.id)
      ])

    } catch (error: any) {
      alert(error.message || 'Erro ao estornar item.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleFecharComanda(e: React.FormEvent) {
    e.preventDefault()
    if (!comandaSelecionada) return

    if (totalComandaSelecionada <= 0) {
      alert('⚠️ Não é possível finalizar comanda sem consumo.')
      return
    }

    try {
      setSubmitting(true)
      let caixaMovimentacaoId: string | null = null

      const metodosTraduzidos = { dinheiro: 'Dinheiro', pix: 'PIX', cartao: 'Cartão' }
      const descMetodo = metodosTraduzidos[metodoPagamento]
      const identificacaoCliente = comandaSelecionada.membros?.nome_completo || comandaSelecionada.nome_visitante || 'Cliente'

      const { data: caixaData, error: errorCaixa } = await supabase
        .from('caixa_movimentacoes')
        .insert([{
          tipo: 'entrada',
          categoria: 'Bar - Faturamento',
          descricao: `Faturamento Bar - Comanda ID: ${comandaSelecionada.id.substring(0,8)} (${identificacaoCliente}) [Mtd: ${descMetodo}]`,
          valor: totalComandaSelecionada,
          data_movimentacao: new Date().toISOString()
        }])
        .select('id')
        .single()

      if (errorCaixa) throw errorCaixa
      if (caixaData) caixaMovimentacaoId = caixaData.id

      const { error: errorComanda } = await supabase
        .from('bar_comandas')
        .update({ 
          status: 'Paga', // Forçado sempre como Paga
          closed_at: new Date().toISOString(),
          caixa_movimentacao_id: caixaMovimentacaoId,
          valor_total: totalComandaSelecionada,
          total: totalComandaSelecionada
        })
        .eq('id', comandaSelecionada.id)

      if (errorComanda) throw errorComanda

      alert('Comanda fechada e faturamento registrado no caixa geral!')

      setModalFecharComanda(false)
      setComandaSelecionada(null)
      await carregarComandas()

    } catch (error: any) {
      alert(error.message || 'Erro ao processar fechamento.')
    } finally {
      setSubmitting(false)
    }
  }

  const comandasFiltradas = comandas
    .filter(c => {
      const atendeStatus = filtroStatus === 'Todas' ? true : c.status === filtroStatus
      const atendeTipo = filtroTipoCliente === 'todos' ? true : 
                         filtroTipoCliente === 'membro' ? c.membro_id !== null : c.nome_visitante !== null
      return atendeStatus && atendeTipo
    })
    .sort((a, b) => (totaisComandas[b.id] || 0) - (totaisComandas[a.id] || 0))

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 font-medium text-xs tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl animate-spin">🍻</span>
          <span>Sincronizando com banco relacional...</span>
        </div>
      </div>
    )
  }

  if (!autenticado) return null

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* HEADER */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">🍻 Painel de Comandas</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Gestão de adega parametrizada por ID e Integrada ao Caixa</p>
        </div>

        <div className="flex items-center gap-3">
          <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            Voltar ao Dash
          </button>
          <button onClick={() => setModalNovaComanda(true)} className="rounded-lg bg-white px-5 py-2 text-xs font-black uppercase text-zinc-950 hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            ⚡ Abrir Comanda
          </button>
        </div>
      </div>

      {/* FILTROS (Sem o status Pendurada) */}
      <div className="mb-6 flex flex-wrap gap-4 items-center justify-between border-b border-zinc-900 pb-4">
        <div className="flex gap-2">
          {(['Aberta', 'Paga', 'Todas'] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFiltroStatus(status)}
              className={`rounded-md px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider transition-all ${
                filtroStatus === status 
                  ? 'bg-zinc-800 text-white border border-zinc-700' 
                  : 'text-zinc-500 hover:text-zinc-350'
              }`}
            >
              {status === 'Aberta' ? '🟢 Abertas' : status === 'Paga' ? '🔴 Pagas' : '📁 Todas'}
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          {(['todos', 'membro', 'visitante'] as const).map((tipo) => (
            <button
              key={tipo}
              onClick={() => setFiltroTipoCliente(tipo)}
              className={`rounded-md px-3 py-1 text-[10px] font-bold uppercase transition-all ${
                filtroTipoCliente === tipo 
                  ? 'bg-zinc-900 border border-zinc-800 text-zinc-300' 
                  : 'text-zinc-600 hover:text-zinc-450'
              }`}
            >
              {tipo === 'todos' ? '👥 Todos' : tipo === 'membro' ? '🛡️ Membros' : '💼 Visitantes'}
            </button>
          ))}
        </div>
      </div>

      {/* GRADE CENTRAL */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* MURAL */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 lg:col-span-2">
          <div className="mb-4 border-l-2 border-zinc-700 pl-3 flex justify-between items-center">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Mural Ativo ({comandasFiltradas.length})</h2>
          </div>

          {comandasFiltradas.length === 0 ? (
            <p className="text-xs text-zinc-500 italic p-6 text-center">Nenhuma comanda localizada.</p>
          ) : (
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {comandasFiltradas.map((c) => {
                const ehMembro = c.membro_id !== null
                const nomeCliente = ehMembro ? c.membros?.nome_completo : c.nome_visitante
                const totalCalculado = totaisComandas[c.id] || 0
                return (
                  <div
                    key={c.id}
                    onClick={() => setComandaSelecionada(c)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all select-none ${
                      comandaSelecionada?.id === c.id 
                        ? 'bg-zinc-900 border-zinc-700' 
                        : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div className="space-y-1.5">
                        <h3 className="text-sm font-black text-white uppercase tracking-wide truncate max-w-[190px]">
                          {nomeCliente || 'Desconhecido'}
                        </h3>
                        
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-medium font-mono text-zinc-500">Cod: #{c.id.substring(0, 8)}</span>
                          {c.status === 'Aberta' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                        </div>
                        
                        <div className="flex gap-1.5">
                          <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${ehMembro ? 'bg-zinc-800 text-zinc-300' : 'bg-zinc-950 text-zinc-500'}`}>
                            {ehMembro ? '🛡️ Membro' : '💼 Visitante'}
                          </span>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <span className="text-xs font-mono font-black text-white">R$ {totalCalculado.toFixed(2)}</span>
                        <p className="text-[9px] text-zinc-500 uppercase tracking-wide mt-1">Total</p>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* DETALHES DA COMANDA */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between">
          {comandaSelecionada ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="border-b border-zinc-900 pb-3 mb-4 flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono uppercase text-zinc-500 block">UUID: {comandaSelecionada.id.substring(0,8)}...</span>
                    <h3 className="text-sm font-black text-white uppercase font-mono">
                      {comandaSelecionada.membro_id ? comandaSelecionada.membros?.nome_completo : comandaSelecionada.nome_visitante}
                    </h3>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                    comandaSelecionada.status === 'Aberta' ? 'bg-emerald-950 text-emerald-450 border border-emerald-900/40' : 'bg-zinc-850 text-zinc-400'
                  }`}>
                    {comandaSelecionada.status}
                  </span>
                </div>

                <div className="space-y-3">
                  <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">📋 Consumo</h4>
                  
                  {itensComanda.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-4 text-center">Nenhum item lançado.</p>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto pr-1">
                      {itensComanda.map((item) => {
                        const subtotalItem = item.quantidade * item.preco_venda_aplicado
                        return (
                          <div key={item.id} className="flex justify-between items-center text-xs p-2.5 bg-zinc-950/60 border border-zinc-900 rounded-lg">
                            <div>
                              <p className="font-bold text-zinc-200 uppercase">{item.bar_produtos?.nome}</p>
                              <span className="text-[9px] text-zinc-500 font-mono">
                                {item.quantidade}x R$ {Number(item.preco_venda_aplicado).toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="font-bold text-white font-mono">R$ {subtotalItem.toFixed(2)}</span>
                              {comandaSelecionada.status === 'Aberta' && (
                                <button onClick={() => handleRemoverItem(item)} className="text-red-500 hover:text-red-400 text-xs">❌</button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-6 p-4 rounded-xl bg-zinc-950/40 border border-zinc-900 flex justify-between items-center">
                  <span className="text-[10px] text-zinc-400 uppercase tracking-wider font-bold">Saldo total</span>
                  <span className="text-xl font-mono font-black text-white">R$ {totalComandaSelecionada.toFixed(2)}</span>
                </div>
              </div>

              {comandaSelecionada.status === 'Aberta' && (
                <div className="mt-6 pt-4 border-t border-zinc-900 grid grid-cols-2 gap-2">
                  <button onClick={() => setModalLancamento(true)} className="py-2.5 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-xs font-bold uppercase hover:bg-zinc-700 transition-colors">
                    ➕ Adicionar Item
                  </button>
                  <button onClick={() => setModalFecharComanda(true)} className="py-2.5 bg-emerald-500 text-zinc-950 rounded-lg text-xs font-black uppercase hover:bg-emerald-400 transition-all">
                    💸 Encerrar Conta
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500 italic py-12 text-center">
              Selecione uma comanda ativa para operar.
            </div>
          )}
        </div>

      </div>

      {/* MODAL: NOVA COMANDA */}
      {modalNovaComanda && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono mb-4">🔓 Nova Comanda</h2>
            
            <form onSubmit={handleCriarComanda} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Tipo de Cliente</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoCliente('visitante')}
                    className={`py-2 rounded-lg border text-xs font-bold uppercase transition ${tipoCliente === 'visitante' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950 border-zinc-900 text-zinc-500'}`}
                  >
                    💼 Visitante
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoCliente('membro')}
                    className={`py-2 rounded-lg border text-xs font-bold uppercase transition ${tipoCliente === 'membro' ? 'bg-zinc-800 border-zinc-700 text-white' : 'bg-zinc-950 border-zinc-900 text-zinc-500'}`}
                  >
                    🛡️ Irmão / Membro
                  </button>
                </div>
              </div>

              {tipoCliente === 'visitante' ? (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Nome do Visitante</label>
                  <input 
                    type="text" 
                    required
                    value={nomeVisitante}
                    onChange={(e) => setNomeVisitante(e.target.value)}
                    placeholder="Ex: Lucas Silva" 
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              ) : (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Selecione o Irmão</label>
                  <select
                    required
                    value={membroSelecionadoId}
                    onChange={(e) => setMembroSelecionadoId(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  >
                    <option value="">Selecione...</option>
                    {membros.map((m) => (
                      <option key={m.id} value={m.id}>{m.nome_completo}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-zinc-850">
                <button type="button" onClick={() => setModalNovaComanda(false)} className="w-1/2 px-4 py-2 bg-zinc-800 text-white font-bold text-xs uppercase rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="w-1/2 px-4 py-2 bg-white text-zinc-950 font-black text-xs uppercase rounded-lg">
                  {submitting ? 'Gravando...' : 'Abrir'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LANÇAR ITEM */}
      {modalLancamento && comandaSelecionada && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono mb-4">📥 Lançar Insumo</h2>
            
            <form onSubmit={handleLancarItem} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Produto</label>
                <select 
                  required
                  value={produtoLancamentoId}
                  onChange={(e) => setProdutoLancamentoId(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                >
                  <option value="">Selecione...</option>
                  {produtos.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.estoque_atual <= 0}>
                      {p.nome} ({p.estoque_atual} un) - R$ {Number(p.preco_venda).toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Quantidade</label>
                <input 
                  type="number" 
                  min="1"
                  required
                  value={quantidadeLancamento}
                  onChange={(e) => setQuantidadeLancamento(parseInt(e.target.value) || 1)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200"
                />
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-850">
                <button type="button" onClick={() => setModalLancamento(false)} className="w-1/2 px-4 py-2 bg-zinc-800 text-white font-bold text-xs uppercase rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="w-1/2 px-4 py-2 bg-white text-zinc-950 font-black text-xs uppercase rounded-lg">
                  Lançar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: FECHAR COMANDA (Apenas opções à vista) */}
      {modalFecharComanda && comandaSelecionada && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-sm rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono mb-2">💸 Fechamento</h2>
            <p className="text-[11px] text-zinc-400 uppercase mb-4">Total: <strong className="text-white">R$ {totalComandaSelecionada.toFixed(2)}</strong></p>
            
            <form onSubmit={handleFecharComanda} className="space-y-4">
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setMetodoPagamento('pix')}
                  className={`w-full py-3 rounded-lg border text-xs font-bold uppercase flex justify-between px-4 ${metodoPagamento === 'pix' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-450' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                >
                  <span>📱 Pix</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPagamento('dinheiro')}
                  className={`w-full py-3 rounded-lg border text-xs font-bold uppercase flex justify-between px-4 ${metodoPagamento === 'dinheiro' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-450' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                >
                  <span>💵 Dinheiro</span>
                </button>

                <button
                  type="button"
                  onClick={() => setMetodoPagamento('cartao')}
                  className={`w-full py-3 rounded-lg border text-xs font-bold uppercase flex justify-between px-4 ${metodoPagamento === 'cartao' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-450' : 'bg-zinc-950 border-zinc-850 text-zinc-400'}`}
                >
                  <span>💳 Cartão</span>
                </button>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-850">
                <button type="button" onClick={() => setModalFecharComanda(false)} className="w-1/2 px-4 py-2 bg-zinc-800 text-white font-bold text-xs uppercase rounded-lg">
                  Cancelar
                </button>
                <button type="submit" disabled={submitting} className="w-1/2 px-4 py-2 bg-white text-zinc-950 font-black text-xs uppercase rounded-lg">
                  Confirmar Pagamento
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
} 