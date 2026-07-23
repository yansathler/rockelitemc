'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '../../lib/supabase'
import { gerarPdfEmergenciaComboio } from '../../lib/pdfEmergencia'

interface Membro {
  id: string
  email: string | null
  nome_completo: string
  telefone_pessoal: string
  data_nascimento: string
  data_filiacao: string 
  sexo: string | null
  cpf: string
  foto_url: string | null
  tarjeta_tipo: string | null
  tarjeta_escrita: string | null
  cep: string | null
  endereco_rua: string | null
  endereco_numero: string | null
  endereco_complemento: string | null
  endereco_bairro: string | null
  endereco_cidade: string | null
  endereco_estado: string | null
  tipo_sanguineo: string | null
  contato_emergencia_nome: string | null
  contato_emergencia_fone: string | null
  possui_alergia: boolean
  alergias_descricao: string
  tp_membro: string
  status_ativo: boolean
  cargo_diretoria: string | null
  vinculo_membro_id: string | null
  chapter_id: string 
}

interface Chapter {
  id: string
  nome: string
}

export default function Membros() {
  const router = useRouter()
  const supabase = createClient()
  
  const [membros, setMembros] = useState<Membro[]>([])
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvandoDados, setSalvandoDados] = useState(false)
  const [exibirFormulario, setExibirFormulario] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'pessoal' | 'endereco' | 'saude'>('pessoal')
  
  const [filtroStatus, setFiltroStatus] = useState<'todos' | 'ativos' | 'inativos'>('todos')
  const [chapterSelecionada, setChapterSelecionada] = useState<string>('todas')
  const [filtroTexto, setFiltroTexto] = useState('')

  const [idEdicao, setIdEdicao] = useState<string | null>(null)
  const [exibirModalInativar, setExibirModalInativar] = useState(false)
  const [justificativa, setJustificativa] = useState('')
  const [membroParaInativar, setMembroParaInativar] = useState<Membro | null>(null)

  const [arquivoFoto, setArquivoFoto] = useState<File | null>(null)
  const [enviandoFoto, setEnviandoFoto] = useState(false)
  const [email, setEmail] = useState('')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [telefonePessoal, setTelefonePessoal] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
  const [dataFiliacao, setDataFiliacao] = useState(new Date().toISOString().split('T')[0]) 
  const [sexo, setSexo] = useState('Masculino')
  const [cpf, setCpf] = useState('')
  const [fotoUrl, setFotoUrl] = useState('')
  const [tarjetaTipo, setTarjetaTipo] = useState('apelido')
  const [tarjetaEscrita, setTarjetaEscrita] = useState('')
  const [cep, setCep] = useState('')
  const [enderecoRua, setEnderecoRua] = useState('')
  const [enderecoNumero, setEnderecoNumero] = useState('')
  const [enderecoComplemento, setEnderecoComplemento] = useState('')
  const [enderecoBairro, setEnderecoBairro] = useState('')
  const [enderecoCidade, setEnderecoCidade] = useState('')
  const [enderecoEstado, setEnderecoEstado] = useState('')
  const [tipoSanguineo, setTipoSanguineo] = useState('')
  const [emergenciaNome, setEmergenciaNome] = useState('')
  const [emergenciaFone, setEmergenciaFone] = useState('')
  const [possuiAlergia, setPossuiAlergia] = useState(false)
  const [alergiasDescricao, setAlergiasDescricao] = useState('Nenhuma')
  const [tpMembro, setTpMembro] = useState('prospect_I')
  const [statusAtivo, setStatusAtivo] = useState(true)
  const [cargoDiretoria, setCargoDiretoria] = useState('membro')
  const [vinculoMembroId, setVinculoMembroId] = useState('')
  const [chapterIdForm, setChapterIdForm] = useState('') 

  const [erroForm, setErroForm] = useState('')

  const limparCampos = () => {
    setIdEdicao(null)
    setArquivoFoto(null)
    setEmail('')
    setNomeCompleto('')
    setTelefonePessoal('')
    setDataNascimento('')
    setDataFiliacao(new Date().toISOString().split('T')[0]) 
    setSexo('Masculino')
    setCpf('')
    setFotoUrl('')
    setTarjetaTipo('apelido')
    setTarjetaEscrita('')
    setCep('')
    setEnderecoRua('')
    setEnderecoNumero('')
    setEnderecoComplemento('')
    setEnderecoBairro('')
    setEnderecoCidade('')
    setEnderecoEstado('')
    setTipoSanguineo('')
    setEmergenciaNome('')
    setEmergenciaFone('')
    setPossuiAlergia(false)
    setAlergiasDescricao('Nenhuma')
    setTpMembro('prospect_I')
    setStatusAtivo(true)
    setCargoDiretoria('membro')
    setVinculoMembroId('')
    setChapterIdForm(chapters[0]?.id || '') 
    setErroForm('')
  }

  const aplicarMascaraCPF = (valor: string) => {
    const v = valor.replace(/\D/g, '')
    if (v.length <= 11) {
      return v
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    }
    return cpf
  }

  const aplicarMascaraTelefone = (valor: string) => {
    const v = valor.replace(/\D/g, '')
    if (v.length <= 11) {
      return v
        .replace(/^(\d{2})(\d)/g, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2')
    }
    return valor.substring(0, 15)
  }

  const aplicarMascaraCEP = async (valor: string) => {
    const v = valor.replace(/\D/g, '')
    if (v.length <= 8) {
      setCep(v.replace(/(\d{5})(\d)/, '$1-$2'))
    }
    if (v.length === 8) {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${v}/json/`)
        const dados = await res.json()
        if (!dados.erro) {
          setEnderecoRua(dados.logradouro || '')
          setEnderecoBairro(dados.bairro || '')
          setEnderecoCidade(dados.localidade || '')
          setEnderecoEstado(dados.uf || '')
        }
      } catch (err) {
        console.error("Erro ao buscar CEP na Sede:", err)
      }
    }
  }

  const inicializarDados = async () => {
    setCarregando(true)
    
    const { data: dataChapters } = await supabase
      .from('chapters')
      .select('id, nome')
      .order('nome', { ascending: true })

    if (dataChapters) {
      setChapters(dataChapters)
      if (dataChapters.length > 0) setChapterIdForm(dataChapters[0].id)
    }

    const { data: dataMembros } = await supabase
      .from('membros')
      .select('*')
      .order('nome_completo', { ascending: true })

    if (dataMembros) setMembros(dataMembros)
    
    setCarregando(false)
  }

  useEffect(() => {
    inicializarDados()
  }, [])

  const membrosFiltradosPorChapter = membros.filter(m => 
    chapterSelecionada === 'todas' ? true : m.chapter_id === chapterSelecionada
  )

  const qtdTodos = membrosFiltradosPorChapter.length
  const qtdAtivos = membrosFiltradosPorChapter.filter(m => m.status_ativo).length
  const qtdInativos = membrosFiltradosPorChapter.filter(m => !m.status_ativo).length

  const membrosFiltradosTabela = membrosFiltradosPorChapter.filter((membro) => {
    if (filtroStatus === 'ativos' && !membro.status_ativo) return false
    if (filtroStatus === 'inativos' && membro.status_ativo) return false

    if (filtroTexto.trim() !== '') {
      const texto = filtroTexto.toLowerCase()
      const nomeMatch = membro.nome_completo?.toLowerCase().includes(texto)
      const tarjetaMatch = membro.tarjeta_escrita?.toLowerCase().includes(texto)
      const patenteMatch = membro.tp_membro?.toLowerCase().replace('_', ' ').includes(texto)
      const cargoMatch = membro.cargo_diretoria?.toLowerCase().replace('_', ' ').includes(texto)

      return nomeMatch || tarjetaMatch || patenteMatch || cargoMatch
    }

    return true
  })

  const fazerUploadFoto = async (idDoMembro: string): Promise<string | null> => {
    if (!arquivoFoto) return fotoUrl || null
  
    setEnviandoFoto(true)
    try {
      const extensao = arquivoFoto.name.split('.').pop()
      const nomeArquivo = `${idDoMembro}-${Date.now()}.${extensao}`
  
      const { error: uploadError } = await supabase.storage
        .from('fotos-membros')
        .upload(nomeArquivo, arquivoFoto, {
          cacheControl: '3600',
          upsert: true
        })
  
      if (uploadError) throw uploadError
  
      const { data } = supabase.storage
        .from('fotos-membros')
        .getPublicUrl(nomeArquivo)
  
      return data.publicUrl
    } catch (error: any) {
      console.error('Erro ao fazer upload da foto:', error.message)
      setErroForm('Erro ao processar upload da fotografia: ' + error.message)
      return null
    } finally {
      setEnviandoFoto(false)
    }
  }

  const carregarMembroParaEdicao = (membro: Membro) => {
    setIdEdicao(membro.id)
    setEmail(membro.email || '')
    setNomeCompleto(membro.nome_completo || '')
    setTelefonePessoal(membro.telefone_pessoal || '')
    setDataNascimento(membro.data_nascimento || '')
    setDataFiliacao(membro.data_filiacao ? membro.data_filiacao.split('T')[0] : new Date().toISOString().split('T')[0]) 
    setSexo(membro.sexo || 'Masculino')
    setCpf(membro.cpf || '')
    setFotoUrl(membro.foto_url || '')
    setTarjetaTipo(membro.tarjeta_tipo || 'apelido')
    setTarjetaEscrita(membro.tarjeta_escrita || '')
    setCep(membro.cep || '')
    setEnderecoRua(membro.endereco_rua || '')
    setEnderecoNumero(membro.endereco_numero || '')
    setEnderecoComplemento(membro.endereco_complemento || '')
    setEnderecoBairro(membro.endereco_bairro || '')
    setEnderecoCidade(membro.endereco_cidade || '')
    setEnderecoEstado(membro.endereco_estado || '')
    setTipoSanguineo(membro.tipo_sanguineo || '')
    setEmergenciaNome(membro.contato_emergencia_nome || '')
    setEmergenciaFone(membro.contato_emergencia_fone || '')
    setPossuiAlergia(membro.possui_alergia || false)
    setAlergiasDescricao(membro.alergias_descricao || 'Nenhuma')
    setTpMembro(membro.tp_membro || 'prospect_I')
    setStatusAtivo(membro.status_ativo)
    setCargoDiretoria(membro.cargo_diretoria || 'membro')
    setVinculoMembroId(membro.vinculo_membro_id || '')
    setChapterIdForm(membro.chapter_id)
    
    setAbaAtiva('pessoal')
    setExibirFormulario(true)
  }

  const handleResetarSenha = async () => {
    if (!idEdicao) return
    
    const confirmar = window.confirm('Tem certeza de que deseja resetar a senha deste irmão para o padrão "RockElite@123"? Ele será obrigado a alterá-la no próximo login.')
    if (!confirmar) return

    setSalvandoDados(true)
    try {
      const res = await fetch('/api/membros', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idMembro: idEdicao })
      })

      const dados = await res.json()

      if (!res.ok || dados.error) {
        alert('Erro ao resetar senha: ' + (dados.error || 'Erro desconhecido.'))
      } else {
        alert('⚡ Chave forjada! A senha voltou para "RockElite@123" e a trava de primeiro acesso foi reativada.')
        limparCampos()
        setExibirFormulario(false)
        inicializarDados()
      }
    } catch (err: any) {
      alert('Erro na infraestrutura do servidor: ' + err.message)
    } finally {
      setSalvandoDados(false)
    }
  }

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroForm('')
    setSalvandoDados(true)

    const cpfLimpo = cpf.replace(/\D/g, '')

    if (!nomeCompleto || !telefonePessoal || !dataNascimento || !dataFiliacao || !chapterIdForm || cpfLimpo.length !== 11) {
      setErroForm('Preencha os campos obrigatórios (*) da Aba Pessoal e valide a Chapter escolhida.')
      setAbaAtiva('pessoal')
      setSalvandoDados(false)
      return
    }

    if (tpMembro === 'Membros_espelho' && !vinculoMembroId) {
      setErroForm('Um Membro Espelho precisa estar vinculado a um integrante titular.')
      setSalvandoDados(false)
      return
    }

    let idRegistro = idEdicao

    if (!idEdicao) {
      try {
        const resAuth = await fetch('/api/membros', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cpf: cpfLimpo,
            senhaProvisoria: 'RockElite@123'
          })
        })

        const dadosAuth = await resAuth.json()

        if (!resAuth.ok || dadosAuth.error) {
          throw new Error(dadosAuth.error || 'Falha ao forjar autenticação no servidor.')
        }

        idRegistro = dadosAuth.user.id
      } catch (err: any) {
        setErroForm('Erro na Infraestrutura de Autenticação: ' + err.message)
        setSalvandoDados(false)
        return
      }
    }

    const urlDaFotoFinal = await fazerUploadFoto(idRegistro!)
    if (arquivoFoto && !urlDaFotoFinal) {
      setSalvandoDados(false)
      return
    }

    const dadosMembro = {
      id: idRegistro,
      email: email || null,
      nome_completo: nomeCompleto,
      telefone_pessoal: telefonePessoal,
      data_nascimento: dataNascimento,
      data_filiacao: dataFiliacao, 
      sexo,
      cpf: cpfLimpo,
      foto_url: urlDaFotoFinal,
      tarjeta_tipo: tarjetaTipo,
      tarjeta_escrita: tarjetaEscrita || null,
      cep: cep || null,
      endereco_rua: enderecoRua || null,
      endereco_numero: enderecoNumero || null,
      endereco_complemento: enderecoComplemento || null,
      endereco_bairro: enderecoBairro || null,
      endereco_cidade: enderecoCidade || null,
      endereco_estado: enderecoEstado || null,
      tipo_sanguineo: tipoSanguineo || null,
      contato_emergencia_nome: emergenciaNome || null,
      contato_emergencia_fone: emergenciaFone || null,
      possui_alergia: possuiAlergia,
      alergias_descricao: possuiAlergia ? alergiasDescricao : 'Nenhuma',
      tp_membro: tpMembro,
      status_ativo: statusAtivo,
      cargo_diretoria: cargoDiretoria || null,
      vinculo_membro_id: tpMembro === 'Membros_espelho' ? vinculoMembroId : null,
      chapter_id: chapterIdForm
    }

    let resultado
    
    if (idEdicao) {
      resultado = await supabase.from('membros').update(dadosMembro).eq('id', idEdicao)
    } else {
      resultado = await supabase.from('membros').insert([dadosMembro])
    }

    setSalvandoDados(false)

    if (resultado.error) {
      setErroForm('Erro ao salvar cadastro do integrante: ' + resultado.error.message)
    } else {
      limparCampos()
      setExibirFormulario(false)
      inicializarDados()
    }
  }

  const handleInativarMembro = async () => {
    if (!membroParaInativar || !justificativa.trim()) return

    const { error: erroMembro } = await supabase
      .from('membros')
      .update({ status_ativo: false })
      .eq('id', membroParaInativar.id)

    if (erroMembro) {
      alert('Erro ao mudar status do irmão: ' + erroMembro.message)
      return
    }

    const { error: erroLog } = await supabase
      .from('logs_inativacao')
      .insert([
        {
          membro_id: membroParaInativar.id,
          justificativa: justificativa.trim()
        }
      ])

    if (erroLog) {
      alert('Status alterado, mas houve erro ao registrar o Log de Auditoria: ' + erroLog.message)
    } else {
      setExibirModalInativar(false)
      setJustificativa('')
      setMembroParaInativar(null)
      limparCampos()
      setExibirFormulario(false)
      inicializarDados()
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10 relative space-y-6">
      
      {/* 🧭 TOPO REESTRUTURADO E ALINHADO */}
      <div className="flex flex-col gap-4 border-b border-zinc-900 pb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-white uppercase font-mono">🛡️ Gestão de Membros</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mt-0.5">Gerenciamento de membros e comando do Rock Elite MC</p>
        </div>
        
        {/* FILTROS E BOTÕES COESOS NA DIREITA */}
        <div className="flex flex-wrap items-center gap-3">
          
          {/* SELETOR DE CHAPTER DINÂMICO */}
          <div className="flex items-center gap-2 border border-zinc-900 bg-zinc-900/40 px-3 py-1.5 rounded-lg">
            <span className="text-[10px] text-zinc-500 font-bold uppercase font-mono">Território:</span>
            <select 
              value={chapterSelecionada} 
              onChange={(e) => setChapterSelecionada(e.target.value)}
              className="bg-transparent text-xs font-black text-white outline-none cursor-pointer pr-1 font-mono uppercase"
            >
              <option value="todas" className="bg-zinc-950 text-zinc-300">Todas as Chapters</option>
              {chapters.map((c) => (
                <option key={c.id} value={c.id} className="bg-zinc-950 text-zinc-300">
                  {c.nome}
                </option>
              ))}
            </select>
          </div>

          {/* BOTÃO VOLTAR AO DASHBOARD */}
          <button
            onClick={() => router.push('/dashboard')}
            className="rounded border border-zinc-800 bg-zinc-900/30 px-4 py-2 text-xs font-bold uppercase tracking-wider text-zinc-400 hover:border-zinc-700 hover:text-white transition-all font-mono"
          >
            Voltar ao dash
          </button>

          {/* BOTÃO DE EMERGÊNCIA (PDF COLETIVO) */}
<button
  type="button"
  onClick={() => {
    // 💡 FILTRO APLICADO: Apenas membros com status_ativo === true
    const membrosAtivos = membros.filter(m => m.status_ativo)
    gerarPdfEmergenciaComboio(membrosAtivos, 'Nacional')
  }}
  className="rounded-lg bg-red-950/40 border border-red-800/60 px-3 py-2 text-xs font-black uppercase text-red-400 hover:bg-red-900/50 hover:text-white transition-all font-mono flex items-center gap-2 cursor-pointer"
>
  🚨 Ficha de Emergência (PDF)
</button>

          {/* BOTÃO RECRUTAR IRMÃO (ABRE MODAL DE FORMULÁRIO) */}
          <button
            onClick={() => {
              limparCampos()
              setExibirFormulario(true)
            }}
            className="rounded bg-zinc-100 px-5 py-2 text-xs font-black uppercase tracking-wider text-zinc-950 hover:bg-zinc-200 transition-colors"
          >
            ⚡ Recrutar Irmão
          </button>
        </div>
      </div>

      {/* 📊 CARDS SUPERIORES SELETORES */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        
        {/* Card Todos */}
        <div 
          onClick={() => setFiltroStatus('todos')}
          className={`rounded-xl border p-4 cursor-pointer transition-all ${filtroStatus === 'todos' ? 'border-zinc-700 bg-zinc-900/40' : 'border-zinc-900 bg-zinc-900/10 hover:border-zinc-800'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total do Efetivo</span>
            <div className="text-zinc-400 text-xs">👥</div>
          </div>
          <p className="mt-2 text-2xl font-black text-white font-mono">{carregando ? '...' : qtdTodos}</p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Listagem geral do território</p>
        </div>

        {/* Card Ativos */}
        <div 
          onClick={() => setFiltroStatus('ativos')}
          className={`rounded-xl border p-4 cursor-pointer transition-all ${filtroStatus === 'ativos' ? 'border-emerald-900 bg-emerald-950/10' : 'border-zinc-900 bg-zinc-900/10 hover:border-zinc-800'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Integrantes Ativos</span>
            <div className="text-emerald-400 text-xs">⚡</div>
          </div>
          <p className="mt-2 text-2xl font-black text-emerald-400 font-mono">{carregando ? '...' : qtdAtivos}</p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Prontos para a pista</p>
        </div>

        {/* Card Inativos */}
        <div 
          onClick={() => setFiltroStatus('inativos')}
          className={`rounded-xl border p-4 cursor-pointer transition-all ${filtroStatus === 'inativos' ? 'border-red-900 bg-red-950/10' : 'border-zinc-900 bg-zinc-900/10 hover:border-zinc-800'}`}
        >
          <div className="flex items-center justify-between text-zinc-500">
            <span className="text-[10px] font-bold uppercase tracking-wider">Baixas / Inativos</span>
            <div className="text-red-400 text-xs">💀</div>
          </div>
          <p className="mt-2 text-2xl font-black text-red-400 font-mono">{carregando ? '...' : qtdInativos}</p>
          <p className="mt-1 text-[9px] text-zinc-500 uppercase">Histórico de afastamentos</p>
        </div>

      </div>

      {/* 🟡 LISTAGEM PRINCIPAL (AGORA EM LARGURA TOTAL) */}
      <div className="rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 w-full">
        
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-zinc-900 pb-5">
          <h2 className="text-xs font-black text-white uppercase tracking-wider font-mono flex items-center gap-2">
            <span>👥</span> Integrantes do Território
          </h2>
          
          <div className="w-full sm:max-w-xs">
            <input
              type="text"
              placeholder="🔍 Buscar por nome, tarjeta ou patente..."
              value={filtroTexto}
              onChange={(e) => setFiltroTexto(e.target.value)}
              className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-1.5 text-xs text-white focus:border-zinc-700 focus:outline-none placeholder-zinc-800 font-mono"
            />
          </div>
        </div>
        
        {carregando ? (
          <p className="text-xs text-zinc-500 italic uppercase tracking-wider font-mono p-6">Buscando na Sede...</p>
        ) : membrosFiltradosTabela.length === 0 ? (
          <p className="text-xs text-zinc-500 italic p-6 text-center border border-dashed border-zinc-900 rounded-lg uppercase tracking-wider font-mono">
            Nenhum integrante encontrado para os critérios selecionados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="bg-zinc-900/50 text-[10px] uppercase tracking-wider text-zinc-500 border-b border-zinc-900 font-mono">
                <tr>
                  <th className="p-4">Membro / Documento</th>
                  <th className="p-4">Tarjeta</th>
                  <th className="p-4">Contato / Filial</th>
                  <th className="p-4">Ficha Médica / SOS</th>
                  <th className="p-4">Patente</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-900">
                {membrosFiltradosTabela.map((membro) => {
                  const chapterDoMembro = chapters.find(c => c.id === membro.chapter_id);
                  
                  return (
                    <tr 
                      key={membro.id} 
                      onClick={() => carregarMembroParaEdicao(membro)}
                      className={`transition-colors text-xs cursor-pointer ${membro.status_ativo ? 'hover:bg-zinc-900/50' : 'bg-red-950/5 hover:bg-red-950/10 opacity-60'}`}
                      title="Clique para abrir a ficha do integrante"
                    >
                      <td className="p-4 flex items-center gap-3">
                        {membro.foto_url ? (
                          <img src={membro.foto_url} alt="Foto" className="h-9 w-9 rounded-full object-cover border border-zinc-800 shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[9px] font-bold text-zinc-600 shrink-0">MC</div>
                        )}
                        <div>
                          <div className="font-bold text-white text-sm flex items-center gap-2">
                            {membro.nome_completo}
                            {!membro.status_ativo && <span className="bg-red-900/80 text-[8px] tracking-wide text-red-200 px-1.5 py-0.5 rounded uppercase font-extrabold">Inativo</span>}
                          </div>
                          <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                            CPF: {membro.cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4')}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        {membro.tarjeta_escrita ? (
                          <div className="inline-block border border-zinc-800 bg-zinc-950 px-2.5 py-0.5 rounded text-center text-white font-mono tracking-widest uppercase text-[10px] shadow-inner font-bold">
                            {membro.tarjeta_escrita}
                          </div>
                        ) : <span className="text-zinc-600">-</span>}
                      </td>
                      <td className="p-4">
                        <div className="text-zinc-400 max-w-[160px] truncate">{membro.email || 'Sem e-mail'}</div>
                        <div className="text-zinc-500 font-mono">{membro.telefone_pessoal}</div>
                        <div className="text-[10px] text-zinc-500 font-bold uppercase mt-0.5 font-mono">
                          📍 {chapterDoMembro ? chapterDoMembro.nome : 'Não Alocado'}
                        </div>
                      </td>
                      <td className="p-4">
                        <div className="text-red-400 font-bold font-mono">🩸 Sangue: {membro.tipo_sanguineo || 'N/A'}</div>
                        {membro.contato_emergencia_nome && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            🚨 {membro.contato_emergencia_nome} ({membro.contato_emergencia_fone})
                          </div>
                        )}
                        <div className="text-[10px] text-zinc-500 mt-0.5 max-w-[150px] truncate" title={membro.alergias_descricao}>Alergias: {membro.alergias_descricao}</div>
                      </td>
                      <td className="p-4">
                        <span className="rounded bg-zinc-900 px-2 py-0.5 uppercase font-bold text-zinc-400 border border-zinc-800 text-[9px] font-mono">
                          {membro.tp_membro.replace('_', ' ')}
                        </span>
                        {membro.cargo_diretoria && (
                          <div className="text-[9px] font-extrabold text-blue-400 mt-1 uppercase tracking-widest font-mono">
                            ⚡ {membro.cargo_diretoria.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 🦅 MODAL POP-UP TÁTICO DE FORMULÁRIO (CADASTRO / EDIÇÃO) */}
      {exibirFormulario && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-md animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
            
            {/* CABEÇALHO COM DESTAQUE VISUAL DA FOTO & DADOS RÁPIDOS */}
            <div className="p-6 bg-zinc-950/80 border-b border-zinc-800 relative">
              
              {/* Botão Fechar X no topo */}
              <button 
                type="button" 
                onClick={() => { limparCampos(); setExibirFormulario(false); }}
                className="absolute top-4 right-4 text-zinc-500 hover:text-white text-lg font-bold p-1 transition-colors"
              >
                ✕
              </button>

              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full bg-zinc-900 border-2 border-zinc-700 flex items-center justify-center overflow-hidden shrink-0 shadow-lg">
                    {arquivoFoto ? (
                      <img src={URL.createObjectURL(arquivoFoto)} alt="Preview" className="h-full w-full object-cover" />
                    ) : fotoUrl ? (
                      <img src={fotoUrl} alt="Atual" className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-xs text-zinc-600 font-black font-mono">REMC</span>
                    )}
                  </div>
                  <label className="absolute -bottom-1 -right-1 bg-zinc-800 border border-zinc-600 hover:bg-zinc-700 text-white rounded-full p-1 cursor-pointer transition-all shadow-md">
                    📸
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment"
                      onChange={(e) => {
                        if (e.target.files && e.target.files[0]) {
                          setArquivoFoto(e.target.files[0])
                        }
                      }}
                      className="hidden" 
                    />
                  </label>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base font-black text-white uppercase tracking-wider font-mono">
                      {idEdicao ? (nomeCompleto || 'Membro') : 'Alistamento de Integrante'}
                    </h2>
                    {idEdicao && (
                      <span className={`text-[9px] px-2 py-0.5 rounded font-black font-mono uppercase tracking-wider ${statusAtivo ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-red-950 text-red-400 border border-red-800'}`}>
                        {statusAtivo ? 'Ativo' : 'Inativo'}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
                    {tarjetaEscrita && (
                      <span className="bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded text-white font-bold tracking-widest uppercase">
                        [{tarjetaEscrita}]
                      </span>
                    )}
                    <span className="uppercase text-zinc-500 font-bold">
                      {tpMembro.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              </div>

              {/* AÇÕES ESPECIAIS DE EDIÇÃO NO CABEÇALHO */}
              {idEdicao && (
                <div className="mt-4 pt-3 border-t border-zinc-800/60 flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={handleResetarSenha}
                    disabled={salvandoDados}
                    className="rounded bg-zinc-800/80 border border-zinc-700 text-zinc-300 px-3 py-1 text-[10px] font-bold uppercase hover:bg-zinc-700 hover:text-white transition-all disabled:opacity-40 font-mono"
                  >
                    🔑 Resetar Senha
                  </button>

                  {statusAtivo && (
                    <button
                      type="button"
                      onClick={() => {
                        const m = membros.find(x => x.id === idEdicao)
                        if (m) {
                          setMembroParaInativar(m)
                          setExibirModalInativar(true)
                        }
                      }}
                      className="rounded bg-red-950/60 border border-red-900/80 text-red-400 px-3 py-1 text-[10px] font-bold uppercase hover:bg-red-900 hover:text-white transition-all font-mono"
                    >
                      💀 Inativar
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* BARRA DE NAVEGAÇÃO DAS ABAS (TABS) */}
            <div className="flex border-b border-zinc-800 bg-zinc-950/40 text-xs font-bold uppercase tracking-wider font-mono">
              <button 
                type="button" 
                onClick={() => setAbaAtiva('pessoal')} 
                className={`flex-1 py-3 text-center transition-all ${abaAtiva === 'pessoal' ? 'border-b-2 border-white text-white bg-zinc-900/60' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                🪪 Pessoal & MC
              </button>
              <button 
                type="button" 
                onClick={() => setAbaAtiva('saude')} 
                className={`flex-1 py-3 text-center transition-all ${abaAtiva === 'saude' ? 'border-b-2 border-white text-white bg-zinc-900/60' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                🚨 Saúde / SOS
              </button>
              <button 
                type="button" 
                onClick={() => setAbaAtiva('endereco')} 
                className={`flex-1 py-3 text-center transition-all ${abaAtiva === 'endereco' ? 'border-b-2 border-white text-white bg-zinc-900/60' : 'text-zinc-500 hover:text-zinc-300'}`}
              >
                🏠 Endereço
              </button>
            </div>

            {/* FORMULÁRIO EM CORPO ROLÁVEL */}
            <form onSubmit={handleCadastrar} className="p-6 overflow-y-auto space-y-4 flex-1">
              
              {/* ABA 1: PESSOAL & MC */}
              {abaAtiva === 'pessoal' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase tracking-wider font-mono">Chapter / Lotação Oficial *</label>
                    <select 
                      value={chapterIdForm} 
                      onChange={(e) => setChapterIdForm(e.target.value)}
                      className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none uppercase font-mono"
                      required
                    >
                      {chapters.map(c => (
                        <option key={c.id} value={c.id}>{c.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Nome Completo *</label>
                    <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" required />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">E-mail (Contato)</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Opcional" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Telefone Pessoal *</label>
                      <input type="text" value={telefonePessoal} onChange={(e) => setTelefonePessoal(aplicarMascaraTelefone(e.target.value))} placeholder="(00) 00000-0000" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">CPF *</label>
                      <input type="text" value={cpf} onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))} placeholder="000.000.000-00" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" disabled={!!idEdicao} required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Sexo</label>
                      <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono">
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                      </select>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Data Nascimento *</label>
                      <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Data de Filiação (MC) *</label>
                      <input type="date" value={dataFiliacao} onChange={(e) => setDataFiliacao(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none cursor-pointer font-mono" required />
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Identificação Tarjeta</label>
                      <select value={tarjetaTipo} onChange={(e) => setTarjetaTipo(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono">
                        <option value="nome">Primeiro Nome</option>
                        <option value="sobrenome">Sobrenome</option>
                        <option value="apelido">Apelido / Vulgo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Escrita da Tarjeta</label>
                      <input type="text" value={tarjetaEscrita} onChange={(e) => setTarjetaEscrita(e.target.value)} placeholder="O que vai bordado" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Patente Interna</label>
                      <select value={tpMembro} onChange={(e) => { setTpMembro(e.target.value); if(e.target.value !== 'Membros_espelho') setVinculoMembroId(''); }} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono">
                        <option value="prospect_I">Próspero / Prospect I</option>
                        <option value="prospect_II">Prospect II</option>
                        <option value="prospect_III">Prospect III</option>
                        <option value="Full_patch">Full Patch (Escudo Fechado)</option>
                        <option value="Membros_espelho">Membro Espelho</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Cargo Diretoria</label>
                      <select 
                        value={cargoDiretoria || 'membro'} 
                        onChange={(e) => setCargoDiretoria(e.target.value)} 
                        className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono"
                      >
                        <option value="membro">membro (Base)</option>
                        <option value="diretor_administrativo">diretor administrativo</option>
                        <option value="secretario">secretário</option>
                        <option value="vice_presidente">vice-presidente</option>
                        <option value="presidente">presidente</option>
                      </select>
                    </div> 

                    {tpMembro === 'Membros_espelho' && (
                      <div className="sm:col-span-3 mt-1">
                        <label className="block text-[10px] font-bold text-red-400 mb-1 uppercase font-mono">Vincular ao Integrante Titular *</label>
                        <select 
                          value={vinculoMembroId} 
                          onChange={(e) => setVinculoMembroId(e.target.value)} 
                          className="w-full rounded bg-zinc-950 border border-red-900/40 px-3 py-2 text-xs text-white focus:border-red-700 focus:outline-none font-mono"
                          required
                        >
                          <option value="">Selecione o membro titular...</option>
                          {membros
                            .filter(m => m.tp_membro !== 'Membros_espelho' && m.id !== idEdicao)
                            .map(m => (
                              <option key={m.id} value={m.id}>{m.nome_completo} ({m.tarjeta_escrita || 'Sem Tarjeta'})</option>
                            ))
                          }
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 2: SAÚDE & SOS */}
              {abaAtiva === 'saude' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Tipo Sanguíneo / RH</label>
                    <select value={tipoSanguineo} onChange={(e) => setTipoSanguineo(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono">
                      <option value="">Selecione o tipo sanguíneo</option>
                      <option value="A+">A+</option>
                      <option value="A-">A-</option>
                      <option value="B+">B+</option>
                      <option value="B-">B-</option>
                      <option value="AB+">AB+</option>
                      <option value="AB-">AB-</option>
                      <option value="O+">O+</option>
                      <option value="O-">O-</option>
                    </select>
                  </div>

                  <div className="border-t border-zinc-800 pt-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2 tracking-wider font-mono">🚨 Contato SOS (Emergência Estrada)</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Nome do Contato</label>
                        <input type="text" value={emergenciaNome} onChange={(e) => setEmergenciaNome(e.target.value)} placeholder="Ex: Maria (Esposa)" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Telefone de Emergência</label>
                        <input type="text" value={emergenciaFone} onChange={(e) => setEmergenciaFone(aplicarMascaraTelefone(e.target.value))} placeholder="(00) 00000-0000" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-800 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" id="alergiaCheck" checked={possuiAlergia} onChange={(e) => setPossuiAlergia(e.target.checked)} className="h-4 w-4 rounded bg-zinc-950 border border-zinc-800 accent-zinc-100" />
                      <label htmlFor="alergiaCheck" className="text-[10px] font-bold text-zinc-400 uppercase cursor-pointer font-mono">Possui alergia a medicação / observações médicas?</label>
                    </div>
                    {possuiAlergia && (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Descreva detalhadamente:</label>
                        <textarea value={alergiasDescricao} onChange={(e) => setAlergiasDescricao(e.target.value)} className="w-full h-24 rounded bg-zinc-950 border border-zinc-800 p-3 text-xs text-white focus:border-zinc-600 focus:outline-none resize-none font-mono" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ABA 3: ENDEREÇO */}
              {abaAtiva === 'endereco' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">CEP (Busca Automática)</label>
                    <input type="text" value={cep} onChange={(e) => aplicarMascaraCEP(e.target.value)} placeholder="00000-000" className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Rua / Logradouro</label>
                      <input type="text" value={enderecoRua} onChange={(e) => setEnderecoRua(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Número</label>
                      <input type="text" value={enderecoNumero} onChange={(e) => setEnderecoNumero(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Complemento</label>
                      <input type="text" value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} placeholder="Apto, Bloco..." className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase font-mono">Bairro</label>
                      <input type="text" value={enderecoBairro} onChange={(e) => setEnderecoBairro(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-800 px-3 py-2 text-xs text-white focus:border-zinc-600 focus:outline-none font-mono" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase font-mono">Cidade (Automático via CEP)</label>
                      <input type="text" value={enderecoCidade} disabled className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-xs text-zinc-400 opacity-60 cursor-not-allowed focus:outline-none font-mono" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase font-mono">Estado (UF)</label>
                      <input type="text" value={enderecoEstado} disabled placeholder="UF" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-xs text-zinc-400 opacity-60 cursor-not-allowed text-center uppercase focus:outline-none font-mono" />
                    </div>
                  </div>
                </div>
              )}

              {erroForm && <p className="text-xs font-semibold text-red-400 bg-red-950/30 p-2.5 rounded border border-red-900 font-mono">{erroForm}</p>}

              {/* RODAPÉ DO MODAL COM BOTÕES DE AÇÃO */}
              <div className="border-t border-zinc-800 pt-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => { limparCampos(); setExibirFormulario(false); }}
                  className="rounded bg-zinc-800 border border-zinc-700 px-4 py-2 text-xs font-bold uppercase text-zinc-300 hover:bg-zinc-700 transition-all font-mono"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={enviandoFoto || salvandoDados} 
                  className="rounded bg-zinc-100 px-6 py-2 text-xs font-black uppercase tracking-wider text-zinc-950 hover:bg-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-mono"
                >
                  {salvandoDados ? '⏳ Forjando Acesso...' : enviandoFoto ? '⏳ Enviando Foto...' : idEdicao ? '⚡ Atualizar Base' : 'Salvar na Base 🦅'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* MODAL DE INATIVAÇÃO */}
      {exibirModalInativar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50 backdrop-blur-sm animate-fadeIn">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-6 max-w-md w-full shadow-2xl">
            <h3 className="text-lg font-bold text-red-400 uppercase tracking-wider mb-2 font-mono">Justificativa de Inativação</h3>
            <p className="text-xs text-zinc-400 mb-4 font-mono">
              Informe detalhadamente o motivo do desligamento ou afastamento de <strong className="text-white">{membroParaInativar?.nome_completo}</strong>. O registro ficará salvo permanentemente no histórico da irmandade.
            </p>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Ex: Afastamento por motivos profissionais / Desligamento oficial da irmandade..."
              className="w-full h-28 rounded bg-zinc-950 border border-zinc-800 p-3 text-sm text-white focus:border-red-900 focus:outline-none resize-none mb-4 font-mono"
              required
            />
            <div className="flex gap-3 justify-end text-xs font-bold uppercase font-mono">
              <button
                type="button"
                onClick={() => { setExibirModalInativar(false); setJustificativa(''); }}
                className="px-4 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleInativarMembro}
                disabled={!justificativa.trim()}
                className="px-4 py-2 rounded bg-red-600 text-white hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Confirmar Baixa 💀
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}