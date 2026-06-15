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

async function chargerUtilisateur(authUserId: string): Promise<Utilisateur | null> {
  const { data, error } = await supabase
    .from('utilisateurs')
    .select('*, roles(*)')
    .eq('auth_user_id', authUserId)
    .eq('actif', true)
    .single()

  if (error || !data) {
    logger.error('[AUTH] Erreur chargement utilisateur:', error)
    return null
  }

  // Normalise le champ roles (objet ou tableau)
  let roles = data.roles as Role | Role[] | null
  if (Array.isArray(roles)) roles = roles.length > 0 ? roles[0] : null

  // Fallback manuel si jointure vide
  if (!roles && data.role_id) {
    const { data: roleData } = await supabase
      .from('roles').select('*').eq('id', data.role_id).single()
    roles = roleData || null
  }

  return { ...(data as unknown as Utilisateur), roles: (roles as Role) || undefined }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Récupère la session Supabase Auth au démarrage
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const u = await chargerUtilisateur(session.user.id)
        setUtilisateur(u)
      }
      setLoading(false)
    })

    // Écoute les changements de session (connexion / déconnexion)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        logger.log('[AUTH] Événement auth:', event)
        if (session?.user) {
          const u = await chargerUtilisateur(session.user.id)
          setUtilisateur(u)
        } else {
          setUtilisateur(null)
        }
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const connexion = async (telephone: string, motDePasse: string) => {
    try {
      // 1. Vérifie le mot de passe bcrypt via notre fonction SQL
      const { data: ok, error: rpcError } = await supabase
        .rpc('verifier_mot_de_passe', {
          p_telephone: telephone,
          p_mot_de_passe: motDePasse
        })

      if (rpcError || !ok) {
        return { error: 'Numéro ou mot de passe incorrect.' }
      }

      // 2. Récupère l'email interne du compte Supabase Auth
      const { data: userData, error: userError } = await supabase
        .from('utilisateurs')
        .select('auth_user_id, telephone')
        .eq('telephone', telephone)
        .eq('actif', true)
        .single()

      if (userError || !userData?.auth_user_id) {
        return { error: 'Compte introuvable.' }
      }

      const email = `${telephone}@chezmoi.internal`

      // 3. Connexion Supabase Auth avec l'email interne
      //    Le mot de passe Auth est synchronisé via la fonction SQL
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: motDePasse
      })

      if (signInError) {
        // Le mot de passe Auth n'est pas encore synchronisé avec bcrypt
        // → on synchronise maintenant via admin.updateUser
        const { error: syncError } = await supabase.rpc('sync_auth_password', {
          p_telephone: telephone,
          p_mot_de_passe: motDePasse
        })

        if (syncError) {
          logger.error('[AUTH] Erreur sync password:', syncError)
          return { error: 'Erreur de connexion. Contactez le support.' }
        }

        // Retente la connexion
        const { error: retryError } = await supabase.auth.signInWithPassword({
          email,
          password: motDePasse
        })

        if (retryError) {
          return { error: 'Erreur de connexion. Réessayez.' }
        }
      }

      // Enregistre l'heure de connexion
      supabase.rpc('enregistrer_connexion', { p_telephone: telephone })
        .then(({ error }) => { if (error) logger.error('[AUTH] Erreur enregistrement connexion:', error) })

      return {}
    } catch (e) {
      logger.error('[AUTH] Exception connexion:', e)
      return { error: 'Erreur de connexion. Vérifiez votre internet.' }
    }
  }

  const deconnexion = async () => {
    await supabase.auth.signOut()
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
