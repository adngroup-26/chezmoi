import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, Building2, Pause, Play, Trash2, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

interface Entreprise {
  id: string
  nom: string
  telephone?: string
  email?: string
  statut: string
  created_at: string
}

interface DetailEntreprise {
  nb_utilisateurs: number
  nb_articles: number
  nb_ventes: number
  licence?: { type_licence: string; statut: string; date_fin: string | null; numero_licence: string }
}

export default function SuperAdminEntreprisesPage() {
  const [entreprises, setEntreprises] = useState<Entreprise[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [detail, setDetail] = useState<DetailEntreprise | null>(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const { data } = await supabase.from('entreprises').select('*').order('created_at', { ascending: false })
    setEntreprises(data || [])
    setLoading(false)
  }

  const filtres = entreprises.filter(e => e.nom.toLowerCase().includes(recherche.toLowerCase()))

  const toggleSuspension = async (e: Entreprise) => {
    const nvStatut = e.statut === 'suspendue' ? 'active' : 'suspendue'
    await supabase.from('entreprises').update({ statut: nvStatut }).eq('id', e.id)
    toast.success(nvStatut === 'suspendue' ? 'Entreprise suspendue' : 'Entreprise réactivée')
    charger()
  }

  const supprimer = async (e: Entreprise) => {
    if (!confirm(
      `⚠️ SUPPRESSION DÉFINITIVE\n\n` +
      `Vous allez supprimer l'entreprise "${e.nom}" et TOUTES ses données :\n\n` +
      `• Tous les utilisateurs\n` +
      `• Tous les articles et catégories\n` +
      `• Tous les clients et fournisseurs\n` +
      `• Tout l'historique des ventes\n` +
      `• Tous les mouvements de stock\n` +
      `• Toutes les licences et paiements\n\n` +
      `Cette action est IRRÉVERSIBLE. Continuer ?`
    )) return
    if (!confirm(`Confirmation finale : supprimer définitivement "${e.nom}" ?`)) return

    const { data, error } = await supabase.rpc('supprimer_entreprise', { p_entreprise_id: e.id })

    if (error || !data?.succes) {
      toast.error('Erreur : ' + (data?.erreur || error?.message || 'Erreur inconnue'))
      return
    }
    toast.success(`Entreprise "${e.nom}" supprimée définitivement`)
    charger()
  }

  const voirDetail = async (e: Entreprise) => {
    setDetailId(e.id)
    setDetail(null)
    const [u, a, v, l] = await Promise.all([
      supabase.from('utilisateurs').select('id', { count: 'exact', head: true }).eq('entreprise_id', e.id),
      supabase.from('articles').select('id', { count: 'exact', head: true }).eq('entreprise_id', e.id).eq('actif', true),
      supabase.from('ventes').select('id', { count: 'exact', head: true }).eq('entreprise_id', e.id),
      supabase.from('licences').select('type_licence, statut, date_fin, numero_licence').eq('entreprise_id', e.id).order('created_at', { ascending: false }).limit(1).maybeSingle()
    ])
    setDetail({
      nb_utilisateurs: u.count || 0,
      nb_articles: a.count || 0,
      nb_ventes: v.count || 0,
      licence: l.data || undefined
    })
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Entreprises</h1>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une entreprise..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Inscrite le</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtres.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucune entreprise</td></tr>
              ) : filtres.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    <Building2 size={14} className="text-gray-400" /> {e.nom}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{e.telephone || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(e.created_at), 'dd/MM/yyyy')}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      e.statut === 'active' ? 'bg-emerald-50 text-emerald-700' :
                      e.statut === 'suspendue' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                    }`}>{e.statut}</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => voirDetail(e)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600" title="Détails">
                        <Eye size={14} />
                      </button>
                      <button onClick={() => toggleSuspension(e)} className="p-1.5 hover:bg-amber-50 rounded-lg text-gray-400 hover:text-amber-600" title={e.statut === 'suspendue' ? 'Réactiver' : 'Suspendre'}>
                        {e.statut === 'suspendue' ? <Play size={14} /> : <Pause size={14} />}
                      </button>
                      <button onClick={() => supprimer(e)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600" title="Supprimer">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{entreprises.find(e => e.id === detailId)?.nom}</h2>
              <button onClick={() => setDetailId(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5">
              {!detail ? (
                <div className="flex justify-center py-6"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" /></div>
              ) : (
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between"><span className="text-gray-500">Utilisateurs</span><span className="font-medium dark:text-gray-200">{detail.nb_utilisateurs}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Articles actifs</span><span className="font-medium dark:text-gray-200">{detail.nb_articles}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">Ventes totales</span><span className="font-medium dark:text-gray-200">{detail.nb_ventes}</span></div>
                  {detail.licence && (
                    <>
                      <div className="border-t border-gray-100 dark:border-gray-800 pt-3 mt-3" />
                      <div className="flex justify-between"><span className="text-gray-500">N° Licence</span><span className="font-medium dark:text-gray-200">{detail.licence.numero_licence}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Type</span><span className="font-medium dark:text-gray-200">{detail.licence.type_licence}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Statut</span><span className="font-medium dark:text-gray-200">{detail.licence.statut}</span></div>
                      <div className="flex justify-between"><span className="text-gray-500">Expire le</span><span className="font-medium dark:text-gray-200">{detail.licence.date_fin ? format(new Date(detail.licence.date_fin), 'dd/MM/yyyy') : 'À vie'}</span></div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
