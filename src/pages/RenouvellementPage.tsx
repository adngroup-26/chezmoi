import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useLicence } from '../lib/licence'
import { useEntreprise } from '../lib/entreprise'
import { useAuth } from '../lib/auth'
import { CheckCircle, Clock, Star, Infinity, MessageCircle, Copy, Phone } from 'lucide-react'
import toast from 'react-hot-toast'

// ⚠️ CONFIGURER ICI : numéro WhatsApp et Mobile Money du propriétaire de ChezMoi Pro
const CONFIG_PAIEMENT = {
  whatsapp: '2250711154074',      // Numéro WhatsApp avec indicatif (sans +)
  mobile_money: '0711154074',     // Numéro Mobile Money à créditer
  operateur: 'Orange Money / Wave',
  nom_beneficiaire: 'AnangoDuNet by ChezMoi',
}

interface Offre {
  id: string
  label: string
  prix: number
  duree: string
  maxUsers: number
  avantages: string[]
  populaire?: boolean
}

const OFFRES: Offre[] = [
  {
    id: 'mensuelle',
    label: 'Mensuelle',
    prix: 4500,
    duree: '1 mois',
    maxUsers: 3,
    avantages: ['Toutes les fonctionnalités', "Jusqu'à 3 utilisateurs", 'Mises à jour incluses', 'Support standard'],
  },
  {
    id: 'semestrielle',
    label: 'Semestrielle',
    prix: 25500,
    duree: '6 mois',
    maxUsers: 5,
    populaire: true,
    avantages: ['Toutes les fonctionnalités', "Jusqu'à 5 utilisateurs", 'Mises à jour incluses', 'Support prioritaire', 'Économie vs mensuel'],
  },
  {
    id: 'annuelle',
    label: 'Annuelle',
    prix: 50000,
    duree: '1 an',
    maxUsers: 10,
    avantages: ['Toutes les fonctionnalités', "Jusqu'à 10 utilisateurs", 'Support prioritaire', 'Accès anticipé aux nouveautés', 'Meilleur rapport qualité/prix'],
  },
  {
    id: 'a_vie',
    label: 'À vie',
    prix: 150000,
    duree: 'Illimitée',
    maxUsers: 15,
    avantages: ['Utilisation illimitée', "Jusqu'à 15 utilisateurs", 'Toutes les fonctionnalités', 'Mises à jour mineures incluses', '12 mois de support inclus'],
  },
]

function formatMontant(n: number) {
  return new Intl.NumberFormat('fr-FR').format(n) + ' FCFA'
}

export default function RenouvellementPage() {
  const { licence } = useLicence()
  const { eid } = useEntreprise()
  const { utilisateur } = useAuth()
  const [offreSelectionnee, setOffreSelectionnee] = useState<Offre | null>(null)
  const [etape, setEtape] = useState<'offres' | 'paiement'>('offres')
  const [reference, setReference] = useState('')
  const [nomEntreprise, setNomEntreprise] = useState('')

  useEffect(() => {
    if (eid) {
      supabase.from('entreprises').select('nom').eq('id', eid).single()
        .then(({ data }) => { if (data) setNomEntreprise(data.nom) })
    }
  }, [eid])

  // Génère la référence quand l'offre est sélectionnée :
  // format CM-[3 lettres entreprise]-[code offre]-[timestamp court]
  // Ex: CM-ANG-MEN-36417 → traçable et unique par entreprise et par offre
  const genererReference = (offre: Offre) => {
    const prefixEntreprise = nomEntreprise.replace(/[^a-zA-Z]/g, '').toUpperCase().slice(0, 3) || 'ENT'
    const codeOffre = { mensuelle: 'MEN', semestrielle: 'SEM', annuelle: 'ANN', a_vie: 'AVE' }[offre.id] || offre.id.toUpperCase().slice(0, 3)
    const suffixe = Date.now().toString().slice(-5)
    return `CM-${prefixEntreprise}-${codeOffre}-${suffixe}`
  }

  const choisirOffre = (offre: Offre) => {
    setOffreSelectionnee(offre)
    setReference(genererReference(offre))
    setEtape('paiement')
  }

  const copier = (texte: string, label: string) => {
    navigator.clipboard.writeText(texte)
    toast.success(`${label} copié !`)
  }

  const envoyerWhatsApp = () => {
    if (!offreSelectionnee) return
    const message = encodeURIComponent(
      `Bonjour,\n\nJe souhaite renouveler ma licence ChezMoi Pro.\n\n` +
      `📋 *Détails du paiement :*\n` +
      `• Entreprise : ${nomEntreprise}\n` +
      `• Offre choisie : ${offreSelectionnee.label} (${offreSelectionnee.duree})\n` +
      `• Montant : ${formatMontant(offreSelectionnee.prix)}\n` +
      `• Référence : ${reference}\n` +
      `• Téléphone compte : ${utilisateur?.telephone || ''}\n\n` +
      `Ci-joint mon reçu de paiement Mobile Money.\n\nMerci !`
    )
    window.open(`https://wa.me/${CONFIG_PAIEMENT.whatsapp}?text=${message}`, '_blank')
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Renouveler ma licence</h1>
        <p className="text-sm text-gray-500 mt-1">Choisissez votre offre et suivez les instructions de paiement.</p>
      </div>

      {/* Statut actuel */}
      {licence && (
        <div className={`card p-4 flex items-center gap-3 ${
          licence.statut === 'expiree' ? 'border-red-200 bg-red-50 dark:bg-red-900/20' :
          licence.statut === 'essai' ? 'border-blue-200 bg-blue-50 dark:bg-blue-900/20' :
          'border-emerald-200 bg-emerald-50 dark:bg-emerald-900/20'
        }`}>
          <Clock size={18} className="text-gray-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
              {licence.statut === 'expiree' ? 'Votre licence a expiré.' :
               licence.statut === 'essai' ? `Essai gratuit — ${licence.jours_restants} jour(s) restant(s).` :
               `Licence active — ${licence.jours_restants > 999 ? 'à vie' : `${licence.jours_restants} jour(s) restant(s)`}.`}
            </p>
            <p className="text-xs text-gray-500">Souscrivez à une offre pour continuer à utiliser toutes les fonctionnalités.</p>
          </div>
        </div>
      )}

      {etape === 'offres' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {OFFRES.map(offre => (
            <div
              key={offre.id}
              className={`card p-5 flex flex-col cursor-pointer hover:shadow-lg transition-all relative ${
                offre.populaire ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-400' : ''
              }`}
              onClick={() => choisirOffre(offre)}
            >
              {offre.populaire && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1">
                    <Star size={11} /> Populaire
                  </span>
                </div>
              )}
              <div className="mb-4">
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">{offre.label}</h3>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold text-blue-600">{formatMontant(offre.prix)}</span>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">
                  {offre.id === 'a_vie' ? <span className="flex items-center gap-1"><Infinity size={12} /> Paiement unique</span> : `/ ${offre.duree}`}
                </p>
              </div>
              <ul className="space-y-2 flex-1 mb-4">
                {offre.avantages.map(a => (
                  <li key={a} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-300">
                    <CheckCircle size={13} className="text-emerald-500 mt-0.5 flex-shrink-0" /> {a}
                  </li>
                ))}
              </ul>
              <button className={`w-full py-2 rounded-lg text-sm font-medium transition-colors ${
                offre.populaire
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200'
              }`}>
                Choisir cette offre
              </button>
            </div>
          ))}
        </div>
      )}

      {etape === 'paiement' && offreSelectionnee && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Récapitulatif commande */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Récapitulatif</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-gray-500">Entreprise</span><span className="font-medium dark:text-gray-200">{nomEntreprise}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Offre</span><span className="font-medium dark:text-gray-200">{offreSelectionnee.label} ({offreSelectionnee.duree})</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Utilisateurs max</span><span className="font-medium dark:text-gray-200">{offreSelectionnee.maxUsers}</span></div>
              <div className="border-t border-gray-100 dark:border-gray-700 pt-3 flex justify-between items-center">
                <span className="font-semibold text-gray-900 dark:text-gray-100">Total</span>
                <span className="text-xl font-bold text-blue-600">{formatMontant(offreSelectionnee.prix)}</span>
              </div>
            </div>
            <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
              <p className="text-xs text-gray-500 mb-1">Votre référence de paiement</p>
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-gray-900 dark:text-gray-100 text-lg">{reference}</span>
                <button onClick={() => copier(reference, 'Référence')} className="p-1.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg text-gray-500">
                  <Copy size={14} />
                </button>
              </div>
              <p className="text-xs text-red-500 mt-1">⚠️ Mentionnez cette référence lors du paiement</p>
            </div>
            <button onClick={() => setEtape('offres')} className="mt-4 text-xs text-gray-400 hover:text-gray-600 underline">
              ← Changer d'offre
            </button>
          </div>

          {/* Instructions de paiement */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 dark:text-gray-100 mb-4">Instructions de paiement</h2>

            <div className="space-y-4">
              <div className="flex gap-3">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">1</div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Effectuez le paiement Mobile Money</p>
                  <p className="text-xs text-gray-500 mt-1">Envoyez {formatMontant(offreSelectionnee.prix)} au numéro :</p>
                  <div className="flex items-center gap-2 mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                    <Phone size={14} className="text-gray-500" />
                    <span className="font-mono font-bold text-gray-900 dark:text-gray-100">{CONFIG_PAIEMENT.mobile_money}</span>
                    <button onClick={() => copier(CONFIG_PAIEMENT.mobile_money, 'Numéro')} className="ml-auto p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-gray-500">
                      <Copy size={12} />
                    </button>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Bénéficiaire : {CONFIG_PAIEMENT.nom_beneficiaire}</p>
                  <p className="text-xs text-gray-400">Accepté : {CONFIG_PAIEMENT.operateur}</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 bg-blue-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">2</div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Notez la référence dans le motif</p>
                  <p className="text-xs text-gray-500 mt-1">Lors du transfert, indiquez la référence <span className="font-mono font-bold text-gray-800 dark:text-gray-200">{reference}</span> dans le champ "motif" ou "commentaire".</p>
                </div>
              </div>

              <div className="flex gap-3">
                <div className="w-7 h-7 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">3</div>
                <div>
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Envoyez le reçu par WhatsApp</p>
                  <p className="text-xs text-gray-500 mt-1">Prenez une capture d'écran de votre reçu et envoyez-la via WhatsApp. Votre licence sera activée sous 24h ouvrées.</p>
                  <button
                    onClick={envoyerWhatsApp}
                    className="mt-3 w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
                  >
                    <MessageCircle size={18} />
                    Envoyer le reçu par WhatsApp
                  </button>
                  <p className="text-xs text-gray-400 text-center mt-1">Ce bouton pré-remplit le message avec vos informations</p>
                </div>
              </div>
            </div>

            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Après validation</strong> : votre licence sera activée manuellement par notre équipe dans les 24 heures suivant la réception de votre reçu.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
