import { useState } from 'react'
import { useAuth } from '../lib/auth'
import { useNavigate, Link } from 'react-router-dom'
import { Phone, Lock, Store, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const { connexion } = useAuth()
  const navigate = useNavigate()
  const [telephone, setTelephone] = useState('')
  const [motDePasse, setMotDePasse] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telephone || !motDePasse) {
      toast.error('Veuillez remplir tous les champs')
      return
    }
    setLoading(true)
    const { error } = await connexion(telephone, motDePasse)
    setLoading(false)
    if (error) {
      toast.error(error)
    } else {
      toast.success('Connexion réussie !')
      navigate('/')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B2B4B] to-[#0f1b2d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ChezMoi</h1>
          <p className="text-white/50 text-sm mt-1">Gestion commerciale simplifiée</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <h2 className="text-lg font-semibold text-gray-800 mb-5">Connexion</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Numéro de téléphone</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={telephone}
                  onChange={e => setTelephone(e.target.value)}
                  placeholder="Ex: 0701234567"
                  className="input-field pl-9"
                  required
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Mot de passe</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  value={motDePasse}
                  onChange={e => setMotDePasse(e.target.value)}
                  placeholder="Votre mot de passe"
                  className="input-field pl-9 pr-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-2.5 text-base"
            >
              {loading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
              ) : 'Se connecter'}
            </button>
          </form>
          <Link to="/mot-de-passe-oublie" className="block text-center text-xs text-blue-600 hover:text-blue-700 mt-4 transition-colors">
            Mot de passe oublié ?
          </Link>
          <p className="text-center text-xs text-gray-400 mt-4">
            Pas de question secrète configurée ? Contactez votre administrateur.
          </p>
          <div className="border-t border-gray-100 mt-4 pt-4 text-center">
            <p className="text-xs text-gray-400">Nouveau commerçant ?</p>
            <Link to="/inscription" className="text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors">
              Créer un compte gratuitement →
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
