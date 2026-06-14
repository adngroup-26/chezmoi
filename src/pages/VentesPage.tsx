import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Search, Eye, Printer, Download, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { construireDonneesRecu, imprimerRecu, telechargerRecuPDF, FormatTicket, InfosEntreprise } from '../lib/recu'


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
        .select('*, clients(nom, telephone), utilisateurs(nom), details_ventes(*, articles(nom))')
        .eq('entreprise_id', eid)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('parametres').select('*').eq('entreprise_id', eid)
    ])
    setVentes((v.data || []) as VenteRow[])

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

  const filtres = ventes.filter(v =>
    v.numero.toLowerCase().includes(recherche.toLowerCase()) ||
    (v.clients?.nom || '').toLowerCase().includes(recherche.toLowerCase())
  )

  // Reconstruit les données du reçu à partir d'une vente de l'historique
  const genererDonneesRecu = (vente: VenteRow) => {
    return construireDonneesRecu(
      vente.numero,
      (vente.details_ventes || []).map(d => ({
        article: { id: '', nom: d.articles?.nom || 'Article', prix_vente: d.prix_unitaire } as never,
        quantite: d.quantite,
        remise: 0
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

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Historique des ventes</h1>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher par N° ou client..." value={recherche} onChange={e => setRecherche(e.target.value)} className="input-field pl-9 max-w-sm" />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">N° Reçu</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtres.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucune vente trouvée</td></tr>
                ) : filtres.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-blue-600">{v.numero}</td>
                    <td className="px-4 py-3 text-gray-700 dark:text-gray-300">{v.clients?.nom || 'Anonyme'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMontant(v.total)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={v.statut === 'validee' ? 'badge-green' : v.statut === 'annulee' ? 'badge-red' : 'badge-amber'}>
                        {v.statut === 'validee' ? 'Validée' : v.statut === 'annulee' ? 'Annulée' : 'En attente'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(v.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setVenteDetail(v)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
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
              <button onClick={() => setVenteDetail(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5">
              <div className="space-y-2 mb-4 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="font-medium dark:text-gray-200">{venteDetail.clients?.nom || 'Anonyme'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Vendeur</span><span className="font-medium dark:text-gray-200">{venteDetail.utilisateurs?.nom || '—'}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="dark:text-gray-200">{format(new Date(venteDetail.created_at), 'dd/MM/yyyy à HH:mm', { locale: fr })}</span></div>
                <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className={venteDetail.statut === 'validee' ? 'badge-green' : 'badge-red'}>{venteDetail.statut}</span></div>
              </div>
              <table className="w-full text-sm mb-4">
                <thead><tr className="bg-gray-50 dark:bg-gray-700/50"><th className="text-left p-2 text-xs text-gray-500">Article</th><th className="text-center p-2 text-xs text-gray-500">Qté</th><th className="text-right p-2 text-xs text-gray-500">Prix</th></tr></thead>
                <tbody>
                  {(venteDetail.details_ventes || []).map(d => (
                    <tr key={d.id} className="border-t border-gray-50 dark:border-gray-700">
                      <td className="p-2 dark:text-gray-300">{d.articles?.nom}</td>
                      <td className="p-2 text-center dark:text-gray-300">{d.quantite}</td>
                      <td className="p-2 text-right dark:text-gray-300">{formatMontant(d.prix_unitaire * d.quantite)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {venteDetail.remise > 0 && (
                <div className="flex justify-between text-sm text-gray-500 mb-1"><span>Remise</span><span>- {formatMontant(venteDetail.remise)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-100 dark:border-gray-700 pt-2 mb-4">
                <span className="dark:text-gray-100">TOTAL</span><span className="text-blue-600">{formatMontant(venteDetail.total)}</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-xs text-gray-500 flex items-center gap-1"><FileText size={13} /> Format :</span>
                <select value={formatTicket} onChange={e => setFormatTicket(e.target.value as FormatTicket)} className="input-field text-xs py-1.5 max-w-[150px]">
                  <option value="58mm">Ticket 58mm</option>
                  <option value="80mm">Ticket 80mm</option>
                  <option value="a4">PDF A4</option>
                </select>
                <button onClick={() => handleImprimer(venteDetail)} className="btn-secondary text-xs py-1.5">
                  <Printer size={14} /> Réimprimer
                </button>
                <button onClick={() => handleTelecharger(venteDetail)} className="btn-secondary text-xs py-1.5">
                  <Download size={14} /> Télécharger PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
