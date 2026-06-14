import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'

interface SuperAdmin {
  id: string
  telephone: string
  nom: string
}

interface SuperAdminContextType {
  superAdmin: SuperAdmin | null
  loading: boolean
  connexion: (telephone: string, motDePasse: string) => Promise<{ error?: string }>
  deconnexion: () => Promise<void>
}

const SuperAdminContext = createContext<SuperAdminContextType | null>(null)

const STORAGE_KEY = 'chezmoi_super_admin' // clé totalement séparée de "chezmoi_user"

export function SuperAdminProvider({ children }: { children: ReactNode }) {
  const [superAdmin, setSuperAdmin] = useState<SuperAdmin | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try { setSuperAdmin(JSON.parse(saved)) } catch { /* ignore */ }
    }
    setLoading(false)
  }, [])

  const connexion = async (telephone: string, motDePasse: string) => {
    try {
      const { data: ok, error: rpcError } = await supabase
        .rpc('verifier_super_admin', { p_telephone: telephone, p_mot_de_passe: motDePasse })

      if (rpcError || !ok) return { error: 'Identifiants invalides' }

      const { data, error } = await supabase
        .from('super_admins')
        .select('id, telephone, nom')
        .eq('telephone', telephone)
        .eq('actif', true)
        .single()

      if (error || !data) return { error: 'Compte introuvable' }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      setSuperAdmin(data)
      return {}
    } catch {
      return { error: 'Erreur de connexion' }
    }
  }

  const deconnexion = async () => {
    localStorage.removeItem(STORAGE_KEY)
    setSuperAdmin(null)
  }

  return (
    <SuperAdminContext.Provider value={{ superAdmin, loading, connexion, deconnexion }}>
      {children}
    </SuperAdminContext.Provider>
  )
}

export function useSuperAdmin() {
  const ctx = useContext(SuperAdminContext)
  if (!ctx) throw new Error('useSuperAdmin must be used within SuperAdminProvider')
  return ctx
}
