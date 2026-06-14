import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useEntreprise } from '../lib/entreprise'
import { useDevise } from '../lib/devise'
import { StatsDashboard } from '../types'
import { TrendingUp, ShoppingCart, Package, Wallet, BarChart3, AlertTriangle, FileDown, Calendar, ShoppingBag } from 'lucide-react'
import { format, startOfDay, endOfDay, startOfWeek, startOfMonth, startOfYear, endOfWeek, endOfMonth, endOfYear, subMonths, eachMonthOfInterval } from 'date-fns'
import { fr } from 'date-fns/locale'
import { telechargerRapportPDF } from '../lib/rapport'
import { InfosEntreprise } from '../lib/recu'
import toast from 'react-hot-toast'
import { useCommandes } from '../lib/commandesContext'

type Periode = 'jour' | 'semaine' | 'mois' | 'annee' | 'personnalisee'


// Composant graphique SVG natif — aucune dépendance externe
function GraphiqueCA({ donnees }: { donnees: { mois: string; ca: number; ventes: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; d: typeof donnees[0] } | null>(null)

  if (!donnees.length) return (
    <div className="h-48 flex items-center justify-center text-gray-300 text-sm">Aucune donnée</div>
  )

  const W = 600, H = 160
  const padL = 52, padR = 16, padT = 12, padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB

  const maxCA = Math.max(...donnees.map(d => d.ca), 1)
  const nTicks = 4

  const xOf = (i: number) => padL + (i / (donnees.length - 1 || 1)) * innerW
  const yOf = (v: number) => padT + innerH - (v / maxCA) * innerH

  const points = donnees.map((d, i) => ({ x: xOf(i), y: yOf(d.ca), d }))

  // Chemin courbe lisse (bezier)
  const pathD = points.reduce((acc, p, i) => {
    if (i === 0) return `M ${p.x},${p.y}`
    const prev = points[i - 1]
    const cpx = (prev.x + p.x) / 2
    return acc + ` C ${cpx},${prev.y} ${cpx},${p.y} ${p.x},${p.y}`
  }, '')

  // Zone remplie
  const areaD = pathD
    + ` L ${points[points.length - 1].x},${padT + innerH}`
    + ` L ${points[0].x},${padT + innerH} Z`

  const fmtCA = (v: number) =>
    v >= 1000000 ? `${(v / 1000000).toFixed(1)}M`
    : v >= 1000 ? `${(v / 1000).toFixed(0)}k`
    : `${v}`

  return (
    <div className="relative select-none" onMouseLeave={() => setTooltip(null)}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full h-48">
        <defs>
          <linearGradient id="gCA" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2563EB" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#2563EB" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Grilles horizontales */}
        {Array.from({ length: nTicks + 1 }, (_, i) => {
          const v = (maxCA / nTicks) * i
          const y = yOf(v)
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#E5E7EB" strokeWidth="0.8" strokeDasharray="4 3" />
              <text x={padL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9CA3AF">{fmtCA(v)}</text>
            </g>
          )
        })}

        {/* Zone sous la courbe */}
        <path d={areaD} fill="url(#gCA)" />

        {/* Courbe */}
        <path d={pathD} fill="none" stroke="#2563EB" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points + zones hover */}
        {points.map((p, i) => (
          <g key={i}
            onMouseEnter={() => setTooltip({ x: p.x, y: p.y, d: p.d })}
            onTouchStart={() => setTooltip({ x: p.x, y: p.y, d: p.d })}
          >
            {/* Zone cliquable invisible */}
            <rect x={p.x - 20} y={padT} width={40} height={innerH} fill="transparent" />
            {/* Point */}
            <circle cx={p.x} cy={p.y} r="5" fill="#2563EB" stroke="white" strokeWidth="2.5" />
            {/* Label mois */}
            <text x={p.x} y={H - 6} textAnchor="middle" fontSize="10" fill="#9CA3AF">{p.d.mois}</text>
          </g>
        ))}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-gray-900 text-white text-xs rounded-xl px-3 py-2 shadow-xl"
          style={{
            left: `${(tooltip.x / W) * 100}%`,
            top: `${(tooltip.y / H) * 100}%`,
            transform: 'translate(-50%, -115%)',
            minWidth: 130,
          }}
        >
          <p className="font-semibold text-blue-300 mb-1">{tooltip.d.mois}</p>
          <p className="text-gray-200">{new Intl.NumberFormat('fr-FR').format(tooltip.d.ca)} FCFA</p>
          <p className="text-gray-400">{tooltip.d.ventes} vente{tooltip.d.ventes > 1 ? 's' : ''}</p>
        </div>
      )}
    </div>
  )
}

export default function DashboardPage() {
  const { eid } = useEntreprise()
  const { formatMontant } = useDevise()
  const [stats, setStats] = useState<StatsDashboard | null>(null)
  const [loading, setLoading] = useState(true)
  const [periode, setPeriode] = useState<Periode>('mois')
  const [alertesStock, setAlertesStock] = useState<{ nom: string; quantite: number; stock_minimum: number }[]>([])
  const [ventesRecentes, setVentesRecentes] = useState<Record<string, unknown>[]>([])
  const [dateDebutPerso, setDateDebutPerso] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [dateFinPerso, setDateFinPerso] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [entreprise, setEntreprise] = useState<InfosEntreprise>({ nom_entreprise: 'ChezMoi', telephone: '', adresse: '', devise: 'FCFA' })
  const [exportLoading, setExportLoading] = useState(false)
  const [donneesGraphique, setDonneesGraphique] = useState<{ mois: string; ca: number; ventes: number }[]>([])
  const { nbEnAttente: nbCommandesEnAttente } = useCommandes()

  useEffect(() => {
    if (!eid) return
    chargerStats()
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'articles', filter: `entreprise_id=eq.${eid}` }, () => chargerStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ventes', filter: `entreprise_id=eq.${eid}` }, () => chargerStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'clients', filter: `entreprise_id=eq.${eid}` }, () => chargerStats())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [eid])

  async function chargerStats() {
    if (!eid) return
    setLoading(true)
    try {
      const now = new Date()
      const debutJour = startOfDay(now).toISOString()
      const debutSemaine = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
      const debutMois = startOfMonth(now).toISOString()
      const debutAnnee = startOfYear(now).toISOString()

      const [ventesRes, articlesRes, clientsRes, stockRes, parametresRes] = await Promise.all([
        supabase.from('ventes').select('total, created_at, remise').eq('statut', 'validee').eq('entreprise_id', eid),
        supabase.from('articles').select('quantite, prix_achat, cout_unitaire, prix_vente, stock_minimum, nom').eq('actif', true).eq('entreprise_id', eid),
        supabase.from('clients').select('id', { count: 'exact', head: true }).eq('entreprise_id', eid),
        supabase.from('articles').select('nom, quantite, stock_minimum').eq('actif', true).eq('entreprise_id', eid),
        supabase.from('parametres').select('*').eq('entreprise_id', eid)
      ])

      if (parametresRes.data) {
        const params = Object.fromEntries(parametresRes.data.map(d => [d.cle, d.valeur || '']))
        setEntreprise({ nom_entreprise: params.nom_entreprise || 'ChezMoi', telephone: params.telephone || '', adresse: params.adresse || '', devise: params.devise || 'FCFA' })
      }

      const ventes = ventesRes.data || []
      const articles = articlesRes.data || []
      const filtrer = (depuis: string) => ventes.filter(v => v.created_at >= depuis)
      const ca = (liste: typeof ventes) => liste.reduce((s, v) => s + (v.total || 0), 0)
      const valeurStock = articles.reduce((s, a) => s + (a.quantite * (a.cout_unitaire || 0)), 0)
      const alertes = (stockRes.data || []).filter(a => a.quantite <= a.stock_minimum)

      setStats({
        ca_jour: ca(filtrer(debutJour)),
        ca_semaine: ca(filtrer(debutSemaine)),
        ca_mois: ca(filtrer(debutMois)),
        ca_annee: ca(filtrer(debutAnnee)),
        nb_ventes_jour: filtrer(debutJour).length,
        nb_ventes_mois: filtrer(debutMois).length,
        nb_clients: clientsRes.count || 0,
        nb_articles: articles.length,
        valeur_stock: valeurStock,
        benefice_mois: ca(filtrer(debutMois)) * 0.2
      })

      setAlertesStock(alertes.slice(0, 5))

      const { data: recentes } = await supabase
        .from('ventes').select('*, clients(nom)').eq('entreprise_id', eid)
        .order('created_at', { ascending: false }).limit(5)
      setVentesRecentes(recentes || [])

      // Graphique : CA et nombre de ventes des 6 derniers mois
      const nowGraph = new Date()
      const debut6Mois = startOfDay(subMonths(startOfMonth(nowGraph), 5))
      const { data: ventesGraphique } = await supabase
        .from('ventes').select('total, created_at')
        .eq('statut', 'validee').eq('entreprise_id', eid)
        .gte('created_at', debut6Mois.toISOString())

      const mois6 = eachMonthOfInterval({ start: debut6Mois, end: nowGraph })
      const donnees = mois6.map(moisDate => {
        const label = format(moisDate, 'MMM yy', { locale: fr })
        const debutM = startOfMonth(moisDate).toISOString()
        const finM = endOfMonth(moisDate).toISOString()
        const ventesM = (ventesGraphique || []).filter((v: { total: number; created_at: string }) => v.created_at >= debutM && v.created_at <= finM)
        return {
          mois: label.charAt(0).toUpperCase() + label.slice(1),
          ca: Math.round(ventesM.reduce((s, v) => s + (v.total || 0), 0)),
          ventes: ventesM.length
        }
      })
      setDonneesGraphique(donnees)
    } catch (e) { console.error(e) }
    setLoading(false)
  }

  const getPlagePeriode = (): { debut: Date; fin: Date; label: string } => {
    const now = new Date()
    switch (periode) {
      case 'jour': return { debut: startOfDay(now), fin: endOfDay(now), label: `Aujourd'hui — ${format(now, 'dd/MM/yyyy', { locale: fr })}` }
      case 'semaine': return { debut: startOfWeek(now, { weekStartsOn: 1 }), fin: endOfWeek(now, { weekStartsOn: 1 }), label: `Cette semaine — du ${format(startOfWeek(now, { weekStartsOn: 1 }), 'dd/MM/yyyy')} au ${format(endOfWeek(now, { weekStartsOn: 1 }), 'dd/MM/yyyy')}` }
      case 'mois': return { debut: startOfMonth(now), fin: endOfMonth(now), label: `Ce mois — ${format(now, 'MMMM yyyy', { locale: fr })}` }
      case 'annee': return { debut: startOfYear(now), fin: endOfYear(now), label: `Cette année — ${format(now, 'yyyy')}` }
      case 'personnalisee': {
        const debut = startOfDay(new Date(dateDebutPerso))
        const fin = endOfDay(new Date(dateFinPerso))
        return { debut, fin, label: dateDebutPerso === dateFinPerso ? `Le ${format(debut, 'dd/MM/yyyy')}` : `Du ${format(debut, 'dd/MM/yyyy')} au ${format(fin, 'dd/MM/yyyy')}` }
      }
      default: return { debut: startOfDay(now), fin: endOfDay(now), label: format(now, 'dd/MM/yyyy') }
    }
  }

  const exporterPDF = async () => {
    if (!eid) return
    setExportLoading(true)
    try {
      const { debut, fin, label } = getPlagePeriode()
      const { data: ventesPeriode } = await supabase
        .from('ventes').select('numero, total, statut, created_at, clients(nom)')
        .eq('entreprise_id', eid).gte('created_at', debut.toISOString()).lte('created_at', fin.toISOString())
        .order('created_at', { ascending: true })
      const ventesValidees = (ventesPeriode || []).filter(v => v.statut === 'validee')
      const ca = ventesValidees.reduce((s, v) => s + (v.total || 0), 0)
      telechargerRapportPDF({
        periodeLabel: label, genereLe: new Date(), ca, benefice: ca * 0.2,
        nbVentes: ventesValidees.length, nbClients: stats?.nb_clients || 0,
        nbArticles: stats?.nb_articles || 0, valeurStock: stats?.valeur_stock || 0,
        ventes: (ventesPeriode || []).map(v => ({
          numero: v.numero,
          client: (Array.isArray(v.clients) ? v.clients[0]?.nom : (v.clients as { nom: string } | null)?.nom) || 'Anonyme',
          total: v.total, statut: v.statut, heure: format(new Date(v.created_at), 'HH:mm')
        })),
        alertesStock: alertesStock.map(a => ({ nom: a.nom, quantite: a.quantite, stockMinimum: a.stock_minimum })),
        entreprise
      })
      toast.success('Rapport PDF généré !')
    } catch (e) { console.error(e); toast.error('Erreur lors de la génération') }
    setExportLoading(false)
  }

  const getCaParPeriode = () => {
    if (!stats) return 0
    if (periode === 'personnalisee') return stats.ca_mois
    return { jour: stats.ca_jour, semaine: stats.ca_semaine, mois: stats.ca_mois, annee: stats.ca_annee }[periode]
  }

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Tableau de bord</h1>
          <p className="text-sm text-gray-500">{format(new Date(), "EEEE d MMMM yyyy", { locale: fr })}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex gap-2 flex-wrap justify-end">
            {(['jour', 'semaine', 'mois', 'annee'] as Periode[]).map(p => (
              <button key={p} onClick={() => setPeriode(p)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${periode === p ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300 text-gray-600 border border-gray-200 dark:border-gray-700 hover:bg-gray-50'}`}>
                {p === 'jour' ? "Aujourd'hui" : p === 'semaine' ? 'Semaine' : p === 'mois' ? 'Mois' : 'Année'}
              </button>
            ))}
            <button onClick={() => setPeriode('personnalisee')} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1 ${periode === 'personnalisee' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-800 dark:text-gray-300 text-gray-600 border border-gray-200 dark:border-gray-700'}`}>
              <Calendar size={12} /> Personnalisée
            </button>
            <button onClick={exporterPDF} disabled={exportLoading} className="btn-primary px-3 py-1.5 text-xs">
              {exportLoading ? <div className="animate-spin rounded-full h-3.5 w-3.5 border-b-2 border-white" /> : <FileDown size={14} />}
              Exporter PDF
            </button>
          </div>
          {periode === 'personnalisee' && (
            <div className="flex items-center gap-2 text-xs">
              <input type="date" value={dateDebutPerso} onChange={e => setDateDebutPerso(e.target.value)} className="input-field py-1 text-xs" />
              <span className="text-gray-400">au</span>
              <input type="date" value={dateFinPerso} onChange={e => setDateFinPerso(e.target.value)} className="input-field py-1 text-xs" min={dateDebutPerso} />
            </div>
          )}
        </div>
      </div>

      <div className={`grid grid-cols-2 gap-4 ${nbCommandesEnAttente > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'}`}>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Chiffre d'affaires</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatMontant(getCaParPeriode())}</p>
            </div>
            <div className="w-9 h-9 bg-blue-50 rounded-lg flex items-center justify-center"><Wallet size={18} className="text-blue-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{periode === 'jour' ? "Aujourd'hui" : periode === 'semaine' ? 'Cette semaine' : periode === 'mois' ? 'Ce mois' : periode === 'annee' ? 'Cette année' : 'Ce mois (référence)'}</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Bénéfice estimé</p>
              <p className="text-xl font-bold text-emerald-600 mt-1">{formatMontant(stats?.benefice_mois || 0)}</p>
            </div>
            <div className="w-9 h-9 bg-emerald-50 rounded-lg flex items-center justify-center"><TrendingUp size={18} className="text-emerald-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">Ce mois</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ventes du jour</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{stats?.nb_ventes_jour || 0}</p>
            </div>
            <div className="w-9 h-9 bg-amber-50 rounded-lg flex items-center justify-center"><ShoppingCart size={18} className="text-amber-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats?.nb_ventes_mois || 0} ce mois</p>
        </div>
        <div className="card p-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Valeur stock</p>
              <p className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-1">{formatMontant(stats?.valeur_stock || 0)}</p>
            </div>
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center"><Package size={18} className="text-purple-600" /></div>
          </div>
          <p className="text-xs text-gray-400 mt-2">{stats?.nb_articles || 0} articles actifs</p>
        </div>
        {nbCommandesEnAttente > 0 && (
          <div className="card p-4 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-amber-600 font-medium uppercase tracking-wide">Commandes en attente</p>
                <p className="text-xl font-bold text-amber-700 dark:text-amber-400 mt-1">{nbCommandesEnAttente}</p>
              </div>
              <div className="w-9 h-9 bg-amber-100 dark:bg-amber-900/40 rounded-lg flex items-center justify-center">
                <ShoppingBag size={18} className="text-amber-600" />
              </div>
            </div>
            <a href="/commandes" className="text-xs text-amber-600 hover:text-amber-700 mt-2 block">Voir les commandes →</a>
          </div>
        )}
      </div>

      {/* Graphique évolution 6 mois — SVG natif */}
      <div className="card p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Évolution du chiffre d'affaires</h2>
            <p className="text-xs text-gray-400 mt-0.5">6 derniers mois</p>
          </div>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="w-3 h-0.5 bg-blue-500 inline-block rounded"></span>CA mensuel
          </span>
        </div>
        <GraphiqueCA donnees={donneesGraphique} />
        <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
          {donneesGraphique.slice(-3).map((d, i) => (
            <div key={i} className="text-center">
              <p className="text-xs text-gray-400">{d.mois}</p>
              <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mt-0.5">
                {d.ca >= 1000000 ? `${(d.ca/1000000).toFixed(1)}M` : d.ca >= 1000 ? `${(d.ca/1000).toFixed(0)}k` : d.ca} FCFA
              </p>
              <p className="text-xs text-gray-400">{d.ventes} vente{d.ventes > 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Dernières ventes</h2>
            <BarChart3 size={16} className="text-gray-400" />
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {ventesRecentes.length === 0 ? (
              <p className="p-4 text-sm text-gray-400 text-center">Aucune vente enregistrée</p>
            ) : ventesRecentes.map((v) => (
              <div key={v.id as string} className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{(v.clients as Record<string, unknown>)?.nom as string || 'Client anonyme'}</p>
                  <p className="text-xs text-gray-400">{v.numero as string} · {format(new Date(v.created_at as string), 'dd/MM HH:mm')}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{formatMontant(v.total as number)}</p>
                  <span className={v.statut === 'validee' ? 'badge-green' : v.statut === 'annulee' ? 'badge-red' : 'badge-amber'}>
                    {v.statut === 'validee' ? 'Validée' : v.statut === 'annulee' ? 'Annulée' : 'En attente'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="card">
          <div className="p-4 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
            <h2 className="font-medium text-gray-900 dark:text-gray-100 text-sm">Alertes stock faible</h2>
            {alertesStock.length > 0 && <span className="badge-red">{alertesStock.length} alerte{alertesStock.length > 1 ? 's' : ''}</span>}
          </div>
          <div className="divide-y divide-gray-50 dark:divide-gray-700">
            {alertesStock.length === 0 ? (
              <div className="p-6 text-center"><Package size={24} className="text-gray-300 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucune alerte de stock</p></div>
            ) : alertesStock.map((a, i) => (
              <div key={i} className="p-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.quantite === 0 ? 'bg-red-50' : 'bg-amber-50'}`}>
                  <AlertTriangle size={15} className={a.quantite === 0 ? 'text-red-500' : 'text-amber-500'} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.nom}</p>
                  <p className="text-xs text-gray-400">Stock min : {a.stock_minimum}</p>
                </div>
                <span className={a.quantite === 0 ? 'badge-red' : 'badge-amber'}>{a.quantite === 0 ? 'Rupture' : `${a.quantite} unités`}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
