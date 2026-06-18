import {
  LayoutDashboard, ShoppingCart, Package, Warehouse,
  Users, Truck, BarChart3, Settings, UserCog, Tag, History, HelpCircle, ShoppingBag, RotateCcw
} from 'lucide-react'

// Définition centralisée de tous les modules de l'application.
// Utilisée pour : la navigation, et la page de gestion des permissions.
export interface ModuleDef {
  key: string
  to: string
  label: string
  icon: typeof LayoutDashboard
  exact?: boolean
  adminOnly?: boolean // toujours réservé à l'admin, jamais attribuable au gestionnaire
}

export const MODULES: ModuleDef[] = [
  { key: 'dashboard', to: '/', label: 'Tableau de bord', icon: LayoutDashboard, exact: true, adminOnly: true },
  { key: 'caisse', to: '/caisse', label: 'Caisse', icon: ShoppingCart },
  { key: 'commandes', to: '/commandes', label: 'Commandes', icon: ShoppingBag },
  { key: 'ventes', to: '/ventes', label: 'Historique ventes', icon: BarChart3 },
  { key: 'avoirs', to: '/avoirs', label: 'Avoirs / Retours', icon: RotateCcw },
  { key: 'articles', to: '/articles', label: 'Articles', icon: Package },
  { key: 'categories', to: '/categories', label: 'Catégories', icon: Tag },
  { key: 'stock', to: '/stock', label: 'Stock', icon: Warehouse },
  { key: 'clients', to: '/clients', label: 'Clients', icon: Users },
  { key: 'fournisseurs', to: '/fournisseurs', label: 'Fournisseurs', icon: Truck, adminOnly: true },
  { key: 'utilisateurs', to: '/utilisateurs', label: 'Utilisateurs', icon: UserCog, adminOnly: true },
  { key: 'audit', to: '/audit', label: "Journal d'audit", icon: History, adminOnly: true },
  { key: 'parametres', to: '/parametres', label: 'Paramètres', icon: Settings, adminOnly: true },
  { key: 'aide', to: '/aide', label: 'Aide', icon: HelpCircle },
]

// Modules pouvant être attribués librement au rôle Gestionnaire
export const MODULES_ATTRIBUABLES = MODULES.filter(m => !m.adminOnly && m.key !== 'aide')

export function getNavPourRole(isAdmin: boolean, permissions?: string[]): ModuleDef[] {
  const aideModule = MODULES.find(m => m.key === 'aide')!
  if (isAdmin) return MODULES
  const perms = permissions || []
  const navGestionnaire = MODULES_ATTRIBUABLES.filter(m => perms.includes(m.key))
  // Aide toujours visible pour tous les rôles
  return [...navGestionnaire, aideModule]
}
