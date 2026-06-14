import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { Fournisseur } from '../types'
import { Plus, Search, Edit2, Trash2, Truck } from 'lucide-react'
import toast from 'react-hot-toast'

export default function FournisseursPage() {
  const { eid } = useEntreprise()
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Fournisseur | null>(null)
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '' })

  useEffect(() => { if (eid) charger() }, [eid])

  async function charger() {
    setLoading(true)
    const { data } = await supabase.from('fournisseurs').select('*').eq('entreprise_id', eid).order('nom')
    setFournisseurs(data || [])
    setLoading(false)
  }

  const ouvrir = (f?: Fournisseur) => { setEditItem(f || null); setForm(f ? { nom: f.nom, telephone: f.telephone || '', email: f.email || '', adresse: f.adresse || '' } : { nom: '', telephone: '', email: '', adresse: '' }); setShowModal(true) }

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom) { toast.error('Le nom est requis'); return }
    const data = { ...form, entreprise_id: eid }
    let error
    if (editItem) { ({ error } = await supabase.from('fournisseurs').update(data).eq('id', editItem.id).eq('entreprise_id', eid)) }
    else { ({ error } = await supabase.from('fournisseurs').insert(data)) }
    if (error) { toast.error('Erreur'); return }
    toast.success(editItem ? 'Fournisseur modifié !' : 'Fournisseur ajouté !')
    setShowModal(false); charger()
  }

  const supprimer = async (id: string, nom: string) => {
    if (!confirm(`Supprimer "${nom}" ?`)) return
    await supabase.from('fournisseurs').delete().eq('id', id).eq('entreprise_id', eid)
    toast.success('Fournisseur supprimé'); charger()
  }

  const filtres = fournisseurs.filter(f => f.nom.toLowerCase().includes(recherche.toLowerCase()))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Fournisseurs</h1>
        <button onClick={() => ouvrir()} className="btn-primary"><Plus size={16} /> Nouveau fournisseur</button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher..." value={recherche} onChange={e => setRecherche(e.target.value)} className="input-field pl-9 max-w-sm" />
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtres.length === 0 ? (
            <div className="col-span-full text-center py-12"><Truck size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400">Aucun fournisseur</p></div>
          ) : filtres.map(f => (
            <div key={f.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-50 rounded-full flex items-center justify-center"><Truck size={18} className="text-amber-600" /></div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">{f.nom}</p>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => ouvrir(f)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => supprimer(f.id, f.nom)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
              {f.telephone && <p className="text-xs text-gray-500">📞 {f.telephone}</p>}
              {f.email && <p className="text-xs text-gray-400 mt-0.5">✉️ {f.email}</p>}
              {f.adresse && <p className="text-xs text-gray-400 mt-0.5 truncate">📍 {f.adresse}</p>}
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{editItem ? 'Modifier' : 'Nouveau fournisseur'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={sauvegarder} className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom *</label><input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Téléphone</label><input type="tel" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Adresse</label><input type="text" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} className="input-field" /></div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
