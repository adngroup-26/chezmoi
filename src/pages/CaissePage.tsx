import { useEntreprise } from '../lib/entreprise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Article, Client, PanierItem } from '../types'
import { useAuth } from '../lib/auth'
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, Printer, Download, FileText, UserPlus, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { construireDonneesRecu, imprimerRecu as imprimerRecuPDF, telechargerRecuPDF, FormatTicket, InfosEntreprise } from '../lib/recu'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { cacheArticles, cacheClients, getArticlesCache, getClientsCache, sauvegarderVenteOffline, decrementerStockCache, sauvegarderClientOffline, ajouterClientAuCache } from '../lib/offline'
import { useLicence } from '../lib/licence'

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
}

export default function CaissePage() {
  const { eid } = useEntreprise()
  const { utilisateur } = useAuth()
  const isOnline = useOnlineStatus()
  const { ecritureBloquee } = useLicence()
  const [articles, setArticles] = useState<Article[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [recherche, setRecherche] = useState('')
  const [panier, setPanier] = useState<PanierItem[]>([])
  const [clientSelectionne, setClientSelectionne] = useState<Client | null>(null)
  const [remiseGlobale, setRemiseGlobale] = useState(0)
  const [loading, setLoading] = useState(false)
  const [venteReussie, setVenteReussie] = useState<{ numero: string; total: number; panier: PanierItem[]; remise: number; client?: string } | null>(null)
  const [formatTicket, setFormatTicket] = useState<FormatTicket>('80mm')
  const [entreprise, setEntreprise] = useState<InfosEntreprise>({ nom_entreprise: 'ChezMoi', telephone: '', adresse: '', devise: 'FCFA' })
  const [showClientModal, setShowClientModal] = useState(false)
  const [nouveauClient, setNouveauClient] = useState({ nom: '', telephone: '' })
  const [creationClientLoading, setCreationClientLoading] = useState(false)

  useEffect(() => { charger() }, [isOnline])

  async function charger() {
    if (!navigator.onLine) {
      // Hors ligne : on charge depuis le cache local
      const [a, c] = await Promise.all([getArticlesCache(), getClientsCache()])
      setArticles(a as unknown as Article[])
      setClients(c as unknown as Client[])
      const entrepriseCache = localStorage.getItem('chezmoi_entreprise')
      if (entrepriseCache) {
        try { setEntreprise(JSON.parse(entrepriseCache)) } catch { /* ignore */ }
      }
      return
    }

    try {
      const [a, c, p] = await Promise.all([
        supabase.from('articles').select('*').eq('actif', true).eq('entreprise_id', eid).order('nom'),
        supabase.from('clients').select('*').eq('entreprise_id', eid).order('nom'),
        supabase.from('parametres').select('*').eq('entreprise_id', eid)
      ])

      if (a.error || c.error) throw (a.error || c.error)

      setArticles(a.data || [])
      setClients(c.data || [])
      // Mise en cache pour utilisation hors ligne
      if (a.data) cacheArticles(a.data as unknown as Record<string, unknown>[])
      if (c.data) cacheClients(c.data as unknown as Record<string, unknown>[])

      if (p.data) {
        const params = Object.fromEntries(p.data.map(d => [d.cle, d.valeur || '']))
        const infosEntreprise = {
          nom_entreprise: params.nom_entreprise || 'ChezMoi',
          telephone: params.telephone || '',
          adresse: params.adresse || '',
          devise: params.devise || 'FCFA'
        }
        setEntreprise(infosEntreprise)
        localStorage.setItem('chezmoi_entreprise', JSON.stringify(infosEntreprise))
      }
    } catch (e) {
      // Connexion réellement indisponible malgré navigator.onLine === true
      // → on charge depuis le cache local
      console.error('[CAISSE] Échec chargement en ligne, utilisation du cache:', e)
      const [a, c] = await Promise.all([getArticlesCache(), getClientsCache()])
      setArticles(a as unknown as Article[])
      setClients(c as unknown as Client[])
      const entrepriseCache = localStorage.getItem('chezmoi_entreprise')
      if (entrepriseCache) {
        try { setEntreprise(JSON.parse(entrepriseCache)) } catch { /* ignore */ }
      }
    }
  }

  const articlesFiltres = articles.filter(a =>
    a.nom.toLowerCase().includes(recherche.toLowerCase()) ||
    (a.reference || '').toLowerCase().includes(recherche.toLowerCase())
  )

  const ajouterAuPanier = (article: Article) => {
    if (article.quantite <= 0) { toast.error('Stock insuffisant'); return }
    setPanier(prev => {
      const exist = prev.find(p => p.article.id === article.id)
      if (exist) {
        if (exist.quantite >= article.quantite) { toast.error('Stock insuffisant'); return prev }
        return prev.map(p => p.article.id === article.id ? { ...p, quantite: p.quantite + 1 } : p)
      }
      return [...prev, { article, quantite: 1, remise: 0 }]
    })
    setRecherche('')
  }

  const modifierQuantite = (id: string, delta: number) => {
    setPanier(prev => prev.map(p => {
      if (p.article.id !== id) return p
      const nv = p.quantite + delta
      if (nv <= 0) return p
      if (nv > p.article.quantite) { toast.error('Stock insuffisant'); return p }
      return { ...p, quantite: nv }
    }))
  }

  const retirerDuPanier = (id: string) => setPanier(prev => prev.filter(p => p.article.id !== id))

  const sousTotal = panier.reduce((s, p) => s + (p.article.prix_vente * p.quantite - p.remise), 0)
  const total = Math.max(0, sousTotal - remiseGlobale)

  const creerNouveauClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nouveauClient.nom.trim()) { toast.error('Le nom est requis'); return }
    setCreationClientLoading(true)

    if (!isOnline) {
      // ===== Création hors ligne =====
      const clientOffline = {
        id: `offline_${crypto.randomUUID()}`,
        nom: nouveauClient.nom.trim(),
        telephone: nouveauClient.telephone.trim() || undefined,
        created_at: new Date().toISOString(),
        synced: 'false' as const
      }
      await sauvegarderClientOffline(clientOffline)
      const clientLocal = clientOffline as unknown as Client
      setClients(prev => [...prev, clientLocal].sort((a, b) => a.nom.localeCompare(b.nom)))
      setClientSelectionne(clientLocal)
      toast.success('Client créé hors ligne — sera synchronisé au retour du réseau.')
    } else {
      // ===== Création en ligne =====
      try {
        const { data, error } = await supabase
          .from('clients')
          .insert({ nom: nouveauClient.nom.trim(), telephone: nouveauClient.telephone.trim() || null })
          .select()
          .single()

        if (error) throw error
        if (!data) throw new Error('Aucune donnée retournée')

        await ajouterClientAuCache(data as unknown as Record<string, unknown>)
        setClients(prev => [...prev, data].sort((a, b) => a.nom.localeCompare(b.nom)))
        setClientSelectionne(data)
        toast.success('Client créé !')
      } catch (e) {
        // Connexion réellement indisponible malgré navigator.onLine === true
        // → on bascule sur la création hors ligne
        console.error('[CLIENT] Échec création en ligne, bascule hors ligne:', e)
        const clientOffline = {
          id: `offline_${crypto.randomUUID()}`,
          nom: nouveauClient.nom.trim(),
          telephone: nouveauClient.telephone.trim() || undefined,
          created_at: new Date().toISOString(),
          synced: 'false' as const
        }
        await sauvegarderClientOffline(clientOffline)
        const clientLocal = clientOffline as unknown as Client
        setClients(prev => [...prev, clientLocal].sort((a, b) => a.nom.localeCompare(b.nom)))
        setClientSelectionne(clientLocal)
        toast.success('Connexion indisponible — client créé hors ligne, sera synchronisé plus tard.')
      }
    }

    setNouveauClient({ nom: '', telephone: '' })
    setShowClientModal(false)
    setCreationClientLoading(false)
  }

  const validerVente = async () => {
    if (panier.length === 0) { toast.error('Le panier est vide'); return }
    if (ecritureBloquee) {
      toast.error('Licence expirée — les nouvelles ventes sont bloquées. Renouvelez votre licence pour continuer.')
      return
    }
    setLoading(true)
    const numero = `VT-${Date.now().toString().slice(-6)}`

    // ===== MODE HORS LIGNE =====
    if (!isOnline) {
      try {
        await sauvegarderVenteOffline({
          id: crypto.randomUUID(),
          numero,
          entreprise_id: eid,
          client_id: clientSelectionne?.id || null,
          client_nom: clientSelectionne?.nom,
          utilisateur_id: utilisateur?.id || '',
          total,
          remise: remiseGlobale,
          items: panier.map(p => ({
            article_id: p.article.id,
            article_nom: p.article.nom,
            quantite: p.quantite,
            prix_unitaire: p.article.prix_vente
          })),
          created_at: new Date().toISOString(),
          synced: 'false'
        })

        // Déduction optimiste du stock dans le cache local pour éviter la survente
        for (const p of panier) {
          await decrementerStockCache(p.article.id, p.quantite)
        }
        // Mise à jour de l'affichage local immédiat
        setArticles(prev => prev.map(a => {
          const item = panier.find(p => p.article.id === a.id)
          return item ? { ...a, quantite: a.quantite - item.quantite } : a
        }))

        setVenteReussie({ numero, total, panier: [...panier], remise: remiseGlobale, client: clientSelectionne?.nom })
        setPanier([])
        setClientSelectionne(null)
        setRemiseGlobale(0)
        toast.success(`Vente ${numero} enregistrée hors ligne — synchronisation automatique au retour du réseau.`)
      } catch (e) {
        console.error(e)
        toast.error("Erreur lors de l'enregistrement hors ligne")
      }
      setLoading(false)
      return
    }

    // ===== MODE EN LIGNE =====
    try {
      const { data: vente, error: venteError } = await supabase
        .from('ventes')
        .insert({ entreprise_id: eid,
          numero,
          client_id: clientSelectionne?.id || null,
          utilisateur_id: utilisateur?.id,
          total,
          remise: remiseGlobale,
          statut: 'validee'
        })
        .select()
        .single()

      if (venteError || !vente) throw new Error('Erreur création vente')

      // Details
      const details = panier.map(p => ({
        vente_id: vente.id,
        article_id: p.article.id,
        quantite: p.quantite,
        prix_unitaire: p.article.prix_vente,
        remise: p.remise
      }))
      const detailsAvecEid = details.map(d => ({ ...d, entreprise_id: eid }))
      await supabase.from('details_ventes').insert(detailsAvecEid)

      // Mouvements stock
      const mouvements = panier.map(p => ({
        article_id: p.article.id,
        utilisateur_id: utilisateur?.id,
        type: 'vente',
        quantite: p.quantite,
        vente_id: vente.id,
        commentaire: `Vente ${numero}`
      }))
      await supabase.from('mouvements_stock').insert(mouvements)

      // Mise à jour stock
      for (const p of panier) {
        await supabase
          .from('articles')
          .update({ quantite: p.article.quantite - p.quantite })
          .eq('id', p.article.id)
      }

      setVenteReussie({ numero, total, panier: [...panier], remise: remiseGlobale, client: clientSelectionne?.nom })
      setPanier([])
      setClientSelectionne(null)
      setRemiseGlobale(0)
      charger()
      toast.success(`Vente ${numero} enregistrée !`)
    } catch (e) {
      // Échec réseau alors qu'on pensait être en ligne → bascule en sauvegarde hors ligne
      console.error(e)
      try {
        await sauvegarderVenteOffline({
          id: crypto.randomUUID(),
          numero,
          entreprise_id: eid,
          client_id: clientSelectionne?.id || null,
          client_nom: clientSelectionne?.nom,
          utilisateur_id: utilisateur?.id || '',
          total,
          remise: remiseGlobale,
          items: panier.map(p => ({
            article_id: p.article.id,
            article_nom: p.article.nom,
            quantite: p.quantite,
            prix_unitaire: p.article.prix_vente
          })),
          created_at: new Date().toISOString(),
          synced: 'false'
        })
        setVenteReussie({ numero, total, panier: [...panier], remise: remiseGlobale, client: clientSelectionne?.nom })
        setPanier([])
        setClientSelectionne(null)
        setRemiseGlobale(0)
        toast.success(`Connexion instable — vente ${numero} sauvegardée hors ligne.`)
      } catch {
        toast.error('Erreur lors de la vente')
      }
    }
    setLoading(false)
  }

  const genererDonnees = () => {
    if (!venteReussie) return null
    return construireDonneesRecu(
      venteReussie.numero,
      venteReussie.panier,
      venteReussie.remise,
      venteReussie.total,
      utilisateur?.nom || 'Vendeur',
      venteReussie.client,
      entreprise
    )
  }

  const handleImprimer = () => {
    const donnees = genererDonnees()
    if (!donnees) return
    imprimerRecuPDF(donnees, formatTicket)
  }

  const handleTelecharger = () => {
    const donnees = genererDonnees()
    if (!donnees) return
    telechargerRecuPDF(donnees, formatTicket)
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-gray-900">Caisse</h1>

      {venteReussie && (
        <div className="card p-4 bg-emerald-50 border-emerald-200 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                <Check size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-emerald-800">Vente enregistrée !</p>
                <p className="text-sm text-emerald-600">{venteReussie.numero} · {formatMontant(venteReussie.total)}</p>
              </div>
            </div>
            <button onClick={() => setVenteReussie(null)} className="btn-primary text-xs py-1.5">Nouvelle vente</button>
          </div>
          <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-emerald-200">
            <span className="text-xs text-emerald-700 font-medium flex items-center gap-1"><FileText size={13} /> Format reçu :</span>
            <select value={formatTicket} onChange={e => setFormatTicket(e.target.value as FormatTicket)} className="input-field text-xs py-1.5 max-w-[160px]">
              <option value="58mm">Ticket 58mm</option>
              <option value="80mm">Ticket 80mm</option>
              <option value="a4">PDF A4</option>
            </select>
            <button onClick={handleImprimer} className="btn-secondary text-xs py-1.5">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={handleTelecharger} className="btn-secondary text-xs py-1.5">
              <Download size={14} /> Télécharger PDF
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Recherche articles */}
        <div className="lg:col-span-3 space-y-3">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un article à ajouter..."
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          {recherche && (
            <div className="card divide-y divide-gray-50 max-h-64 overflow-y-auto">
              {articlesFiltres.slice(0, 10).map(a => (
                <button
                  key={a.id}
                  onClick={() => ajouterAuPanier(a)}
                  className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.nom}</p>
                    <p className="text-xs text-gray-400">Stock : {a.quantite}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-blue-600">{formatMontant(a.prix_vente)}</p>
                    <div className={`text-xs ${a.quantite === 0 ? 'text-red-500' : 'text-gray-400'}`}>
                      {a.quantite === 0 ? 'Rupture' : 'En stock'}
                    </div>
                  </div>
                </button>
              ))}
              {articlesFiltres.length === 0 && <p className="p-3 text-sm text-gray-400 text-center">Aucun résultat</p>}
            </div>
          )}

          {/* Articles rapides */}
          {!recherche && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">Articles récents</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {articles.slice(0, 6).map(a => (
                  <button
                    key={a.id}
                    onClick={() => ajouterAuPanier(a)}
                    disabled={a.quantite === 0}
                    className="card p-3 text-left hover:border-blue-200 hover:shadow-md transition-all disabled:opacity-50"
                  >
                    <p className="text-sm font-medium text-gray-900 truncate">{a.nom}</p>
                    <p className="text-xs font-semibold text-blue-600 mt-1">{formatMontant(a.prix_vente)}</p>
                    <p className={`text-xs mt-0.5 ${a.quantite <= a.stock_minimum ? 'text-amber-500' : 'text-gray-400'}`}>
                      Stock : {a.quantite}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panier */}
        <div className="lg:col-span-2">
          <div className="card flex flex-col" style={{ minHeight: 400 }}>
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-600" />
              <span className="font-medium text-gray-900 text-sm">Panier ({panier.length})</span>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
              {panier.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-gray-300">
                  <ShoppingCart size={32} className="mb-2" />
                  <p className="text-sm">Panier vide</p>
                </div>
              ) : panier.map(p => (
                <div key={p.article.id} className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.article.nom}</p>
                      <p className="text-xs text-gray-400">{formatMontant(p.article.prix_vente)} / unité</p>
                    </div>
                    <button onClick={() => retirerDuPanier(p.article.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-2">
                      <button onClick={() => modifierQuantite(p.article.id, -1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Minus size={11} />
                      </button>
                      <span className="text-sm font-medium w-6 text-center">{p.quantite}</span>
                      <button onClick={() => modifierQuantite(p.article.id, 1)} className="w-6 h-6 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors">
                        <Plus size={11} />
                      </button>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatMontant(p.article.prix_vente * p.quantite)}</span>
                  </div>
                </div>
              ))}
            </div>

            {panier.length > 0 && (
              <div className="p-4 border-t border-gray-100 space-y-3">
                {/* Client */}
                <div className="flex items-center gap-2">
                  <select
                    value={clientSelectionne?.id || ''}
                    onChange={e => setClientSelectionne(clients.find(c => c.id === e.target.value) || null)}
                    className="input-field text-xs"
                  >
                    <option value="">Client anonyme</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.nom} {c.telephone ? `(${c.telephone})` : ''}</option>)}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowClientModal(true)}
                    className="btn-secondary text-xs py-2 px-2.5 flex-shrink-0"
                    title="Nouveau client"
                  >
                    <UserPlus size={14} />
                  </button>
                </div>

                {/* Remise */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Remise :</label>
                  <input
                    type="number"
                    min="0"
                    value={remiseGlobale}
                    onChange={e => setRemiseGlobale(+e.target.value)}
                    className="input-field text-xs py-1.5"
                    placeholder="0"
                  />
                  <span className="text-xs text-gray-400">FCFA</span>
                </div>

                <div className="flex items-center justify-between py-2 border-t border-gray-100">
                  <span className="font-semibold text-gray-900">TOTAL</span>
                  <span className="text-lg font-bold text-blue-600">{formatMontant(total)}</span>
                </div>

                {ecritureBloquee && (
                  <div className="flex items-center gap-1.5 text-xs text-red-600 bg-red-50 dark:bg-red-900/30 p-2 rounded-lg">
                    <Lock size={13} /> Licence expirée — nouvelles ventes bloquées.
                  </div>
                )}

                <button
                  onClick={validerVente}
                  disabled={loading || ecritureBloquee}
                  className="btn-primary w-full justify-center py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : ecritureBloquee ? <>
                    <Lock size={16} /> Ventes bloquées
                  </> : <>
                    <Check size={18} /> Valider la vente
                  </>}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {showClientModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-sm shadow-2xl">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">Nouveau client</h2>
              <button onClick={() => setShowClientModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={creerNouveauClient} className="p-5 space-y-3">
              {!isOnline && (
                <div className="text-xs text-amber-700 bg-amber-50 dark:bg-amber-900/30 dark:text-amber-300 p-2 rounded-lg">
                  Vous êtes hors ligne — ce client sera synchronisé automatiquement au retour du réseau.
                </div>
              )}
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom *</label>
                <input type="text" value={nouveauClient.nom} onChange={e => setNouveauClient({...nouveauClient, nom: e.target.value})} className="input-field" required autoFocus />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Téléphone</label>
                <input type="tel" value={nouveauClient.telephone} onChange={e => setNouveauClient({...nouveauClient, telephone: e.target.value})} className="input-field" />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowClientModal(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                <button type="submit" disabled={creationClientLoading} className="btn-primary flex-1 justify-center">
                  {creationClientLoading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
