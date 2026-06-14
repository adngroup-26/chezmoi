import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { Categorie } from '../types'
import { Plus, Edit2, Trash2, Tag } from 'lucide-react'
import toast from 'react-hot-toast'

export default function CategoriesPage() {
  const { eid } = useEntreprise()
  const [categories, setCategories] = useState<Categorie[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Categorie | null>(null)
  const [nom, setNom] = useState('')
  const [compteurs, setCompteurs] = useState<Record<string, number>>({})

  useEffect(() => { if (eid) charger() }, [eid])

  async function charger() {
    setLoading(true)
    const { data } = await supabase.from('categories').select('*').eq('entreprise_id', eid).order('nom')
    setCategories(data || [])
    const { data: articles } = await supabase.from('articles').select('categorie_id').eq('actif', true).eq('entreprise_id', eid)
    const counts: Record<string, number> = {}
    for (const a of articles || []) { if (a.categorie_id) counts[a.categorie_id] = (counts[a.categorie_id] || 0) + 1 }
    setCompteurs(counts)
    setLoading(false)
  }

  const ouvrir = (c?: Categorie) => { setEditItem(c || null); setNom(c?.nom || ''); setShowModal(true) }

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nom.trim()) { toast.error('Le nom est requis'); return }
    let error
    if (editItem) { ({ error } = await supabase.from('categories').update({ nom: nom.trim() }).eq('id', editItem.id).eq('entreprise_id', eid)) }
    else { ({ error } = await supabase.from('categories').insert({ nom: nom.trim(), entreprise_id: eid })) }
    if (error) { toast.error(error.code === '23505' ? 'Cette catégorie existe déjà' : 'Erreur'); return }
    toast.success(editItem ? 'Catégorie modifiée !' : 'Catégorie ajoutée !')
    setShowModal(false); charger()
  }

  const supprimer = async (c: Categorie) => {
    if (compteurs[c.id]) { toast.error(`Impossible : ${compteurs[c.id]} article(s) utilisent cette catégorie`); return }
    if (!confirm(`Supprimer "${c.nom}" ?`)) return
    await supabase.from('categories').delete().eq('id', c.id).eq('entreprise_id', eid)
    toast.success('Catégorie supprimée'); charger()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Catégories</h1>
        <button onClick={() => ouvrir()} className="btn-primary"><Plus size={16} /> Nouvelle catégorie</button>
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {categories.length === 0 ? (
            <div className="col-span-full text-center py-12"><Tag size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400">Aucune catégorie. Crée ta première catégorie pour organiser tes articles.</p></div>
          ) : categories.map(c => (
            <div key={c.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-2">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center"><Tag size={18} className="text-blue-600" /></div>
                <div className="flex gap-1">
                  <button onClick={() => ouvrir(c)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => supprimer(c)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
              <p className="font-medium text-gray-900 dark:text-gray-100">{c.nom}</p>
              <p className="text-xs text-gray-400 mt-1">{compteurs[c.id] || 0} article{(compteurs[c.id] || 0) !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{editItem ? 'Modifier la catégorie' : 'Nouvelle catégorie'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={sauvegarder} className="p-5 space-y-4">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom *</label><input type="text" value={nom} onChange={e => setNom(e.target.value)} className="input-field" required autoFocus /></div>
              <div className="flex gap-3 pt-1">
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
