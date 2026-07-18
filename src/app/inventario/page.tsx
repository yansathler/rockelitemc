'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface Chapter {
  id: string
  nome: string
  estado: string
}

interface Membro {
  id: string
  nome: string
  vulgo?: string
}

interface ItemInventario {
  id: string
  chapter_id: string
  nome: string
  pilar: 'patrimonio' | 'boutique'
  categoria: string
  quantidade: number
  tamanho: string | null
  status_conservacao: string
  localizacao_interna: string
  preco_custo: number
  preco_venda: number
  observacoes: string
}

interface Trofeu {
  id: string
  chapter_id: string
  titulo: string
  evento_origem: string
  ano_conquista: number
  irmaos_representantes: string
  descricao_contexto: string
}

export default function GestaoInventario() {
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [membros, setMembros] = useState<Membro[]>([])
  const [chapterAtivaId, setChapterAtivaId] = useState<string>('')
  
  const [abaAtiva, setAbaAtiva] = useState<'patrimonio' | 'boutique' | 'trofeus'>('patrimonio')
  const [itens, setItens] = useState<ItemInventario[]>([])
  const [trofeus, setTrofeus] = useState<Trofeu[]>([])

  // Modais
  const [modalItemAberto, setModalItemAberto] = useState(false)
  const [modalTrofeuAberto, setModalTrofeuAberto] = useState(false)
  const [modalMovimentarAberto, setModalMovimentarAberto] = useState(false)
  const [itemSelecionado, setItemSelecionado] = useState<ItemInventario | null>(null)

  // Formulários Básicos
  const [formItem, setFormItem] = useState({
    nome: '', pilar: 'patrimonio', categoria: '', quantidade: 1,
    tamanho: '', status_conservacao: 'Operacional', localizacao_interna: 'Sede Central',
    preco_custo: 0, preco_venda: 0, observacoes: ''
  })

  const [formTrofeu, setFormTrofeu] = useState({
    titulo: '', evento_origem: '', ano_conquista: new Date().getFullYear(), irmaos_representantes: '', descricao_contexto: ''
  })

  // Formulário de Movimentação/Cautela
  const [formMovimentacao, setFormMovimentacao] = useState({
    tipo_movimentacao: 'Cautela (Empréstimo)',
    membro_id: '',
    novo_status: 'Operacional',
    destino_motivo: ''
  })

  useEffect(() => {
    const idMembro = localStorage.getItem('@rockelite:membro_id')
    if (!idMembro) {
      router.replace('/')
    } else {
      carregarChapters()
      carregarMembros()
    }
  }, [router])

  useEffect(() => {
    if (chapterAtivaId) {
      carregarDadosInventario(chapterAtivaId)
    }
  }, [chapterAtivaId, abaAtiva])

  const carregarChapters = async () => {
    const { data } = await supabase.from('chapters').select('id, nome, estado').order('nome', { ascending: true })
    if (data && data.length > 0) {
      setChapters(data)
      setChapterAtivaId(data[0].id)
    }
  }

  const carregarMembros = async () => {
    // Busca a listagem de irmãos para usar na cautela de retirada
    const { data } = await supabase.from('membros').select('id, nome, vulgo').order('nome', { ascending: true })
    if (data) setMembros(data)
  }

  const carregarDadosInventario = async (idChapter: string) => {
    setCarregando(true)
    try {
      if (abaAtiva === 'trofeus') {
        const { data } = await supabase.from('inventario_trofeus').select('*').eq('chapter_id', idChapter).order('ano_conquista', { ascending: false })
        if (data) setTrofeus(data)
      } else {
        const { data } = await supabase.from('inventario_itens').select('*').eq('chapter_id', idChapter).eq('pilar', abaAtiva).order('nome', { ascending: true })
        if (data) setItens(data)
      }
    } finally {
      setCarregando(false)
    }
  }

  const handleSalvarItem = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('inventario_itens').insert([{
      chapter_id: chapterAtivaId,
      nome: formItem.nome,
      pilar: formItem.pilar,
      categoria: formItem.categoria || null,
      quantidade: Number(formItem.quantidade),
      tamanho: formItem.pilar === 'boutique' ? formItem.tamanho || null : null,
      status_conservacao: formItem.status_conservacao,
      localizacao_interna: formItem.localizacao_interna,
      preco_custo: Number(formItem.preco_custo),
      preco_venda: formItem.pilar === 'boutique' ? Number(formItem.preco_venda) : 0,
      observacoes: formItem.observacoes
    }])

    if (!error) {
      setModalItemAberto(false)
      setFormItem({ nome: '', pilar: 'patrimonio', categoria: '', quantidade: 1, tamanho: '', status_conservacao: 'Operacional', localizacao_interna: 'Sede Central', preco_custo: 0, preco_venda: 0, observacoes: '' })
      carregarDadosInventario(chapterAtivaId)
    }
  }

  const handleSalvarTrofeu = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error } = await supabase.from('inventario_trofeus').insert([{
      chapter_id: chapterAtivaId,
      titulo: formTrofeu.titulo,
      evento_origem: formTrofeu.evento_origem,
      ano_conquista: Number(formTrofeu.ano_conquista),
      irmaos_representantes: formTrofeu.irmaos_representantes,
      descricao_contexto: formTrofeu.descricao_contexto
    }])

    if (!error) {
      setModalTrofeuAberto(false)
      setFormTrofeu({ titulo: '', evento_origem: '', ano_conquista: new Date().getFullYear(), irmaos_representantes: '', descricao_contexto: '' })
      carregarDadosInventario(chapterAtivaId)
    }
  }

  const handleRegistrarMovimentacao = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!itemSelecionado) return

    // 1. Insere o registro histórico de movimentação
    const { error: erroMov } = await supabase.from('inventario_movimentacoes').insert([{
      item_id: itemSelecionado.id,
      membro_id: formMovimentacao.tipo_movimentacao.includes('Empréstimo') ? formMovimentacao.membro_id || null : null,
      tipo_movimentacao: formMovimentacao.tipo_movimentacao,
      quantidade_movimentada: 1,
      destino_motivo: formMovimentacao.destino_motivo
    }])

    if (erroMov) {
      alert('Erro ao registrar histórico: ' + erroMov.message)
      return
    }

    // 2. Atualiza o status de conservação e observações do item na tabela principal
    const statusAtualizado = formMovimentacao.tipo_movimentacao === 'Envio para Manutenção' 
      ? 'Manutenção' 
      : formMovimentacao.novo_status

    const { error: erroItem } = await supabase.from('inventario_itens')
      .update({ 
        status_conservacao: statusAtualizado,
        observacoes: `${itemSelecionado.observacoes || ''}\n[Movimentação]: ${formMovimentacao.tipo_movimentacao} - ${formMovimentacao.destino_motivo}`.trim()
      })
      .eq('id', itemSelecionado.id)

    if (!erroItem) {
      setModalMovimentarAberto(false)
      setItemSelecionado(null)
      setFormMovimentacao({ tipo_movimentacao: 'Cautela (Empréstimo)', membro_id: '', novo_status: 'Operacional', destino_motivo: '' })
      carregarDadosInventario(chapterAtivaId)
    }
  }

  const deletarItem = async (id: string, tabela: 'inventario_itens' | 'inventario_trofeus') => {
    if (!window.confirm('Deseja apagar esse registro?')) return
    const { error } = await supabase.from(tabela).delete().eq('id', id)
    if (!error) carregarDadosInventario(chapterAtivaId)
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 space-y-8 font-sans">
      
      {/* CABEÇALHO TÁTICO NO PADRÃO REMC */}
<div className="flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
  <div>
    <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">📦 Gestão de Inventário</h1>
    <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Patrimônio, Boutique e Memória Histórica REMC</p>
  </div>

  <div className="flex flex-wrap items-center gap-3">
    {chapters.length > 0 && (
      <div className="flex items-center gap-2 border border-zinc-800 bg-zinc-900/50 px-3 py-1.5 rounded-lg">
        <span className="text-xs text-zinc-500 font-bold uppercase font-mono">Chapter:</span>
        <select value={chapterAtivaId} onChange={(e) => setChapterAtivaId(e.target.value)} className="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-2">
          {chapters.map((c) => (
            <option key={c.id} value={c.id} className="bg-zinc-900 text-zinc-100">{c.nome} ({c.estado})</option>
          ))}
        </select>
      </div>
    )}
    

    <button 
      onClick={() => router.push('/dashboard')} 
      className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs font-black uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all font-mono"
    >
      Voltar ao Dash
    </button>

    <button
      onClick={() => abaAtiva === 'trofeus' ? setModalTrofeuAberto(true) : setModalItemAberto(true)}
      className="rounded-lg bg-white px-4 py-2 text-xs font-black uppercase text-black hover:bg-zinc-200 transition-colors font-mono"
    >
      ➕ Novo Registro
    </button>

  </div>
</div>

      {/* ABAS */}
      <div className="flex border-b border-zinc-900 gap-2">
        <button onClick={() => { setAbaAtiva('patrimonio'); setFormItem(f => ({ ...f, pilar: 'patrimonio' })); }} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-all ${abaAtiva === 'patrimonio' ? 'border-blue-500 text-white bg-blue-950/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>🗄️ Patrimônio Fixo</button>
        <button onClick={() => { setAbaAtiva('boutique'); setFormItem(f => ({ ...f, pilar: 'boutique' })); }} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-all ${abaAtiva === 'boutique' ? 'border-amber-500 text-white bg-amber-950/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>📦 Boutique & Coletes</button>
        <button onClick={() => setAbaAtiva('trofeus')} className={`px-4 py-2 text-xs font-bold uppercase border-b-2 transition-all ${abaAtiva === 'trofeus' ? 'border-cyan-500 text-white bg-cyan-950/10' : 'border-transparent text-zinc-500 hover:text-zinc-300'}`}>🦅 Galeria de Troféus</button>
      </div>

      {/* LISTAGEM PRINCIPAL */}
      <div className="min-h-[400px]">
        {carregando ? (
          <p className="text-sm font-mono text-zinc-500 uppercase text-center py-20">Sincronizando acervo...</p>
        ) : abaAtiva === 'trofeus' ? (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {trofeus.length === 0 ? (
              <p className="text-zinc-600 text-xs italic p-6 border border-dashed border-zinc-900 rounded-lg text-center col-span-full uppercase">Nenhum troféu catalogado nesta chapter.</p>
            ) : (
              trofeus.map((t) => (
                <div key={t.id} className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 flex flex-col justify-between space-y-4">
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-400 uppercase">Ano {t.ano_conquista}</span>
                      <button onClick={() => deletarItem(t.id, 'inventario_trofeus')} className="text-zinc-600 hover:text-red-400 text-xs">❌</button>
                    </div>
                    <h3 className="text-base font-black text-white mt-3 font-mono uppercase">{t.titulo}</h3>
                    <p className="text-xs text-zinc-400 mt-1">📍 Origem: <span className="text-zinc-200">{t.evento_origem}</span></p>
                    {t.descricao_contexto && <p className="text-xs text-zinc-500 mt-3 border-t border-zinc-900/60 pt-2 italic">"{t.descricao_contexto}"</p>}
                  </div>
                  {t.irmaos_representantes && <div className="bg-zinc-950/60 p-2.5 rounded border border-zinc-900 text-[10px] text-zinc-400"><span className="font-bold text-zinc-500 block uppercase">Irmãos na Missão:</span> {t.irmaos_representantes}</div>}
                </div>
              ))
            )}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-zinc-900 bg-zinc-900/10">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-zinc-900 bg-zinc-900/40 text-zinc-500 uppercase font-mono tracking-wider">
                  <th className="p-4">Item / Categoria</th>
                  <th className="p-4">Qtd</th>
                  {abaAtiva === 'boutique' && <th className="p-4">Tam</th>}
                  <th className="p-4">Onde está guardado</th>
                  <th className="p-4">Status / Conservação</th>
                  <th className="p-4">Valores</th>
                  <th className="p-4 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900/50">
                {itens.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-zinc-600 italic uppercase">Nenhum material registrado.</td></tr>
                ) : (
                  itens.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-900/20 transition-colors">
                      <td className="p-4">
                        <p className="font-bold text-white uppercase font-mono">{item.nome}</p>
                        <p className="text-[10px] text-zinc-500 mt-0.5 uppercase">{item.categoria || 'Geral'}</p>
                      </td>
                      <td className="p-4 font-mono font-bold text-zinc-300">{item.quantidade}x</td>
                      {abaAtiva === 'boutique' && <td className="p-4 font-mono text-amber-400 font-bold">{item.tamanho || 'N/A'}</td>}
                      <td className="p-4 text-zinc-400">{item.localizacao_interna}</td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.status_conservacao === 'Operacional' ? 'bg-emerald-950 text-emerald-400' : item.status_conservacao === 'Manutenção' ? 'bg-amber-950 text-amber-400' : 'bg-red-950 text-red-400'}`}>
                          {item.status_conservacao}
                        </span>
                      </td>
                      <td className="p-4 font-mono text-zinc-400">
                        <span>C: R$ {Number(item.preco_custo).toFixed(2)}</span>
                        {abaAtiva === 'boutique' && <span className="block text-emerald-400">V: R$ {Number(item.preco_venda).toFixed(2)}</span>}
                      </td>
                      <td className="p-4 text-center space-x-2 whitespace-nowrap">
  <button 
    onClick={() => { setItemSelecionado(item); setModalMovimentarAberto(true); }}
    className="text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800 text-[11px] font-bold uppercase tracking-wider"
  >
    ⚙️ Movimentar
  </button>
  <button 
    onClick={() => deletarItem(item.id, 'inventario_itens')} 
    className="text-red-400 hover:text-red-300 transition-colors bg-red-950/20 hover:bg-red-950/40 px-2 py-1.5 rounded border border-red-900/40 text-[11px] font-bold uppercase tracking-wider"
  >
    ❌ Apagar
  </button>
</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL: MOVIMENTAR / CAUTELA (MANUTENÇÃO OU EMPRÉSTIMO) */}
      {modalMovimentarAberto && itemSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-black font-mono text-white uppercase tracking-wider">🛠️ Movimentar: {itemSelecionado.nome}</h2>
              <button onClick={() => setModalMovimentarAberto(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleRegistrarMovimentacao} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Tipo de Ação</label>
                <select 
                  value={formMovimentacao.tipo_movimentacao} 
                  onChange={e => setFormMovimentacao({...formMovimentacao, tipo_movimentacao: e.target.value})}
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none"
                >
                  <option value="Cautela (Empréstimo)">Retirada / Empréstimo para Irmão</option>
                  <option value="Envio para Manutenção">Enviar para Manutenção/Conserto</option>
                  <option value="Devolução">Retornar / Devolução para o Estoque</option>
                </select>
              </div>

              {formMovimentacao.tipo_movimentacao === 'Cautela (Empréstimo)' && (
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Irmão Responsável (Cautela) *</label>
                  <select 
                    required
                    value={formMovimentacao.membro_id} 
                    onChange={e => setFormMovimentacao({...formMovimentacao, membro_id: e.target.value})}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none"
                  >
                    <option value="">Selecione o membro...</option>
                    {membros.map(m => (
                      <option key={m.id} value={m.id}>{m.nome} {m.vulgo ? `(${m.vulgo})` : ''}</option>
                    ))}
                  </select>
                </div>
              )}

              {formMovimentacao.tipo_movimentacao === 'Devolução' && (
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Status de Conservação no Retorno</label>
                  <select 
                    value={formMovimentacao.novo_status} 
                    onChange={e => setFormMovimentacao({...formMovimentacao, novo_status: e.target.value})}
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none"
                  >
                    <option value="Operacional">Operacional (Pronto p/ Uso)</option>
                    <option value="Manutenção">Ainda precisa de Manutenção</option>
                  </select>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Destino / Motivo ou Justificativa *</label>
                <textarea 
                  required
                  rows={3} 
                  value={formMovimentacao.destino_motivo}
                  onChange={e => setFormMovimentacao({...formMovimentacao, destino_motivo: e.target.value})}
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none resize-none" 
                  placeholder={formMovimentacao.tipo_movimentacao.includes('Empréstimo') ? "Ex: Levou a tenda para o evento regional em Cabo Frio" : "Ex: Conserto do autofalante queimado"}
                />
              </div>

              <button type="submit" className="w-full rounded bg-white p-2.5 font-black text-black hover:bg-zinc-200 text-xs uppercase mt-2">
                Confirmar Registro
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO DE ITEM (MANTIDO DO ANTERIOR COM TEXTO ATUALIZADO) */}
      {modalItemAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-black font-mono text-white uppercase">📦 Registrar Novo Item ({formItem.pilar})</h2>
              <button onClick={() => setModalItemAberto(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSalvarItem} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Nome do Item *</label>
                <input required type="text" value={formItem.nome} onChange={e => setFormItem({...formItem, nome: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Categoria</label>
                  <input type="text" value={formItem.categoria} onChange={e => setFormItem({...formItem, categoria: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Quantidade *</label>
                  <input required type="number" min="1" value={formItem.quantidade} onChange={e => setFormItem({...formItem, quantidade: Number(e.target.value)})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none font-mono" />
                </div>
              </div>
              {formItem.pilar === 'boutique' && (
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Tamanho Grade</label>
                  <input type="text" value={formItem.tamanho} onChange={e => setFormItem({...formItem, tamanho: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none uppercase font-mono" placeholder="Ex: G, GG" />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Status Inicial</label>
                  <select value={formItem.status_conservacao} onChange={e => setFormItem({...formItem, status_conservacao: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none">
                    <option value="Operacional">Operacional</option>
                    <option value="Manutenção">Manutenção</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Onde está guardado</label>
                  <input type="text" value={formItem.localizacao_interna} onChange={e => setFormItem({...formItem, localizacao_interna: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none" placeholder="Ex: Armário da secretaria" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Preço de Custo (R$)</label>
                  <input type="number" step="0.01" value={formItem.preco_custo} onChange={e => setFormItem({...formItem, preco_custo: Number(e.target.value)})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none font-mono" />
                </div>
                {formItem.pilar === 'boutique' && (
                  <div className="space-y-1">
                    <label className="text-zinc-500 font-bold uppercase">Preço de Venda (R$)</label>
                    <input type="number" step="0.01" value={formItem.preco_venda} onChange={e => setFormItem({...formItem, preco_venda: Number(e.target.value)})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none font-mono" />
                  </div>
                )}
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Observações</label>
                <textarea rows={2} value={formItem.observacoes} onChange={e => setFormItem({...formItem, observacoes: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none resize-none"></textarea>
              </div>
              <button type="submit" className="w-full rounded bg-white p-2.5 font-black text-black hover:bg-zinc-200 text-xs uppercase mt-2">Confirmar Cadastro</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CADASTRO DE TROFÉU (MANTIDO DO ANTERIOR) */}
      {modalTrofeuAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-black font-mono text-white uppercase">🦅 Registrar Troféu / Honraria</h2>
              <button onClick={() => setModalTrofeuAberto(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>
            <form onSubmit={handleSalvarTrofeu} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Título da Conquista *</label>
                <input required type="text" value={formTrofeu.titulo} onChange={e => setFormTrofeu({...formTrofeu, titulo: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none" />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-2 space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Evento de Origem *</label>
                  <input required type="text" value={formTrofeu.evento_origem} onChange={e => setFormTrofeu({...formTrofeu, evento_origem: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none" />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Ano *</label>
                  <input required type="number" value={formTrofeu.ano_conquista} onChange={e => setFormTrofeu({...formTrofeu, ano_conquista: Number(e.target.value)})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none font-mono" />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Irmãos Representantes</label>
                <input type="text" value={formTrofeu.irmaos_representantes} onChange={e => setFormTrofeu({...formTrofeu, irmaos_representantes: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none" />
              </div>
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Histórico / Detalhes</label>
                <textarea rows={3} value={formTrofeu.descricao_contexto} onChange={e => setFormTrofeu({...formTrofeu, descricao_contexto: e.target.value})} className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none resize-none"></textarea>
              </div>
              <button type="submit" className="w-full rounded bg-white p-2.5 font-black text-black hover:bg-zinc-200 text-xs uppercase mt-2">Eternizar na Galeria</button>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}