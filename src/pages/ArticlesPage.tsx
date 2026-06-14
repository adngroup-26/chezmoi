import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { Article, Categorie, Fournisseur } from '../types'
import { Plus, Search, Edit2, Trash2, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'


export default function ArticlesPage() {
  const { eid } = useEntreprise()
  const { formatMontant, devise } = useDevise()
  const [articles, setArticles] = useState<Article[]>([])
  const [categories, setCategories] = useState<Categorie[]>([])
  const [fournisseurs, setFournisseurs] = useState<Fournisseur[]>([])
  const [recherche, setRecherche] = useState('')
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [articleEdit, setArticleEdit] = useState<Article | null>(null)
  const [form, setForm] = useState({ reference: '', nom: '', categorie_id: '', prix_achat: 0, quantite: 0, transport: 0, prix_vente: 0, stock_minimum: 5, fournisseur_id: '' })

  useEffect(() => { if (eid) charger() }, [eid])

  async function charger() {
    setLoading(true)
    const [a, c, f] = await Promise.all([
      supabase.from('articles').select('*, categories(*), fournisseurs(*)').eq('actif', true).eq('entreprise_id', eid).order('nom'),
      supabase.from('categories').select('*').eq('entreprise_id', eid).order('nom'),
      supabase.from('fournisseurs').select('*').eq('entreprise_id', eid).order('nom')
    ])
    setArticles(a.data || [])
    setCategories(c.data || [])
    setFournisseurs(f.data || [])
    setLoading(false)
  }

  const prixRevient = (pa: number, tr: number, qte: number) => qte > 0 ? (pa + tr) / qte : 0

  const ouvrirAjout = () => {
    setArticleEdit(null)
    setForm({ reference: '', nom: '', categorie_id: '', prix_achat: 0, quantite: 0, transport: 0, prix_vente: 0, stock_minimum: 5, fournisseur_id: '' })
    setShowModal(true)
  }

  const ouvrirEdit = (a: Article) => {
    setArticleEdit(a)
    setForm({ reference: a.reference || '', nom: a.nom, categorie_id: a.categorie_id || '', prix_achat: a.prix_achat, quantite: a.quantite, transport: a.transport, prix_vente: a.prix_vente, stock_minimum: a.stock_minimum, fournisseur_id: a.fournisseur_id || '' })
    setShowModal(true)
  }

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom || form.prix_vente <= 0) { toast.error('Nom et prix de vente requis'); return }
    const data = {
      ...form,
      reference: form.reference.trim() || null,
      categorie_id: form.categorie_id || null,
      fournisseur_id: form.fournisseur_id || null,
      cout_unitaire: Math.round(prixRevient(form.prix_achat, form.transport, form.quantite)),
      entreprise_id: eid
    }
    let error
    if (articleEdit) {
      ({ error } = await supabase.from('articles').update(data).eq('id', articleEdit.id).eq('entreprise_id', eid))
    } else {
      ({ error } = await supabase.from('articles').insert(data))
    }
    if (error) { toast.error('Erreur lors de la sauvegarde'); return }
    toast.success(articleEdit ? 'Article modifié !' : 'Article ajouté !')
    setShowModal(false)
    charger()
  }

  const supprimer = async (id: string, nom: string) => {
    if (!confirm(`Supprimer l'article "${nom}" ?`)) return
    await supabase.from('articles').update({ actif: false }).eq('id', id).eq('entreprise_id', eid)
    toast.success('Article supprimé')
    charger()
  }

  const articlesFiltres = articles.filter(a =>
    a.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (a.reference || '').toLowerCase().includes(recherche.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Articles</h1>
        <button onClick={ouvrirAjout} className="btn-primary"><Plus size={16} /> Nouvel article</button>
      </div>
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Rechercher un article..." value={recherche} onChange={e => setRecherche(e.target.value)} className="input-field pl-9 max-w-sm" />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Article</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Catégorie</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prix revient</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prix vente</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stock</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {articlesFiltres.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-12 text-gray-400"><Package size={32} className="mx-auto mb-2 text-gray-300" />Aucun article trouvé</td></tr>
                ) : articlesFiltres.map(a => {
                  const pr = prixRevient(a.prix_achat, a.transport, a.quantite)
                  const alerte = a.quantite <= a.stock_minimum
                  return (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                      <td className="px-4 py-3"><div className="font-medium text-gray-900 dark:text-gray-100">{a.nom}</div>{a.reference && <div className="text-xs text-gray-400">{a.reference}</div>}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{a.categories?.nom || '—'}</td>
                      <td className="px-4 py-3 text-right text-gray-700 dark:text-gray-300">{formatMontant(pr)}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900 dark:text-gray-100">{formatMontant(a.prix_vente)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${a.quantite === 0 ? 'bg-red-50 text-red-700' : alerte ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                          {alerte && a.quantite > 0 && <AlertTriangle size={10} />}{a.quantite}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => ouvrirEdit(a)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={14} /></button>
                          <button onClick={() => supprimer(a.id, a.nom)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={14} /></button>
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
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{articleEdit ? 'Modifier l\'article' : 'Nouvel article'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={sauvegarder} className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Référence</label><input type="text" value={form.reference} onChange={e => setForm({...form, reference: e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom *</label><input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="input-field" required /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Catégorie</label>
                <select value={form.categorie_id} onChange={e => setForm({...form, categorie_id: e.target.value})} className="input-field">
                  <option value="">Sélectionner...</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prix d'achat global du lot ({devise})</label><input type="number" min="0" value={form.prix_achat} onChange={e => setForm({...form, prix_achat: +e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Transport ({devise})</label><input type="number" min="0" value={form.transport} onChange={e => setForm({...form, transport: +e.target.value})} className="input-field" /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Quantité</label><input type="number" min="0" value={form.quantite} onChange={e => setForm({...form, quantite: +e.target.value})} className="input-field" /></div>
              </div>
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">Prix de revient unitaire = {formatMontant(prixRevient(form.prix_achat, form.transport, form.quantite))}</p>
                <p className="text-xs text-blue-500 mt-0.5">(Prix d'achat global + Transport) ÷ Quantité du lot</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prix de vente unitaire ({devise}) *</label><input type="number" min="0" value={form.prix_vente} onChange={e => setForm({...form, prix_vente: +e.target.value})} className="input-field" required /></div>
                <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Stock minimum</label><input type="number" min="0" value={form.stock_minimum} onChange={e => setForm({...form, stock_minimum: +e.target.value})} className="input-field" /></div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Fournisseur</label>
                <select value={form.fournisseur_id} onChange={e => setForm({...form, fournisseur_id: e.target.value})} className="input-field">
                  <option value="">Sélectionner...</option>
                  {fournisseurs.map(f => <option key={f.id} value={f.id}>{f.nom}</option>)}
                </select>
              </div>
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
