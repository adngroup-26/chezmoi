import { logger } from './logger'
import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'
import { Utilisateur, Role } from '../types'

interface AuthContextType {
  utilisateur: Utilisateur | null
  loading: boolean
  connexion: (telephone: string, motDePasse: string) => Promise<{ error?: string }>
  deconnexion: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

async function normaliserUtilisateur(data: Record<string, unknown>): Promise<Utilisateur> {
  let roles = data.roles as Role | Role[] | null
  if (Array.isArray(roles)) roles = roles.length > 0 ? roles[0] : null

  if (!roles && data.role_id) {
    const { data: roleData } = await supabase
      .from('roles').select('*').eq('id', data.role_id as string).single()
    roles = roleData || null
  }

  return { ...(data as unknown as Utilisateur), roles: (roles as Role) || undefined }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Restaure la session depuis localStorage au démarrage
    try {
      const stored = localStorage.getItem('chezmoi_user')
      if (stored) {
        const u = JSON.parse(stored)
        setUtilisateur(u)
        // Vérifie en arrière-plan que le compte est toujours actif
        supabase.from('utilisateurs').select('*, roles(*)')
          .eq('id', u.id).eq('actif', true).single()
          .then(async ({ data }) => {
            if (data) {
              const userNormalise = await normaliserUtilisateur(data)
              const userPourStorage = {
                id: userNormalise.id, nom: userNormalise.nom,
                telephone: userNormalise.telephone, role_id: userNormalise.role_id,
                actif: userNormalise.actif, roles: userNormalise.roles,
                entreprise_id: (userNormalise as unknown as { entreprise_id?: string }).entreprise_id,
                created_at: userNormalise.created_at,
              }
              localStorage.setItem('chezmoi_user', JSON.stringify(userPourStorage))
              setUtilisateur(userNormalise)
            } else {
              localStorage.removeItem('chezmoi_user')
              setUtilisateur(null)
            }
            setLoading(false)
          })
      } else {
        setLoading(false)
      }
    } catch {
      localStorage.removeItem('chezmoi_user')
      setLoading(false)
    }
  }, [])

  const connexion = async (telephone: string, motDePasse: string) => {
    try {
      logger.log('[AUTH] Tentative connexion:', telephone)

      // 1. Vérifie le mot de passe bcrypt via RPC sécurisée
      const { data: ok, error: rpcError } = await supabase
        .rpc('verifier_mot_de_passe', {
          p_telephone: telephone,
          p_mot_de_passe: motDePasse
        })

      if (rpcError) {
        logger.error('[AUTH] Erreur RPC:', rpcError)
        return { error: 'Erreur de connexion. Vérifiez votre internet.' }
      }

      if (!ok) return { error: 'Numéro ou mot de passe incorrect.' }

      // 2. Charge les données utilisateur
      const { data, error } = await supabase
        .from('utilisateurs').select('*, roles(*)')
        .eq('telephone', telephone).eq('actif', true).single()

      if (error || !data) {
        logger.error('[AUTH] Utilisateur introuvable:', error)
        return { error: 'Compte introuvable ou désactivé.' }
      }

      // 3. Normalise et stocke en session
      const userNormalise = await normaliserUtilisateur(data)
      const userPourStorage = {
        id: userNormalise.id,
        nom: userNormalise.nom,
        telephone: userNormalise.telephone,
        role_id: userNormalise.role_id,
        actif: userNormalise.actif,
        roles: userNormalise.roles,
        entreprise_id: (userNormalise as unknown as { entreprise_id?: string }).entreprise_id,
        created_at: userNormalise.created_at,
      }
      localStorage.setItem('chezmoi_user', JSON.stringify(userPourStorage))
      setUtilisateur(userNormalise)

      // 4. Enregistre l'heure de connexion (sans bloquer)
      supabase.rpc('enregistrer_connexion', { p_telephone: telephone })
        .then(({ error: e }) => { if (e) logger.error('[AUTH] Erreur enregistrement connexion:', e) })

      return {}
    } catch (e) {
      logger.error('[AUTH] Exception:', e)
      return { error: 'Erreur de connexion. Vérifiez votre internet.' }
    }
  }

  const deconnexion = async () => {
    localStorage.removeItem('chezmoi_user')
    setUtilisateur(null)
  }

  const isAdmin = utilisateur?.roles?.nom === 'admin'

  return (
    <AuthContext.Provider value={{ utilisateur, loading, connexion, deconnexion, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
