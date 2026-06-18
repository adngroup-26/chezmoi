export interface Role {
  id: string
  nom: string
  permissions?: string[]
  created_at: string
}

export interface Utilisateur {
  id: string
  telephone: string
  nom: string
  role_id: string
  actif: boolean
  created_at: string
  roles?: Role
  question_secrete?: string
  derniere_connexion?: string
  entreprise_id?: string
}

export interface Categorie {
  id: string
  nom: string
  created_at: string
}

export interface Fournisseur {
  id: string
  nom: string
  telephone?: string
  email?: string
  adresse?: string
  created_at: string
}

export interface Article {
  id: string
  reference?: string
  nom: string
  categorie_id?: string
  prix_achat: number
  quantite: number
  transport: number
  prix_vente: number
  stock_minimum: number
  fournisseur_id?: string
  photo_url?: string
  actif: boolean
  created_at: string
  categories?: Categorie
  fournisseurs?: Fournisseur
  prix_revient?: number
  cout_unitaire?: number
}

export interface Client {
  id: string
  nom: string
  telephone?: string
  email?: string
  adresse?: string
  notes?: string
  created_at: string
}

export interface Vente {
  id: string
  numero: string
  client_id?: string
  utilisateur_id?: string
  total: number
  remise: number
  statut: 'validee' | 'en_attente' | 'annulee'
  created_at: string
  clients?: Client
  utilisateurs?: Utilisateur
  details_ventes?: DetailVente[]
}

export interface DetailVente {
  id: string
  vente_id: string
  article_id: string
  quantite: number
  prix_unitaire: number
  remise: number
  created_at: string
  articles?: Article
}

export interface MouvementStock {
  id: string
  article_id: string
  utilisateur_id?: string
  type: 'entree' | 'sortie' | 'inventaire' | 'vente' | 'retour' | 'perte' | 'casse'
  quantite: number
  commentaire?: string
  vente_id?: string
  created_at: string
  articles?: Article
  utilisateurs?: Utilisateur
}

export interface AuditLog {
  id: string
  utilisateur_id?: string
  table_name: string
  action: string
  ancienne_valeur?: Record<string, unknown>
  nouvelle_valeur?: Record<string, unknown>
  created_at: string
}

export interface Parametre {
  id: string
  cle: string
  valeur?: string
}

export interface PanierItem {
  article: Article
  quantite: number
  remise: number
}

export interface StatsDashboard {
  ca_jour: number
  ca_semaine: number
  ca_mois: number
  ca_annee: number
  nb_ventes_jour: number
  nb_ventes_mois: number
  nb_clients: number
  nb_articles: number
  valeur_stock: number
  benefice_mois: number
}

export interface Commande {
  id: string
  entreprise_id: string
  numero: string
  client_id?: string
  client_nom?: string
  client_telephone?: string
  adresse_livraison?: string
  notes?: string
  statut: 'en_attente' | 'confirmee' | 'annulee'
  total: number
  remise: number
  vente_id?: string
  created_at: string
  updated_at: string
  clients?: { nom: string; telephone?: string } | null
  details_commandes?: DetailCommande[]
}

export interface DetailCommande {
  id: string
  commande_id: string
  article_id?: string
  article_nom: string
  quantite: number
  prix_unitaire: number
  articles?: { nom: string; prix_vente: number; quantite: number }
}

export interface Avoir {
  id: string
  entreprise_id: string
  numero: string
  vente_id: string
  client_id?: string
  utilisateur_id?: string
  type: 'partiel' | 'total'
  statut: 'valide'
  motif: string
  commentaire?: string
  montant: number
  created_at: string
  updated_at: string
  ventes?: { numero: string; total: number }
  clients?: { nom: string; telephone?: string }
  utilisateurs?: { nom: string }
  details_avoirs?: DetailAvoir[]
}

export interface DetailAvoir {
  id: string
  avoir_id: string
  article_id?: string
  article_nom: string
  quantite: number
  prix_unitaire: number
  montant_ligne: number
}
