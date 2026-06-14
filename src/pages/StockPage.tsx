import { useEntreprise } from '../lib/entreprise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Article, MouvementStock } from '../types'
import { useAuth } from '../lib/auth'
import { Plus, ArrowUp, ArrowDown, History, Wallet, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import { useLicence } from '../lib/licence'

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default function StockPage() {
  const { eid } = useEntreprise()
  const { utilisateur } = useAuth()
  const { ecritureBloquee } = useLicence()
  const [articles, setArticles] = useState<Article[]>([])
  const [mouvements, setMouvements] = useState<MouvementStock[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({
    article_id: '', type: 'entree', quantite: 1, commentaire: '',
    prix_achat: 0, transport: 0
  })
  const [onglet, setOnglet] = useState<'stock' | 'historique'>('stock')

  useEffect(() => { charger() }, [])

  async function charger() {
    setLoading(true)
    const [a, m] = await Promise.all([
      supabase.from('articles').select('*').eq('actif', true).eq('entreprise_id', eid).order('nom'),
      supabase.from('mouvements_stock').select('*, articles(nom), utilisateurs(nom)').eq('entreprise_id', eid).order('created_at', { ascending: false }).limit(50)
    ])
    setArticles(a.data || [])
    setMouvements(m.data || [])
    setLoading(false)
  }

  const articleSelectionne = articles.find(a => a.id === form.article_id)
  const estEntreeAchat = form.type === 'entree'

  // Prix de revient unitaire de la nouvelle livraison (PR = (PA + transport) / quantité achetée)
  const prCalcule = form.quantite > 0 ? Math.round((form.prix_achat + form.transport) / form.quantite) : 0

  const enregistrerMouvement = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.article_id || form.quantite <= 0) { toast.error('Article et quantité requis'); return }

    const estEntree = form.type === 'entree' || form.type === 'retour'
    if (estEntree && ecritureBloquee) {
      toast.error('Licence expirée — les nouvelles entrées de stock sont bloquées. Renouvelez votre licence pour continuer.')
      return
    }

    const article = articles.find(a => a.id === form.article_id)
    if (!article) return

    const nvQte = form.type === 'entree' || form.type === 'retour'
      ? article.quantite + form.quantite
      : article.quantite - form.quantite

    if (nvQte < 0) { toast.error('Stock insuffisant pour cette sortie'); return }

    await supabase.from('mouvements_stock').insert({ entreprise_id: eid,
      article_id: form.article_id,
      utilisateur_id: utilisateur?.id,
      type: form.type,
      quantite: form.quantite,
      commentaire: form.commentaire
    })

    const updateData: Record<string, number> = { quantite: nvQte }

    // Entrée (achat fournisseur) avec coûts renseignés : recalcule le prix de revient unitaire
    // PR = (prix_achat_global + transport) / quantité_achetée
    // Ce nouveau PR remplace l'ancien pour le calcul de la valeur du stock.
    if (estEntreeAchat && (form.prix_achat > 0 || form.transport > 0)) {
      updateData.prix_achat = form.prix_achat
      updateData.transport = form.transport
      updateData.cout_unitaire = prCalcule
    }

    await supabase.from('articles').update(updateData).eq('id', form.article_id).eq('entreprise_id', eid)
    toast.success('Mouvement enregistré ! Valeur du stock mise à jour.')
    setShowModal(false)
    setForm({ article_id: '', type: 'entree', quantite: 1, commentaire: '', prix_achat: 0, transport: 0 })
    charger()
  }

  const typeLabel = (t: string) => {
    const labels: Record<string, string> = {
      entree: 'Entrée', sortie: 'Sortie', vente: 'Vente',
      retour: 'Retour client', perte: 'Perte', casse: 'Casse', inventaire: 'Inventaire'
    }
    return labels[t] || t
  }

  const valeurTotaleStock = articles.reduce((s, a) => s + a.quantite * (a.cout_unitaire || 0), 0)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Gestion du stock</h1>
        <button onClick={() => setShowModal(true)} className="btn-primary"><Plus size={16} /> Mouvement de stock</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setOnglet('stock')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${onglet === 'stock' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300 text-gray-600 border border-gray-200 dark:border-gray-700'}`}>
          État du stock
        </button>
        <button onClick={() => setOnglet('historique')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${onglet === 'historique' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300 text-gray-600 border border-gray-200 dark:border-gray-700'}`}>
          <History size={14} /> Historique
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : onglet === 'stock' ? (
        <>
          <div className="card p-4 flex items-center justify-between bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-blue-100 dark:bg-blue-900/40 rounded-lg flex items-center justify-center">
                <Wallet size={18} className="text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Valeur totale du stock</p>
                <p className="text-xl font-bold text-blue-700 dark:text-blue-300">{formatMontant(valeurTotaleStock)}</p>
              </div>
            </div>
            <p className="text-xs text-gray-400 text-right max-w-[180px]">Somme de (Prix de revient unitaire × Stock actuel) de chaque article</p>
          </div>

          <div className="card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Article</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stock actuel</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Stock min.</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Prix revient (PR)</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Valeur stock</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {articles.map(a => {
                  const critique = a.quantite === 0
                  const alerte = a.quantite <= a.stock_minimum && a.quantite > 0
                  const pr = a.cout_unitaire || 0
                  return (
                    <tr key={a.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 ${critique ? 'bg-red-50/50 dark:bg-red-900/10' : alerte ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{a.nom}</td>
                      <td className="px-4 py-3 text-center font-semibold text-gray-900 dark:text-gray-100">{a.quantite}</td>
                      <td className="px-4 py-3 text-center text-gray-500">{a.stock_minimum}</td>
                      <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-300">{formatMontant(pr)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMontant(a.quantite * pr)}</td>
                      <td className="px-4 py-3 text-center">
                        {critique ? <span className="badge-red">Rupture</span> :
                         alerte ? <span className="badge-amber">Faible</span> :
                         <span className="badge-green">OK</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50">
                  <td colSpan={4} className="px-4 py-3 text-right font-semibold text-gray-700 dark:text-gray-200">TOTAL</td>
                  <td className="px-4 py-3 text-right font-bold text-blue-700 dark:text-blue-300">{formatMontant(valeurTotaleStock)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Article</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Type</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Qté</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Commentaire</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
              {mouvements.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Aucun mouvement enregistré</td></tr>
              ) : mouvements.map(m => {
                const isEntree = ['entree', 'retour', 'inventaire'].includes(m.type)
                return (
                  <tr key={m.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 text-gray-500 text-xs">{format(new Date(m.created_at), 'dd/MM/yy HH:mm', { locale: fr })}</td>
                    <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">{(m.articles as { nom?: string } | null)?.nom}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${isEntree ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
                        {isEntree ? <ArrowUp size={10} /> : <ArrowDown size={10} />}
                        {typeLabel(m.type)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center font-medium dark:text-gray-200">{m.quantite}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{m.commentaire || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nouveau mouvement de stock</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={enregistrerMouvement} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Article *</label>
                <select value={form.article_id} onChange={e => setForm({...form, article_id: e.target.value})} className="input-field" required>
                  <option value="">Sélectionner...</option>
                  {articles.map(a => <option key={a.id} value={a.id}>{a.nom} (Stock: {a.quantite})</option>)}
                </select>
                {articleSelectionne && (
                  <p className="text-xs text-gray-400 mt-1">
                    PR actuel : {formatMontant(articleSelectionne.cout_unitaire || 0)} · Valeur stock actuelle : {formatMontant(articleSelectionne.quantite * (articleSelectionne.cout_unitaire || 0))}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Type de mouvement *</label>
                <select value={form.type} onChange={e => setForm({...form, type: e.target.value})} className="input-field">
                  <option value="entree">Entrée — Achat fournisseur</option>
                  <option value="retour">Entrée — Retour client</option>
                  <option value="sortie">Sortie — Autre</option>
                  <option value="perte">Sortie — Perte</option>
                  <option value="casse">Sortie — Casse</option>
                  <option value="inventaire">Inventaire — Ajustement</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Quantité *</label>
                <input type="number" min="1" value={form.quantite} onChange={e => setForm({...form, quantite: +e.target.value})} className="input-field" required />
              </div>

              {estEntreeAchat && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg space-y-3">
                  <p className="text-xs font-medium text-blue-700 dark:text-blue-300">
                    Renseigner les coûts de cette livraison met à jour automatiquement le prix de revient et la valeur du stock (laisser à 0 pour ne pas modifier le PR actuel).
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prix d'achat global (FCFA)</label>
                      <input type="number" min="0" value={form.prix_achat} onChange={e => setForm({...form, prix_achat: +e.target.value})} className="input-field" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Transport (FCFA)</label>
                      <input type="number" min="0" value={form.transport} onChange={e => setForm({...form, transport: +e.target.value})} className="input-field" />
                    </div>
                  </div>
                  {(form.prix_achat > 0 || form.transport > 0) && (
                    <p className="text-xs text-blue-700 dark:text-blue-300 font-medium">
                      Nouveau PR = ({form.prix_achat} + {form.transport}) ÷ {form.quantite} = {formatMontant(prCalcule)}
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Commentaire</label>
                <textarea value={form.commentaire} onChange={e => setForm({...form, commentaire: e.target.value})} className="input-field" rows={2} placeholder="Optionnel..." />
              </div>
              {(form.type === 'entree' || form.type === 'retour') && ecritureBloquee && (
                <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg">
                  <Lock size={13} /> Licence expirée — nouvelles entrées bloquées.
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                <button
                  type="submit"
                  disabled={(form.type === 'entree' || form.type === 'retour') && ecritureBloquee}
                  className="btn-primary flex-1 justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {(form.type === 'entree' || form.type === 'retour') && ecritureBloquee ? <><Lock size={14} /> Bloqué</> : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
