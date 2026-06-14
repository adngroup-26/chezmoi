import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { Client } from '../types'
import { Plus, Search, Edit2, Trash2, Users, Phone, Mail } from 'lucide-react'
import toast from 'react-hot-toast'

export default function ClientsPage() {
  const { eid } = useEntreprise()
  const [clients, setClients] = useState<Client[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [clientEdit, setClientEdit] = useState<Client | null>(null)
  const [form, setForm] = useState({ nom: '', telephone: '', email: '', adresse: '', notes: '' })

  useEffect(() => { if (eid) charger() }, [eid])

  async function charger() {
    setLoading(true)
    const { data } = await supabase.from('clients').select('*').eq('entreprise_id', eid).order('nom')
    setClients(data || [])
    setLoading(false)
  }

  const ouvrirAjout = () => { setClientEdit(null); setForm({ nom: '', telephone: '', email: '', adresse: '', notes: '' }); setShowModal(true) }
  const ouvrirEdit = (c: Client) => { setClientEdit(c); setForm({ nom: c.nom, telephone: c.telephone || '', email: c.email || '', adresse: c.adresse || '', notes: c.notes || '' }); setShowModal(true) }

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom) { toast.error('Le nom est requis'); return }
    const data = { ...form, entreprise_id: eid }
    let error
    if (clientEdit) { ({ error } = await supabase.from('clients').update(data).eq('id', clientEdit.id).eq('entreprise_id', eid)) }
    else { ({ error } = await supabase.from('clients').insert(data)) }
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    toast.success(clientEdit ? 'Client modifié !' : 'Client ajouté !')
    setShowModal(false); charger()
  }

  const supprimer = async (id: string, nom: string) => {
    if (!confirm(`Supprimer le client "${nom}" ?`)) return
    await supabase.from('clients').delete().eq('id', id).eq('entreprise_id', eid)
    toast.success('Client supprimé'); charger()
  }

  const clientsFiltres = clients.filter(c => c.nom.toLowerCase().includes(recherche.toLowerCase()) || (c.telephone || '').includes(recherche))

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Clients</h1>
        <button onClick={ouvrirAjout} className="btn-primary"><Plus size={16} /> Nouveau client</button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher un client..." value={recherche} onChange={e => setRecherche(e.target.value)} className="input-field pl-9 max-w-sm" />
      </div>
      {loading ? <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {clientsFiltres.length === 0 ? (
            <div className="col-span-full text-center py-12"><Users size={40} className="mx-auto text-gray-200 mb-3" /><p className="text-gray-400">Aucun client trouvé</p></div>
          ) : clientsFiltres.map(c => (
            <div key={c.id} className="card p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">{c.nom.slice(0, 2).toUpperCase()}</div>
                  <div><p className="font-medium text-gray-900 dark:text-gray-100">{c.nom}</p>{c.telephone && <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{c.telephone}</p>}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => ouvrirEdit(c)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={13} /></button>
                  <button onClick={() => supprimer(c.id, c.nom)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
                </div>
              </div>
              {c.email && <p className="text-xs text-gray-400 flex items-center gap-1 mb-1"><Mail size={11} />{c.email}</p>}
              {c.notes && <p className="text-xs text-gray-400 mt-2 italic truncate">{c.notes}</p>}
            </div>
          ))}
        </div>
      )}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{clientEdit ? 'Modifier le client' : 'Nouveau client'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={sauvegarder} className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom *</label><input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Téléphone</label><input type="tel" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Email</label><input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Adresse</label><input type="text" value={form.adresse} onChange={e => setForm({...form, adresse: e.target.value})} className="input-field" /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes</label><textarea value={form.notes} onChange={e => setForm({...form, notes: e.target.value})} className="input-field" rows={2} /></div>
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
