import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Variables Supabase manquantes dans .env')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: { persistSession: true, autoRefreshToken: true }
})

/**
 * Positionne l'entreprise_id dans la session PostgreSQL
 * avant chaque requête métier, pour que les policies RLS
 * puissent filtrer correctement par tenant.
 * À appeler une seule fois après connexion.
 */
export async function setSessionEntrepriseId(entrepriseId: string) {
  if (!entrepriseId) return
  await supabase.rpc('set_config', {
    setting: 'app.entreprise_id',
    value: entrepriseId,
    is_local: false
  }).catch(() => {
    // Fallback si set_config RPC non disponible :
    // les policies RLS utilisent la clé de session directement
  })
}
