import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { Utilisateur, Role } from '../types'

interface AuthContextType {
  utilisateur: Utilisateur | null
  loading: boolean
  connexion: (telephone: string, motDePasse: string) => Promise<{ error?: string }>
  deconnexion: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextType | null>(null)

// Normalise le champ "roles" : gère objet, tableau, ou null (si la jointure
// automatique de Supabase échoue car il manque la contrainte FK).
// Dans ce dernier cas, on recharge le rôle manuellement via role_id.
async function normaliserUtilisateur(data: Record<string, unknown>): Promise<Utilisateur> {
  let roles = data.roles as Role | Role[] | null

  if (Array.isArray(roles)) {
    roles = roles.length > 0 ? roles[0] : null
  }

  // Fallback : si la jointure n'a rien renvoyé mais qu'on a un role_id,
  // on va chercher le rôle directement dans la table roles.
  if (!roles && data.role_id) {
    console.log('[AUTH] Jointure roles(*) vide — chargement manuel via role_id:', data.role_id)
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('id', data.role_id as string)
      .single()

    if (roleError) {
      console.error('[AUTH] Erreur lors du chargement manuel du rôle:', roleError)
    } else {
      console.log('[AUTH] Rôle chargé manuellement:', roleData)
      roles = roleData
    }
  }

  return { ...(data as unknown as Utilisateur), roles: (roles as Role) || undefined }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem('chezmoi_user')
    if (saved) {
      try {
        const u = JSON.parse(saved)
        console.log('[AUTH] Utilisateur trouvé dans le localStorage:', u)

        supabase
          .from('utilisateurs')
          .select('*')
          .eq('id', u.id)
          .eq('actif', true)
          .single()
          .then(async ({ data, error }) => {
            if (error) {
              console.error('[AUTH] Erreur lors du rechargement utilisateur:', error)
            }
            if (data) {
              console.log('[AUTH] Données brutes reçues de Supabase:', data)
              const userNormalise = await normaliserUtilisateur(data)
              console.log('[AUTH] Utilisateur normalisé:', userNormalise)
              console.log('[AUTH] isAdmin calculé:', userNormalise.roles?.nom === 'admin')

              localStorage.setItem('chezmoi_user', JSON.stringify(userNormalise))
              setUtilisateur(userNormalise)
            } else {
              console.warn('[AUTH] Aucune donnée utilisateur retournée — déconnexion forcée')
              localStorage.removeItem('chezmoi_user')
            }
            setLoading(false)
          })
      } catch (e) {
        console.error('[AUTH] Erreur de parsing localStorage:', e)
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
  }, [])

  const connexion = async (telephone: string, motDePasse: string) => {
    try {
      console.log('[AUTH] Tentative de connexion pour le téléphone:', telephone)

      const { data: authData, error: authError } = await supabase
        .rpc('verifier_mot_de_passe', { p_telephone: telephone, p_mot_de_passe: motDePasse })

      if (authError || !authData) return { error: 'Téléphone ou mot de passe incorrect' }

      const { data, error } = await supabase
        .from('utilisateurs')
        .select('*')
        .eq('telephone', telephone)
        .eq('actif', true)
        .single()

      if (error || !data) {
        console.error('[AUTH] Erreur chargement utilisateur après connexion:', error)
        return { error: 'Utilisateur introuvable' }
      }

      console.log('[AUTH] Données brutes après connexion:', data)
      console.log('[AUTH] data.roles (brut):', data.roles)

      const userNormalise = await normaliserUtilisateur(data)
      console.log('[AUTH] Rôle final après normalisation:', userNormalise.roles)
      console.log('[AUTH] isAdmin sera:', userNormalise.roles?.nom === 'admin')

      localStorage.setItem('chezmoi_user', JSON.stringify(userNormalise))
      setUtilisateur(userNormalise)

      // Enregistre l'heure de connexion (pour le statut en ligne/hors ligne)
      supabase.rpc('enregistrer_connexion', { p_telephone: telephone }).then(({ error }) => {
        if (error) console.error('[AUTH] Erreur enregistrement connexion:', error)
      })

      return {}
    } catch (e) {
      console.error('[AUTH] Exception lors de la connexion:', e)
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
