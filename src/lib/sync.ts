import { logger } from '../lib/logger'
import { supabase } from './supabase'
import {
  getVentesNonSynchronisees,
  marquerVenteSynchronisee,
  getClientsNonSynchronises,
  marquerClientSynchronise,
  remplacerClientIdDansVentes,
  VenteOffline,
  ClientOffline
} from './offline'

export type SyncStatut = 'inactif' | 'en_cours' | 'succes' | 'erreur'

let syncEnCours = false

/**
 * Synchronise les clients créés hors ligne.
 * Remplace l'identifiant temporaire par le vrai identifiant Supabase
 * partout où il est utilisé (cache local + ventes en attente).
 */
async function synchroniserClient(client: ClientOffline): Promise<boolean> {
  try {
    const { data: nvClient, error } = await supabase
      .from('clients')
      .insert({
        nom: client.nom,
        telephone: client.telephone || null,
        email: client.email || null,
        adresse: client.adresse || null,
        notes: client.notes || null,
        entreprise_id: client.entreprise_id || null
      })
      .select()
      .single()

    if (error || !nvClient) {
      logger.error('[SYNC] Erreur création client:', error)
      return false
    }

    await marquerClientSynchronise(client.id, nvClient.id, nvClient as Record<string, unknown>)
    await remplacerClientIdDansVentes(client.id, nvClient.id)
    return true
  } catch (e) {
    logger.error('[SYNC] Exception lors de la synchronisation du client:', e)
    return false
  }
}

export async function synchroniserClientsEnAttente(): Promise<{ succes: number; echecs: number; total: number }> {
  const enAttente = await getClientsNonSynchronises()
  let succes = 0
  let echecs = 0
  for (const client of enAttente) {
    const ok = await synchroniserClient(client)
    if (ok) succes++
    else echecs++
  }
  return { succes, echecs, total: enAttente.length }
}

/**
 * Envoie une vente enregistrée hors ligne vers Supabase :
 * - création de la vente
 * - création des lignes de détail
 * - création des mouvements de stock
 * - déduction du stock réel (en tenant compte des ventes déjà synchronisées entre-temps)
 */
async function synchroniserVente(vente: VenteOffline): Promise<boolean> {
  try {
    // Si la vente référence un client créé hors ligne pas encore synchronisé,
    // on ne peut pas l'envoyer maintenant (le client_id temporaire n'existe pas côté serveur).
    if (vente.client_id && vente.client_id.startsWith('offline_')) {
      logger.log('[SYNC] Vente en attente du client associé, report de la synchronisation:', vente.numero)
      return false
    }

    // Vérifie si cette vente n'a pas déjà été créée (évite les doublons en cas de re-sync)
    const { data: existante } = await supabase
      .from('ventes')
      .select('id')
      .eq('numero', vente.numero)
      .maybeSingle()

    let venteId = existante?.id as string | undefined

    if (!venteId) {
      const { data: nvVente, error: venteError } = await supabase
        .from('ventes')
        .insert({
          numero: vente.numero,
          client_id: vente.client_id,
          utilisateur_id: vente.utilisateur_id,
          entreprise_id: vente.entreprise_id,
          total: vente.total,
          remise: vente.remise,
          statut: 'validee',
          created_at: vente.created_at
        })
        .select()
        .single()

      if (venteError || !nvVente) {
        logger.error('[SYNC] Erreur création vente:', venteError)
        return false
      }
      venteId = nvVente.id

      const details = vente.items.map(item => ({
        vente_id: venteId,
        article_id: item.article_id,
        entreprise_id: vente.entreprise_id,
        quantite: item.quantite,
        prix_unitaire: item.prix_unitaire,
        remise: 0
      }))
      await supabase.from('details_ventes').insert(details)

      const mouvements = vente.items.map(item => ({
        article_id: item.article_id,
        utilisateur_id: vente.utilisateur_id,
        entreprise_id: vente.entreprise_id,
        type: 'vente',
        quantite: item.quantite,
        vente_id: venteId,
        commentaire: `Vente ${vente.numero} (synchronisee hors ligne)`
      }))
      await supabase.from('mouvements_stock').insert(mouvements)

      // Déduit le stock réel actuel (au moment de la synchro, pas celui d'avant)
      for (const item of vente.items) {
        const { data: article } = await supabase
          .from('articles')
          .select('quantite')
          .eq('id', item.article_id)
          .single()

        if (article) {
          const nouvelleQte = Math.max(0, article.quantite - item.quantite)
          await supabase.from('articles').update({ quantite: nouvelleQte }).eq('id', item.article_id)
        }
      }
    }

    await marquerVenteSynchronisee(vente.id)
    return true
  } catch (e) {
    logger.error('[SYNC] Exception lors de la synchronisation:', e)
    return false
  }
}

/**
 * Synchronise toutes les ventes en attente.
 * Retourne le nombre de ventes synchronisées avec succès et le nombre d'échecs.
 */
export async function synchroniserVentesEnAttente(): Promise<{ succes: number; echecs: number; total: number }> {
  if (syncEnCours) return { succes: 0, echecs: 0, total: 0 }
  syncEnCours = true

  try {
    // 1. D'abord les clients créés hors ligne, pour obtenir leurs vrais IDs
    await synchroniserClientsEnAttente()

    // 2. Ensuite les ventes (les client_id temporaires ont été remplacés à l'étape 1)
    const enAttente = await getVentesNonSynchronisees()
    let succes = 0
    let echecs = 0

    for (const vente of enAttente) {
      const ok = await synchroniserVente(vente)
      if (ok) succes++
      else echecs++
    }

    return { succes, echecs, total: enAttente.length }
  } finally {
    syncEnCours = false
  }
}

export async function compterVentesEnAttente(): Promise<number> {
  const enAttente = await getVentesNonSynchronisees()
  return enAttente.length
}
