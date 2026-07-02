'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../../lib/supabase' // ajuste o caminho se necessário

interface Membro {
  id: string
  nome_completo: string
}

export default function NovoChapter() {
  const router = useRouter()
  const supabase = createClient()

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
  const [carregandoMembros, setCarregandoMembros] = useState(true)
  const [buscandoCep, setBuscandoCep] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const [erro, setErro] = useState('')

  // 👥 1. Carga inicial dos membros ativos para o Guardião
  useEffect(() => {
    async function carregarMembros() {
      try {
        const { data, error } = await supabase
          .from('membros')
          .select('id, nome_completo')
          .eq('status_ativo', true)
          .order('nome_completo', { ascending: true })

        if (!error && data) {
          setMembros(data)
        }
      } catch (err) {
        console.error('Erro ao buscar membros:', err)
      } finally {
        setCarregandoMembros(false)
      }
    }
    carregarMembros()
  }, [])

  // ⚡ 2. Gatilho de Busca Automática de CEP via ViaCEP
  const handleCepChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const valor = e.target.value.replace(/\D/g, '') // Limpa traços ou pontos
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
          
          // Foco automático no número para poupar cliques
          document.getElementById('input-numero')?.focus()
        }
      } catch (err) {
        setErro('⚠️ Falha ao rastrear servidor de mapas (ViaCEP).')
      } finally {
        setBuscandoCep(false)
      }
    }
  }

  // 💾 3. Envio dos Dados para o Supabase
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
        .insert([
          {
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
          }
        ])

      if (error) throw error

      // Sucesso! Retorna para o painel de controle
      router.push('/dashboard')
      router.refresh()
    } catch (err: any) {
      console.error(err)
      setErro(`❌ Erro de comando: ${err.message || 'Falha ao salvar no banco.'}`)
    } finally {
      setEnviando(false)
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 flex justify-center items-center">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-900 bg-zinc-900/20 p-6 md:p-8 backdrop-blur-md">
        
        {/* Cabeçalho */}
        <div className="border-b border-zinc-900 pb-4 mb-6">
          <h1 className="text-xl font-black font-mono text-white uppercase tracking-tight flex items-center gap-2">
            ⚙️ Mapear Nova Frente Regional
          </h1>
          <p className="text-[11px] text-zinc-500 uppercase tracking-wider mt-0.5">
            Cadastrar território operacional, filiais e bases do REMC • 2026
          </p>
        </div>

        {erro && (
          <div className="mb-6 p-3 rounded-lg bg-red-950/30 border border-red-900/50 text-xs font-bold text-red-400 uppercase tracking-wide">
            {erro}
          </div>
        )}

        {/* Formulário */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Dados Principais */}
          <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Nome do Chapter / Praça *</label>
              <input 
                type="text" 
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex: REMC Chapter Itaperuna"
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 outline-none transition-colors"
                required
              />
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Classificação Regional</label>
              <select
                value={tipoChapter}
                onChange={(e) => setTipoChapter(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none transition-colors cursor-pointer"
              >
                <option value="Prospect Chapter" className="bg-zinc-900">Prospect Chapter (Em Formação)</option>
                <option value="Chapter" className="bg-zinc-900">Chapter (Oficializado)</option>
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Status Operacional</label>
              <select
                value={statusOperacional}
                onChange={(e) => setStatusOperacional(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none transition-colors cursor-pointer"
              >
                <option value="Ativo" className="bg-zinc-900 text-emerald-400">🟢 Ativo / Operando</option>
                <option value="Inativo" className="bg-zinc-900 text-red-400">🔴 Inativo / Suspenso</option>
              </select>
            </div>
          </div>

          {/* Endereço Inteligente com Busca por CEP */}
          <div className="border-t border-zinc-900 pt-4 space-y-4">
            <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-widest font-mono">📍 Local Oficial de Reuniões</h3>
            
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">CEP (Autopreencher)</label>
                <div className="relative">
                  <input 
                    type="text" 
                    maxLength={8}
                    value={cep}
                    onChange={handleCepChange}
                    placeholder="Somente números"
                    className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-zinc-500 outline-none transition-colors font-mono"
                  />
                  {buscandoCep && (
                    <span className="absolute right-2.5 top-2.5 text-xs animate-spin text-zinc-500">⏳</span>
                  )}
                </div>
              </div>

              <div className="col-span-2 md:col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Rua / Logradouro</label>
                <input 
                  type="text" 
                  value={rua}
                  onChange={(e) => setRua(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Número</label>
                <input 
                  id="input-numero"
                  type="text" 
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  placeholder="S/N"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-colors"
                />
              </div>

              <div className="col-span-2">
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Bairro</label>
                <input 
                  type="text" 
                  value={bairro}
                  onChange={(e) => setBairro(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white outline-none transition-colors"
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Cidade *</label>
                <input 
                  type="text" 
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white outline-none transition-colors"
                  required
                />
              </div>

              <div>
                <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Estado (UF) *</label>
                <input 
                  type="text" 
                  maxLength={2}
                  value={estado}
                  onChange={(e) => setEstado(e.target.value)}
                  placeholder="RJ"
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none transition-colors uppercase font-mono"
                  required
                />
              </div>
            </div>
          </div>

          {/* Atribuições de Comando */}
          <div className="border-t border-zinc-900 pt-4 grid gap-4 grid-cols-1 md:grid-cols-2">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Guardião da Sede (Responsável)</label>
              <select
                value={guardiaoId}
                onChange={(e) => setGuardiaoId(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none transition-colors cursor-pointer"
                disabled={carregandoMembros}
              >
                <option value="">{carregandoMembros ? 'Buscando contingente...' : 'Sem Guardião Designado'}</option>
                {membros.map((m) => (
                  <option key={m.id} value={m.id} className="bg-zinc-900 text-zinc-100">
                    {m.nome_completo}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 block mb-1.5">Data de Oficialização (Pavilhão)</label>
              <input 
                type="date" 
                value={dataOficializacao}
                onChange={(e) => setDataOficializacao(e.target.value)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-sm text-white focus:border-zinc-500 outline-none transition-colors font-mono"
              />
            </div>
          </div>

          {/* Botões de Ação */}
          <div className="border-t border-zinc-900 pt-6 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.push('/dashboard')}
              className="px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-500 border border-zinc-900 rounded-lg bg-transparent hover:bg-zinc-900 transition-colors"
            >
              Abortar
            </button>
            <button
              type="submit"
              disabled={enviando || buscandoCep}
              className="px-6 py-2 text-xs font-black uppercase tracking-widest text-zinc-950 bg-white hover:bg-zinc-200 rounded-lg disabled:opacity-50 transition-all shadow-[0_0_15px_rgba(255,255,255,0.08)]"
            >
              {enviando ? 'Gravando Território...' : 'Salvar Chapter 🏁'}
            </button>
          </div>

        </form>

      </div>
    </main>
  )
}