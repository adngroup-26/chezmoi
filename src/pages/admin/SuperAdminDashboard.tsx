import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Building2, KeyRound, AlertTriangle, Clock, Users, Wallet, TrendingUp, Ban } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface StatsGlobales {
  total_entreprises: number
  licences_actives: number
  licences_expirees: number
  licences_essai: number
  licences_suspendues: number
  total_utilisateurs: number
  revenus_mois: number
  revenus_annee: number
}

interface EntrepriseRecente {
  id: string
  nom: string
  created_at: string
  statut: string
}

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<StatsGlobales | null>(null)
  const [recentes, setRecentes] = useState<EntrepriseRecente[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const [s, e] = await Promise.all([
      supabase.rpc('admin_stats_globales'),
      supabase.from('entreprises').select('id, nom, created_at, statut').order('created_at', { ascending: false }).limit(5)
    ])
    if (s.data && s.data.length > 0) setStats(s.data[0])
    setRecentes(e.data || [])
    setLoading(false)
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>

  const cards = [
    { label: 'Entreprises', value: stats?.total_entreprises || 0, icon: Building2, color: 'blue' },
    { label: 'Licences actives', value: stats?.licences_actives || 0, icon: KeyRound, color: 'emerald' },
    { label: 'En essai', value: stats?.licences_essai || 0, icon: Clock, color: 'blue' },
    { label: 'Expirées', value: stats?.licences_expirees || 0, icon: AlertTriangle, color: 'amber' },
    { label: 'Suspendues', value: stats?.licences_suspendues || 0, icon: Ban, color: 'red' },
    { label: 'Utilisateurs totaux', value: stats?.total_utilisateurs || 0, icon: Users, color: 'purple' },
  ]

  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400',
    amber: 'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    red: 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
    purple: 'bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tableau de bord</h1>
        <p className="text-sm text-gray-500">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map(c => (
          <div key={c.label} className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{c.label}</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">{c.value}</p>
              </div>
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${colorClasses[c.color]}`}>
                <c.icon size={18} />
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Wallet size={16} className="text-emerald-600" />
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Revenus</p>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Ce mois</span>
              <span className="text-lg font-bold text-gray-900 dark:text-gray-100">{formatMontant(stats?.revenus_mois || 0)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 flex items-center gap-1"><TrendingUp size={11} /> Cette année</span>
              <span className="text-lg font-bold text-emerald-600">{formatMontant(stats?.revenus_annee || 0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl">
          <div className="p-4 border-b border-gray-100 dark:border-gray-800">
            <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Entreprises récentes</p>
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
            {recentes.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Aucune entreprise</p>
            ) : recentes.map(e => (
              <div key={e.id} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{e.nom}</p>
                  <p className="text-xs text-gray-400">{format(new Date(e.created_at), 'dd/MM/yyyy')}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  e.statut === 'active' ? 'bg-emerald-50 text-emerald-700' :
                  e.statut === 'suspendue' ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}>{e.statut}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
