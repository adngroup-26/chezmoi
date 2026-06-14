import { useState } from 'react'
import { useSuperAdmin } from '../../lib/superAdminAuth'
import { useNavigate } from 'react-router-dom'
import { Phone, Lock, ShieldCheck, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function SuperAdminLoginPage() {
  const { connexion } = useSuperAdmin()
  const navigate = useNavigate()
  const [telephone, setTelephone] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telephone || !motDePasse) { toast.error('Veuillez remplir tous les champs'); return }
    setLoading(true)
    const { error } = await connexion(telephone, motDePasse)
    setLoading(false)
    if (error) { toast.error(error); return }
    toast.success('Connexion réussie')
    navigate('/admin')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gray-800 border border-gray-700 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldCheck size={32} className="text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">ChezMoi Pro</h1>
          <p className="text-gray-400 text-sm mt-1">Portail Super Administrateur</p>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Téléphone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="tel"
                  value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                  autoFocus
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-lg pl-9 pr-9 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium py-2.5 rounded-lg flex items-center justify-center transition-colors">
              {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Se connecter'}
            </button>
          </form>
        </div>
        <p className="text-center text-xs text-gray-500 mt-4">Accès réservé au propriétaire de ChezMoi Pro</p>
      </div>
    </div>
  )
}
