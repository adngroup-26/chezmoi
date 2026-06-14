import { useEntreprise } from '../lib/entreprise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Settings, Save } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ParametresPage() {
  const { eid } = useEntreprise()
  const [form, setForm] = useState({ nom_entreprise: '', devise: 'FCFA', telephone: '', adresse: '' })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => { charger() }, [])

  async function charger() {
    const { data } = await supabase.from('parametres').select('*').eq('entreprise_id', eid)
    if (data) {
      const p = Object.fromEntries(data.map(d => [d.cle, d.valeur || '']))
      setForm(f => ({ ...f, ...p }))
    }
    setLoading(false)
  }

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    for (const [cle, valeur] of Object.entries(form)) {
      await supabase.from('parametres').upsert({ cle, valeur, entreprise_id: eid }, { onConflict: 'cle,entreprise_id' })
    }
    setSaving(false)
    toast.success('Paramètres sauvegardés !')
  }

  if (loading) return <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-4 max-w-xl">
      <div className="flex items-center gap-2">
        <Settings size={20} className="text-gray-600" />
        <h1 className="text-xl font-semibold text-gray-900">Paramètres</h1>
      </div>

      <div className="card p-6">
        <h2 className="font-medium text-gray-900 mb-4">Informations de l'entreprise</h2>
        <form onSubmit={sauvegarder} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Nom de l'entreprise</label>
            <input type="text" value={form.nom_entreprise} onChange={e => setForm({...form, nom_entreprise: e.target.value})} className="input-field" placeholder="Ex: Boutique Diallo & Fils" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Devise</label>
            <select value={form.devise} onChange={e => setForm({...form, devise: e.target.value})} className="input-field">
              <option value="FCFA">FCFA (Franc CFA)</option>
              <option value="GNF">GNF (Franc guinéen)</option>
              <option value="XOF">XOF</option>
              <option value="EUR">EUR (Euro)</option>
              <option value="USD">USD (Dollar)</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Téléphone</label>
            <input type="tel" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="input-field" placeholder="Ex: +225 07 01 23 45 67" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Adresse</label>
            <textarea value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} className="input-field" rows={2} placeholder="Ex: Abidjan, Cocody, Rue des Jardins" />
          </div>
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Save size={16} /> Sauvegarder</>}
          </button>
        </form>
      </div>
    </div>
  )
}
