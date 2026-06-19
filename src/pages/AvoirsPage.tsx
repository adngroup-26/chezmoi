import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { useAuth } from '../lib/auth'
import { Avoir, DetailAvoir } from '../types'
import { RotateCcw, Eye, Search, FileDown, AlertTriangle, CheckCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { telechargerRecuPDF, InfosEntreprise } from '../lib/recu'
import jsPDF from 'jspdf'

// ── Motifs prédéfinis ─────────────────────────────────────────────────────
const MOTIFS = [
  'Produit défectueux',
  'Erreur de facturation',
  'Erreur de quantité',
  'Mauvais article livré',
  'Changement d\'avis du client',
  'Retour client',
  'Autre',
]

// ── Types internes ────────────────────────────────────────────────────────
interface VenteAvecDetails {
  id: string
  numero: string
  total: number
  remise: number
  created_at: string
  clients?: { id: string; nom: string; telephone?: string } | null
  details_ventes: {
    id: string
    article_id: string | null
    article_nom: string
    articles?: { nom: string; prix_vente: number } | null
    quantite: number
    prix_unitaire: number
  }[]
}

interface LigneRetour {
  article_id: string | null
  article_nom: string
  prix_unitaire: number
  quantite_vendue: number
  quantite_retour: number
  selectionne: boolean
}

// ── Composant badge statut ────────────────────────────────────────────────
function BadgeType({ type }: { type: string }) {
  return type === 'total'
    ? <span className="badge-red text-xs">Total</span>
    : <span className="badge-amber text-xs">Partiel</span>
}

// ── Génération PDF avoir ──────────────────────────────────────────────────
function genererPDFAvoir(avoir: Avoir, entreprise: InfosEntreprise, devise: string) {
  const doc = new jsPDF({ format: 'a4', unit: 'mm' })
  const W = 210, ML = 20, MR = 20, CW = W - ML - MR
  let y = 20

  const line = (ya: number) => { doc.setDrawColor(220,220,220); doc.line(ML, ya, W-MR, ya) }
  const txt = (t: string, x: number, ya: number, size = 9, bold = false, color = [55,65,81]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal')
    doc.setFontSize(size)
    doc.setTextColor(...(color as [number,number,number]))
    doc.text(t, x, ya)
  }
  // Intl.NumberFormat('fr-FR') insère un espace insécable fin (U+202F) non supporté
  // par la police par défaut de jsPDF (s'affiche comme "/"). On le remplace par un espace normal.
  const fmt = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n)).replace(/[\u202F\u00A0]/g, ' ') + ' ' + devise

  // En-tête
  doc.setFillColor(27,43,75)
  doc.rect(0, 0, W, 40, 'F')
  doc.setFillColor(37,99,235)
  doc.roundedRect(ML, 8, 24, 24, 4, 4, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(11); doc.setTextColor(255,255,255)
  doc.text('CM', ML+12, 23, { align: 'center' })
  doc.setFontSize(16); doc.setTextColor(255,255,255)
  doc.text(entreprise.nom_entreprise || 'ChezMoi Pro', ML+30, 18)
  doc.setFontSize(9); doc.setTextColor(147,197,253)
  doc.text('DOCUMENT D\'AVOIR', ML+30, 28)
  y = 52

  // Numéros
  doc.setFillColor(249,250,251)
  doc.rect(ML, y-4, CW, 28, 'F')
  txt('N° Avoir :', ML+4, y+2, 8, false, [107,114,128])
  txt(avoir.numero, ML+4, y+10, 12, true, [27,43,75])
  txt('Vente de référence :', ML+90, y+2, 8, false, [107,114,128])
  txt(avoir.ventes?.numero || '—', ML+90, y+10, 11, true, [37,99,235])
  txt('Date :', W-MR-50, y+2, 8, false, [107,114,128])
  txt(format(new Date(avoir.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr }), W-MR-50, y+10, 9, true, [27,43,75])
  y += 34

  // Client + motif
  txt('Client', ML, y, 8, false, [107,114,128]); y += 5
  txt(avoir.clients?.nom || 'Anonyme', ML, y, 10, true, [27,43,75]); y += 5
  if (avoir.clients?.telephone) { txt(avoir.clients.telephone, ML, y, 9, false, [107,114,128]); y += 5 }
  y += 4
  doc.setFillColor(254,243,199)
  doc.rect(ML, y-4, CW, avoir.commentaire ? 18 : 12, 'F')
  txt('Motif : ' + avoir.motif, ML+4, y+2, 9, true, [146,64,14])
  if (avoir.commentaire) txt('Commentaire : ' + avoir.commentaire, ML+4, y+9, 8, false, [146,64,14])
  y += avoir.commentaire ? 22 : 16

  // Articles
  txt('Articles retournés', ML, y, 10, true, [27,43,75]); y += 6
  doc.setFillColor(27,43,75)
  doc.rect(ML, y-4, CW, 8, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(8); doc.setTextColor(255,255,255)
  doc.text('Article', ML+3, y+0.5)
  doc.text('Qté', ML+110, y+0.5, { align: 'center' })
  doc.text('Prix unit.', ML+138, y+0.5, { align: 'right' })
  doc.text('Montant', W-MR-3, y+0.5, { align: 'right' })
  y += 8

  let bg = false
  for (const d of (avoir.details_avoirs || [])) {
    if (bg) { doc.setFillColor(249,250,251); doc.rect(ML, y-4, CW, 8, 'F') }
    doc.setFont('helvetica','normal'); doc.setFontSize(9); doc.setTextColor(55,65,81)
    doc.text(d.article_nom, ML+3, y+0.5)
    doc.text(String(d.quantite), ML+110, y+0.5, { align: 'center' })
    doc.text(fmt(d.prix_unitaire), ML+138, y+0.5, { align: 'right' })
    doc.text(fmt(d.montant_ligne), W-MR-3, y+0.5, { align: 'right' })
    y += 8; bg = !bg
  }

  // Total avoir
  y += 4; line(y); y += 6
  doc.setFillColor(254,242,242)
  doc.rect(ML+70, y-4, CW-70, 14, 'F')
  doc.setFont('helvetica','bold'); doc.setFontSize(12); doc.setTextColor(220,38,38)
  doc.text('MONTANT DE L\'AVOIR', ML+72, y+3)
  doc.text(fmt(avoir.montant), W-MR-3, y+3, { align: 'right' })
  y += 18

  // Pied
  line(y); y += 6
  doc.setFont('helvetica','normal'); doc.setFontSize(8); doc.setTextColor(107,114,128)
  doc.text('Ce document est un avoir officiel délivré par ' + (entreprise.nom_entreprise || 'ChezMoi Pro'), W/2, y, { align: 'center' })
  doc.text('Aucune suppression autorisée — Document généré le ' + format(new Date(), 'dd/MM/yyyy à HH:mm', { locale: fr }), W/2, y+5, { align: 'center' })

  doc.save(`Avoir-${avoir.numero}.pdf`)
}

// ── COMPOSANT PRINCIPAL ────────────────────────────────────────────────────
export default function AvoirsPage() {
  const { eid } = useEntreprise()
  const { formatMontant, devise } = useDevise()
  const { utilisateur, isAdmin } = useAuth()
  const isGestionnaire = utilisateur?.roles?.nom === 'gestionnaire'
  const peutFaireAvoir = isAdmin || isGestionnaire

  const [avoirs, setAvoirs] = useState<Avoir[]>([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [entreprise, setEntreprise] = useState<InfosEntreprise>({ nom_entreprise: 'ChezMoi', telephone: '', adresse: '', devise: 'FCFA' })

  // Modal création avoir
  const [modalAvoir, setModalAvoir] = useState(false)
  const [venteCherche, setVenteCherche] = useState('')
  const [venteTrouvee, setVenteTrouvee] = useState<VenteAvecDetails | null>(null)
  const [chercheLoading, setChercheLoading] = useState(false)
  const [lignes, setLignes] = useState<LigneRetour[]>([])
  const [motif, setMotif] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [typeAvoir, setTypeAvoir] = useState<'partiel' | 'total'>('partiel')
  const [confirmModal, setConfirmModal] = useState(false)
  const [saving, setSaving] = useState(false)

  // Modal détail avoir
  const [detailAvoir, setDetailAvoir] = useState<Avoir | null>(null)

  useEffect(() => { charger() }, [eid])

  async function charger() {
    if (!eid) return
    setLoading(true)
    const [av, params] = await Promise.all([
      supabase.from('avoirs')
        .select('*, ventes(numero, total), clients(nom, telephone), utilisateurs(nom), details_avoirs(*)')
        .eq('entreprise_id', eid)
        .order('created_at', { ascending: false }),
      supabase.from('parametres').select('*').eq('entreprise_id', eid)
    ])
    setAvoirs((av.data || []) as unknown as Avoir[])
    if (params.data) {
      const p = Object.fromEntries(params.data.map(d => [d.cle, d.valeur || '']))
      setEntreprise({ nom_entreprise: p.nom_entreprise || 'ChezMoi', telephone: p.telephone || '', adresse: p.adresse || '', devise: p.devise || 'FCFA' })
    }
    setLoading(false)
  }

  // Recherche vente par numéro
  async function chercherVente() {
    if (!venteCherche.trim()) return
    setChercheLoading(true)
    const { data: vente } = await supabase
      .from('ventes')
      .select('*, clients(id, nom, telephone)')
      .eq('entreprise_id', eid)
      .ilike('numero', `%${venteCherche.trim()}%`)
      .eq('statut', 'validee')
      .single()

    if (!vente) { toast.error('Vente introuvable ou déjà annulée'); setChercheLoading(false); return }

    // Charge les détails séparément
    const { data: details } = await supabase
      .from('details_ventes')
      .select('*, articles(nom, prix_vente)')
      .eq('vente_id', vente.id)

    const venteComplete: VenteAvecDetails = {
      ...vente,
      details_ventes: (details || []).map(d => ({
        id: d.id,
        article_id: d.article_id,
        article_nom: (d.articles as { nom: string } | null)?.nom || 'Article supprimé',
        articles: d.articles as { nom: string; prix_vente: number } | null,
        quantite: d.quantite,
        prix_unitaire: d.prix_unitaire,
      }))
    }

    setVenteTrouvee(venteComplete)
    setLignes(venteComplete.details_ventes.map(d => ({
      article_id: d.article_id,
      article_nom: d.article_nom,
      prix_unitaire: d.prix_unitaire,
      quantite_vendue: d.quantite,
      quantite_retour: 0,
      selectionne: false,
    })))
    setChercheLoading(false)
  }

  // Calcul type et montant
  const lignesSelectionnees = lignes.filter(l => l.selectionne && l.quantite_retour > 0)
  const montantAvoir = lignesSelectionnees.reduce((s, l) => s + l.prix_unitaire * l.quantite_retour, 0)
  const estTotal = venteTrouvee && lignesSelectionnees.length === lignes.length &&
    lignes.every(l => l.quantite_retour === l.quantite_vendue)

  // Sélection totale
  const selectionnerTout = () => {
    setLignes(prev => prev.map(l => ({ ...l, selectionne: true, quantite_retour: l.quantite_vendue })))
    setTypeAvoir('total')
  }

  // Validation avoir
  async function validerAvoir() {
    if (!venteTrouvee || !motif || lignesSelectionnees.length === 0) return
    setSaving(true)
    try {
      const { data: numData } = await supabase.rpc('generer_numero_avoir', { p_entreprise_id: eid })
      const numero = numData || `AVR-${Date.now()}`
      const typeF: 'partiel' | 'total' = estTotal ? 'total' : 'partiel'

      // 1. Crée l'avoir
      const { data: avoir, error: avErr } = await supabase.from('avoirs').insert({
        entreprise_id: eid,
        numero,
        vente_id: venteTrouvee.id,
        client_id: venteTrouvee.clients?.id || null,
        utilisateur_id: utilisateur?.id,
        type: typeF,
        motif,
        commentaire: commentaire || null,
        montant: montantAvoir,
      }).select().single()

      if (avErr || !avoir) throw new Error('Erreur création avoir')

      // 2. Crée les détails de l'avoir
      await supabase.from('details_avoirs').insert(
        lignesSelectionnees.map(l => ({
          avoir_id: avoir.id,
          article_id: l.article_id || null,
          article_nom: l.article_nom,
          quantite: l.quantite_retour,
          prix_unitaire: l.prix_unitaire,
        }))
      )

      // 3. Réintègre le stock + crée mouvements "Retour Client"
      for (const l of lignesSelectionnees) {
        if (!l.article_id) continue
        const { data: art } = await supabase.from('articles').select('quantite').eq('id', l.article_id).single()
        if (art) {
          await supabase.from('articles').update({ quantite: art.quantite + l.quantite_retour }).eq('id', l.article_id)
        }
        await supabase.from('mouvements_stock').insert({
          entreprise_id: eid,
          article_id: l.article_id,
          utilisateur_id: utilisateur?.id,
          type: 'retour_client',
          quantite: l.quantite_retour,
          commentaire: `Avoir ${numero} — ${motif}`,
        })
      }

      // 4. Si avoir total → marque la vente comme annulée
      if (typeF === 'total') {
        await supabase.from('ventes').update({ statut: 'annulee' }).eq('id', venteTrouvee.id)
      }

      // 5. Journal d'audit
      try {
        await supabase.from('audit_logs').insert({
          entreprise_id: eid,
          utilisateur_id: utilisateur?.id,
          action: 'CREATE',
          table_name: 'avoirs',
          record_id: avoir.id,
          nouvelles_valeurs: JSON.stringify({ numero, type: typeF, montant: montantAvoir, motif }),
        })
      } catch { /* le journal ne doit jamais bloquer l'opération */ }

      toast.success(`Avoir ${numero} créé — ${formatMontant(montantAvoir)} remboursé`)
      setConfirmModal(false)
      setModalAvoir(false)
      resetModal()
      charger()
    } catch (e) {
      toast.error('Erreur lors de la création de l\'avoir')
    }
    setSaving(false)
  }

  function resetModal() {
    setVenteCherche(''); setVenteTrouvee(null); setLignes([])
    setMotif(''); setCommentaire(''); setTypeAvoir('partiel')
  }

  const filtres = avoirs.filter(a =>
    a.numero.toLowerCase().includes(recherche.toLowerCase()) ||
    (a.ventes?.numero || '').toLowerCase().includes(recherche.toLowerCase()) ||
    (a.clients?.nom || '').toLowerCase().includes(recherche.toLowerCase())
  )

  const totalAvoirs = avoirs.reduce((s, a) => s + a.montant, 0)

  return (
    <div className="space-y-4">
      {/* En-tête */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <RotateCcw size={20} className="text-red-500" /> Avoirs & Retours clients
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {avoirs.length} avoir{avoirs.length > 1 ? 's' : ''} · Total remboursé : <span className="text-red-500 font-medium">{formatMontant(totalAvoirs)}</span>
          </p>
        </div>
        {peutFaireAvoir && (
          <button onClick={() => { resetModal(); setModalAvoir(true) }} className="btn-primary">
            <RotateCcw size={15} /> Nouvel avoir
          </button>
        )}
      </div>

      {/* Barre de recherche */}
      <div className="relative max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="N° avoir, N° vente, client..." value={recherche}
          onChange={e => setRecherche(e.target.value)} className="input-field pl-8 text-sm" />
      </div>

      {/* Liste avoirs */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                {['N° Avoir', 'Vente réf.', 'Client', 'Motif', 'Type', 'Montant', 'Date', ''].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={8} className="py-12 text-center"><div className="animate-spin h-6 w-6 border-b-2 border-red-500 rounded-full mx-auto" /></td></tr>
              ) : filtres.length === 0 ? (
                <tr><td colSpan={8} className="py-12 text-center text-gray-400">
                  <RotateCcw size={32} className="mx-auto mb-2 text-gray-300" />
                  Aucun avoir enregistré
                </td></tr>
              ) : filtres.map(a => (
                <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-3 font-medium text-red-600">{a.numero}</td>
                  <td className="px-4 py-3 text-blue-600 text-xs">{a.ventes?.numero || '—'}</td>
                  <td className="px-4 py-3 text-gray-900 dark:text-gray-100">{a.clients?.nom || 'Anonyme'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[140px] truncate">{a.motif}</td>
                  <td className="px-4 py-3"><BadgeType type={a.type} /></td>
                  <td className="px-4 py-3 font-semibold text-red-600">- {formatMontant(a.montant)}</td>
                  <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(a.created_at), 'dd/MM/yy HH:mm', { locale: fr })}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setDetailAvoir(a)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors">
                      <Eye size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── MODAL CRÉER AVOIR ───────────────────────────────────────────── */}
      {modalAvoir && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl my-4">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                <RotateCcw size={16} className="text-red-500" /> Nouvel avoir / retour client
              </h2>
              <button onClick={() => setModalAvoir(false)} className="text-gray-400">✕</button>
            </div>

            <div className="p-5 space-y-5">
              {/* Recherche vente */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Vente à rembourser</p>
                <div className="flex gap-2">
                  <input type="text" value={venteCherche}
                    onChange={e => setVenteCherche(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && chercherVente()}
                    placeholder="Numéro de vente (ex: VT-250618-0001)"
                    className="input-field flex-1 text-sm" />
                  <button onClick={chercherVente} disabled={chercheLoading} className="btn-primary px-4 text-sm">
                    {chercheLoading ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <Search size={15} />}
                  </button>
                </div>
              </div>

              {/* Vente trouvée */}
              {venteTrouvee && (
                <>
                  <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-sm">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-blue-800 dark:text-blue-300">{venteTrouvee.numero}</span>
                      <span className="text-blue-600 font-bold">{formatMontant(venteTrouvee.total)}</span>
                    </div>
                    {venteTrouvee.clients?.nom && <p className="text-xs text-blue-600 mt-1">Client : {venteTrouvee.clients.nom}</p>}
                    <p className="text-xs text-blue-400">{format(new Date(venteTrouvee.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</p>
                  </div>

                  {/* Sélection articles */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Articles à retourner</p>
                      <button onClick={selectionnerTout} className="text-xs text-red-600 hover:text-red-700 font-medium">
                        Tout sélectionner (avoir total)
                      </button>
                    </div>
                    <div className="space-y-2">
                      {lignes.map((l, i) => (
                        <div key={i} className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${l.selectionne ? 'border-red-200 bg-red-50 dark:bg-red-900/10 dark:border-red-800' : 'border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30'}`}>
                          <input type="checkbox" checked={l.selectionne}
                            onChange={e => setLignes(prev => prev.map((ll, ii) => ii !== i ? ll : { ...ll, selectionne: e.target.checked, quantite_retour: e.target.checked ? ll.quantite_vendue : 0 }))}
                            className="rounded text-red-500" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{l.article_nom}</p>
                            <p className="text-xs text-gray-400">{formatMontant(l.prix_unitaire)} × {l.quantite_vendue} vendu(s)</p>
                          </div>
                          {l.selectionne && (
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500">Qté retour :</label>
                              <input type="number" min={1} max={l.quantite_vendue}
                                value={l.quantite_retour}
                                onChange={e => setLignes(prev => prev.map((ll, ii) => ii !== i ? ll : { ...ll, quantite_retour: Math.min(+e.target.value, ll.quantite_vendue) }))}
                                className="input-field w-20 text-sm text-center" />
                              <span className="text-xs text-red-600 font-medium">{formatMontant(l.prix_unitaire * l.quantite_retour)}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {lignesSelectionnees.length > 0 && (
                      <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg flex justify-between items-center">
                        <span className="text-sm font-medium text-red-700 dark:text-red-300">
                          {estTotal ? '✓ Avoir TOTAL' : `Avoir partiel — ${lignesSelectionnees.length} article(s)`}
                        </span>
                        <span className="text-lg font-bold text-red-600">- {formatMontant(montantAvoir)}</span>
                      </div>
                    )}
                  </div>

                  {/* Motif OBLIGATOIRE */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                        Motif <span className="text-red-500">*</span>
                      </label>
                      <select value={motif} onChange={e => setMotif(e.target.value)} className="input-field text-sm">
                        <option value="">— Choisir un motif —</option>
                        {MOTIFS.map(m => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Commentaire</label>
                      <input type="text" value={commentaire} onChange={e => setCommentaire(e.target.value)}
                        placeholder="Précision optionnelle..." className="input-field text-sm" />
                    </div>
                  </div>

                  {/* Bouton valider */}
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setModalAvoir(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                    <button
                      disabled={!motif || lignesSelectionnees.length === 0}
                      onClick={() => setConfirmModal(true)}
                      className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-lg py-2.5 text-sm font-medium transition-colors">
                      <RotateCcw size={15} /> Créer l'avoir
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL CONFIRMATION ─────────────────────────────────────────── */}
      {confirmModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-100 dark:bg-amber-900/40 rounded-full flex items-center justify-center">
                <AlertTriangle size={22} className="text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Confirmer l'avoir</h3>
                <p className="text-xs text-gray-500">Cette action est irréversible</p>
              </div>
            </div>
            <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 space-y-2 text-sm">
              <p className="text-gray-700 dark:text-gray-300">Cette opération va :</p>
              <p className="text-gray-600 dark:text-gray-400">✓ Créer un avoir de <strong className="text-red-600">{formatMontant(montantAvoir)}</strong></p>
              <p className="text-gray-600 dark:text-gray-400">✓ Réintégrer {lignesSelectionnees.reduce((s,l) => s+l.quantite_retour,0)} article(s) dans le stock</p>
              {estTotal && <p className="text-gray-600 dark:text-gray-400">✓ Marquer la vente {venteTrouvee?.numero} comme annulée</p>}
              <p className="text-gray-600 dark:text-gray-400">✓ Modifier les statistiques de vente</p>
            </div>
            <p className="text-xs text-center text-gray-500">Confirmez-vous l'opération ?</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmModal(false)} className="btn-secondary flex-1 justify-center">Non, annuler</button>
              <button onClick={validerAvoir} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 text-sm font-medium">
                {saving ? <div className="animate-spin h-4 w-4 border-b-2 border-white rounded-full" /> : <><CheckCircle size={15} /> Oui, confirmer</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DÉTAIL AVOIR ─────────────────────────────────────────── */}
      {detailAvoir && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl">
              <div>
                <h2 className="font-semibold text-red-600">{detailAvoir.numero}</h2>
                <BadgeType type={detailAvoir.type} />
              </div>
              <button onClick={() => setDetailAvoir(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Vente réf.</span><span className="font-medium text-blue-600">{detailAvoir.ventes?.numero}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="font-medium dark:text-gray-200">{detailAvoir.clients?.nom || 'Anonyme'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Motif</span><span className="dark:text-gray-300 text-right max-w-[60%]">{detailAvoir.motif}</span></div>
                {detailAvoir.commentaire && <div className="flex justify-between"><span className="text-gray-500">Commentaire</span><span className="dark:text-gray-300 text-right max-w-[60%]">{detailAvoir.commentaire}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Opération par</span><span className="dark:text-gray-300">{detailAvoir.utilisateurs?.nom || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="dark:text-gray-300">{format(new Date(detailAvoir.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span></div>
              </div>
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase mb-2">Articles retournés</p>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left p-2 text-xs text-gray-500">Article</th>
                    <th className="text-center p-2 text-xs text-gray-500">Qté</th>
                    <th className="text-right p-2 text-xs text-gray-500">Montant</th>
                  </tr></thead>
                  <tbody>
                    {(detailAvoir.details_avoirs || []).map((d: DetailAvoir) => (
                      <tr key={d.id} className="border-t border-gray-50 dark:border-gray-700">
                        <td className="p-2 dark:text-gray-300">{d.article_nom}</td>
                        <td className="p-2 text-center dark:text-gray-300">{d.quantite}</td>
                        <td className="p-2 text-right font-medium text-red-600">- {formatMontant(d.montant_ligne)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-gray-100 dark:border-gray-700 pt-2">
                <span className="dark:text-gray-100">MONTANT AVOIR</span>
                <span className="text-red-600">- {formatMontant(detailAvoir.montant)}</span>
              </div>
              <button
                onClick={() => genererPDFAvoir(detailAvoir, entreprise, devise)}
                className="w-full flex items-center justify-center gap-2 btn-secondary text-sm">
                <FileDown size={15} /> Télécharger PDF avoir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
