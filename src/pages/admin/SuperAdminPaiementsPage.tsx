import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { Wallet, Download, Plus } from 'lucide-react'
import { format, startOfDay, startOfMonth, startOfYear } from 'date-fns'
import toast from 'react-hot-toast'

interface Paiement {
  id: string
  montant: number
  moyen_paiement: string
  reference_paiement: string | null
  date_paiement: string
  statut: string
  licences?: { numero_licence: string; entreprises?: { nom: string } }
}

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default function SuperAdminPaiementsPage() {
  const [paiements, setPaiements] = useState<Paiement[]>([])
  const [loading, setLoading] = useState(true)
  const [filtrePeriode, setFiltrePeriode] = useState<'tous' | 'jour' | 'mois' | 'annee'>('tous')
  const [showModal, setShowModal] = useState(false)
  const [licences, setLicences] = useState<{ id: string; numero_licence: string; entreprises?: { nom: string } }[]>([])
  const [form, setForm] = useState({ licence_id: '', montant: 0, moyen_paiement: 'mobile_money', reference_paiement: '' })

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const [p, l] = await Promise.all([
      supabase.from('paiements').select('*, licences(numero_licence, entreprises(nom))').order('date_paiement', { ascending: false }),
      supabase.from('licences').select('id, numero_licence, entreprises(nom)').order('created_at', { ascending: false })
    ])
    setPaiements((p.data || []) as unknown as Paiement[])
    setLicences((l.data || []) as unknown as typeof licences)
    setLoading(false)
  }

  const enregistrer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.licence_id || form.montant <= 0) { toast.error('Licence et montant requis'); return }
    const { error } = await supabase.from('paiements').insert({
      licence_id: form.licence_id,
      montant: form.montant,
      moyen_paiement: form.moyen_paiement,
      reference_paiement: form.reference_paiement || null,
      statut: 'paye',
      date_paiement: new Date().toISOString()
    })
    if (error) { toast.error('Erreur : ' + error.message); return }
    toast.success('Paiement enregistré !')
    setShowModal(false)
    setForm({ licence_id: '', montant: 0, moyen_paiement: 'mobile_money', reference_paiement: '' })
    charger()
  }

  const maintenant = new Date()
  const filtres = paiements.filter(p => {
    if (filtrePeriode === 'jour') return new Date(p.date_paiement) >= startOfDay(maintenant)
    if (filtrePeriode === 'mois') return new Date(p.date_paiement) >= startOfMonth(maintenant)
    if (filtrePeriode === 'annee') return new Date(p.date_paiement) >= startOfYear(maintenant)
    return true
  })

  const ca = {
    jour: paiements.filter(p => p.statut === 'paye' && new Date(p.date_paiement) >= startOfDay(maintenant)).reduce((s, p) => s + p.montant, 0),
    mois: paiements.filter(p => p.statut === 'paye' && new Date(p.date_paiement) >= startOfMonth(maintenant)).reduce((s, p) => s + p.montant, 0),
    annee: paiements.filter(p => p.statut === 'paye' && new Date(p.date_paiement) >= startOfYear(maintenant)).reduce((s, p) => s + p.montant, 0),
  }

  const exporterCSV = () => {
    const lignes = [
      ['Date', 'Entreprise', 'N° Licence', 'Montant (FCFA)', 'Moyen', 'Référence', 'Statut']
    ]
    for (const p of filtres) {
      lignes.push([
        format(new Date(p.date_paiement), 'dd/MM/yyyy HH:mm'),
        p.licences?.entreprises?.nom || '—',
        p.licences?.numero_licence || '—',
        p.montant.toString(),
        p.moyen_paiement,
        p.reference_paiement || '',
        p.statut
      ])
    }
    const csv = lignes.map(l => l.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n')
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `paiements-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Paiements</h1>
        <div className="flex gap-2">
          <button onClick={exporterCSV} className="border border-gray-200 dark:border-gray-700 dark:text-gray-200 text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
            <Download size={16} /> Export CSV
          </button>
          <button onClick={() => setShowModal(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus size={16} /> Enregistrer un paiement
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">CA du jour</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatMontant(ca.jour)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">CA du mois</p>
          <p className="text-lg font-bold text-gray-900 dark:text-gray-100 mt-1">{formatMontant(ca.mois)}</p>
        </div>
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl p-4">
          <p className="text-xs text-gray-500 font-medium uppercase">CA annuel</p>
          <p className="text-lg font-bold text-emerald-600 mt-1">{formatMontant(ca.annee)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {(['tous', 'jour', 'mois', 'annee'] as const).map(p => (
          <button key={p} onClick={() => setFiltrePeriode(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium ${filtrePeriode === p ? 'bg-emerald-600 text-white' : 'bg-white dark:bg-gray-900 dark:text-gray-300 text-gray-600 border border-gray-200 dark:border-gray-700'}`}>
            {p === 'tous' ? 'Tous' : p === 'jour' ? "Aujourd'hui" : p === 'mois' ? 'Ce mois' : 'Cette année'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>
      ) : (
        <div className="bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Entreprise</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Licence</th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Montant</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Moyen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
              {filtres.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucun paiement</td></tr>
              ) : filtres.map(p => (
                <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                  <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(p.date_paiement), 'dd/MM/yyyy HH:mm')}</td>
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{p.licences?.entreprises?.nom || '—'}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">{p.licences?.numero_licence || '—'}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMontant(p.montant)}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300 text-xs capitalize">{p.moyen_paiement?.replace('_', ' ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2"><Wallet size={16} /> Nouveau paiement</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={enregistrer} className="p-5 space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Licence *</label>
                <select value={form.licence_id} onChange={e => setForm({...form, licence_id: e.target.value})} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm" required>
                  <option value="">Sélectionner...</option>
                  {licences.map(l => <option key={l.id} value={l.id}>{l.entreprises?.nom} — {l.numero_licence}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Montant (FCFA) *</label>
                <input type="number" min="0" value={form.montant} onChange={e => setForm({...form, montant: +e.target.value})} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Moyen de paiement</label>
                <select value={form.moyen_paiement} onChange={e => setForm({...form, moyen_paiement: e.target.value})} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm">
                  <option value="mobile_money">Mobile Money</option>
                  <option value="especes">Espèces</option>
                  <option value="virement">Virement</option>
                  <option value="carte">Carte bancaire</option>
                  <option value="manuel">Manuel</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Référence (optionnel)</label>
                <input type="text" value={form.reference_paiement} onChange={e => setForm({...form, reference_paiement: e.target.value})} className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="flex-1 border border-gray-200 dark:border-gray-700 dark:text-gray-200 rounded-lg py-2 text-sm">Annuler</button>
                <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
