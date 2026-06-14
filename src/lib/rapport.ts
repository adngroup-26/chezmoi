import jsPDF from 'jspdf'
import { InfosEntreprise } from './recu'

export interface LigneVenteRapport {
  numero: string
  client: string
  total: number
  statut: string
  heure: string
}

export interface DonneesRapport {
  periodeLabel: string       // ex: "Aujourd'hui — 13/06/2026" ou "Du 01/06/2026 au 13/06/2026"
  genereLe: Date
  ca: number
  benefice: number
  nbVentes: number
  nbClients: number
  nbArticles: number
  valeurStock: number
  ventes: LigneVenteRapport[]
  alertesStock: { nom: string; quantite: number; stockMinimum: number }[]
  entreprise: InfosEntreprise
}

function formatNombre(n: number): string {
  const entier = Math.round(n)
  const str = Math.abs(entier).toString()
  let result = ''
  for (let i = 0; i < str.length; i++) {
    if (i > 0 && (str.length - i) % 3 === 0) result += ' '
    result += str[i]
  }
  return (entier < 0 ? '-' : '') + result
}

function formatMontant(n: number, devise: string): string {
  return `${formatNombre(n)} ${devise}`
}

export function genererRapportActivite(donnees: DonneesRapport): jsPDF {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const pageWidth = 210
  const margin = 15
  const usableWidth = pageWidth - margin * 2
  let y = margin

  const titre = (texte: string, taille = 16) => {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(taille)
    doc.text(texte, margin, y)
    y += taille * 0.5
  }

  const sousTitre = (texte: string, taille = 10) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(taille)
    doc.setTextColor(110, 110, 110)
    doc.text(texte, margin, y)
    doc.setTextColor(0, 0, 0)
    y += taille * 0.5 + 2
  }

  const sectionTitre = (texte: string) => {
    y += 4
    doc.setFillColor(27, 43, 75) // bleu marine #1B2B4B
    doc.rect(margin, y - 4.5, usableWidth, 7, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(255, 255, 255)
    doc.text(texte, margin + 2, y)
    doc.setTextColor(0, 0, 0)
    y += 6
  }

  const ligne = (texte: string, taille = 9, gras = false) => {
    doc.setFont('helvetica', gras ? 'bold' : 'normal')
    doc.setFontSize(taille)
    doc.text(texte, margin, y)
    y += taille * 0.5 + 1.5
  }

  const checkPageBreak = (espaceNecessaire: number) => {
    if (y + espaceNecessaire > 285) {
      doc.addPage()
      y = margin
    }
  }

  // ===== EN-TÊTE =====
  titre(donnees.entreprise.nom_entreprise || 'ChezMoi', 18)
  if (donnees.entreprise.telephone || donnees.entreprise.adresse) {
    const infos = [donnees.entreprise.telephone, donnees.entreprise.adresse].filter(Boolean).join('  ·  ')
    sousTitre(infos)
  }
  y += 1
  doc.setDrawColor(27, 43, 75)
  doc.setLineWidth(0.5)
  doc.line(margin, y, pageWidth - margin, y)
  y += 6

  titre('Rapport d\'activité', 14)
  sousTitre(donnees.periodeLabel, 11)
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(`Généré le ${donnees.genereLe.toLocaleDateString('fr-FR')} à ${donnees.genereLe.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`, margin, y)
  doc.setTextColor(0, 0, 0)
  y += 6

  // ===== INDICATEURS CLÉS =====
  sectionTitre('INDICATEURS CLÉS')

  const kpis: [string, string][] = [
    ['Chiffre d\'affaires', formatMontant(donnees.ca, donnees.entreprise.devise)],
    ['Bénéfice estimé', formatMontant(donnees.benefice, donnees.entreprise.devise)],
    ['Nombre de ventes', donnees.nbVentes.toString()],
    ['Valeur du stock', formatMontant(donnees.valeurStock, donnees.entreprise.devise)],
    ['Nombre de clients', donnees.nbClients.toString()],
    ['Articles actifs', donnees.nbArticles.toString()],
  ]

  const colWidth = usableWidth / 2
  for (let i = 0; i < kpis.length; i += 2) {
    const [label1, val1] = kpis[i]
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(9)
    doc.setTextColor(110, 110, 110)
    doc.text(label1, margin, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(0, 0, 0)
    doc.text(val1, margin, y + 5)

    if (kpis[i + 1]) {
      const [label2, val2] = kpis[i + 1]
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.setTextColor(110, 110, 110)
      doc.text(label2, margin + colWidth, y)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(12)
      doc.setTextColor(0, 0, 0)
      doc.text(val2, margin + colWidth, y + 5)
    }
    y += 11
  }

  // ===== ALERTES STOCK =====
  if (donnees.alertesStock.length > 0) {
    checkPageBreak(10 + donnees.alertesStock.length * 5)
    sectionTitre('ALERTES STOCK')
    for (const a of donnees.alertesStock) {
      checkPageBreak(5)
      const statut = a.quantite === 0 ? 'RUPTURE' : `${a.quantite} unité(s) (seuil : ${a.stockMinimum})`
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(9)
      doc.text(`• ${a.nom}`, margin, y)
      doc.setFont('helvetica', 'bold')
      if (a.quantite === 0) doc.setTextColor(220, 38, 38)
      else doc.setTextColor(217, 119, 6)
      doc.text(statut, pageWidth - margin, y, { align: 'right' })
      doc.setTextColor(0, 0, 0)
      y += 5
    }
  }

  // ===== DÉTAIL DES VENTES =====
  checkPageBreak(15)
  sectionTitre(`DÉTAIL DES VENTES (${donnees.ventes.length})`)

  if (donnees.ventes.length === 0) {
    ligne('Aucune vente sur cette période.')
  } else {
    // En-tête tableau
    const colHeure = margin
    const colNumero = margin + 18
    const colClient = margin + 55
    const colStatut = margin + 130
    const colTotal = pageWidth - margin

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(110, 110, 110)
    doc.text('HEURE', colHeure, y)
    doc.text('N° REÇU', colNumero, y)
    doc.text('CLIENT', colClient, y)
    doc.text('STATUT', colStatut, y)
    doc.text('TOTAL', colTotal, y, { align: 'right' })
    doc.setTextColor(0, 0, 0)
    y += 1.5
    doc.setDrawColor(220, 220, 220)
    doc.line(margin, y, pageWidth - margin, y)
    y += 4

    for (const v of donnees.ventes) {
      checkPageBreak(5)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.text(v.heure, colHeure, y)
      doc.text(v.numero, colNumero, y)
      doc.text(v.client.length > 28 ? v.client.slice(0, 28) + '...' : v.client, colClient, y)

      if (v.statut === 'validee') doc.setTextColor(5, 150, 105)
      else if (v.statut === 'annulee') doc.setTextColor(220, 38, 38)
      else doc.setTextColor(217, 119, 6)
      doc.text(v.statut === 'validee' ? 'Validée' : v.statut === 'annulee' ? 'Annulée' : 'En attente', colStatut, y)
      doc.setTextColor(0, 0, 0)

      doc.setFont('helvetica', 'bold')
      doc.text(formatMontant(v.total, donnees.entreprise.devise), colTotal, y, { align: 'right' })
      y += 5
    }

    // Total général
    checkPageBreak(8)
    y += 2
    doc.setDrawColor(27, 43, 75)
    doc.setLineWidth(0.4)
    doc.line(margin, y, pageWidth - margin, y)
    y += 5
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text('TOTAL GÉNÉRAL', margin, y)
    doc.text(formatMontant(donnees.ca, donnees.entreprise.devise), pageWidth - margin, y, { align: 'right' })
  }

  // ===== PIED DE PAGE =====
  const nbPages = doc.getNumberOfPages()
  for (let i = 1; i <= nbPages; i++) {
    doc.setPage(i)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(150, 150, 150)
    doc.text('Généré par ChezMoi', margin, 292)
    doc.text(`Page ${i} / ${nbPages}`, pageWidth - margin, 292, { align: 'right' })
    doc.setTextColor(0, 0, 0)
  }

  return doc
}

export function telechargerRapportPDF(donnees: DonneesRapport) {
  const doc = genererRapportActivite(donnees)
  const dateStr = donnees.genereLe.toISOString().split('T')[0]
  doc.save(`rapport-activite-${dateStr}.pdf`)
}
