import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../lib/auth'
import { useTheme } from '../../lib/theme'
import { useSyncOffline } from '../../hooks/useSyncOffline'
import { getNavPourRole } from '../../lib/modules'
import LicenceBanner from './LicenceBanner'
import {
  ShieldCheck, RefreshCw, UploadCloud,
  LogOut, Wifi, WifiOff, Store, Menu, Sun, Moon, CreditCard
} from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

export default function Layout() {
  const { utilisateur, deconnexion, isAdmin } = useAuth()
  const { darkMode, toggleDarkMode } = useTheme()
  const { isOnline, enSynchronisation, enAttente, lancerSync } = useSyncOffline()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const nav = getNavPourRole(isAdmin, utilisateur?.roles?.permissions)

  const handleDeconnexion = async () => {
    await deconnexion()
    toast.success('Déconnexion réussie')
    navigate('/connexion')
  }

  const initiales = utilisateur?.nom?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || 'CM'

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-[#1B2B4B]">
      <div className="p-5 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
            <Store size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">ChezMoi</div>
            <div className="text-white/40 text-xs">Gestion commerciale</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 overflow-y-auto">
        {nav.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink
            to="/permissions"
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all duration-150 ${
                isActive
                  ? 'bg-blue-600 text-white font-medium'
                  : 'text-white/60 hover:text-white hover:bg-white/8'
              }`
            }
          >
            <ShieldCheck size={17} />
            Rôles & permissions
          </NavLink>
        )}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-semibold">
            {initiales}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-white text-xs font-medium truncate">{utilisateur?.nom}</div>
            <div className="text-white/40 text-xs">
              {utilisateur?.roles?.nom === 'admin' ? 'Administrateur' : utilisateur?.roles?.nom === 'gestionnaire' ? 'Gestionnaire' : '—'}
            </div>
          </div>
        </div>
        <button onClick={handleDeconnexion} className="flex items-center gap-2 text-white/50 hover:text-white/80 text-xs transition-colors w-full">
          <LogOut size={14} />
          Déconnexion
        </button>
        <NavLink to="/renouvellement" onClick={() => setSidebarOpen(false)} className="flex items-center gap-2 text-emerald-400/80 hover:text-emerald-300 text-xs transition-colors mt-2 w-full">
          <CreditCard size={14} /> Renouveler ma licence
        </NavLink>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 dark:bg-gray-900">
      {/* Desktop sidebar */}
      <div className="hidden md:flex flex-col w-56 flex-shrink-0">
        <SidebarContent />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56">
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 px-4 py-3 flex items-center gap-3 flex-shrink-0">
          <button
            className="md:hidden p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} className="text-gray-600 dark:text-gray-300" />
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            {enAttente > 0 && (
              <div className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800">
                <UploadCloud size={12} />
                {enAttente} vente{enAttente > 1 ? 's' : ''} en attente
                {isOnline && (
                  <button onClick={() => lancerSync()} className="ml-1 hover:opacity-70 transition-opacity" title="Synchroniser maintenant">
                    <RefreshCw size={11} className={enSynchronisation ? 'animate-spin' : ''} />
                  </button>
                )}
              </div>
            )}
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border ${
              isOnline
                ? 'text-emerald-600 border-emerald-200 bg-emerald-50 dark:bg-emerald-900/30 dark:border-emerald-800'
                : 'text-amber-600 border-amber-200 bg-amber-50 dark:bg-amber-900/30 dark:border-amber-800'
            }`}>
              {enSynchronisation ? <RefreshCw size={12} className="animate-spin" /> : isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
              {enSynchronisation ? 'Synchronisation...' : isOnline ? 'En ligne' : 'Hors ligne'}
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors text-gray-500 dark:text-gray-300"
            title={darkMode ? 'Mode clair' : 'Mode sombre'}
          >
            {darkMode ? <Sun size={18} /> : <Moon size={18} />}
          </button>
        </header>

        <LicenceBanner />

        {/* Page content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
