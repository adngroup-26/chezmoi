import { useAuth } from './auth'

/**
 * Hook central pour l'isolation des données par entreprise.
 * Toutes les pages doivent utiliser ce hook pour filtrer leurs requêtes.
 *
 * Usage :
 *   const { eid } = useEntreprise()
 *   supabase.from('articles').select('*').eq('entreprise_id', eid)
 */
export function useEntreprise() {
  const { utilisateur } = useAuth()
  const eid = (utilisateur as unknown as { entreprise_id?: string } | null)?.entreprise_id || ''
  return { eid }
}
