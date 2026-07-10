'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../../lib/supabase'

interface Membro {
  id: string
  nome_completo: string
}

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditarChapter({ params }: PageProps) {
  const router = useRouter()
  const supabase = createClient()
  
  // Desembrulha os parâmetros da URL de forma segura no Next.js
  const { id } = use(params)

  // Estados do Formulário
  const [nome, setNome] = useState('')
  const [tipoChapter, setTipoChapter] = useState('Prospect Chapter')
  const [statusOperacional, setStatusOperacional] = useState('Ativo')
  const [cep, setCep] = useState('')
  const [rua, setRua] = useState('')
  const [numero, setNumero] = useState('')
  const [bairro, setBairro] = useState('')
  const [cidade, setCidade] = useState('')
  const [estado, setEstado] = useState('')
  const [guardiaoId, setGuardiaoId] = useState('')
  const [dataOficializacao, setDataOficializacao] = useState('')

  // Estados de controle da tela
  const [membros, setMembros] = useState<Membro[]>([])
  const [carregandoDados, setCarregandoDados] = useState(true)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // 👥 1. Carrega o contingente de membros e os dados atuais do Chapter
  useEffect(() => {
    async function inicializarTela() {
      try {
        setCarregandoDados(true)
        
        // Busca membros ativos para o select de Guardião
        const { data: dataMembros } = await supabase
          .from('membros')
          .select('id, nome_completo')
          .eq('status_ativo', true)
          .order('nome_completo', { ascending: true })

        if (dataMembros) setMembros(dataMembros)

        // Busca o prontuário atual deste Chapter específico
        const { data: chapter, error: errorChapter } = await supabase
          .from('chapters')
          .select('*')
          .eq('id', id)
          .single()

        if (errorChapter) throw errorChapter

        if (chapter) {
          setNome(chapter.nome)
          setTipoChapter(chapter.tipo_chapter)
          setStatusOperacional(chapter.status_operacional)
          setRua(chapter.rua || '')
          setNumero(chapter.numero || '')
          setBairro(chapter.bairro || '')
          setCidade(chapter.cidade)
          setEstado(chapter.estado)
          setGuardiaoId(chapter.guardiao_id || '')
          setDataOficializacao(chapter.data_oficializacao || '')
        }

      } catch (err: any) {
        console.error(err)
        setErro('❌ Falha ao carregar o prontuário do Chapter selecionado.')
      } finally {
        setCarregandoDados(false)
      }
    }

    if (id) inicializarTela()
  }, [id])

  // ⚡ 2. Gatilho de Busca Automática de CEP via ViaCEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '')
    setCep(valor)

    if (valor.length === 8) {
      setBuscandoCep(true)
      setErro('')
      try {
        const res = await fetch(`https://viacep.com.br/ws/${valor}/json/`)
        const data = await res.json()

        if (data.erro) {
          setErro('⚠️ CEP não encontrado no asfalto nacional.')
        } else {
          setRua(data.logradouro || '')
          setBairro(data.bairro || '')
          setCidade(data.localidade || '')
          setEstado(data.uf || '')
          
          document.getElementById('input-numero')?.focus()
        }
      } catch (err) {
        setErro('⚠️ Falha ao rastrear servidor de mapas (ViaCEP).')
      } finally {
        setBuscandoCep(false)
      }
    }
  }

  // 💾 3. Update dos dados salvos no Supabase
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nome || !cidade || !estado) {
      setErro('⚠️ Preencha os campos obrigatórios (Nome, Cidade, Estado).')
      return
    }

    setEnviando(true)
    setErro('')

    try {
      const { error } = await supabase
        .from('chapters')
        .update({
          nome,
          tipo_chapter: tipoChapter,
          status_operacional: statusOperacional,
          rua,
          numero,
          bairro,
          cidade,
          estado: estado.toUpperCase().substring(0, 2),
          guardiao_id: guardiaoId || null,
          data_oficializacao: dataOficializacao || null
        })
        .eq('id', id)

      if (error) throw error

      // Sucesso! Retorna para a tela de gestão central de chapters
      router.push('/chapters')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setErro(`❌ Erro ao atualizar o comando: ${err.message || 'Falha ao salvar modificações.'}`)
    } finally {
      setEnviando(false)
    }
  }

  if (carregandoDados) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#07080a] text-zinc-400 font-medium text-xs tracking-widest uppercase">
        <div className="flex flex-col items-center gap-3">
          <span className="text-xl animate-spin">🛡️</span>
          <span>Acessando arquivos do alto comando...</span>
        </div>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-[#07080a] text-white p-4 md:p-8 font-sans">
      
      {/* TOPO DA TELA */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center border-b border-zinc-900 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚙️</span>
            <h1 className="text-2xl font-bold tracking-tight text-white uppercase">Atualizar Prontuário de Chapter</h1>
          </div>
          <p className="text-sm text-zinc-400 mt-1">Alterar diretrizes, endereço de QG e comando de sede ativa</p>
        </div>

        <div className="flex items-center gap-3">
          <button 
            type="button"
            onClick={() => router.push('/dashboard')} 
            className="rounded-lg bg-[#161920] border border-zinc-800 px-4 py-2 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors uppercase tracking-wider"
          >
            Voltar ao dash
          </button>
        </div>
      </div>

      {erro && (
        <div className="mb-6 p-4 rounded-xl bg-red-950/20 border border-red-900/40 text-xs font-bold text-red-400 uppercase tracking-wide">
          {erro}
        </div>
      )}

      {/* FORMULÁRIO DE ATUALIZAÇÃO AMPLO (100% LARGURA) */}
      <form onSubmit={handleSubmit} className="rounded-2xl bg-[#0f1115] border border-zinc-900 p-6 space-y-8 w-full">
        
        {/* SEÇÃO 1: IDENTIFICAÇÃO */}
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-4 font-mono">📋 Identificação Estrutural</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-4">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Nome do Chapter / Praça *</label>
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: REMC Chapter Itaperuna"
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white focus:border-zinc-700 outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Classificação Regional</label>
              <select
                value={tipoChapter}
                onChange={(e) => setTipoChapter(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white focus:border-zinc-700 outline-none transition-colors cursor-pointer"
              >
                <option value="Prospect Chapter" className="bg-[#0f1115]">Prospect Chapter (Em Formação)</option>
                <option value="Chapter" className="bg-[#0f1115]">Chapter (Oficializado)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Status Operacional</label>
              <select
                value={statusOperacional}
                onChange={(e) => setStatusOperacional(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white focus:border-zinc-700 outline-none transition-colors cursor-pointer"
              >
                <option value="Ativo" className="bg-[#0f1115] text-emerald-400">🟢 Ativo / Operando</option>
                <option value="Inativo" className="bg-[#0f1115] text-red-400">🔴 Inativo / Suspenso</option>
              </select>
            </div>
          </div>
        </div>

        {/* SEÇÃO 2: LOGÍSTICA / ENDEREÇO */}
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-4 font-mono">📍 QG / Local Oficial de Reuniões</h2>
          <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
            <div className="col-span-2 md:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Atualizar por CEP</label>
              <div className="relative">
                <input 
                  type="text" 
                  maxLength={8}
                  value={cep}
                  onChange={handleCepChange}
                  placeholder="Novo CEP"
                  className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white placeholder-zinc-700 focus:border-zinc-700 outline-none transition-colors font-mono"
                />
                {buscandoCep && (
                  <span className="absolute right-2.5 top-2.5 text-xs animate-spin text-zinc-500">⏳</span>
                )}
              </div>
            </div>

            <div className="col-span-2 md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Rua / Logradouro</label>
              <input 
                type="text" 
                value={rua}
                onChange={(e) => setRua(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Número</label>
              <input 
                id="input-numero"
                type="text" 
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="S/N"
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div className="col-span-1 md:col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Bairro</label>
              <input 
                type="text" 
                value={bairro}
                onChange={(e) => setBairro(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white outline-none focus:border-zinc-700 transition-colors"
              />
            </div>

            <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Cidade *</label>
              <input 
                type="text" 
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white outline-none focus:border-zinc-700 transition-colors"
                required
              />
            </div>

            <div className="col-span-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Estado (UF) *</label>
              <input 
                type="text" 
                maxLength={2}
                value={estado}
                onChange={(e) => setEstado(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white outline-none focus:border-zinc-700 transition-colors uppercase font-mono"
                required
              />
            </div>
          </div>
        </div>

        {/* SEÇÃO 3: COMANDO */}
        <div>
          <h2 className="text-xs font-bold text-zinc-400 uppercase tracking-widest border-b border-zinc-900 pb-2 mb-4 font-mono">🛡️ Alocação de Responsabilidade</h2>
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Guardião da Sede (Responsável)</label>
              <select
                value={guardiaoId}
                onChange={(e) => setGuardiaoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white focus:border-zinc-700 outline-none transition-colors cursor-pointer"
              >
                <option value="" className="bg-[#0f1115]">Sem Guardião Designado</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id} className="bg-[#0f1115] text-zinc-100">
                    {m.nome_completo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">Data de Oficialização (Pavilhão)</label>
              <input 
                type="date" 
                value={dataOficializacao}
                onChange={(e) => setDataOficializacao(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-[#07080a] px-3 py-2 text-sm text-white focus:border-zinc-700 outline-none transition-colors font-mono"
              />
            </div>
          </div>
        </div>

        {/* BOTÕES DE AÇÃO */}
        <div className="border-t border-zinc-900 pt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => router.push('/chapters')}
            className="px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400 border border-zinc-800 rounded-lg bg-transparent hover:bg-zinc-900 hover:text-white transition-colors"
          >
            Cancelar Modificações
          </button>
          <button
            type="submit"
            disabled={enviando || buscandoCep}
            className="px-7 py-2.5 text-xs font-black uppercase tracking-widest text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)]"
          >
            {enviando ? 'Atualizando Prontuário...' : 'Confirmar Alterações 🏁'}
          </button>
        </div>

      </form>

    </main>
  )
}