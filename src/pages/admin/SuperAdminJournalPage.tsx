import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Shield, CheckCircle, XCircle, Search, RefreshCw } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface Entree {
  id: string
  telephone: string
  nom_utilisateur: string | null
  entreprise_id: string | null
  succes: boolean
  raison: string
  ip: string | null
  user_agent: string | null
  created_at: string
}

const RAISONS: Record<string, string> = {
  succes: '✓ Connexion réussie',
  compte_introuvable: '✗ Numéro introuvable',
  compte_suspendu: '✗ Compte suspendu',
  mot_de_passe_incorrect: '✗ Mot de passe incorrect',
  licence_resiliee: '✗ Licence résiliée',
  deconnexion: '→ Déconnexion',
  erreur_rpc: '✗ Erreur serveur',
}

export default function SuperAdminJournalPage() {
  const [entrees, setEntrees] = useState<Entree[]>([])
  const [loading, setLoading] = useState(true)
  const [recherche, setRecherche] = useState('')
  const [filtre, setFiltre] = useState<'tous' | 'succes' | 'echec'>('tous')

  const charger = async () => {
    setLoading(true)
    const { data } = await supabase
      .from('journal_connexions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)
    setEntrees(data || [])
    setLoading(false)
  }

  useEffect(() => { charger() }, [])

  const filtrees = entrees.filter(e => {
    const matchFiltre = filtre === 'tous' || (filtre === 'succes' ? e.succes : !e.succes)
    const matchRecherche = !recherche ||
      e.telephone?.includes(recherche) ||
      (e.nom_utilisateur || '').toLowerCase().includes(recherche.toLowerCase()) ||
      (e.raison || '').includes(recherche)
    return matchFiltre && matchRecherche
  })

  const nbEchecs = entrees.filter(e => !e.succes && e.raison !== 'deconnexion').length
  const nbSucces = entrees.filter(e => e.succes && e.raison === 'succes').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <Shield size={20} className="text-blue-600" /> Journal des connexions
          </h1>
          <p className="text-xs text-gray-400 mt-0.5">
            {nbSucces} connexions réussies · {nbEchecs} échecs
          </p>
        </div>
        <button onClick={charger} className="btn-secondary flex items-center gap-2 text-sm">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualiser
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Téléphone, nom..." value={recherche}
            onChange={e => setRecherche(e.target.value)}
            className="input-field pl-8 py-1.5 text-sm max-w-48" />
        </div>
        {(['tous', 'succes', 'echec'] as const).map(f => (
          <button key={f} onClick={() => setFiltre(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              filtre === f ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-gray-700'
            }`}>
            {f === 'tous' ? 'Tous' : f === 'succes' ? '✓ Succès' : '✗ Échecs'}
          </button>
        ))}
      </div>

      {/* Tableau */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date / Heure</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Téléphone</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Raison</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Appareil</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto" />
                </td></tr>
              ) : filtrees.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucune entrée</td></tr>
              ) : filtrees.map(e => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                  <td className="px-4 py-2.5 text-xs text-gray-500 whitespace-nowrap">
                    {format(new Date(e.created_at), 'dd/MM/yy HH:mm:ss', { locale: fr })}
                  </td>
                  <td className="px-4 py-2.5 font-medium text-gray-900 dark:text-gray-100">{e.telephone || '—'}</td>
                  <td className="px-4 py-2.5 text-center">
                    {e.succes
                      ? <CheckCircle size={16} className="text-emerald-500 mx-auto" />
                      : <XCircle size={16} className="text-red-500 mx-auto" />}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-600 dark:text-gray-400">
                    {RAISONS[e.raison] || e.raison}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-gray-400 max-w-[200px] truncate" title={e.user_agent || ''}>
                    {e.user_agent
                      ? e.user_agent.includes('Mobile') ? '📱 Mobile' : '💻 Desktop'
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
