import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Search, KeyRound, Plus, RefreshCw, Calendar, Pause, Play, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, addMonths, addYears } from 'date-fns'

interface Licence {
  id: string
  entreprise_id: string
  numero_licence: string
  type_licence: string
  date_debut: string
  date_fin: string | null
  montant: number
  statut: string
  max_utilisateurs: number
  entreprises?: { nom: string }
}

const TYPES_LICENCE: Record<string, { label: string; montant: number; maxUsers: number; duree: (d: Date) => Date | null }> = {
  essai: { label: 'Essai gratuit (15 jours)', montant: 0, maxUsers: 3, duree: d => { const n = new Date(d); n.setDate(n.getDate() + 15); return n } },
  mensuelle: { label: 'Mensuelle — 4 500 FCFA', montant: 4500, maxUsers: 3, duree: d => addMonths(d, 1) },
  semestrielle: { label: 'Semestrielle — 25 500 FCFA', montant: 25500, maxUsers: 5, duree: d => addMonths(d, 6) },
  annuelle: { label: 'Annuelle — 50 000 FCFA', montant: 50000, maxUsers: 10, duree: d => addYears(d, 1) },
  a_vie: { label: 'À vie — 150 000 FCFA', montant: 150000, maxUsers: 15, duree: () => null },
}

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

const STATUT_BADGE: Record<string, string> = {
  essai: 'bg-blue-50 text-blue-700',
  active: 'bg-emerald-50 text-emerald-700',
  expiree: 'bg-red-50 text-red-700',
  suspendue: 'bg-amber-50 text-amber-700',
  resiliee: 'bg-gray-100 text-gray-600',
}

export default function SuperAdminLicencesPage() {
  const [licences, setLicences] = useState<Licence[]>([])
  const [entreprises, setEntreprises] = useState<{ id: string; nom: string }[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ entreprise_id: '', type_licence: 'mensuelle' })

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const [l, e] = await Promise.all([
      supabase.from('licences').select('*, entreprises(nom)').order('created_at', { ascending: false }),
      supabase.from('entreprises').select('id, nom').order('nom')
    ])
    setLicences(l.data || [])
    setEntreprises(e.data || [])
    setLoading(false)
  }

  const filtres = licences.filter(l =>
    (l.entreprises?.nom || '').toLowerCase().includes(recherche.toLowerCase()) ||
    l.numero_licence.toLowerCase().includes(recherche.toLowerCase())
  )

  const recalculerStatut = (l: Licence) => {
    if (['suspendue', 'resiliee'].includes(l.statut)) return l.statut
    if (l.date_fin && new Date(l.date_fin) < new Date()) return 'expiree'
    return l.statut
  }

  const creerLicence = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.entreprise_id) { toast.error('Sélectionnez une entreprise'); return }

    const config = TYPES_LICENCE[form.type_licence]
    const dateDebut = new Date()
    const dateFin = config.duree(dateDebut)

    const numero = `LIC-${format(dateDebut, 'yyyyMMdd')}-${Math.random().toString(36).slice(2, 8)}`

    const { error } = await supabase.from('licences').insert({
      entreprise_id: form.entreprise_id,
      numero_licence: numero,
      type_licence: form.type_licence,
      date_debut: dateDebut.toISOString(),
      date_fin: dateFin ? dateFin.toISOString() : null,
      montant: config.montant,
      statut: form.type_licence === 'essai' ? 'essai' : 'active',
      max_utilisateurs: config.maxUsers
    })

    if (error) { toast.error('Erreur : ' + error.message); return }

    // Enregistre automatiquement le paiement (sauf essai gratuit)
    if (config.montant > 0) {
      const { data: nvLicence } = await supabase.from('licences').select('id').eq('numero_licence', numero).single()
      if (nvLicence) {
        await supabase.from('paiements').insert({
          licence_id: nvLicence.id,
          montant: config.montant,
          moyen_paiement: 'manuel',
          statut: 'paye',
          date_paiement: new Date().toISOString()
        })
      }
    }

    toast.success('Licence créée !')
    setShowModal(false)
    setForm({ entreprise_id: '', type_licence: 'mensuelle' })
    charger()
  }

  const renouveler = async (l: Licence) => {
    const config = TYPES_LICENCE[l.type_licence] || TYPES_LICENCE.mensuelle
    const base = l.date_fin && new Date(l.date_fin) > new Date() ? new Date(l.date_fin) : new Date()
    const nvDateFin = config.duree(base)

    await supabase.from('licences').update({
      date_fin: nvDateFin ? nvDateFin.toISOString() : null,
      statut: 'active'
    }).eq('id', l.id)

    if (config.montant > 0) {
      await supabase.from('paiements').insert({
        licence_id: l.id,
        montant: config.montant,
        moyen_paiement: 'manuel',
        statut: 'paye',
        date_paiement: new Date().toISOString()
      })
    }

    toast.success('Licence renouvelée !')
    charger()
  }

  const prolonger = async (l: Licence, jours: number) => {
    const base = l.date_fin ? new Date(l.date_fin) : new Date()
    base.setDate(base.getDate() + jours)
    await supabase.from('licences').update({ date_fin: base.toISOString(), statut: 'active' }).eq('id', l.id)
    toast.success(`Licence prolongée de ${jours} jours`)
    charger()
  }

  const changerStatut = async (l: Licence, statut: string) => {
    await supabase.from('licences').update({ statut }).eq('id', l.id)
    toast.success('Statut mis à jour')
    charger()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Licences</h1>
        <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
          <Plus size={16} /> Nouvelle licence
        </button>
      </div>

      <div className="relative max-w-sm">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher par entreprise ou n°..."
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">N° Licence</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Expire le</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {filtres.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-8 text-gray-400">Aucune licence</td></tr>
                ) : filtres.map(l => {
                  const statutCalcule = recalculerStatut(l)
                  return (
                    <tr key={l.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{l.entreprises?.nom || '—'}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.numero_licence}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs">{TYPES_LICENCE[l.type_licence]?.label.split(' —')[0] || l.type_licence}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{l.date_fin ? format(new Date(l.date_fin), 'dd/MM/yyyy') : 'À vie'}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUT_BADGE[statutCalcule] || 'bg-gray-100 text-gray-600'}`}>{statutCalcule}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => renouveler(l)} className="p-1.5 hover:bg-emerald-50 rounded-lg text-gray-400 hover:text-emerald-600" title="Renouveler">
                            <RefreshCw size={14} />
                          </button>
                          <button onClick={() => prolonger(l, 7)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600" title="Prolonger de 7 jours">
                            <Calendar size={14} />
                          </button>
                          {l.statut === 'suspendue' ? (
                            <button onClick={() => changerStatut(l, 'active')} className="p-1.5 hover:bg-emerald-50 rounded-lg text-gray-400 hover:text-emerald-600" title="Réactiver">
                              <Play size={14} />
                            </button>
                          ) : (
                            <button onClick={() => changerStatut(l, 'suspendue')} className="p-1.5 hover:bg-amber-50 rounded-lg text-gray-400 hover:text-amber-600" title="Suspendre">
                              <Pause size={14} />
                            </button>
                          )}
                          <button onClick={() => changerStatut(l, 'resiliee')} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600" title="Résilier">
                            <XCircle size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><KeyRound size={16} /> Nouvelle licence</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={creerLicence} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Entreprise *</label>
                <select value={form.entreprise_id} onChange={e => setForm({...form, entreprise_id: e.target.value})} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Sélectionner...</option>
                  {entreprises.map(e => <option key={e.id} value={e.id}>{e.nom}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type de licence *</label>
                <select value={form.type_licence} onChange={e => setForm({...form, type_licence: e.target.value})} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                  {Object.entries(TYPES_LICENCE).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <p className="text-xs text-gray-500">
                {TYPES_LICENCE[form.type_licence].montant > 0
                  ? `Un paiement de ${formatMontant(TYPES_LICENCE[form.type_licence].montant)} sera automatiquement enregistré.`
                  : 'Aucun paiement requis pour cette offre.'}
              </p>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 dark:border-gray-700 dark:text-gray-200 rounded-lg py-2 text-sm">Annuler</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
