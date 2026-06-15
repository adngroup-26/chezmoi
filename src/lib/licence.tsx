import { logger } from '../lib/logger'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from './auth'

export interface InfosLicence {
  statut: 'essai' | 'active' | 'expiree' | 'suspendue' | 'resiliee' | 'introuvable'
  type_licence: string | null
  date_fin: string | null
  jours_restants: number
  max_utilisateurs: number
  nb_utilisateurs_actuels: number
}

interface LicenceContextType {
  licence: InfosLicence | null
  loading: boolean
  recharger: () => Promise<void>
  // Indique si les actions d'écriture (ventes, stock) doivent être bloquées
  ecritureBloquee: boolean
}

const LicenceContext = createContext<LicenceContextType | null>(null)

const CACHE_KEY = 'chezmoi_licence_cache'
const CACHE_DATE_KEY = 'chezmoi_licence_cache_date'
const DUREE_GRACE_HORS_LIGNE_JOURS = 30

export function LicenceProvider({ children }: { children: ReactNode }) {
  const { utilisateur } = useAuth()
  // Cast défensif : entreprise_id peut être absent du type Utilisateur selon la version
  // du fichier types/index.ts déployée, mais la colonne existe en base (select '*').
  const entrepriseId = (utilisateur as unknown as { entreprise_id?: string } | null)?.entreprise_id
  const [licence, setLicence] = useState<InfosLicence | null>(null)
  const [loading, setLoading] = useState(true)

  const recharger = async () => {
    if (!entrepriseId) {
      setLoading(false)
      return
    }

    try {
      const { data, error } = await supabase
        .rpc('verifier_licence', { p_entreprise_id: entrepriseId })

      if (error || !data || data.length === 0) throw error || new Error('Pas de licence')

      const infos = data[0] as InfosLicence
      setLicence(infos)
      localStorage.setItem(CACHE_KEY, JSON.stringify(infos))
      localStorage.setItem(CACHE_DATE_KEY, new Date().toISOString())
    } catch (e) {
      logger.error('[LICENCE] Erreur de vérification, utilisation du cache:', e)
      const cache = localStorage.getItem(CACHE_KEY)
      if (cache) {
        try { setLicence(JSON.parse(cache)) } catch { /* ignore */ }
      }
    }
    setLoading(false)
  }

  useEffect(() => {
    recharger()
    // Revérifie périodiquement (toutes les heures) pour détecter changement de statut admin
    const interval = setInterval(recharger, 60 * 60 * 1000)
    return () => clearInterval(interval)
  }, [entrepriseId])

  // Calcule si l'écriture doit être bloquée :
  // - licence expirée/suspendue/résiliée → bloqué
  // - SAUF si on est dans la période de grâce hors ligne de 30 jours depuis la dernière vérification réussie
  const calculerEcritureBloquee = (): boolean => {
    if (!licence) return false
    if (licence.statut === 'essai' || licence.statut === 'active') return false

    // Licence non valide : vérifie si on est encore dans la période de grâce hors ligne
    const derniereVerif = localStorage.getItem(CACHE_DATE_KEY)
    if (derniereVerif) {
      const joursDepuisVerif = (Date.now() - new Date(derniereVerif).getTime()) / (1000 * 60 * 60 * 24)
      if (joursDepuisVerif < DUREE_GRACE_HORS_LIGNE_JOURS && !navigator.onLine) {
        return false // grâce hors ligne accordée
      }
    }

    return true
  }

  return (
    <LicenceContext.Provider value={{ licence, loading, recharger, ecritureBloquee: calculerEcritureBloquee() }}>
      {children}
    </LicenceContext.Provider>
  )
}

export function useLicence() {
  const ctx = useContext(LicenceContext)
  if (!ctx) throw new Error('useLicence must be used within LicenceProvider')
  return ctx
}
