import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Eye, Printer, Download, FileText, RotateCcw } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { construireDonneesRecu, imprimerRecu, telechargerRecuPDF, FormatTicket, InfosEntreprise } from '../lib/recu'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'


interface VenteRow {
  id: string
  numero: string
  total: number
  remise: number
  statut: string
  created_at: string
  clients: { nom: string; telephone?: string } | null
  utilisateurs: { nom: string } | null
  details_ventes: {
    id: string
    quantite: number
    prix_unitaire: number
    articles: { nom: string } | null
  }[]
}

export default function VentesPage() {
  const { eid } = useEntreprise()
  const { formatMontant } = useDevise()
  const { isAdmin, utilisateur } = useAuth()
  const navigate = useNavigate()
  const peutFaireAvoir = isAdmin || utilisateur?.roles?.nom === 'gestionnaire'
  const [ventes, setVentes] = useState<VenteRow[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [venteDetail, setVenteDetail] = useState<VenteRow | null>(null)
  const [formatTicket, setFormatTicket] = useState<FormatTicket>('80mm')
  const [entreprise, setEntreprise] = useState<InfosEntreprise>({ nom_entreprise: 'ChezMoi', telephone: '', adresse: '', devise: 'FCFA' })

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const [v, p] = await Promise.all([
      supabase
        .from('ventes')
        .select('*, clients(nom, telephone), utilisateurs(nom)')
        .eq('entreprise_id', eid)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('parametres').select('*').eq('entreprise_id', eid)
    ])

    // Charge les details_ventes séparément pour éviter les problèmes de jointure RLS
    const ventesBase = (v.data || []) as unknown as VenteRow[]
    if (ventesBase.length > 0) {
      const venteIds = ventesBase.map(v => v.id)
      const { data: detailsData } = await supabase
        .from('details_ventes')
        .select('*, articles(nom, prix_vente)')
        .in('vente_id', venteIds)

      // Attache les détails à chaque vente
      const detailsParVente: Record<string, VenteRow['details_ventes']> = {}
      for (const d of (detailsData || [])) {
        const det = d as unknown as { vente_id: string }
        if (!detailsParVente[det.vente_id]) detailsParVente[det.vente_id] = []
        detailsParVente[det.vente_id]!.push(d as unknown as VenteRow['details_ventes'][0])
      }

      const ventesAvecDetails = ventesBase.map(v => ({
        ...v,
        details_ventes: detailsParVente[v.id] || []
      }))
      setVentes(ventesAvecDetails)
    } else {
      setVentes([])
    }

    if (p.data) {
      const params = Object.fromEntries(p.data.map(d => [d.cle, d.valeur || '']))
      setEntreprise({
        nom_entreprise: params.nom_entreprise || 'ChezMoi',
        telephone: params.telephone || '',
        adresse: params.adresse || '',
        devise: params.devise || 'FCFA'
      })
    }
    setLoading(false)
  }

  const ouvrirDetail = async (vente: VenteRow) => {
    // Affiche d'abord la vente immédiatement (UX rapide)
    setVenteDetail(vente)

    // Recharge avec détails complets — deux requêtes séparées pour contourner les policies RLS sur les jointures
    const { data: venteData } = await supabase
      .from('ventes')
      .select('*, clients(nom, telephone), utilisateurs(nom)')
      .eq('id', vente.id)
      .single()

    const { data: detailsData } = await supabase
      .from('details_ventes')
      .select('*, articles(nom, prix_vente)')
      .eq('vente_id', vente.id)

    if (venteData) {
      const venteComplete = {
        ...(venteData as unknown as VenteRow),
        details_ventes: (detailsData || []) as unknown as VenteRow['details_ventes']
      }
      setVenteDetail(venteComplete)
    }
  }

  const filtres = ventes.filter(v =>
    v.numero.toLowerCase().includes(recherche.toLowerCase()) ||
    (v.clients?.nom || '').toLowerCase().includes(recherche.toLowerCase())
  )

  // Reconstruit les données du reçu correctement depuis l'historique
  const genererDonneesRecu = (vente: VenteRow) => {
    return construireDonneesRecu(
      vente.numero,
      (vente.details_ventes || []).map(d => ({
        article: {
          id: '',
          nom: d.articles?.nom || 'Article supprimé',
          prix_vente: d.prix_unitaire,
          quantite: 0,
          prix_achat: 0,
          transport: 0,
          cout_unitaire: 0,
          stock_minimum: 0,
          actif: true,
        } as never,
        quantite: d.quantite,
        remise: 0,
      })),
      vente.remise,
      vente.total,
      vente.utilisateurs?.nom || 'Vendeur',
      vente.clients?.nom,
      entreprise
    )
  }

  const handleImprimer = (vente: VenteRow) => {
    imprimerRecu(genererDonneesRecu(vente), formatTicket)
  }

  const handleTelecharger = (vente: VenteRow) => {
    telechargerRecuPDF(genererDonneesRecu(vente), formatTicket)
  }

  const handleWhatsApp = (vente: VenteRow) => {
    const tel = (vente.clients?.telephone || '').replace(/\D/g, '')
    if (!tel) return
    const lignes = (vente.details_ventes || [])
      .map(d => `- ${d.articles?.nom || 'Article'} x${d.quantite} = ${formatMontant(d.prix_unitaire * d.quantite)}`)
      .join('\n')
    const message = encodeURIComponent(
      `Bonjour ${vente.clients?.nom || ''},\n\nVotre reçu :\nN° : ${vente.numero}\n${lignes}` +
      (vente.remise > 0 ? `\nRemise : -${formatMontant(vente.remise)}` : '') +
      `\nTOTAL : ${formatMontant(vente.total)}\n\nMerci pour votre achat ! 🙏`
    )
    window.open(`https://wa.me/${tel}?text=${message}`, '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Historique des ventes</h1>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher par numéro ou client..." value={recherche}
          onChange={e => setRecherche(e.target.value)} className="input-field pl-9" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">N° Vente</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtres.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400">Aucune vente trouvée</td></tr>
                ) : filtres.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-blue-600">{v.numero}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{v.clients?.nom || 'Anonyme'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMontant(v.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={v.statut === 'validee' ? 'badge-green' : 'badge-red'}>{v.statut}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(v.created_at), 'dd/MM/yy HH:mm', { locale: fr })}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => ouvrirDetail(v)} className="p-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {venteDetail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Détail — {venteDetail.numero}</h2>
              <button onClick={() => setVenteDetail(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="p-5 space-y-4">

              {/* Infos vente */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Client</span>
                  <span className="font-medium dark:text-gray-200">{venteDetail.clients?.nom || 'Anonyme'}</span>
                </div>
                {venteDetail.clients?.telephone && (
                  <div className="flex justify-between">
                    <span className="text-gray-500">Téléphone</span>
                    <span className="dark:text-gray-300">{venteDetail.clients.telephone}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-gray-500">Vendeur</span>
                  <span className="font-medium dark:text-gray-200">{venteDetail.utilisateurs?.nom || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date</span>
                  <span className="dark:text-gray-200">{format(new Date(venteDetail.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Statut</span>
                  <span className={venteDetail.statut === 'validee' ? 'badge-green' : 'badge-red'}>{venteDetail.statut}</span>
                </div>
              </div>

              {/* Détail articles */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Articles</p>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 dark:bg-gray-700/50">
                      <th className="text-left p-2 text-xs text-gray-500">Article</th>
                      <th className="text-center p-2 text-xs text-gray-500">Qté</th>
                      <th className="text-right p-2 text-xs text-gray-500">P.U.</th>
                      <th className="text-right p-2 text-xs text-gray-500">Montant</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(venteDetail.details_ventes || []).length === 0 ? (
                      <tr><td colSpan={4} className="p-3 text-center text-gray-400 text-xs">Aucun détail disponible</td></tr>
                    ) : (venteDetail.details_ventes || []).map(d => (
                      <tr key={d.id} className="border-t border-gray-50 dark:border-gray-700">
                        <td className="p-2 dark:text-gray-300">{d.articles?.nom || <span className="text-gray-400 italic">Article supprimé</span>}</td>
                        <td className="p-2 text-center dark:text-gray-300">{d.quantite}</td>
                        <td className="p-2 text-right dark:text-gray-300">{formatMontant(d.prix_unitaire)}</td>
                        <td className="p-2 text-right font-medium dark:text-gray-200">{formatMontant(d.prix_unitaire * d.quantite)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {venteDetail.remise > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Remise</span><span>- {formatMontant(venteDetail.remise)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-100 dark:border-gray-700 pt-2">
                <span className="dark:text-gray-100">TOTAL</span>
                <span className="text-blue-600">{formatMontant(venteDetail.total)}</span>
              </div>

              {/* Boutons actions */}
              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 flex items-center gap-1"><FileText size={13} /> Format :</span>
                <select value={formatTicket} onChange={e => setFormatTicket(e.target.value as FormatTicket)} className="input-field text-xs py-1.5 max-w-[130px]">
                  <option value="58mm">Ticket 58mm</option>
                  <option value="80mm">Ticket 80mm</option>
                  <option value="a4">PDF A4</option>
                </select>
                <button onClick={() => handleImprimer(venteDetail)} className="btn-secondary text-xs py-1.5">
                  <Printer size={14} /> Réimprimer
                </button>
                <button onClick={() => handleTelecharger(venteDetail)} className="btn-secondary text-xs py-1.5">
                  <Download size={14} /> PDF
                </button>
                {venteDetail.clients?.telephone && (
                  <button
                    onClick={() => handleWhatsApp(venteDetail)}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                    </svg>
                    WhatsApp
                  </button>
                )}
                {peutFaireAvoir && venteDetail.statut === 'validee' && (
                  <button
                    onClick={() => { setVenteDetail(null); navigate(`/avoirs?vente=${encodeURIComponent(venteDetail.numero)}`) }}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-medium transition-colors"
                  >
                    <RotateCcw size={13} /> Faire un avoir
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}


interface VenteRow {
  id: string
  numero: string
  total: number
  remise: number
  statut: string
  created_at: string
  clients: { nom: string; telephone?: string } | null
  utilisateurs: { nom: string } | null
  details_ventes: {
    id: string
    quantite: number
    prix_unitaire: number
    articles: { nom: string } | null
  }[]
}
