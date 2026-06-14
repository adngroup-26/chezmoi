import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'

interface CommandesContextType {
  nbEnAttente: number
  recharger: () => Promise<void>
}

const CommandesContext = createContext<CommandesContextType>({ nbEnAttente: 0, recharger: async () => {} })

export function CommandesProvider({ children, entrepriseId }: { children: ReactNode; entrepriseId?: string }) {
  const [nbEnAttente, setNbEnAttente] = useState(0)

  const recharger = async () => {
    if (!entrepriseId) return
    const { count } = await supabase
      .from('commandes')
      .select('id', { count: 'exact', head: true })
      .eq('entreprise_id', entrepriseId)
      .eq('statut', 'en_attente')
    setNbEnAttente(count || 0)
  }

  useEffect(() => {
    recharger()
    if (!entrepriseId) return
    const channel = supabase.channel('commandes-count')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commandes', filter: `entreprise_id=eq.${entrepriseId}` }, recharger)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [entrepriseId])

  return (
    <CommandesContext.Provider value={{ nbEnAttente, recharger }}>
      {children}
    </CommandesContext.Provider>
  )
}

export function useCommandes() {
  return useContext(CommandesContext)
}
