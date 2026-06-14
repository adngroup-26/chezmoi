import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from './supabase'

interface DeviseContextType {
  devise: string
  formatMontant: (n: number) => string
}

const DeviseContext = createContext<DeviseContextType>({
  devise: 'FCFA',
  formatMontant: (n) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' FCFA'
})

export function DeviseProvider({ children, entrepriseId }: { children: ReactNode; entrepriseId?: string }) {
  const [devise, setDevise] = useState('FCFA')

  useEffect(() => {
    if (!entrepriseId) return
    supabase
      .from('parametres')
      .select('valeur')
      .eq('cle', 'devise')
      .eq('entreprise_id', entrepriseId)
      .single()
      .then(({ data }) => {
        if (data?.valeur) setDevise(data.valeur)
      })
  }, [entrepriseId])

  const formatMontant = (n: number) =>
    new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise

  return (
    <DeviseContext.Provider value={{ devise, formatMontant }}>
      {children}
    </DeviseContext.Provider>
  )
}

export function useDevise() {
  return useContext(DeviseContext)
}

// Fonction utilitaire exportée pour les pages qui en ont besoin hors contexte
export function creerFormatMontant(devise: string) {
  return (n: number) => new Intl.NumberFormat('fr-FR').format(Math.round(n)) + ' ' + devise
}
