import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { useAuth } from '../lib/auth'
import { Commande, DetailCommande, Article, Client } from '../types'
import { Plus, Eye, CheckCircle, XCircle, Search, ShoppingBag, Trash2, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

function BadgeStatut({ statut }: { statut: string }) {
  if (statut === 'en_attente') return <span className="badge-amber">En attente</span>
  if (statut === 'confirmee')  return <span className="badge-green">Confirmée</span>
  return <span className="badge-red">Annulée</span>
}

interface LigneCommande {
  article: Article | null
  article_nom: string
  quantite: number
  prix_unitaire: number
}

const FORM_INIT = {
  client_id: '', client_nom: '', client_telephone: '', adresse_livraison: '', notes: '', remise: 0
}

export default function CommandesPage() {
  const { eid } = useEntreprise()
  const { formatMontant } = useDevise()
  const { utilisateur } = useAuth()

  const [commandes, setCommandes] = useState<Commande[]>([])
  const [articles, setArticles] = useState<Article[]>([])
  const [clients, setClients]   = useState<Client[]>([])
  const [loading, setLoading]   = useState(true)
  const [recherche, setRecherche] = useState('')
  const [filtreStatut, setFiltreStatut] = useState<'tous' | 'en_attente' | 'confirmee' | 'annulee'>('tous')

  const [showModal, setShowModal]     = useState(false)
  const [detailCmd, setDetailCmd]     = useState<Commande | null>(null)
  const [form, setForm]               = useState({ ...FORM_INIT })
  const [lignes, setLignes]           = useState<LigneCommande[]>([
    { article: null, article_nom: '', quantite: 1, prix_unitaire: 0 }
  ])
  const [saving, setSaving]           = useState(false)
  const [searchArticle, setSearchArticle] = useState<string[]>([''])

  useEffect(() => { if (eid) charger() }, [eid])

  async function charger() {
    setLoading(true)
    const [cmd, art, cli] = await Promise.all([
      supabase.from('commandes')
        .select('*, clients(nom, telephone), details_commandes(*, articles(nom, prix_vente, quantite))')
        .eq('entreprise_id', eid)
        .order('created_at', { ascending: false }),
      supabase.from('articles').select('*').eq('actif', true).eq('entreprise_id', eid).order('nom'),
      supabase.from('clients').select('*').eq('entreprise_id', eid).order('nom'),
    ])
    setCommandes((cmd.data || []) as Commande[])
    setArticles(art.data || [])
    setClients(cli.data || [])
    setLoading(false)
  }

  // ─── Calcul total
  const total = lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0) - form.remise

  // ─── Gestion lignes
  const setLigne = (i: number, champ: keyof LigneCommande, val: unknown) => {
    setLignes(prev => prev.map((l, idx) => idx === i ? { ...l, [champ]: val } : l))
  }

  const choisirArticle = (i: number, articleId: string) => {
    const art = articles.find(a => a.id === articleId) || null
    setLignes(prev => prev.map((l, idx) => idx !== i ? l : {
      ...l,
      article: art,
      article_nom: art ? art.nom : '',
      prix_unitaire: art ? art.prix_vente : 0,
      quantite: 1,
    }))
    const ns = [...searchArticle]; ns[i] = art?.nom || ''; setSearchArticle(ns)
  }

  const verifierStock = (i: number, qte: number) => {
    const art = lignes[i].article
    if (art && qte > art.quantite) {
      toast(`⚠️ Stock insuffisant pour "${art.nom}" : ${art.quantite} unité(s) disponible(s). La commande sera enregistrée mais nécessitera un réapprovisionnement avant confirmation.`,
        { duration: 5000, icon: '⚠️', style: { background: '#FFFBEB', color: '#92400E', border: '1px solid #FCD34D' } })
    }
    setLigne(i, 'quantite', qte)
  }

  const ajouterLigne = () => {
    setLignes(prev => [...prev, { article: null, article_nom: '', quantite: 1, prix_unitaire: 0 }])
    setSearchArticle(prev => [...prev, ''])
  }

  const supprimerLigne = (i: number) => {
    if (lignes.length === 1) return
    setLignes(prev => prev.filter((_, idx) => idx !== i))
    setSearchArticle(prev => prev.filter((_, idx) => idx !== i))
  }

  // ─── Sauvegarder commande
  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    const lignesValides = lignes.filter(l => l.article_nom.trim() && l.quantite > 0 && l.prix_unitaire >= 0)
    if (!lignesValides.length) { toast.error('Ajoutez au moins un article'); return }
    if (!form.client_nom.trim() && !form.client_id) { toast.error('Renseignez le nom du client'); return }
    setSaving(true)

    // Numéro de commande
    const { data: numData } = await supabase.rpc('generer_numero_commande', { p_entreprise_id: eid })
    const numero = numData || `CMD-${Date.now()}`

    const clientNom = form.client_id
      ? clients.find(c => c.id === form.client_id)?.nom || form.client_nom
      : form.client_nom

    const { data: cmd, error } = await supabase.from('commandes').insert({
      entreprise_id: eid,
      numero,
      client_id: form.client_id || null,
      client_nom: clientNom,
      client_telephone: form.client_telephone,
      adresse_livraison: form.adresse_livraison,
      notes: form.notes,
      remise: form.remise,
      total: Math.max(0, total),
      statut: 'en_attente',
    }).select().single()

    if (error || !cmd) { toast.error('Erreur lors de la création'); setSaving(false); return }

    await supabase.from('details_commandes').insert(
      lignesValides.map(l => ({
        commande_id: cmd.id,
        article_id: l.article?.id || null,
        article_nom: l.article_nom,
        quantite: l.quantite,
        prix_unitaire: l.prix_unitaire,
      }))
    )

    toast.success(`Commande ${numero} créée !`)
    setShowModal(false)
    setForm({ ...FORM_INIT })
    setLignes([{ article: null, article_nom: '', quantite: 1, prix_unitaire: 0 }])
    setSearchArticle([''])
    charger()
    setSaving(false)
  }

  // ─── Confirmer → créer la vente
  const confirmerCommande = async (cmd: Commande) => {
    if (!confirm(`Confirmer la commande ${cmd.numero} et la transformer en vente ?`)) return

    const details = cmd.details_commandes || []
    if (!details.length) { toast.error('Commande vide'); return }

    // Crée la vente
    const { data: vente, error: ve } = await supabase.from('ventes').insert({
      entreprise_id: eid,
      client_id: cmd.client_id || null,
      utilisateur_id: utilisateur?.id,
      numero: cmd.numero.replace('CMD-', 'VT-'),
      total: cmd.total,
      remise: cmd.remise,
      statut: 'validee',
    }).select().single()

    if (ve || !vente) { toast.error('Erreur lors de la création de la vente'); return }

    // Crée les détails de vente
    await supabase.from('details_ventes').insert(
      details.map(d => ({
        entreprise_id: eid,
        vente_id: vente.id,
        article_id: d.article_id || null,
        quantite: d.quantite,
        prix_unitaire: d.prix_unitaire,
      }))
    )

    // Déduit le stock pour chaque article
    for (const d of details) {
      if (!d.article_id) continue
      const art = articles.find(a => a.id === d.article_id)
      if (!art) continue
      const nvQte = Math.max(0, art.quantite - d.quantite)
      await supabase.from('articles').update({ quantite: nvQte }).eq('id', d.article_id)
      await supabase.from('mouvements_stock').insert({
        entreprise_id: eid,
        article_id: d.article_id,
        utilisateur_id: utilisateur?.id,
        type: 'vente',
        quantite: d.quantite,
        commentaire: `Commande ${cmd.numero} confirmée`,
      })
    }

    // Met à jour la commande
    await supabase.from('commandes').update({
      statut: 'confirmee',
      vente_id: vente.id,
      updated_at: new Date().toISOString(),
    }).eq('id', cmd.id)

    toast.success(`Commande confirmée → Vente ${vente.numero} créée !`)
    setDetailCmd(null)
    charger()
  }

  // ─── Annuler une commande
  const annulerCommande = async (cmd: Commande) => {
    if (!confirm(`Annuler la commande ${cmd.numero} ?`)) return
    await supabase.from('commandes').update({ statut: 'annulee', updated_at: new Date().toISOString() }).eq('id', cmd.id)
    toast.success('Commande annulée')
    setDetailCmd(null)
    charger()
  }

  const filtrees = commandes.filter(c => {
    const matchStatut = filtreStatut === 'tous' || c.statut === filtreStatut
    const matchRecherche = c.numero.toLowerCase().includes(recherche.toLowerCase())
      || (c.client_nom || '').toLowerCase().includes(recherche.toLowerCase())
    return matchStatut && matchRecherche
  })

  const nbEnAttente = commandes.filter(c => c.statut === 'en_attente').length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
            <ShoppingBag size={20} className="text-blue-600" /> Commandes
          </h1>
          {nbEnAttente > 0 && (
            <p className="text-xs text-amber-600 mt-0.5">{nbEnAttente} commande{nbEnAttente > 1 ? 's' : ''} en attente de confirmation</p>
          )}
        </div>
        <button onClick={() => { setForm({ ...FORM_INIT }); setLignes([{ article: null, article_nom: '', quantite: 1, prix_unitaire: 0 }]); setSearchArticle(['']); setShowModal(true) }} className="btn-primary">
          <Plus size={16} /> Nouvelle commande
        </button>
      </div>

      {/* Filtres */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="N° ou client..." value={recherche} onChange={e => setRecherche(e.target.value)} className="input-field pl-8 py-1.5 text-sm max-w-48" />
        </div>
        {(['tous','en_attente','confirmee','annulee'] as const).map(s => (
          <button key={s} onClick={() => setFiltreStatut(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filtreStatut === s ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300 text-gray-600 border border-gray-200 dark:border-gray-700'}`}>
            {s === 'tous' ? 'Toutes' : s === 'en_attente' ? 'En attente' : s === 'confirmee' ? 'Confirmées' : 'Annulées'}
          </button>
        ))}
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">N° Commande</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Client</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Adresse livraison</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase">Total</th>
                  <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-700">
                {filtrees.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-12 text-gray-400">
                    <ShoppingBag size={32} className="mx-auto mb-2 text-gray-300" />
                    Aucune commande trouvée
                  </td></tr>
                ) : filtrees.map(cmd => (
                  <tr key={cmd.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                    <td className="px-4 py-3 font-medium text-blue-600">{cmd.numero}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900 dark:text-gray-100">{cmd.client_nom || cmd.clients?.nom || 'Anonyme'}</p>
                      {cmd.client_telephone && <p className="text-xs text-gray-400">{cmd.client_telephone}</p>}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[160px] truncate">{cmd.adresse_livraison || '—'}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 dark:text-gray-100">{formatMontant(cmd.total)}</td>
                    <td className="px-4 py-3 text-center"><BadgeStatut statut={cmd.statut} /></td>
                    <td className="px-4 py-3 text-xs text-gray-400">{format(new Date(cmd.created_at), 'dd/MM/yy HH:mm', { locale: fr })}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setDetailCmd(cmd)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors">
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Nouvelle commande */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-start justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-2xl shadow-2xl my-4">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between sticky top-0 bg-white dark:bg-gray-800 rounded-t-2xl z-10">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nouvelle commande</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={sauvegarder} className="p-5 space-y-5">

              {/* Client */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Client</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Client existant</label>
                    <select value={form.client_id} onChange={e => {
                      const cli = clients.find(c => c.id === e.target.value)
                      setForm(f => ({ ...f, client_id: e.target.value, client_nom: cli?.nom || '', client_telephone: cli?.telephone || '' }))
                    }} className="input-field">
                      <option value="">— Saisir manuellement —</option>
                      {clients.map(c => <option key={c.id} value={c.id}>{c.nom}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom du client *</label>
                    <input type="text" value={form.client_nom} onChange={e => setForm(f => ({...f, client_nom: e.target.value}))} className="input-field" placeholder="Nom complet" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Téléphone</label>
                    <input type="tel" value={form.client_telephone} onChange={e => setForm(f => ({...f, client_telephone: e.target.value}))} className="input-field" placeholder="+225 07..." />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Adresse de livraison</label>
                    <input type="text" value={form.adresse_livraison} onChange={e => setForm(f => ({...f, adresse_livraison: e.target.value}))} className="input-field" placeholder="Quartier, rue, ville..." />
                  </div>
                </div>
              </div>

              {/* Articles */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Articles commandés</p>
                <div className="space-y-2">
                  {lignes.map((l, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        {i === 0 && <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Article *</label>}
                      <select
                          value={l.article?.id || ''}
                          onChange={e => choisirArticle(i, e.target.value)}
                          className="input-field text-sm"
                        >
                          <option value="">— Choisir article —</option>
                          {articles.map(a => (
                            <option key={a.id} value={a.id}>{a.nom} (Stock: {a.quantite})</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        {i === 0 && <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Qté *</label>}
                        <input type="number" min="1" value={l.quantite}
                          onChange={e => verifierStock(i, +e.target.value)}
                          className={`input-field text-sm ${l.article && +l.quantite > l.article.quantite ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/20' : ''}`} />
                      </div>
                      <div className="col-span-3">
                        {i === 0 && <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Prix unit.</label>}
                        <input type="number" min="0" value={l.prix_unitaire}
                          onChange={e => setLigne(i, 'prix_unitaire', +e.target.value)}
                          className="input-field text-sm" />
                      </div>
                      <div className="col-span-2 flex items-center justify-between gap-1">
                        {i === 0 && <div className="h-5" />}
                        <span className="text-xs text-gray-500 truncate">{formatMontant(l.quantite * l.prix_unitaire)}</span>
                        <button type="button" onClick={() => supprimerLigne(i)} className="text-gray-300 hover:text-red-500 transition-colors flex-shrink-0">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <button type="button" onClick={ajouterLigne} className="mt-2 text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors">
                  <Plus size={13} /> Ajouter un article
                </button>

                {/* Alerte stock insuffisant */}
                {lignes.some(l => l.article && l.quantite > l.article.quantite) && (
                  <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">⚠️ Stock insuffisant pour certains articles</p>
                    {lignes.filter(l => l.article && l.quantite > l.article.quantite).map((l, i) => (
                      <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                        • {l.article_nom} : demandé {l.quantite}, disponible {l.article?.quantite} — réapprovisionner avant confirmation
                      </p>
                    ))}
                  </div>
                )}
              </div>

              {/* Notes & Remise */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Notes internes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({...f, notes: e.target.value}))} className="input-field text-sm" rows={2} placeholder="Instructions de livraison, commentaires..." />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Remise</label>
                  <input type="number" min="0" value={form.remise} onChange={e => setForm(f => ({...f, remise: +e.target.value}))} className="input-field" />
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg text-right">
                    <p className="text-xs text-gray-500">Sous-total : {formatMontant(lignes.reduce((s,l) => s + l.quantite*l.prix_unitaire,0))}</p>
                    {form.remise > 0 && <p className="text-xs text-red-500">Remise : - {formatMontant(form.remise)}</p>}
                    <p className="text-sm font-bold text-gray-900 dark:text-gray-100">TOTAL : {formatMontant(Math.max(0,total))}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center">
                  {saving ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : <><Package size={15} /> Enregistrer la commande</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Modal Détail commande */}
      {detailCmd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{detailCmd.numero}</h2>
                <BadgeStatut statut={detailCmd.statut} />
              </div>
              <button onClick={() => setDetailCmd(null)} className="text-gray-400">✕</button>
            </div>
            <div className="p-5 space-y-4">
              {/* Infos client */}
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between"><span className="text-gray-500">Client</span><span className="font-medium dark:text-gray-200">{detailCmd.client_nom || detailCmd.clients?.nom || '—'}</span></div>
                {detailCmd.client_telephone && <div className="flex justify-between"><span className="text-gray-500">Téléphone</span><span className="dark:text-gray-300">{detailCmd.client_telephone}</span></div>}
                {detailCmd.adresse_livraison && <div className="flex justify-between"><span className="text-gray-500">Livraison</span><span className="dark:text-gray-300 text-right max-w-[60%]">{detailCmd.adresse_livraison}</span></div>}
                <div className="flex justify-between"><span className="text-gray-500">Date</span><span className="dark:text-gray-300">{format(new Date(detailCmd.created_at), 'dd/MM/yyyy HH:mm', { locale: fr })}</span></div>
              </div>

              {/* Articles */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Articles</p>
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 dark:bg-gray-700/50">
                    <th className="text-left p-2 text-xs text-gray-500">Article</th>
                    <th className="text-center p-2 text-xs text-gray-500">Qté</th>
                    <th className="text-right p-2 text-xs text-gray-500">Montant</th>
                  </tr></thead>
                  <tbody>
                    {(detailCmd.details_commandes || []).map(d => (
                      <tr key={d.id} className="border-t border-gray-50 dark:border-gray-700">
                        <td className="p-2 dark:text-gray-300">{d.article_nom}</td>
                        <td className="p-2 text-center dark:text-gray-300">{d.quantite}</td>
                        <td className="p-2 text-right dark:text-gray-300">{formatMontant(d.quantite * d.prix_unitaire)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {detailCmd.remise > 0 && (
                <div className="flex justify-between text-sm text-gray-500"><span>Remise</span><span>- {formatMontant(detailCmd.remise)}</span></div>
              )}
              <div className="flex justify-between font-bold text-base border-t border-gray-100 dark:border-gray-700 pt-2">
                <span className="dark:text-gray-100">TOTAL</span>
                <span className="text-blue-600">{formatMontant(detailCmd.total)}</span>
              </div>

              {detailCmd.notes && (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 text-xs text-gray-600 dark:text-gray-300">
                  <strong>Notes :</strong> {detailCmd.notes}
                </div>
              )}

              {/* Alerte stock dans le détail */}
              {detailCmd.statut === 'en_attente' && (detailCmd.details_commandes || []).some(d => {
                const art = articles.find(a => a.id === d.article_id)
                return art && d.quantite > art.quantite
              }) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg p-3">
                  <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1.5">⚠️ Réapprovisionnement requis avant confirmation</p>
                  {(detailCmd.details_commandes || [])
                    .filter(d => { const art = articles.find(a => a.id === d.article_id); return art && d.quantite > art.quantite })
                    .map((d, i) => {
                      const art = articles.find(a => a.id === d.article_id)
                      return <p key={i} className="text-xs text-amber-600 dark:text-amber-400">
                        • {d.article_nom} : demandé {d.quantite}, en stock {art?.quantite ?? 0}
                      </p>
                    })
                  }
                </div>
              )}

              {detailCmd.vente_id && (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3 text-xs text-emerald-700 dark:text-emerald-300">
                  ✓ Commande transformée en vente
                </div>
              )}

              {/* Actions */}
              {detailCmd.statut === 'en_attente' && (
                <div className="flex gap-3 pt-2">
                  <button onClick={() => annulerCommande(detailCmd)} className="flex-1 flex items-center justify-center gap-2 border border-red-200 text-red-600 hover:bg-red-50 rounded-lg py-2 text-sm font-medium transition-colors">
                    <XCircle size={15} /> Annuler
                  </button>
                  <button onClick={() => confirmerCommande(detailCmd)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 text-sm font-medium transition-colors">
                    <CheckCircle size={15} /> Confirmer → Vente
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
