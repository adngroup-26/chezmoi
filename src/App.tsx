import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { MODULES } from './lib/modules'
import Layout from './components/layout/Layout'
import LoginPage from './pages/LoginPage'
import MotDePasseOubliePage from './pages/MotDePasseOubliePage'
import InscriptionPage from './pages/InscriptionPage'
import RenouvellementPage from './pages/RenouvellementPage'
import AidePage from './pages/AidePage'
import CommandesPage from './pages/CommandesPage'
import AvoirsPage from './pages/AvoirsPage'
import DashboardPage from './pages/DashboardPage'
import ArticlesPage from './pages/ArticlesPage'
import VentesPage from './pages/VentesPage'
import CaissePage from './pages/CaissePage'
import StockPage from './pages/StockPage'
import ClientsPage from './pages/ClientsPage'
import FournisseursPage from './pages/FournisseursPage'
import UtilisateursPage from './pages/UtilisateursPage'
import ParametresPage from './pages/ParametresPage'
import CategoriesPage from './pages/CategoriesPage'
import AuditPage from './pages/AuditPage'
import PermissionsPage from './pages/PermissionsPage'
import { useSuperAdmin } from './lib/superAdminAuth'
import SuperAdminLoginPage from './pages/admin/SuperAdminLoginPage'
import SuperAdminLayout from './components/admin/SuperAdminLayout'
import SuperAdminDashboard from './pages/admin/SuperAdminDashboard'
import SuperAdminEntreprisesPage from './pages/admin/SuperAdminEntreprisesPage'
import SuperAdminLicencesPage from './pages/admin/SuperAdminLicencesPage'
import SuperAdminPaiementsPage from './pages/admin/SuperAdminPaiementsPage'
import SuperAdminJournalPage from './pages/admin/SuperAdminJournalPage'

function SuperAdminRoute({ children }: { children: JSX.Element }) {
  const { superAdmin, loading } = useSuperAdmin()
  if (loading) return <div className="flex items-center justify-center h-screen bg-gray-950"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" /></div>
  if (!superAdmin) return <Navigate to="/admin/connexion" replace />
  return children
}

function ProtectedRoute({ children, adminOnly = false }: { children: JSX.Element, adminOnly?: boolean }) {
  const { utilisateur, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  if (!utilisateur) return <Navigate to="/connexion" replace />
  if (adminOnly && !isAdmin) return <Navigate to="/" replace />
  return children
}

// Vérifie l'accès à un module selon les permissions définies par l'admin
// pour le rôle Gestionnaire. L'admin a toujours accès à tout.
function ModuleRoute({ moduleKey, children }: { moduleKey: string, children: JSX.Element }) {
  const { utilisateur, loading, isAdmin } = useAuth()
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
  if (!utilisateur) return <Navigate to="/connexion" replace />

  const module = MODULES.find(m => m.key === moduleKey)
  if (module?.adminOnly && !isAdmin) return <Navigate to="/premier-module" replace />

  if (!isAdmin) {
    const permissions = utilisateur.roles?.permissions || []
    if (!permissions.includes(moduleKey)) return <Navigate to="/premier-module" replace />
  }
  return children
}

// Redirige le gestionnaire vers le premier module auquel il a accès
function PremierModuleDisponible() {
  const { utilisateur, isAdmin } = useAuth()
  if (isAdmin) return <Navigate to="/" replace />
  const permissions = utilisateur?.roles?.permissions || []
  const premier = MODULES.find(m => !m.adminOnly && permissions.includes(m.key))
  if (premier) return <Navigate to={premier.to} replace />
  return (
    <div className="text-center py-16">
      <p className="text-gray-500">Aucun module ne vous a été attribué pour le moment.</p>
      <p className="text-sm text-gray-400 mt-1">Contactez votre administrateur.</p>
    </div>
  )
}

export default function App() {
  const { utilisateur, loading } = useAuth()
  const { superAdmin } = useSuperAdmin()

  // Le portail Super Admin (/admin/*) est totalement indépendant de l'authentification client :
  // pas d'écran de chargement client, pas de redirection client.
  const path = window.location.pathname
  if (path.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin/connexion" element={superAdmin ? <Navigate to="/admin" replace /> : <SuperAdminLoginPage />} />
        <Route path="/admin" element={<SuperAdminRoute><SuperAdminLayout /></SuperAdminRoute>}>
          <Route index element={<SuperAdminDashboard />} />
          <Route path="entreprises" element={<SuperAdminEntreprisesPage />} />
          <Route path="licences" element={<SuperAdminLicencesPage />} />
          <Route path="paiements" element={<SuperAdminPaiementsPage />} />
          <Route path="journal" element={<SuperAdminJournalPage />} />
        </Route>
      </Routes>
    )
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
        <p className="text-gray-500 text-sm">Chargement de ChezMoi...</p>
      </div>
    </div>
  )

  return (
    <Routes>
      <Route path="/connexion" element={utilisateur ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/inscription" element={utilisateur ? <Navigate to="/" replace /> : <InscriptionPage />} />
      <Route path="/mot-de-passe-oublie" element={utilisateur ? <Navigate to="/" replace /> : <MotDePasseOubliePage />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<ModuleRoute moduleKey="dashboard"><DashboardPage /></ModuleRoute>} />
        <Route path="premier-module" element={<PremierModuleDisponible />} />
        <Route path="articles" element={<ModuleRoute moduleKey="articles"><ArticlesPage /></ModuleRoute>} />
        <Route path="categories" element={<ModuleRoute moduleKey="categories"><CategoriesPage /></ModuleRoute>} />
        <Route path="ventes" element={<ModuleRoute moduleKey="ventes"><VentesPage /></ModuleRoute>} />
        <Route path="caisse" element={<ModuleRoute moduleKey="caisse"><CaissePage /></ModuleRoute>} />
        <Route path="stock" element={<ModuleRoute moduleKey="stock"><StockPage /></ModuleRoute>} />
        <Route path="clients" element={<ModuleRoute moduleKey="clients"><ClientsPage /></ModuleRoute>} />
        <Route path="fournisseurs" element={<ProtectedRoute adminOnly><FournisseursPage /></ProtectedRoute>} />
        <Route path="utilisateurs" element={<ProtectedRoute adminOnly><UtilisateursPage /></ProtectedRoute>} />
        <Route path="audit" element={<ProtectedRoute adminOnly><AuditPage /></ProtectedRoute>} />
        <Route path="permissions" element={<ProtectedRoute adminOnly><PermissionsPage /></ProtectedRoute>} />
        <Route path="renouvellement" element={<ProtectedRoute adminOnly><RenouvellementPage /></ProtectedRoute>} />
        <Route path="aide" element={<AidePage />} />
        <Route path="commandes" element={<CommandesPage />} />
        <Route path="avoirs" element={<AvoirsPage />} />
        <Route path="parametres" element={<ProtectedRoute adminOnly><ParametresPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  )
}
