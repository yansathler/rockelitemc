'use client'

import { useState, useEffect } from 'react'
import { createClient } from '../../lib/supabase'

interface Membro {
  id: string
  email: string
  nome_completo: string
  telefone_pessoal: string
  data_nascimento: string
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
}

export default function Membros() {
  const supabase = createClient()
  
  const [membros, setMembros] = useState<Membro[]>([])
  const [carregando, setCarregando] = useState(true)
  const [exibirFormulario, setExibirFormulario] = useState(false)
  const [abaAtiva, setAbaAtiva] = useState<'pessoal' | 'endereco' | 'saude'>('pessoal')

  // Estados do Formulário
  const [email, setEmail] = useState('')
  const [nomeCompleto, setNomeCompleto] = useState('')
  const [telefonePessoal, setTelefonePessoal] = useState('')
  const [dataNascimento, setDataNascimento] = useState('')
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
  const [tpMembro, setTpMembro] = useState('prospect_i')
  const [statusAtivo, setStatusAtivo] = useState(true)
  const [cargoDiretoria, setCargoDiretoria] = useState('')
  const [vinculoMembroId, setVinculoMembroId] = useState('') // 🔥 Estado para o Vínculo do Espelho

  const [erroForm, setErroForm] = useState('')

  // 🎭 Funções de Máscaras em Tempo Real
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
      const cepFormatado = v.replace(/(\d{5})(\d)/, '$1-$2')
      setCep(cepFormatado)
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

  const buscarMembros = async () => {
    setCarregando(true)
    const { data, error } = await supabase
      .from('membros')
      .select('*')
      .order('nome_completo', { ascending: true })

    if (!error && data) setMembros(data)
    setCarregando(false)
  }

  useEffect(() => {
    buscarMembros()
  }, [])

  const handleCadastrar = async (e: React.FormEvent) => {
    e.preventDefault()
    setErroForm('')

    if (!nomeCompleto || !email || !telefonePessoal || !dataNascimento || !cpf) {
      setErroForm('Preencha todos os campos obrigatórios (*) da Aba Dados Pessoais.')
      setAbaAtiva('pessoal')
      return
    }

    // 🔥 Trava de Segurança para Membro Espelho
    if (tpMembro === 'Membros_espelho' && !vinculoMembroId) {
      setErroForm('Um Membro Espelho precisa obrigatoriamente estar vinculado a um integrante titular.')
      return
    }

    const dadosParaInserir = {
      email,
      nome_completo: nomeCompleto,
      telefone_pessoal: telefonePessoal,
      data_nascimento: dataNascimento,
      sexo,
      cpf,
      foto_url: fotoUrl || null,
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
    }

    const { error } = await supabase.from('membros').insert([dadosParaInserir])

    if (error) {
      setErroForm('Erro ao salvar irmão: ' + error.message)
    } else {
      // Limpeza de campos
      setEmail('')
      setNomeCompleto('')
      setTelefonePessoal('')
      setDataNascimento('')
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
      setTpMembro('prospect_i')
      setStatusAtivo(true)
      setCargoDiretoria('')
      setVinculoMembroId('')
      setExibirFormulario(false)
      setAbaAtiva('pessoal')
      buscarMembros()
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 p-6 text-zinc-100 md:p-10">
      
      <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Irmandade</h1>
          <p className="text-sm text-zinc-400">Gerenciamento de membros e comando do Rock Elite MC</p>
        </div>
        <button
          onClick={() => setExibirFormulario(!exibirFormulario)}
          className="rounded bg-zinc-100 px-5 py-2.5 text-sm font-bold uppercase tracking-wider text-zinc-950 hover:bg-zinc-200 transition-colors"
        >
          {exibirFormulario ? 'Fechar Cadastro' : '⚡ Recrutar Irmão'}
        </button>
      </div>

      <div className="grid gap-6 grid-cols-1 lg:grid-cols-12">
        
        {exibirFormulario && (
          <div className="rounded-xl border border-zinc-900 bg-zinc-900/30 p-6 lg:col-span-5 h-fit max-h-[85vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">Ficha de Alistamento</h2>
            
            <div className="mb-6 flex border-b border-zinc-900 text-xs font-bold uppercase tracking-wider">
              <button type="button" onClick={() => setAbaAtiva('pessoal')} className={`pb-3 pr-4 ${abaAtiva === 'pessoal' ? 'border-b border-white text-white' : 'text-zinc-500'}`}>👤 Pessoal</button>
              <button type="button" onClick={() => setAbaAtiva('endereco')} className={`pb-3 px-4 ${abaAtiva === 'endereco' ? 'border-b border-white text-white' : 'text-zinc-500'}`}>📍 Endereço</button>
              <button type="button" onClick={() => setAbaAtiva('saude')} className={`pb-3 px-4 ${abaAtiva === 'saude' ? 'border-b border-white text-white' : 'text-zinc-500'}`}>🩺 Saúde</button>
            </div>

            <form onSubmit={handleCadastrar} className="space-y-4">
              
              {/* ABA 1: DADOS PESSOAIS */}
              {abaAtiva === 'pessoal' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Nome Completo *</label>
                    <input type="text" value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">E-mail *</label>
                      <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Telefone Pessoal *</label>
                      <input type="text" value={telefonePessoal} onChange={(e) => setTelefonePessoal(aplicarMascaraTelefone(e.target.value))} placeholder="(00) 00000-0000" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" required />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">CPF *</label>
                      <input type="text" value={cpf} onChange={(e) => setCpf(aplicarMascaraCPF(e.target.value))} placeholder="000.000.000-00" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Sexo</label>
                      <select value={sexo} onChange={(e) => setSexo(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none">
                        <option value="Masculino">Masculino</option>
                        <option value="Feminino">Feminino</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Data Nascimento *</label>
                      <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">URL da Fotografia</label>
                      <input type="text" value={fotoUrl} onChange={(e) => setFotoUrl(e.target.value)} placeholder="Link da imagem" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                    </div>
                  </div>
                  <div className="border-t border-zinc-900 pt-3 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Identificação Tarjeta</label>
                      <select value={tarjetaTipo} onChange={(e) => setTarjetaTipo(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none">
                        <option value="nome">Primeiro Nome</option>
                        <option value="sobrenome">Sobrenome</option>
                        <option value="apelido">Apelido / Vulgo</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Escrita da Tarjeta</label>
                      <input type="text" value={tarjetaEscrita} onChange={(e) => setTarjetaEscrita(e.target.value)} placeholder="O que vai bordado" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                    </div>
                  </div>
                  <div className="border-t border-zinc-900 pt-3 grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Patente Interna</label>
                      <select value={tpMembro} onChange={(e) => { setTpMembro(e.target.value); if(e.target.value !== 'Membros_espelho') setVinculoMembroId(''); }} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none">
                        <option value="prospect_I">Próspero / Prospect I</option>
                        <option value="prospect_II">Prospect II</option>
                        <option value="prospect_III">Prospect III</option>
                        <option value="Full_patch">Full Patch (Escudo Fechado)</option>
                        <option value="Membros_espelho">Membro Espelho</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Cargo Diretoria / Perfil</label>
                      <select 
                        value={cargoDiretoria} 
                        onChange={(e) => setCargoDiretoria(e.target.value)} 
                        className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none"
                      >
                        <option value="membro">membro (Base)</option>
                        <option value="diretor_administrativo">diretor administrativo</option>
                        <option value="secretario">secretário</option>
                        <option value="vice_presidente">vice-presidente</option>
                        <option value="presidente">presidente</option>
                      </select>
                    </div> 

                    {/* 🔥 Campo Condicional: Vínculo do Membro Espelho */}
                    {tpMembro === 'Membros_espelho' && (
                      <div className="col-span-3 mt-1 animate-fadeIn">
                        <label className="block text-[10px] font-bold text-red-400 mb-1 uppercase">Vincular ao Integrante Titular *</label>
                        <select 
                          value={vinculoMembroId} 
                          onChange={(e) => setVinculoMembroId(e.target.value)} 
                          className="w-full rounded bg-zinc-950 border border-red-900/40 px-3 py-2 text-sm text-white focus:border-red-700 focus:outline-none"
                          required
                        >
                          <option value="">Selecione o membro titular...</option>
                          {membros
                            .filter(m => m.tp_membro !== 'Membros_espelho')
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

              {/* ABA 2: ENDEREÇO RESIDENCIAL */}
              {abaAtiva === 'endereco' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">CEP</label>
                    <input 
                      type="text" 
                      value={cep} 
                      onChange={(e) => aplicarMascaraCEP(e.target.value)} 
                      placeholder="00000-000" 
                      className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" 
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Rua / Logradouro</label>
                      <input type="text" value={enderecoRua} onChange={(e) => setEnderecoRua(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Número</label>
                      <input type="text" value={enderecoNumero} onChange={(e) => setEnderecoNumero(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Complemento</label>
                      <input type="text" value={enderecoComplemento} onChange={(e) => setEnderecoComplemento(e.target.value)} placeholder="Apto, Bloco..." className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Bairro</label>
                      <input type="text" value={enderecoBairro} onChange={(e) => setEnderecoBairro(e.target.value)} className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Cidade (Automático via CEP)</label>
                      <input type="text" value={enderecoCidade} disabled className="w-full rounded bg-zinc-950 border border-zinc-900/50 px-3 py-2 text-sm text-zinc-400 opacity-60 cursor-not-allowed focus:outline-none" />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 mb-1 uppercase">Estado (UF)</label>
                      <input type="text" value={enderecoEstado} disabled placeholder="UF" className="w-full rounded bg-zinc-950 border border-zinc-900/50 px-3 py-2 text-sm text-zinc-400 opacity-60 cursor-not-allowed text-center uppercase focus:outline-none" />
                    </div>
                  </div>
                </div>
              )}

              {/* ABA 3: SAÚDE & EMERGÊNCIA */}
              {abaAtiva === 'saude' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Tipo Sanguíneo</label>
                    <select 
                      value={tipoSanguineo} 
                      onChange={(e) => setTipoSanguineo(e.target.value)} 
                      className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none"
                    >
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

                  <div className="border-t border-zinc-900 pt-3">
                    <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2 tracking-wider">Contato SOS (Emergência)</p>
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Nome da Pessoa de Contato</label>
                        <input type="text" value={emergenciaNome} onChange={(e) => setEmergenciaNome(e.target.value)} placeholder="Ex: Maria (Esposa)" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Telefone de Emergência</label>
                        <input type="text" value={emergenciaFone} onChange={(e) => setEmergenciaFone(aplicarMascaraTelefone(e.target.value))} placeholder="(00) 00000-0000" className="w-full rounded bg-zinc-950 border border-zinc-900 px-3 py-2 text-sm text-white focus:border-zinc-700 focus:outline-none" />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-zinc-900 pt-3">
                    <div className="flex items-center gap-2 mb-2">
                      <input type="checkbox" id="alergiaCheck" checked={possuiAlergia} onChange={(e) => setPossuiAlergia(e.target.checked)} className="h-4 w-4 rounded bg-zinc-950 border border-zinc-900 accent-zinc-100" />
                      <label htmlFor="alergiaCheck" className="text-[10px] font-bold text-zinc-400 uppercase cursor-pointer">Possui alergia a medicação?</label>
                    </div>
                    {possuiAlergia && (
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-400 mb-1 uppercase">Descreva as medicações:</label>
                        <textarea value={alergiasDescricao} onChange={(e) => setAlergiasDescricao(e.target.value)} className="w-full h-20 rounded bg-zinc-950 border border-zinc-900 p-3 text-sm text-white focus:border-zinc-700 focus:outline-none resize-none" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="border-t border-zinc-900 pt-4 flex gap-3">
                {abaAtiva !== 'saude' ? (
                  <button type="button" onClick={() => setAbaAtiva(abaAtiva === 'pessoal' ? 'endereco' : 'saude')} className="w-full rounded bg-zinc-900 border border-zinc-800 py-2.5 text-xs font-bold uppercase tracking-wider text-white hover:bg-zinc-800">Próxima Aba ➡️</button>
                ) : (
                  <button type="submit" className="w-full rounded bg-zinc-100 py-2.5 text-sm font-bold uppercase tracking-wider text-zinc-950 hover:bg-zinc-200 transition-colors">Salvar na Base 🦅</button>
                )}
              </div>

              {erroForm && <p className="text-xs font-semibold text-red-400 bg-red-950/30 p-2 rounded border border-red-900">{erroForm}</p>}
            </form>
          </div>
        )}

        {/* Tabela de Integrantes Completa */}
        <div className={`rounded-xl border border-zinc-900 bg-zinc-900/10 p-6 ${exibirFormulario ? 'lg:col-span-7' : 'lg:col-span-12'}`}>
          <h2 className="text-lg font-bold text-white mb-4">Integrantes Atuais</h2>
          
          {carregando ? (
            <p className="text-sm text-zinc-500 italic">Buscando na Sede...</p>
          ) : membros.length === 0 ? (
            <p className="text-sm text-zinc-500 italic">Nenhum irmão cadastrado ainda.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-zinc-300">
                <thead className="bg-zinc-900/50 text-xs uppercase tracking-wider text-zinc-400 border-b border-zinc-900">
                  <tr>
                    <th className="p-4">Membro</th>
                    <th className="p-4">Tarjeta</th>
                    <th className="p-4">Contato / Endereço</th>
                    <th className="p-4">Ficha Médica / SOS</th>
                    <th className="p-4">Patente</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {membros.map((membro) => (
                    <tr key={membro.id} className="hover:bg-zinc-900/30 transition-colors text-xs">
                      <td className="p-4 flex items-center gap-3">
                        {membro.foto_url ? (
                          <img src={membro.foto_url} alt="Foto" className="h-9 w-9 rounded-full object-cover border border-zinc-800" />
                        ) : (
                          <div className="h-9 w-9 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center text-[10px] font-bold text-zinc-600">MC</div>
                        )}
                        <div>
                          <div className="font-bold text-white text-sm">{membro.nome_completo}</div>
                          <div className="text-[10px] text-zinc-500">CPF: {membro.cpf}</div>
                        </div>
                      </td>
                      <td className="p-4">
                        {membro.tarjeta_escrita ? (
                          <div className="inline-block border border-zinc-800 bg-zinc-950 px-2.5 py-1 rounded text-center text-white font-mono tracking-widest uppercase text-[11px] shadow-inner font-bold">
                            {membro.tarjeta_escrita}
                          </div>
                        ) : <span className="text-zinc-600">-</span>}
                      </td>
                      <td className="p-4">
                        <div className="text-zinc-400">{membro.email}</div>
                        <div className="text-zinc-500">{membro.telefone_pessoal}</div>
                        {membro.endereco_cidade && <div className="text-[10px] text-zinc-600 mt-0.5">{membro.endereco_cidade} - {membro.endereco_estado}</div>}
                      </td>
                      <td className="p-4">
                        <div className="text-red-400 font-bold">Sangue: {membro.tipo_sanguineo || 'N/A'}</div>
                        {membro.contato_emergencia_nome && (
                          <div className="text-[10px] text-zinc-400 mt-0.5">
                            🚨 {membro.contato_emergencia_nome} ({membro.contato_emergencia_fone})
                          </div>
                        )}
                        <div className="text-[10px] text-zinc-500 mt-0.5 max-w-[150px] truncate" title={membro.alergias_descricao}>Alergias: {membro.alergias_descricao}</div>
                      </td>
                      <td className="p-4">
                        <span className="rounded bg-zinc-900 px-2 py-0.5 uppercase font-bold text-zinc-400 border border-zinc-800 text-[10px]">
                          {membro.tp_membro.replace('_', ' ')}
                        </span>
                        {membro.cargo_diretoria && (
                          <div className="text-[9px] font-extrabold text-purple-400 mt-1 uppercase tracking-widest">
                            👑 {membro.cargo_diretoria.replace('_', ' ')}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </main>
  )
}