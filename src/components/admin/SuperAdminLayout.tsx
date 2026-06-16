import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useSuperAdmin } from '../../lib/superAdminAuth'
import { ShieldCheck, LayoutDashboard, Building2, KeyRound, Wallet, LogOut, Menu, FileText } from 'lucide-react'
import { useState } from 'react'
import toast from 'react-hot-toast'

const nav = [
  { to: '/admin', label: 'Tableau de bord', icon: LayoutDashboard, exact: true },
  { to: '/admin/entreprises', label: 'Entreprises', icon: Building2 },
  { to: '/admin/licences', label: 'Licences', icon: KeyRound },
  { to: '/admin/paiements', label: 'Paiements', icon: Wallet },
  { to: '/admin/journal', label: 'Journal connexions', icon: FileText },
]

export default function SuperAdminLayout() {
  const { superAdmin, deconnexion } = useSuperAdmin()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleDeconnexion = async () => {
    await deconnexion()
    toast.success('Déconnexion réussie')
    navigate('/admin/connexion')
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-gray-900">
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center">
            <ShieldCheck size={16} className="text-white" />
          </div>
          <div>
            <div className="text-white font-semibold text-sm">ChezMoi Pro</div>
            <div className="text-gray-500 text-xs">Super Admin</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4">
        {nav.map(({ to, label, icon: Icon, exact }) => (
          <NavLink
            key={to}
            to={to}
            end={exact}
            onClick={() => setSidebarOpen(false)}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2.5 mx-2 rounded-lg text-sm transition-all ${
                isActive ? 'bg-emerald-600 text-white font-medium' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Icon size={17} />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-400 mb-3">{superAdmin?.nom}</div>
        <button onClick={handleDeconnexion} className="flex items-center gap-2 text-gray-500 hover:text-gray-300 text-xs transition-colors">
          <LogOut size={14} /> Déconnexion
        </button>
      </div>
    </div>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 dark:bg-gray-950">
      <div className="hidden md:flex flex-col w-56 flex-shrink-0">
        <SidebarContent />
      </div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-56"><SidebarContent /></div>
        </div>
      )}
      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-3 flex items-center md:hidden">
          <button onClick={() => setSidebarOpen(true)} className="p-1.5"><Menu size={20} /></button>
        </header>
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
