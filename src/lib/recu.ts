import jsPDF from 'jspdf'
import { PanierItem } from '../types'

export interface InfosEntreprise {
  nom_entreprise: string
  telephone: string
  adresse: string
  devise: string
}

export interface DonneesRecu {
  numero: string
  date: Date
  vendeur: string
  client?: string
  items: { nom: string; quantite: number; prixUnitaire: number }[]
  remise: number
  total: number
  entreprise: InfosEntreprise
}

export type FormatTicket = '58mm' | '80mm' | 'a4'

// Formate un nombre avec espace normal (compatible police standard jsPDF)
// au lieu de Intl.NumberFormat qui utilise une espace fine insécable invisible
// dans la police Courier par défaut.
function formatNombre(n: number): string {
  const entier = Math.round(n)
  const str = entier.toString()
  let result = ''
  for (let i = 0; i < str.length; i++) {
    if (i > 0 && (str.length - i) % 3 === 0) result += ' '
    result += str[i]
  }
  return result
}

function formatMontant(n: number, devise: string): string {
  return `${formatNombre(n)} ${devise}`
}

// Coupe un texte en plusieurs lignes selon une largeur max de caractères
function wrapText(text: string, maxChars: number): string[] {
  if (text.length <= maxChars) return [text]
  const mots = text.split(' ')
  const lignes: string[] = []
  let ligneActuelle = ''
  for (const mot of mots) {
    if ((ligneActuelle + ' ' + mot).trim().length > maxChars) {
      if (ligneActuelle) lignes.push(ligneActuelle.trim())
      // Si le mot seul est trop long, on le découpe brutalement
      if (mot.length > maxChars) {
        let reste = mot
        while (reste.length > maxChars) {
          lignes.push(reste.slice(0, maxChars))
          reste = reste.slice(maxChars)
        }
        ligneActuelle = reste
      } else {
        ligneActuelle = mot
      }
    } else {
      ligneActuelle = (ligneActuelle + ' ' + mot).trim()
    }
  }
  if (ligneActuelle) lignes.push(ligneActuelle)
  return lignes
}

// Configuration des formats de ticket
const CONFIGS: Record<FormatTicket, {
  width: number      // largeur page en mm
  margin: number      // marge en mm
  fontSize: number
  colDesignation: number // largeur colonne désignation en caractères
  colQte: number
  colPu: number
  colTotal: number
}> = {
  '58mm': { width: 58, margin: 3, fontSize: 7, colDesignation: 14, colQte: 3, colPu: 6, colTotal: 7 },
  '80mm': { width: 80, margin: 4, fontSize: 8, colDesignation: 20, colQte: 4, colPu: 8, colTotal: 9 },
  'a4': { width: 210, margin: 15, fontSize: 10, colDesignation: 40, colQte: 6, colPu: 14, colTotal: 16 },
}

function padRight(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len)
  return str + ' '.repeat(len - str.length)
}

function padLeft(str: string, len: number): string {
  if (str.length >= len) return str.slice(0, len)
  return ' '.repeat(len - str.length) + str
}

export function genererRecuPDF(donnees: DonneesRecu, format: FormatTicket = '80mm'): jsPDF {
  const config = CONFIGS[format]
  const { width, margin, fontSize } = config
  const lineHeight = fontSize * 0.42 // mm approx pour Courier

  // Pré-calcul du nombre de lignes nécessaires (avec retour à la ligne désignations)
  const lignesArticles: { lignesDesignation: string[]; qte: string; pu: string; total: string }[] = []
  let totalQuantites = 0
  for (const item of donnees.items) {
    const lignesDesignation = wrapText(item.nom, config.colDesignation)
    lignesArticles.push({
      lignesDesignation,
      qte: item.quantite.toString(),
      pu: formatNombre(item.prixUnitaire),
      total: formatNombre(item.prixUnitaire * item.quantite)
    })
    totalQuantites += item.quantite
  }

  const nbLignesTotal = lignesArticles.reduce((s, l) => s + l.lignesDesignation.length, 0)

  // Hauteur estimée du document
  const enTeteHauteur = 38
  const piedHauteur = donnees.remise > 0 ? 28 : 22
  const hauteurArticles = nbLignesTotal * (lineHeight + 0.6) + lignesArticles.length * 1.2
  const hauteurTotal = format === 'a4'
    ? 297
    : enTeteHauteur + hauteurArticles + piedHauteur + 15

  const doc = new jsPDF({
    unit: 'mm',
    format: format === 'a4' ? 'a4' : [width, Math.max(hauteurTotal, 80)]
  })

  doc.setFont('courier', 'normal')
  const usableWidth = width - margin * 2
  let y = margin + 4

  const centrer = (texte: string, taille: number, gras = false) => {
    doc.setFontSize(taille)
    doc.setFont('courier', gras ? 'bold' : 'normal')
    doc.text(texte, width / 2, y, { align: 'center' })
    y += taille * 0.42 + 1
  }

  const ligneTexte = (texte: string, taille = fontSize, gras = false) => {
    doc.setFontSize(taille)
    doc.setFont('courier', gras ? 'bold' : 'normal')
    doc.text(texte, margin, y)
    y += taille * 0.42 + 0.8
  }

  const traitPointille = () => {
    doc.setFontSize(fontSize)
    doc.setFont('courier', 'normal')
    const nbCar = Math.floor(usableWidth / 1.6)
    doc.text('-'.repeat(nbCar), margin, y)
    y += lineHeight + 0.8
  }

  // ===== EN-TÊTE ENTREPRISE =====
  centrer(donnees.entreprise.nom_entreprise || 'ChezMoi', fontSize + 4, true)
  if (donnees.entreprise.telephone) centrer(`Tél: ${donnees.entreprise.telephone}`, fontSize)
  if (donnees.entreprise.adresse) centrer(donnees.entreprise.adresse, fontSize)
  y += 1
  traitPointille()

  // ===== INFOS VENTE =====
  ligneTexte(`Reçu N° : ${donnees.numero}`, fontSize, true)
  const dateStr = donnees.date.toLocaleDateString('fr-FR')
  const heureStr = donnees.date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  ligneTexte(`Date : ${dateStr}    Heure : ${heureStr}`)
  ligneTexte(`Vendeur : ${donnees.vendeur}`)
  if (donnees.client) ligneTexte(`Client : ${donnees.client}`)
  traitPointille()

  // ===== EN-TÊTE TABLEAU =====
  const enteteCols = padRight('DESIGNATION', config.colDesignation) + ' ' +
    padLeft('QTE', config.colQte) + ' ' +
    padLeft('PU', config.colPu) + ' ' +
    padLeft('TOTAL', config.colTotal)
  ligneTexte(enteteCols, fontSize, true)
  traitPointille()

  // ===== LIGNES ARTICLES =====
  for (const item of lignesArticles) {
    // Première ligne : désignation (1ère partie) + qté + pu + total
    item.lignesDesignation.forEach((ligneDesignation, idx) => {
      if (idx === 0) {
        const ligne = padRight(ligneDesignation, config.colDesignation) + ' ' +
          padLeft(item.qte, config.colQte) + ' ' +
          padLeft(item.pu, config.colPu) + ' ' +
          padLeft(item.total, config.colTotal)
        ligneTexte(ligne)
      } else {
        // Lignes suivantes : uniquement la suite de la désignation
        ligneTexte(padRight(ligneDesignation, config.colDesignation))
      }
    })
  }

  traitPointille()

  // ===== TOTAUX =====
  ligneTexte(`Total articles vendus : ${totalQuantites}`, fontSize, true)
  if (donnees.remise > 0) {
    const sousTotal = donnees.items.reduce((s, i) => s + i.prixUnitaire * i.quantite, 0)
    ligneTexte(`Sous-total : ${formatMontant(sousTotal, donnees.entreprise.devise)}`)
    ligneTexte(`Remise : -${formatMontant(donnees.remise, donnees.entreprise.devise)}`)
  }
  y += 0.5
  centrer(`TOTAL GENERAL : ${formatMontant(donnees.total, donnees.entreprise.devise)}`, fontSize + 2, true)

  y += 2
  traitPointille()
  centrer('Merci pour votre confiance !', fontSize)

  return doc
}

export function imprimerRecu(donnees: DonneesRecu, format: FormatTicket = '80mm') {
  const doc = genererRecuPDF(donnees, format)
  // Ouvre la boîte de dialogue d'impression directement
  doc.autoPrint()
  const blobUrl = doc.output('bloburl')
  window.open(blobUrl, '_blank')
}

export function telechargerRecuPDF(donnees: DonneesRecu, format: FormatTicket = '80mm') {
  const doc = genererRecuPDF(donnees, format)
  doc.save(`recu-${donnees.numero}.pdf`)
}

// Construit les données du reçu à partir du panier et des paramètres
export function construireDonneesRecu(
  numero: string,
  panier: PanierItem[],
  remiseGlobale: number,
  total: number,
  vendeur: string,
  client: string | undefined,
  entreprise: InfosEntreprise
): DonneesRecu {
  return {
    numero,
    date: new Date(),
    vendeur,
    client,
    items: panier.map(p => ({
      nom: p.article.nom,
      quantite: p.quantite,
      prixUnitaire: p.article.prix_vente
    })),
    remise: remiseGlobale,
    total,
    entreprise
  }
}
