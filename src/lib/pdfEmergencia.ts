import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'

export interface MembroEmergencia {
  id: string
  nome_completo: string
  tarjeta_escrita?: string | null
  telefone_pessoal: string
  tipo_sanguineo?: string | null
  possui_alergia?: boolean | null
  alergias_descricao?: string | null
  contato_emergencia_nome?: string | null
  contato_emergencia_fone?: string | null
}

export const gerarPdfEmergenciaComboio = (
  membros: MembroEmergencia[], 
  nomeChapter: string = 'GERAL'
) => {
  // 1. Instância do PDF em formato Paisagem (Landscape) para caber na estrada
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  // 2. Cabeçalho Tático REMC
  doc.setFillColor(18, 18, 18) // Fundo Escuro
  doc.rect(0, 0, 297, 22, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(`REMC - FICHA COLETIVA DE EMERGÊNCIA & COMBOIO`, 14, 11)

  doc.setFontSize(9)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(180, 180, 180)
  doc.text(
    `CHAPTER / REGIONAL: ${nomeChapter.toUpperCase()} | EMISSÃO: ${new Date().toLocaleDateString('pt-BR')}`, 
    14, 
    17
  )

  // 3. Mapear dados para as linhas da tabela
  const linhasTabela = membros.map((m) => [
    `${m.nome_completo.toUpperCase()}\n${m.tarjeta_escrita ? `[${m.tarjeta_escrita}]` : ''}`,
    m.telefone_pessoal || 'N/I',
    m.tipo_sanguineo ? m.tipo_sanguineo.toUpperCase() : 'N/I',
    m.possui_alergia ? `SIM: ${m.alergias_descricao || 'Não detalhada'}` : 'NENHUMA',
    `${m.contato_emergencia_nome || 'N/I'}\n${m.contato_emergencia_fone || ''}`
  ])

  // 4. Montar a tabela tática
  autoTable(doc, {
    startY: 26,
    head: [['NOME / TARJETA', 'TEL. PESSOAL', 'TIPO SANGUÍNEO', 'ALERGIAS / OBS. MÉDICAS', 'CONTATO DE EMERGÊNCIA']],
    body: linhasTabela,
    theme: 'grid',
    headStyles: {
      fillColor: [30, 30, 30],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'left'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: [20, 20, 20]
    },
    columnStyles: {
      0: { cellWidth: 65, fontStyle: 'bold' },
      1: { cellWidth: 35 },
      2: { cellWidth: 30, fontStyle: 'bold', halign: 'center' },
      3: { cellWidth: 80 },
      4: { cellWidth: 70 }
    },
    didParseCell: (data) => {
      // Destaca em vermelho forte se o membro possuir alergias registradas
      if (data.section === 'body' && data.column.index === 3) {
        if (data.cell.raw && data.cell.raw.toString().startsWith('SIM:')) {
          data.cell.styles.textColor = [180, 0, 0]
          data.cell.styles.fontStyle = 'bold'
        }
      }
    }
  })

  // 5. Salvar / Baixar o arquivo PDF
  const nomeArquivo = `REMC_Ficha_Emergencia_${nomeChapter.replace(/\s+/g, '_')}.pdf`
  doc.save(nomeArquivo)
}