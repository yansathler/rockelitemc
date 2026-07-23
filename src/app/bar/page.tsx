'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase' 

// Tipagem dos dados do banco de dados do bar
interface Produto {
  id: string
  nome: string
  preco_compra: number
  preco_venda: number
  estoque_atual: number
  estoque_minimo: number
  created_at: string
}

export default function EstoqueBarPage() {
  const router = useRouter()
  const supabase = createClient() // Instanciação padronizada

  // Estados de Controle e Acesso
  const [carregando, setCarregando] = useState(true)
  const [autenticado, setAutenticado] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Estados de Dados do Estoque
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  
  // Estado de Filtro dos Cards
  const [filtro, setFiltro] = useState<'todos' | 'critico'>('todos')

  // Estados dos Modais
  const [modalProdutoAberto, setModalProdutoAberto] = useState(false)
  const [modalMovimentarAberto, setModalMovimentarAberto] = useState(false)

  // Formulário de Cadastro de Novo Produto
  const [nome, setNome] = useState('')
  const [precoCompra, setPrecoCompra] = useState(0)
  const [precoVenda, setPrecoVenda] = useState(0)
  const [estoqueInicial, setEstoqueInicial] = useState(0)
  const [estoqueMinimo, setEstoqueMinimo] = useState(5)

  // Formulário de Movimentação (Entrada / Perda)
  const [tipoMovimentacao, setTipoMovimentacao] = useState<'entrada' | 'perda'>('entrada')
  const [quantidadeMovimentacao, setQuantidadeMovimentacao] = useState(1)
  const [motivoPerda, setMotivoPerda] = useState('')
  const [novoPrecoCompra, setNovoPrecoCompra] = useState(0)

  useEffect(() => {
    if (produtoSelecionado) {
      setNovoPrecoCompra(produtoSelecionado.preco_compra)
    }
  }, [produtoSelecionado])

  useEffect(() => {
    async function checarAcesso() {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        router.push('/login')
      } else {
        setAutenticado(true)
        await carregarEstoque()
      }
    }
    checarAcesso()
  }, [])

  async function carregarEstoque() {
    try {
      setCarregando(true)
      const { data, error } = await supabase
        .from('bar_produtos')
        .select('*')
        .order('nome', { ascending: true })

      if (error) throw error
      const listaProdutos = data || []
      setProdutos(listaProdutos)

      if (listaProdutos.length > 0 && !produtoSelecionado) {
        setProdutoSelecionado(listaProdutos[0])
      }
    } catch (error) {
      console.error('Erro ao buscar estoque:', error)
    } finally {
      setCarregando(false)
    }
  }

  // RNP-01 & RNE-01: Cadastro de novo produto com validações táticas
  async function handleCadastrarProduto(e: React.FormEvent) {
    e.preventDefault()
    if (precoVenda < precoCompra) {
      alert('⚠️ Erro: O preço de revenda não pode ser menor que o preço de compra!')
      return
    }

    try {
      setSubmitting(true)
      const { error } = await supabase.from('bar_produtos').insert([
        {
          nome,
          preco_compra: precoCompra,
          preco_venda: precoVenda,
          estoque_atual: estoqueInicial,
          estoque_minimo: estoqueMinimo,
        },
      ])

      if (error) throw error

      alert('Produto cadastrado com sucesso!')
      limparFormProduto()
      await carregarEstoque()
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar o produto.')
    } finally {
      setSubmitting(false)
    }
  }

  // RNE-04, RNE-06 & Integração com Caixa Geral
  async function handleMovimentarEstoque(e: React.FormEvent) {
    e.preventDefault()
    if (!produtoSelecionado) return
  
    if (tipoMovimentacao === 'perda' && motivoPerda.trim().length < 10) {
      alert('⚠️ O motivo da perda deve conter pelo menos 10 caracteres para fins de auditoria.')
      return
    }
  
    // RNP-01: Se for entrada, valida se o novo preço de custo informado é maior/igual ao preço de revenda atual
    if (tipoMovimentacao === 'entrada' && novoPrecoCompra >= produtoSelecionado.preco_venda) {
      alert(`⚠️ Bloqueado: O novo preço de custo (R$ ${novoPrecoCompra.toFixed(2)}) é maior ou igual ao preço de revenda atual (R$ ${produtoSelecionado.preco_venda.toFixed(2)}). Altere o preço de revenda no cadastro antes de dar entrada ou revise o valor de compra.`)
      return
    }
  
    try {
      setSubmitting(true)
  
      const alteracao = tipoMovimentacao === 'entrada' ? quantidadeMovimentacao : -quantidadeMovimentacao
      const novoEstoque = produtoSelecionado.estoque_atual + alteracao
  
      if (novoEstoque < 0) {
        alert('❌ Operação abortada: O estoque físico não pode ficar negativo.')
        return
      }
  
      let caixaMovimentacaoId = null
      const precoCustoFinal = tipoMovimentacao === 'entrada' ? novoPrecoCompra : produtoSelecionado.preco_compra
  
      // Se for ENTRADA (Compra), gera débito de saída no caixa geral baseado no novo preço informado
      if (tipoMovimentacao === 'entrada') {
        const custoTotalLote = precoCustoFinal * quantidadeMovimentacao
        
        const { data: caixaData, error: caixaError } = await supabase
          .from('caixa_movimentacoes')
          .insert([
            {
              tipo: 'saida',
              categoria: 'Bar - Compra de Estoque',
              descricao: `Compra de Lote: ${quantidadeMovimentacao}x ${produtoSelecionado.nome} (Custo un: R$ ${precoCustoFinal.toFixed(2)})`,
              valor: custoTotalLote,
              data_movimentacao: new Date().toISOString()
            }
          ])
          .select()
          .single()
  
        if (caixaError) throw caixaError
        caixaMovimentacaoId = caixaData.id
      }
  
      // 1. Atualizar estoque (e preço de compra caso tenha sido alterado na entrada)
      const dadosAtualizacao: any = { estoque_atual: novoEstoque }
      if (tipoMovimentacao === 'entrada') {
        dadosAtualizacao.preco_compra = precoCustoFinal
      }
  
      const { error: prodError } = await supabase
        .from('bar_produtos')
        .update(dadosAtualizacao)
        .eq('id', produtoSelecionado.id)
  
      if (prodError) throw prodError
  
      // 2. Registrar histórico do movimento
      const { error: movError } = await supabase
        .from('bar_movimentacoes_estoque')
        .insert([
          {
            produto_id: produtoSelecionado.id,
            tipo: tipoMovimentacao,
            quantidade: quantidadeMovimentacao,
            motivo_perda: tipoMovimentacao === 'perda' ? motivoPerda : null,
            caixa_movimentacao_id: caixaMovimentacaoId
          }
        ])
  
      if (movError) throw movError
  
      alert('Estoque atualizado e movimentação financeira integrada!')
      fecharModalMovimentar()
      await carregarEstoque()
    } catch (error: any) {
      alert(error.message || 'Erro ao registrar movimentação de estoque.')
    } finally {
      setSubmitting(false)
    }
  }

  function limparFormProduto() {
    setNome('')
    setPrecoCompra(0)
    setPrecoVenda(0)
    setEstoqueInicial(0)
    setEstoqueMinimo(5)
    setModalProdutoAberto(false)
  }

  function fecharModalMovimentar() {
    setQuantidadeMovimentacao(1)
    setMotivoPerda('')
    setModalMovimentarAberto(false)
  }

  // Métricas de Painel
  const totalItens = produtos.length
  const estoqueCriticoCount = produtos.filter((p) => p.estoque_atual <= p.estoque_minimo).length
  const patrimonioTotal = produtos.reduce((acc, p) => acc + p.estoque_atual * p.preco_compra, 0)

  if (carregando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-400 font-medium text-xs tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl animate-spin">📦</span>
          <span>Acessando inventário e adega da sede...</span>
        </div>
      </div>
    )
  }

  if (!autenticado) return null

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      {/* TOPO DA TELA */}
      <div className="mb-8 flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">🍺 Gestão do Bar</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Torre de monitoramento de insumos, fluxo de caixa e histórico de auditorias de perdas</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={() => router.push('/dashboard')} className="rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            Voltar ao Dash
          </button>
          <button onClick={() => carregarEstoque()} className="flex items-center gap-1.5 rounded-lg border border-zinc-800 bg-zinc-900 px-3.5 py-1.5 text-xs font-bold uppercase text-zinc-400 hover:bg-zinc-800 transition-colors">
            🔄 Recarregar
          </button>
          
          <button 
            onClick={() => router.push('/bar/comanda')} 
            className="rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-black uppercase text-white hover:bg-emerald-500 transition-all shadow-[0_0_15px_rgba(16,185,129,0.15)]"
          >
            💸 Área de Vendas
          </button>

          <button onClick={() => setModalProdutoAberto(true)} className="rounded-lg bg-white px-4 py-1.5 text-xs font-black uppercase text-zinc-950 hover:bg-zinc-200 transition-all shadow-[0_0_15px_rgba(255,255,255,0.1)]">
            ➕ Novo Produto
          </button>
        </div>
      </div>

      {/* PAINEL DE CARDS ANALÍTICOS (FILTRÁVEIS) */}
      <div className="mb-8 grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {/* Card: Total de Itens (Filtro 'todos') */}
        <div 
          onClick={() => setFiltro('todos')}
          className={`rounded-xl border p-5 cursor-pointer select-none transition-all ${
            filtro === 'todos' 
              ? 'border-zinc-500 bg-zinc-900/50 shadow-[0_0_15px_rgba(255,255,255,0.03)]' 
              : 'border-zinc-900 bg-zinc-900/20 hover:border-zinc-800'
          }`}
        >
          <div className="flex justify-between items-center">
            <p className="text-[10px] font-bold uppercase tracking-wider text-zinc-500">Total de Itens Cadastrados</p>
            {filtro === 'todos' && <span className="text-[9px] bg-zinc-800 text-zinc-300 font-bold px-1.5 py-0.5 rounded uppercase">Ativo</span>}
          </div>
          <p className="mt-2 text-3xl font-black text-white font-mono">{totalItens}</p>
          <p className="text-[9px] text-zinc-400 uppercase mt-1">Produtos ativos catalogados no bar (Clique para todos)</p>
        </div>

        {/* Card: Estoque Crítico (Filtro 'critico') */}
        <div 
          onClick={() => setFiltro('critico')}
          className={`rounded-xl border p-5 cursor-pointer select-none transition-all ${
            filtro === 'critico'
              ? 'border-amber-500 bg-amber-950/20 border-l-2 shadow-[0_0_15px_rgba(245,158,11,0.05)]'
              : estoqueCriticoCount > 0 
                ? 'border-zinc-900 bg-zinc-900/20 border-l-2 border-l-amber-500/50 hover:border-amber-950/50' 
                : 'border-zinc-900 bg-zinc-900/20 hover:border-zinc-800'
          }`}
        >
          <div className="flex justify-between items-center">
            <p className={`text-[10px] font-bold uppercase tracking-wider ${estoqueCriticoCount > 0 ? 'text-amber-400' : 'text-zinc-500'}`}>⚠️ Estoque Crítico</p>
            {filtro === 'critico' && <span className="text-[9px] bg-amber-950 text-amber-400 border border-amber-900/50 font-bold px-1.5 py-0.5 rounded uppercase">Filtrado</span>}
          </div>
          <p className="mt-2 text-3xl font-black text-white font-mono">{estoqueCriticoCount}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Produtos iguais ou abaixo do mínimo (Clique para filtrar)</p>
        </div>

        {/* Card: Capital Investido */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 border-l-2 border-l-emerald-500 select-none">
          <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">💵 Capital Investido</p>
          <p className="mt-2 text-3xl font-black text-white font-mono">R$ {patrimonioTotal.toFixed(2)}</p>
          <p className="text-[9px] text-zinc-500 uppercase mt-1">Total investido parado em estoque físico</p>
        </div>
      </div>

      {/* SEÇÃO CENTRAL OPERACIONAL */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        
        {/* COLUNA ESQUERDA: LISTAGEM DE ESTOQUE */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 lg:col-span-2">
          <div className="mb-4 border-l-2 border-zinc-700 pl-3 flex justify-between items-center">
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">📦 Inventário Ativo</h2>
            <span className="text-[9px] text-zinc-500 font-mono uppercase tracking-widest">
              Filtro: {filtro === 'critico' ? 'Apenas Críticos' : 'Todos os Itens'}
            </span>
          </div>
          <p className="text-[11px] text-zinc-500 mb-6 uppercase tracking-wide">Monitore as quantidades e custos. Selecione um item para obter mais detalhes.</p>

          <div className="space-y-2 max-h-[450px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-zinc-800">
            {(() => {
              const produtosFiltrados = produtos.filter((p) => {
                if (filtro === 'critico') {
                  return p.estoque_atual <= p.estoque_minimo
                }
                return true
              })

              if (produtosFiltrados.length === 0) {
                return (
                  <p className="text-xs text-zinc-500 italic p-6 text-center">
                    {filtro === 'critico' 
                      ? 'Nenhum produto em nível crítico de estoque no momento.' 
                      : 'Nenhum produto cadastrado no bar ainda.'}
                  </p>
                )
              }

              return produtosFiltrados.map((p) => {
                const ehCritico = p.estoque_atual <= p.estoque_minimo
                const markup = p.preco_compra > 0 ? ((p.preco_venda - p.preco_compra) / p.preco_compra) * 100 : 0

                return (
                  <div
                    key={p.id}
                    onClick={() => setProdutoSelecionado(p)}
                    className={`flex items-center justify-between rounded-xl p-3.5 border cursor-pointer transition-all select-none ${produtoSelecionado?.id === p.id ? 'bg-zinc-900 border-zinc-700' : 'bg-zinc-950/40 border-zinc-900 hover:border-zinc-800'}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-white uppercase">{p.nome}</h4>
                        {p.estoque_atual === 0 ? (
                          <span className="text-[9px] font-bold bg-red-950/40 text-red-400 border border-red-900/40 px-1.5 py-0.5 rounded uppercase">Esgotado</span>
                        ) : ehCritico ? (
                          <span className="text-[9px] font-bold bg-amber-950/40 text-amber-500 border border-amber-900/40 px-1.5 py-0.5 rounded uppercase animate-pulse">Crítico</span>
                        ) : (
                          <span className="text-[9px] font-bold bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 px-1.5 py-0.5 rounded uppercase">Estável</span>
                        )}
                      </div>
                      
                      <div className="flex items-center gap-2 mt-1.5 text-[10px] text-zinc-500 font-mono">
                        <span>Custo: <strong className="text-zinc-350">R$ {p.preco_compra.toFixed(2)}</strong></span>
                        <span>•</span>
                        <span>Revenda: <strong className="text-emerald-450">R$ {p.preco_venda.toFixed(2)}</strong></span>
                      </div>
                    </div>

                    <div className="text-right flex flex-col items-end">
                      <span className="text-xs font-mono font-bold text-white">📦 {p.estoque_atual} <span className="text-[10px] text-zinc-500 font-sans">/ {p.estoque_minimo}</span></span>
                      <span className="text-[9px] text-zinc-500 uppercase tracking-wide mt-0.5">Margem: {markup.toFixed(0)}%</span>
                    </div>
                  </div>
                )
              })
            })()}
          </div>
        </div>

        {/* COLUNA DIREITA: AJUSTES E AUDITORIA */}
        <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 flex flex-col justify-between">
          {produtoSelecionado ? (
            <div className="flex flex-col h-full justify-between">
              <div>
                <div className="border-b border-zinc-900 pb-3 mb-4">
                  <span className="text-[10px] font-mono uppercase text-zinc-500 block tracking-wider">Ficha Técnica do Insumo</span>
                  <h3 className="text-base font-black text-white uppercase tracking-tight">{produtoSelecionado.nome}</h3>
                </div>

                <div className="space-y-4">
                  {/* QUANTIDADE EM EXIBIÇÃO AMPLA */}
                  <div className="rounded-xl bg-zinc-950/40 border border-zinc-900 p-4 flex justify-between items-center">
                    <div className="text-left">
                      <span className={`text-3xl font-mono font-black ${produtoSelecionado.estoque_atual <= produtoSelecionado.estoque_minimo ? 'text-amber-500' : 'text-white'}`}>{produtoSelecionado.estoque_atual}</span>
                      <span className="text-[10px] text-zinc-400 uppercase block tracking-wider mt-0.5">Unidades no Depósito</span>
                    </div>
                    <span className="text-xl">📥</span>
                  </div>

                  {/* PREÇOS */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">💰 Distribuição de Custos</h4>
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-2.5 flex justify-between items-center text-xs">
                      <span className="text-zinc-500">Lucro Bruto por Unidade:</span>
                      <span className="font-bold text-emerald-400">R$ {(produtoSelecionado.preco_venda - produtoSelecionado.preco_compra).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* NOTA DE AUDITORIA */}
                  <div className="space-y-1.5">
                    <h4 className="text-[10px] font-bold uppercase text-zinc-400 tracking-widest">🛡️ Auditoria de Margem</h4>
                    <div className="rounded-lg border border-zinc-900 bg-zinc-950/40 p-2.5 text-xs text-zinc-300">
                      <span className="text-zinc-500">Markup Aplicado:</span>{' '}
                      <strong className="font-mono text-zinc-200">
                        {produtoSelecionado.preco_compra > 0 ? (((produtoSelecionado.preco_venda - produtoSelecionado.preco_compra) / produtoSelecionado.preco_compra) * 100).toFixed(0) : 0}%
                      </strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* AÇÃO DO CARD DE DETALHES */}
              <div className="mt-6 pt-4 border-t border-zinc-900 flex gap-2">
                <button
                  onClick={() => setModalMovimentarAberto(true)}
                  className="w-full py-2 bg-zinc-800 border border-zinc-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-zinc-700 transition-colors"
                >
                  ⚙️ Movimentar Estoque
                </button>
              </div>
            </div>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-zinc-500 italic py-12 text-center">
              Selecione um produto para auditar ou movimentar.
            </div>
          )}
        </div>

      </div>

      {/* MODAL: NOVO PRODUTO */}
      {modalProdutoAberto && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono mb-4">🛡️ Cadastrar Novo Produto</h2>
            <form onSubmit={handleCadastrarProduto} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Nome do Produto</label>
                <input 
                  type="text" 
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Ex: Heineken Long Neck" 
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Preço de Custo (Compra)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={precoCompra}
                    onChange={(e) => setPrecoCompra(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Preço de Revenda</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={precoVenda}
                    onChange={(e) => setPrecoVenda(parseFloat(e.target.value) || 0)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Estoque Inicial</label>
                  <input 
                    type="number" 
                    min="0"
                    value={estoqueInicial}
                    onChange={(e) => setEstoqueInicial(parseInt(e.target.value) || 0)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Estoque Mínimo</label>
                  <input 
                    type="number" 
                    min="1"
                    value={estoqueMinimo}
                    onChange={(e) => setEstoqueMinimo(parseInt(e.target.value) || 1)}
                    required
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-zinc-850">
                <button 
                  type="button" 
                  onClick={limparFormProduto}
                  className="w-1/2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 font-bold text-xs uppercase text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-1/2 px-4 py-2 bg-white hover:bg-zinc-200 font-black text-xs uppercase text-zinc-950 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {submitting ? 'Aguarde...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: MOVIMENTAR ESTOQUE (ENTRADA / PERDA) */}
      {modalMovimentarAberto && produtoSelecionado && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-zinc-900 border border-zinc-800 w-full max-w-md rounded-xl p-6 shadow-2xl">
            <h2 className="text-sm font-black text-white uppercase tracking-widest font-mono mb-2">⚡ Ajuste de Unidades</h2>
            <p className="text-[11px] text-zinc-500 uppercase mb-4">Item Selecionado: <span className="text-zinc-200 font-semibold">{produtoSelecionado.nome}</span></p>
            
            <form onSubmit={handleMovimentarEstoque} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Natureza do Movimento</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setTipoMovimentacao('entrada')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold uppercase transition ${tipoMovimentacao === 'entrada' ? 'bg-emerald-950/20 border-emerald-900 text-emerald-400' : 'bg-zinc-950 border-zinc-800 text-zinc-550'}`}
                  >
                    📥 Entrada Lote
                  </button>
                  <button
                    type="button"
                    onClick={() => setTipoMovimentacao('perda')}
                    className={`flex items-center justify-center gap-2 py-2 rounded-lg border text-xs font-bold uppercase transition ${tipoMovimentacao === 'perda' ? 'bg-red-950/20 border-red-900 text-red-500' : 'bg-zinc-950 border-zinc-800 text-zinc-550'}`}
                  >
                    ⚠️ Perda/Baixa
                  </button>
                </div>
              </div>

              {/* RNP-01: Campo do Novo Preço de Custo (Exclusivo para Entradas) */}
              {tipoMovimentacao === 'entrada' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Preço de Custo Unitário deste Lote (R$)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={novoPrecoCompra}
                    onChange={(e) => setNovoPrecoCompra(parseFloat(e.target.value) || 0)}
                    required={tipoMovimentacao === 'entrada'}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                  />
                  <p className="text-[9px] text-zinc-500 mt-1 uppercase">Preço atual de cadastro: R$ {produtoSelecionado.preco_compra.toFixed(2)}</p>
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Quantidade de Unidades</label>
                <input 
                  type="number" 
                  min="1"
                  value={quantidadeMovimentacao}
                  onChange={(e) => setQuantidadeMovimentacao(parseInt(e.target.value) || 1)}
                  required
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 focus:border-zinc-700 focus:outline-none"
                />
              </div>

              {/* RNE-04: Justificativa obrigatória se for perda */}
              {tipoMovimentacao === 'perda' && (
                <div>
                  <label className="block text-[10px] font-bold uppercase text-zinc-500 mb-1.5">Motivo Detalhado da Perda (Mínimo de 10 caracteres)</label>
                  <textarea 
                    value={motivoPerda}
                    onChange={(e) => setMotivoPerda(e.target.value)}
                    required={tipoMovimentacao === 'perda'}
                    placeholder="Ex: Três garrafas quebradas por queda ao reabastecer a geladeira principal."
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs text-zinc-200 h-24 focus:border-zinc-700 focus:outline-none resize-none"
                  />
                </div>
              )}

              {tipoMovimentacao === 'entrada' && (
                <div className="p-3.5 bg-zinc-950/70 border border-zinc-900 rounded-lg text-xs text-zinc-500 space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span>Custo Total do Lote:</span>
                    <span className="font-semibold text-zinc-300">R$ {(novoPrecoCompra * quantidadeMovimentacao).toFixed(2)}</span>
                  </div>
                  <p className="text-[9px] text-amber-500/80 uppercase mt-1.5 font-sans font-bold leading-normal">
                    ⚠️ Esta entrada gerará uma saída de caixa de forma automatizada no balanço financeiro geral.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-4 border-t border-zinc-850">
                <button 
                  type="button" 
                  onClick={fecharModalMovimentar}
                  className="w-1/2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 font-bold text-xs uppercase text-white rounded-lg transition"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={submitting}
                  className="w-1/2 px-4 py-2 bg-white hover:bg-zinc-200 font-black text-xs uppercase text-zinc-950 rounded-lg transition flex items-center justify-center gap-2"
                >
                  {submitting ? 'Aguarde...' : 'Confirmar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}