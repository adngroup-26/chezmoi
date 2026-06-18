import { logger } from '../lib/logger'
import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { Article, Client, PanierItem } from '../types'
import { useAuth } from '../lib/auth'
import { Search, Plus, Minus, Trash2, ShoppingCart, Check, Printer, Download, FileText, UserPlus, Lock } from 'lucide-react'
import toast from 'react-hot-toast'
import { construireDonneesRecu, imprimerRecu as imprimerRecuPDF, telechargerRecuPDF, FormatTicket, InfosEntreprise } from '../lib/recu'
import { useOnlineStatus } from '../hooks/useOnlineStatus'
import { cacheArticles, cacheClients, getArticlesCache, getClientsCache, sauvegarderVenteOffline, decrementerStockCache, sauvegarderClientOffline, ajouterClientAuCache } from '../lib/offline'
import { useLicence } from '../lib/licence'


export default function CaissePage() {
  const { eid } = useEntreprise()
  const { formatMontant, devise } = useDevise()
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
  const [venteReussie, setVenteReussie] = useState<{
    numero: string
    total: number
    panier: PanierItem[]
    remise: number
    client?: string
    clientTelephone?: string
  } | null>(null)
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
      logger.error('[CAISSE] Échec chargement en ligne, utilisation du cache:', e)
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

  // Sous-total : remise par ligne cappée au montant de la ligne
  const sousTotal = panier.reduce((s, p) => {
    const montantLigne = p.article.prix_vente * p.quantite
    const remiseLigne = Math.min(p.remise, montantLigne) // ne peut pas dépasser le prix
    return s + (montantLigne - remiseLigne)
  }, 0)
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
        logger.error('[CLIENT] Échec création en ligne, bascule hors ligne:', e)
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

        setVenteReussie({ numero, total, panier: [...panier], remise: remiseGlobale, client: clientSelectionne?.nom, clientTelephone: clientSelectionne?.telephone })
        setPanier([])
        setClientSelectionne(null)
        setRemiseGlobale(0)
        toast.success(`Vente ${numero} enregistrée hors ligne — synchronisation automatique au retour du réseau.`)
      } catch (e) {
        logger.error(e)
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

      setVenteReussie({ numero, total, panier: [...panier], remise: remiseGlobale, client: clientSelectionne?.nom, clientTelephone: clientSelectionne?.telephone })
      setPanier([])
      setClientSelectionne(null)
      setRemiseGlobale(0)
      charger()
      toast.success(`Vente ${numero} enregistrée !`)
    } catch (e) {
      // Échec réseau alors qu'on pensait être en ligne → bascule en sauvegarde hors ligne
      logger.error(e)
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
        setVenteReussie({ numero, total, panier: [...panier], remise: remiseGlobale, client: clientSelectionne?.nom, clientTelephone: clientSelectionne?.telephone })
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

  // Sur mobile : onglets Articles / Panier
  const [ongletMobile, setOngletMobile] = useState<'articles' | 'panier'>('articles')
  const nbPanier = panier.reduce((s, p) => s + p.quantite, 0)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Caisse</h1>
        {/* Switcher mobile articles/panier */}
        <div className="flex lg:hidden bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setOngletMobile('articles')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${ongletMobile === 'articles' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >Articles</button>
          <button
            onClick={() => setOngletMobile('panier')}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors relative ${ongletMobile === 'panier' ? 'bg-white dark:bg-gray-800 text-blue-600 shadow-sm' : 'text-gray-500 dark:text-gray-400'}`}
          >
            Panier
            {nbPanier > 0 && (
              <span className="absolute -top-1 -right-1 bg-blue-600 text-white text-[9px] font-bold min-w-[14px] h-[14px] rounded-full flex items-center justify-center px-0.5">
                {nbPanier}
              </span>
            )}
          </button>
        </div>
      </div>

      {venteReussie && (
        <div className="card p-4 bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800 space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-100 dark:bg-emerald-900/40 rounded-full flex items-center justify-center">
                <Check size={20} className="text-emerald-600" />
              </div>
              <div>
                <p className="font-medium text-emerald-800 dark:text-emerald-300">Vente enregistrée !</p>
                <p className="text-sm text-emerald-600 dark:text-emerald-400">{venteReussie.numero} · {formatMontant(venteReussie.total)}</p>
              </div>
            </div>
            <button onClick={() => { setVenteReussie(null); setOngletMobile('articles') }} className="btn-primary text-xs py-1.5">Nouvelle vente</button>
          </div>

          {/* Détails de la vente */}
          <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-emerald-100 dark:border-emerald-800">
            {venteReussie.client && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                Client : <span className="font-medium text-gray-700 dark:text-gray-300">{venteReussie.client}</span>
              </p>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="text-gray-400 border-b border-gray-100 dark:border-gray-700">
                  <th className="text-left pb-1.5">Article</th>
                  <th className="text-center pb-1.5">Qté</th>
                  <th className="text-right pb-1.5">Prix unit.</th>
                  <th className="text-right pb-1.5">Montant</th>
                </tr>
              </thead>
              <tbody>
                {venteReussie.panier.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-700/50">
                    <td className="py-1 text-gray-700 dark:text-gray-300 font-medium truncate max-w-[120px]">{p.article.nom}</td>
                    <td className="py-1 text-center text-gray-600 dark:text-gray-400">{p.quantite}</td>
                    <td className="py-1 text-right text-gray-600 dark:text-gray-400">{formatMontant(p.article.prix_vente)}</td>
                    <td className="py-1 text-right font-medium text-gray-800 dark:text-gray-200">
                      {formatMontant(p.article.prix_vente * p.quantite - Math.min(p.remise, p.article.prix_vente * p.quantite))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {venteReussie.remise > 0 && (
              <div className="flex justify-between text-xs text-gray-500 mt-1.5 pt-1.5 border-t border-gray-100 dark:border-gray-700">
                <span>Remise globale</span><span>- {formatMontant(venteReussie.remise)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-gray-900 dark:text-gray-100 mt-1.5 pt-1.5 border-t border-gray-200 dark:border-gray-600">
              <span>TOTAL</span><span className="text-blue-600">{formatMontant(venteReussie.total)}</span>
            </div>
          </div>

          {/* Boutons reçu */}
          <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-emerald-200 dark:border-emerald-800">
            <span className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1"><FileText size={13} /> Format :</span>
            <select value={formatTicket} onChange={e => setFormatTicket(e.target.value as FormatTicket)} className="input-field text-xs py-1.5 max-w-[140px]">
              <option value="58mm">Ticket 58mm</option>
              <option value="80mm">Ticket 80mm</option>
              <option value="a4">PDF A4</option>
            </select>
            <button onClick={handleImprimer} className="btn-secondary text-xs py-1.5">
              <Printer size={14} /> Imprimer
            </button>
            <button onClick={handleTelecharger} className="btn-secondary text-xs py-1.5">
              <Download size={14} /> PDF
            </button>
            {venteReussie.clientTelephone && (
              <button
                onClick={() => {
                  const tel = venteReussie.clientTelephone!.replace(/\D/g, '')
                  const message = encodeURIComponent(
                    `Bonjour ${venteReussie.client || ''},\n\nVotre reçu ChezMoi Pro :\n` +
                    `N° : ${venteReussie.numero}\n` +
                    venteReussie.panier.map(p =>
                      `- ${p.article.nom} x${p.quantite} = ${formatMontant(p.article.prix_vente * p.quantite)}`
                    ).join('\n') +
                    (venteReussie.remise > 0 ? `\nRemise : -${formatMontant(venteReussie.remise)}` : '') +
                    `\nTOTAL : ${formatMontant(venteReussie.total)}\n\nMerci pour votre achat ! 🙏`
                  )
                  window.open(`https://wa.me/${tel}?text=${message}`, '_blank')
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#25D366] hover:bg-[#1ebe5d] text-white rounded-lg text-xs font-medium transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                WhatsApp
              </button>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Colonne articles — masquée sur mobile si onglet panier actif */}
        <div className={`lg:col-span-3 space-y-3 ${ongletMobile === 'panier' ? 'hidden lg:block' : 'block'}`}>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher un article..."
              value={recherche}
              onChange={e => setRecherche(e.target.value)}
              className="input-field pl-9 text-base"  /* text-base évite le zoom iOS */
              autoComplete="off"
            />
          </div>
          {recherche && (
            <div className="card divide-y divide-gray-50 dark:divide-gray-700 max-h-[50vh] overflow-y-auto">
              {articlesFiltres.slice(0, 10).map(a => (
                <button
                  key={a.id}
                  onClick={() => { ajouterAuPanier(a); setOngletMobile('panier') }}
                  className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-700/30 active:bg-blue-50 transition-colors text-left"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{a.nom}</p>
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
              {articlesFiltres.length === 0 && <p className="p-4 text-sm text-gray-400 text-center">Aucun résultat</p>}
            </div>
          )}

          {/* Articles rapides — grille plus grande sur mobile */}
          {!recherche && (
            <div>
              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">Accès rapide</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {articles.slice(0, 6).map(a => (
                  <button
                    key={a.id}
                    onClick={() => { ajouterAuPanier(a); setOngletMobile('panier') }}
                    disabled={a.quantite === 0}
                    className="card p-3 text-left hover:border-blue-200 hover:shadow-md active:scale-95 transition-all disabled:opacity-50 touch-manipulation"
                  >
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{a.nom}</p>
                    <p className="text-sm font-bold text-blue-600 mt-1">{formatMontant(a.prix_vente)}</p>
                    <p className={`text-xs mt-0.5 ${a.quantite <= a.stock_minimum ? 'text-amber-500' : 'text-gray-400'}`}>
                      Stock : {a.quantite}
                    </p>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panier — masqué sur mobile si onglet articles actif */}
        <div className={`lg:col-span-2 ${ongletMobile === 'articles' ? 'hidden lg:block' : 'block'}`}>
          <div className="card flex flex-col" style={{ minHeight: 400 }}>
            <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
              <ShoppingCart size={16} className="text-gray-600 dark:text-gray-300" />
              <span className="font-medium text-gray-900 dark:text-gray-100 text-sm">Panier ({panier.length})</span>
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
                  <span className="text-xs text-gray-400">{devise}</span>
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
