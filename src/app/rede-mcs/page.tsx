'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'

interface RedeMC {
  id: string
  nome_mc: string
  cidade: string
  estado: string
  nome_contato: string
  cargo: string
  telefone: string
  observacoes: string
}

export default function RedeMCs() {
  const router = useRouter()
  const supabase = createClient()

  const [carregando, setCarregando] = useState(true)
  const [listaMcs, setListaMcs] = useState<RedeMC[]>([])
  const [filtroBusca, setFiltroBusca] = useState('')

  // Modais e edição
  const [modalAberto, setModalAberto] = useState(false)
  const [idEdicao, setIdEdicao] = useState<string | null>(null)

  // Formulário
  const [form, setForm] = useState({
    nome_mc: '',
    cidade: '',
    estado: 'RJ',
    nome_contato: '',
    cargo: 'Presidente',
    telefone: '',
    observacoes: ''
  })

  useEffect(() => {
    const idMembro = localStorage.getItem('@rockelite:membro_id')
    if (!idMembro) {
      router.replace('/')
    } else {
      carregarRedeMCs()
    }
  }, [router])

  const carregarRedeMCs = async () => {
    setCarregando(true)
    try {
      const { data, error } = await supabase
        .from('rede_mcs')
        .select('*')
        .order('nome_mc', { ascending: true })

      if (!error && data) {
        setListaMcs(data)
      }
    } catch (err) {
      console.error('Erro ao carregar Rede de MCs:', err)
    } finally {
      setCarregando(false)
    }
  }

  const handleAbrirModalNovo = () => {
    setIdEdicao(null)
    setForm({
      nome_mc: '',
      cidade: '',
      estado: 'RJ',
      nome_contato: '',
      cargo: 'Presidente',
      telefone: '',
      observacoes: ''
    })
    setModalAberto(true)
  }

  const handleAbrirModalEditar = (item: RedeMC) => {
    setIdEdicao(item.id)
    setForm({
      nome_mc: item.nome_mc,
      cidade: item.cidade,
      estado: item.estado,
      nome_contato: item.nome_contato,
      cargo: item.cargo,
      telefone: item.telefone,
      observacoes: item.observacoes || ''
    })
    setModalAberto(true)
  }

  const handleSalvar = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      if (idEdicao) {
        const { error } = await supabase
          .from('rede_mcs')
          .update({
            nome_mc: form.nome_mc,
            cidade: form.cidade,
            estado: form.estado.toUpperCase(),
            nome_contato: form.nome_contato,
            cargo: form.cargo,
            telefone: form.telefone,
            observacoes: form.observacoes
          })
          .eq('id', idEdicao)

        if (error) alert('Erro ao atualizar: ' + error.message)
      } else {
        const { error } = await supabase.from('rede_mcs').insert([
          {
            nome_mc: form.nome_mc,
            cidade: form.cidade,
            estado: form.estado.toUpperCase(),
            nome_contato: form.nome_contato,
            cargo: form.cargo,
            telefone: form.telefone,
            observacoes: form.observacoes
          }
        ])

        if (error) alert('Erro ao cadastrar: ' + error.message)
      }

      setModalAberto(false)
      carregarRedeMCs()
    } catch (err) {
      console.error(err)
    }
  }

  const handleDeletar = async (id: string, nomeMc: string) => {
    if (!window.confirm(`Tem certeza que deseja remover o MC "${nomeMc}" da sua rede?`)) return
    const { error } = await supabase.from('rede_mcs').delete().eq('id', id)
    if (!error) carregarRedeMCs()
  }

  const mcsFiltrados = listaMcs.filter(mc => {
    const termo = filtroBusca.toLowerCase()
    return (
      mc.nome_mc.toLowerCase().includes(termo) ||
      mc.cidade.toLowerCase().includes(termo) ||
      mc.estado.toLowerCase().includes(termo) ||
      mc.nome_contato.toLowerCase().includes(termo) ||
      mc.cargo.toLowerCase().includes(termo)
    )
  })

  const aplicarMascaraTelefone = (valor: string) => {
    // Remove tudo que não for dígito
    const apenasNumeros = valor.replace(/\D/g, '').slice(0, 11)
  
    // Aplica a formatação dinâmica para fixo ou celular
    if (apenasNumeros.length <= 10) {
      return apenasNumeros
        .replace(/^(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2')
    }
  
    return apenasNumeros
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
  }

  const formatarWhatsappLink = (telefone: string) => {
    const numApenasDigitos = telefone.replace(/\D/g, '')
    const numeroFinal = numApenasDigitos.startsWith('55') ? numApenasDigitos : `55${numApenasDigitos}`
    return `https://wa.me/${numeroFinal}`
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 space-y-8 font-sans">
      
      {/* CABEÇALHO TÁTICO NO PADRÃO REMC */}
      <div className="flex flex-col justify-between gap-4 border-b border-zinc-900 pb-6 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">🌐 Rede de MCs Parceiros</h1>
          <p className="text-xs text-zinc-500 uppercase tracking-wider mt-0.5">Alianças, Contatos de Estrada e Diplomacia Geral</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">

          <button 
            onClick={() => router.push('/dashboard')} 
            className="rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-2 text-xs font-black uppercase text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all font-mono"
          >
            Voltar ao Dash
          </button>

          <button
            onClick={handleAbrirModalNovo}
            className="rounded-lg bg-white px-4 py-2 text-xs font-black uppercase text-black hover:bg-zinc-200 transition-colors font-mono"
          >
            ➕ Novo Cadastro
          </button>

        </div>
      </div>

      {/* BARRA DE PESQUISA E FILTRO ESTRATÉGICO */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-center bg-zinc-900/30 p-4 rounded-xl border border-zinc-900">
        <div className="w-full sm:w-96">
          <input
            type="text"
            value={filtroBusca}
            onChange={(e) => setFiltroBusca(e.target.value)}
            placeholder="🔍 Buscar por MC, Cidade, Estado ou Vulgo..."
            className="w-full rounded-lg bg-zinc-900 border border-zinc-800 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-600 font-mono"
          />
        </div>
        <div className="text-xs text-zinc-500 font-mono uppercase">
          Total Mapeado: <span className="font-bold text-white">{mcsFiltrados.length} MCs</span>
        </div>
      </div>

      {/* GRID DE PARCEIROS E CONTATOS */}
      <div className="min-h-[400px]">
        {carregando ? (
          <p className="text-sm font-mono text-zinc-500 uppercase text-center py-20">Mapeando contatos da rede nacional...</p>
        ) : mcsFiltrados.length === 0 ? (
          <div className="border border-dashed border-zinc-900 rounded-xl p-12 text-center space-y-2">
            <p className="text-zinc-500 text-xs font-mono uppercase">Nenhum Motoclube parceiro cadastrado com esses filtros.</p>
          </div>
        ) : (
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {mcsFiltrados.map((mc) => (
              <div key={mc.id} className="rounded-xl border border-zinc-900 bg-zinc-900/20 p-5 flex flex-col justify-between space-y-4 hover:border-zinc-800 transition-all">
                <div className="space-y-3">
                  <div className="flex justify-between items-start">
                    <span className="text-[10px] font-black font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-300 uppercase">
                      📍 {mc.cidade} / {mc.estado}
                    </span>
                    <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-amber-950/60 text-amber-400 uppercase border border-amber-900/40">
                      {mc.cargo}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-black text-white font-mono uppercase tracking-wide">{mc.nome_mc}</h3>
                    <p className="text-xs font-bold text-zinc-300 mt-1">
                      👤 Contato: <span className="text-white font-mono">{mc.nome_contato}</span>
                    </p>
                  </div>

                  {mc.observacoes && (
                    <div className="bg-zinc-950/60 p-2.5 rounded border border-zinc-900/80 text-[11px] text-zinc-400 italic">
                      "{mc.observacoes}"
                    </div>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO E WHATSAPP */}
                <div className="pt-3 border-t border-zinc-900/80 flex flex-col gap-2">
                  <a
                    href={formatarWhatsappLink(mc.telefone)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full flex items-center justify-center gap-2 rounded bg-emerald-950/40 hover:bg-emerald-900/50 border border-emerald-800/60 p-2 text-center text-xs font-black text-emerald-400 uppercase transition-all font-mono"
                  >
                    💬 WhatsApp: {mc.telefone}
                  </a>

                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => handleAbrirModalEditar(mc)}
                      className="text-zinc-400 hover:text-white transition-colors bg-zinc-900 px-2 py-1.5 rounded border border-zinc-800 text-[11px] font-bold uppercase tracking-wider"
                    >
                      ⚙️ Editar
                    </button>
                    <button
                      onClick={() => handleDeletar(mc.id, mc.nome_mc)}
                      className="text-red-400 hover:text-red-300 transition-colors bg-red-950/20 hover:bg-red-950/40 px-2 py-1.5 rounded border border-red-900/40 text-[11px] font-bold uppercase tracking-wider"
                    >
                      ❌ Apagar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: CADASTRO / EDIÇÃO DE PARCEIRO */}
      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-zinc-950 p-6 space-y-4">
            <div className="border-b border-zinc-900 pb-3 flex justify-between items-center">
              <h2 className="text-sm font-black font-mono text-white uppercase tracking-wider">
                {idEdicao ? '⚙️ Editar Parceiro' : '🤝 Cadastrar Novo MC Parceiro'}
              </h2>
              <button onClick={() => setModalAberto(false)} className="text-zinc-500 hover:text-white">✕</button>
            </div>

            <form onSubmit={handleSalvar} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Nome do Motoclube *</label>
                <input
                  required
                  type="text"
                  value={form.nome_mc}
                  onChange={(e) => setForm({ ...form, nome_mc: e.target.value })}
                  placeholder="Ex: Guardiões da Estrada MC"
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none focus:border-zinc-600"
                />
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="col-span-2 space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Cidade *</label>
                  <input
                    required
                    type="text"
                    value={form.cidade}
                    onChange={(e) => setForm({ ...form, cidade: e.target.value })}
                    placeholder="Ex: Resende"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none focus:border-zinc-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">UF *</label>
                  <input
                    required
                    maxLength={2}
                    type="text"
                    value={form.estado}
                    onChange={(e) => setForm({ ...form, estado: e.target.value.toUpperCase() })}
                    placeholder="RJ"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none uppercase font-mono focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Contato / Vulgo *</label>
                  <input
                    required
                    type="text"
                    value={form.nome_contato}
                    onChange={(e) => setForm({ ...form, nome_contato: e.target.value })}
                    placeholder="Ex: Irmão Caveira"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none focus:border-zinc-600"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-zinc-500 font-bold uppercase">Cargo do Contato *</label>
                  <input
                    required
                    type="text"
                    value={form.cargo}
                    onChange={(e) => setForm({ ...form, cargo: e.target.value })}
                    placeholder="Ex: Presidente, RP"
                    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none focus:border-zinc-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
  <label className="text-zinc-500 font-bold uppercase">Telefone / WhatsApp com DDD *</label>
  <input
    required
    type="text"
    maxLength={15}
    value={form.telefone}
    onChange={(e) => setForm({ ...form, telefone: aplicarMascaraTelefone(e.target.value) })}
    placeholder="(24) 99999-9999"
    className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none font-mono focus:border-zinc-600"
  />
</div>

              <div className="space-y-1">
                <label className="text-zinc-500 font-bold uppercase">Observações (Ponto de apoio, alojamento...)</label>
                <textarea
                  rows={3}
                  value={form.observacoes}
                  onChange={(e) => setForm({ ...form, observacoes: e.target.value })}
                  placeholder="Ex: Possui alojamento na sede para até 10 pessoas, oficina parceira do lado."
                  className="w-full rounded bg-zinc-900 border border-zinc-800 p-2 text-white outline-none resize-none focus:border-zinc-600"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded bg-white p-2.5 font-black text-black hover:bg-zinc-200 text-xs uppercase mt-2 font-mono"
              >
                {idEdicao ? 'Salvar Alterações' : 'Confirmar Cadastro'}
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  )
}