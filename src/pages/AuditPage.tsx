import { useEntreprise } from '../lib/entreprise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { AuditLog } from '../types'
import { History, Plus, Pencil, Trash2, ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

const TABLE_LABELS: Record<string, string> = {
  articles: 'Articles',
  clients: 'Clients',
  fournisseurs: 'Fournisseurs',
  ventes: 'Ventes',
  mouvements_stock: 'Mouvements de stock',
  categories: 'Catégories',
  utilisateurs: 'Utilisateurs'
}

const ACTION_CONFIG: Record<string, { label: string; icon: typeof Plus; color: string }> = {
  creation: { label: 'Création', icon: Plus, color: 'text-emerald-600 bg-emerald-50' },
  modification: { label: 'Modification', icon: Pencil, color: 'text-amber-600 bg-amber-50' },
  suppression: { label: 'Suppression', icon: Trash2, color: 'text-red-600 bg-red-50' },
}

export default function AuditPage() {
  const { eid } = useEntreprise()
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filtreTable, setFiltreTable] = useState('')
  const [filtreAction, setFiltreAction] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('entreprise_id', eid)
      .order('created_at', { ascending: false })
      .limit(200)
    setLogs(data || [])
    setLoading(false)
  }

  const filtres = logs.filter(l =>
    (!filtreTable || l.table_name === filtreTable) &&
    (!filtreAction || l.action === filtreAction)
  )

  const getNomElement = (log: AuditLog): string => {
    const v = (log.nouvelle_valeur || log.ancienne_valeur) as Record<string, unknown> | undefined
    if (!v) return '—'
    return (v.nom as string) || (v.numero as string) || (v.reference as string) || (v.id as string)?.slice(0, 8) || '—'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <History size={20} className="text-gray-600" />
        <h1 className="text-xl font-semibold text-gray-900">Journal d'audit</h1>
      </div>
      <p className="text-sm text-gray-500">Historique complet des créations, modifications et suppressions.</p>

      <div className="flex gap-2 flex-wrap">
        <select value={filtreTable} onChange={e => setFiltreTable(e.target.value)} className="input-field max-w-[180px] text-xs">
          <option value="">Toutes les tables</option>
          {Object.entries(TABLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select value={filtreAction} onChange={e => setFiltreAction(e.target.value)} className="input-field max-w-[160px] text-xs">
          <option value="">Toutes les actions</option>
          <option value="creation">Création</option>
          <option value="modification">Modification</option>
          <option value="suppression">Suppression</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="divide-y divide-gray-50">
            {filtres.length === 0 ? (
              <p className="text-center py-12 text-gray-400">Aucune entrée trouvée</p>
            ) : filtres.map(log => {
              const config = ACTION_CONFIG[log.action] || ACTION_CONFIG.modification
              const Icon = config.icon
              const isOpen = expanded === log.id
              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpanded(isOpen ? null : log.id)}
                    className="w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${config.color}`}>
                      <Icon size={14} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {config.label} — {TABLE_LABELS[log.table_name] || log.table_name}
                      </p>
                      <p className="text-xs text-gray-400">{getNomElement(log)}</p>
                    </div>
                    <span className="text-xs text-gray-400 whitespace-nowrap">
                      {format(new Date(log.created_at), 'dd/MM/yy HH:mm', { locale: fr })}
                    </span>
                    {isOpen ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {log.ancienne_valeur && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Avant</p>
                          <pre className="bg-red-50 text-red-800 text-xs p-2 rounded-lg overflow-x-auto">{JSON.stringify(log.ancienne_valeur, null, 2)}</pre>
                        </div>
                      )}
                      {log.nouvelle_valeur && (
                        <div>
                          <p className="text-xs font-medium text-gray-500 mb-1">Après</p>
                          <pre className="bg-emerald-50 text-emerald-800 text-xs p-2 rounded-lg overflow-x-auto">{JSON.stringify(log.nouvelle_valeur, null, 2)}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
