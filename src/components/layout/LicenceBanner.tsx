import { useLicence } from '../../lib/licence'
import { AlertTriangle, Clock, XCircle, Ban } from 'lucide-react'
import { useState } from 'react'

const LABELS_TYPE: Record<string, string> = {
  essai: 'Essai gratuit',
  mensuelle: 'Licence mensuelle',
  semestrielle: 'Licence semestrielle',
  annuelle: 'Licence annuelle',
  a_vie: 'Licence à vie'
}

export default function LicenceBanner() {
  const { licence, loading } = useLicence()
  const [masquee, setMasquee] = useState(false)

  if (loading || !licence || masquee) return null
  if (licence.statut === 'introuvable') return null

  // Licence à vie ou active avec plus de 7 jours restants : pas de bannière
  if (licence.statut === 'active' && (licence.date_fin === null || licence.jours_restants > 7)) return null

  let config: { bg: string; text: string; icon: typeof AlertTriangle; message: string; fermable: boolean } | null = null

  if (licence.statut === 'essai') {
    if (licence.jours_restants <= 0) {
      config = {
        bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
        text: 'text-red-700 dark:text-red-300',
        icon: XCircle,
        message: "Votre période d'essai gratuit est terminée. Les nouvelles ventes et entrées de stock sont bloquées. Contactez-nous pour souscrire à une licence.",
        fermable: false
      }
    } else if (licence.jours_restants <= 3) {
      config = {
        bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
        text: 'text-amber-700 dark:text-amber-300',
        icon: AlertTriangle,
        message: `Votre essai gratuit expire dans ${licence.jours_restants} jour${licence.jours_restants > 1 ? 's' : ''}. Pensez à souscrire à une licence pour continuer sans interruption.`,
        fermable: true
      }
    } else if (licence.jours_restants <= 7) {
      config = {
        bg: 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800',
        text: 'text-blue-700 dark:text-blue-300',
        icon: Clock,
        message: `Votre essai gratuit expire dans ${licence.jours_restants} jours.`,
        fermable: true
      }
    }
  } else if (licence.statut === 'active' && licence.jours_restants <= 7) {
    config = {
      bg: 'bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800',
      text: 'text-amber-700 dark:text-amber-300',
      icon: AlertTriangle,
      message: `Votre licence (${LABELS_TYPE[licence.type_licence || ''] || ''}) expire dans ${licence.jours_restants} jour${licence.jours_restants > 1 ? 's' : ''}. Renouvelez-la pour éviter toute interruption.`,
      fermable: true
    }
  } else if (licence.statut === 'expiree') {
    config = {
      bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: XCircle,
      message: 'Votre licence a expiré. Consultation des données autorisée, mais les nouvelles ventes et entrées de stock sont bloquées. Contactez-nous pour renouveler.',
      fermable: false
    }
  } else if (licence.statut === 'suspendue') {
    config = {
      bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: Ban,
      message: 'Votre compte a été suspendu. Contactez le support pour plus d\'informations.',
      fermable: false
    }
  } else if (licence.statut === 'resiliee') {
    config = {
      bg: 'bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800',
      text: 'text-red-700 dark:text-red-300',
      icon: Ban,
      message: 'Votre licence a été résiliée. Contactez le support pour réactiver votre compte.',
      fermable: false
    }
  }

  if (!config) return null
  const Icon = config.icon

  return (
    <div className={`flex items-center gap-2 px-4 py-2 border-b text-xs ${config.bg} ${config.text}`}>
      <Icon size={14} className="flex-shrink-0" />
      <p className="flex-1">{config.message}</p>
      {config.fermable && (
        <button onClick={() => setMasquee(true)} className="text-current opacity-60 hover:opacity-100 transition-opacity">
          ✕
        </button>
      )}
    </div>
  )
}
