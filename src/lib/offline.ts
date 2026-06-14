import { openDB, DBSchema, IDBPDatabase } from 'idb'

export interface VenteOffline {
  id: string              // identifiant local (uuid généré côté client)
  numero: string
  client_id: string | null
  client_nom?: string
  utilisateur_id: string
  entreprise_id: string
  total: number
  remise: number
  items: {
    article_id: string
    article_nom: string
    quantite: number
    prix_unitaire: number
  }[]
  created_at: string
  synced: 'true' | 'false'
}

interface ChezMoiDB extends DBSchema {
  ventes_offline: {
    key: string
    value: VenteOffline
    indexes: { by_synced: string }
  }
  clients_offline: {
    key: string
    value: ClientOffline
    indexes: { by_synced: string }
  }
  articles_cache: {
    key: string
    value: Record<string, unknown>
  }
  clients_cache: {
    key: string
    value: Record<string, unknown>
  }
}

export interface ClientOffline {
  id: string // identifiant temporaire local, préfixé "offline_"
  nom: string
  telephone?: string
  email?: string
  adresse?: string
  notes?: string
  created_at: string
  synced: 'true' | 'false'
}

let db: IDBPDatabase<ChezMoiDB> | null = null

export async function getDB() {
  if (db) return db
  db = await openDB<ChezMoiDB>('chezmoi-offline', 3, {
    upgrade(database) {
      if (!database.objectStoreNames.contains('ventes_offline')) {
        const store = database.createObjectStore('ventes_offline', { keyPath: 'id' })
        store.createIndex('by_synced', 'synced')
      }
      if (!database.objectStoreNames.contains('clients_offline')) {
        const store = database.createObjectStore('clients_offline', { keyPath: 'id' })
        store.createIndex('by_synced', 'synced')
      }
      if (!database.objectStoreNames.contains('articles_cache')) {
        database.createObjectStore('articles_cache', { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains('clients_cache')) {
        database.createObjectStore('clients_cache', { keyPath: 'id' })
      }
    }
  })
  return db
}

// ===== VENTES OFFLINE =====

export async function sauvegarderVenteOffline(vente: VenteOffline) {
  const database = await getDB()
  await database.put('ventes_offline', vente)
}

export async function getVentesNonSynchronisees(): Promise<VenteOffline[]> {
  const database = await getDB()
  return database.getAllFromIndex('ventes_offline', 'by_synced', 'false')
}

export async function getToutesVentesOffline(): Promise<VenteOffline[]> {
  const database = await getDB()
  return database.getAll('ventes_offline')
}

export async function marquerVenteSynchronisee(id: string) {
  const database = await getDB()
  const vente = await database.get('ventes_offline', id)
  if (vente) {
    vente.synced = 'true'
    await database.put('ventes_offline', vente)
  }
}

export async function supprimerVenteOffline(id: string) {
  const database = await getDB()
  await database.delete('ventes_offline', id)
}

// ===== CACHE ARTICLES =====

export async function cacheArticles(articles: Record<string, unknown>[]) {
  const database = await getDB()
  const tx = database.transaction('articles_cache', 'readwrite')
  await tx.store.clear()
  for (const a of articles) await tx.store.put(a)
  await tx.done
}

export async function getArticlesCache(): Promise<Record<string, unknown>[]> {
  const database = await getDB()
  return database.getAll('articles_cache')
}

// Met à jour localement la quantité d'un article dans le cache
// (pour refléter immédiatement une vente offline)
export async function decrementerStockCache(articleId: string, quantiteVendue: number) {
  const database = await getDB()
  const article = await database.get('articles_cache', articleId)
  if (article) {
    article.quantite = (article.quantite as number) - quantiteVendue
    await database.put('articles_cache', article)
  }
}

// ===== CLIENTS OFFLINE =====

export async function sauvegarderClientOffline(client: ClientOffline) {
  const database = await getDB()
  await database.put('clients_offline', client)
  // Ajoute aussi au cache des clients pour qu'il apparaisse immédiatement dans les listes
  await database.put('clients_cache', client as unknown as Record<string, unknown>)
}

export async function getClientsNonSynchronises(): Promise<ClientOffline[]> {
  const database = await getDB()
  return database.getAllFromIndex('clients_offline', 'by_synced', 'false')
}

export async function marquerClientSynchronise(idTemporaire: string, idReel: string, donnees: Record<string, unknown>) {
  const database = await getDB()
  const client = await database.get('clients_offline', idTemporaire)
  if (client) {
    client.synced = 'true'
    await database.put('clients_offline', client)
  }
  // Remplace l'entrée temporaire du cache par la vraie donnée (avec le vrai id Supabase)
  await database.delete('clients_cache', idTemporaire)
  await database.put('clients_cache', donnees)
}

// ===== CACHE CLIENTS =====

export async function ajouterClientAuCache(client: Record<string, unknown>) {
  const database = await getDB()
  await database.put('clients_cache', client)
}

// Met à jour le client_id d'une vente offline en attente (après synchro d'un client temporaire)
export async function remplacerClientIdDansVentes(idTemporaire: string, idReel: string) {
  const database = await getDB()
  const ventes = await database.getAll('ventes_offline')
  for (const vente of ventes) {
    if (vente.client_id === idTemporaire) {
      vente.client_id = idReel
      await database.put('ventes_offline', vente)
    }
  }
}

export async function cacheClients(clients: Record<string, unknown>[]) {
  const database = await getDB()
  const tx = database.transaction('clients_cache', 'readwrite')
  await tx.store.clear()
  for (const c of clients) await tx.store.put(c)
  await tx.done
}

export async function getClientsCache(): Promise<Record<string, unknown>[]> {
  const database = await getDB()
  return database.getAll('clients_cache')
}
