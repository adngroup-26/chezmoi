import { logger } from '../lib/logger'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Store, Building2, Phone, User, Lock, Eye, EyeOff, CheckCircle, ArrowLeft, Clock, Shield, Users } from 'lucide-react'
import toast from 'react-hot-toast'

type Etape = 'formulaire' | 'succes'

export default function InscriptionPage() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState<Etape>('formulaire')
  const [form, setForm] = useState({
    nom_entreprise: '',
    nom_admin: '',
    telephone: '',
    mot_de_passe: '',
    confirmer_mdp: ''
  })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [dateFinEssai, setDateFinEssai] = useState('')
  const [numeroLicence, setNumeroLicence] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!form.nom_entreprise.trim()) { toast.error("Le nom de l'entreprise est requis"); return }
    if (!form.nom_admin.trim()) { toast.error('Votre nom est requis'); return }
    if (!form.telephone.trim()) { toast.error('Le numéro de téléphone est requis'); return }
    if (form.mot_de_passe.length < 4) { toast.error('Le mot de passe doit contenir au moins 4 caractères'); return }
    if (form.mot_de_passe !== form.confirmer_mdp) { toast.error('Les mots de passe ne correspondent pas'); return }

    setLoading(true)

    try {
      const { data, error } = await supabase.rpc('inscrire_entreprise', {
        p_nom_entreprise: form.nom_entreprise.trim(),
        p_telephone_admin: form.telephone.trim(),
        p_nom_admin: form.nom_admin.trim(),
        p_mot_de_passe: form.mot_de_passe
      })

      if (error) throw error

      const result = data as { succes: boolean; erreur?: string; date_fin_essai?: string; numero_licence?: string }

      if (!result.succes) {
        toast.error(result.erreur || 'Erreur lors de l\'inscription')
        setLoading(false)
        return
      }

      setDateFinEssai(result.date_fin_essai || '')
      setNumeroLicence(result.numero_licence || '')
      setEtape('succes')
    } catch (err) {
      logger.error(err)
      toast.error('Erreur de connexion. Vérifiez votre internet et réessayez.')
    }

    setLoading(false)
  }

  if (etape === 'succes') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#1B2B4B] to-[#0f1b2d] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl p-8 shadow-2xl text-center">
            <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Compte créé avec succès !</h2>
            <p className="text-gray-500 text-sm mb-6">
              Bienvenue dans ChezMoi. Votre période d'essai gratuit de 15 jours commence maintenant.
            </p>
            <div className="bg-blue-50 rounded-xl p-4 text-left space-y-2 mb-6">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Entreprise</span>
                <span className="font-medium text-gray-900">{form.nom_entreprise}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">N° Licence</span>
                <span className="font-medium text-gray-900 text-xs">{numeroLicence}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Fin d'essai</span>
                <span className="font-medium text-emerald-600">
                  {dateFinEssai ? new Date(dateFinEssai).toLocaleDateString('fr-FR') : '—'}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Identifiant</span>
                <span className="font-medium text-gray-900">{form.telephone}</span>
              </div>
            </div>
            <button
              onClick={() => navigate('/connexion')}
              className="btn-primary w-full justify-center py-3 text-base"
            >
              Se connecter maintenant
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B2B4B] to-[#0f1b2d] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Créer votre compte ChezMoi</h1>
          <p className="text-white/50 text-sm mt-1">15 jours d'essai gratuit — sans carte bancaire</p>
        </div>

        {/* Avantages */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { icon: Clock, text: '15 jours gratuits' },
            { icon: Shield, text: 'Données sécurisées' },
            { icon: Users, text: "Jusqu'à 3 utilisateurs" }
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="bg-white/10 rounded-xl p-3 text-center">
              <Icon size={18} className="text-blue-300 mx-auto mb-1" />
              <p className="text-white/70 text-xs">{text}</p>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Nom de votre entreprise / boutique *</label>
              <div className="relative">
                <Building2 size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.nom_entreprise}
                  onChange={e => setForm({...form, nom_entreprise: e.target.value})}
                  placeholder="Ex: Boutique Diallo & Fils"
                  className="input-field pl-9"
                  required
                  autoFocus
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Votre nom complet *</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={form.nom_admin}
                  onChange={e => setForm({...form, nom_admin: e.target.value})}
                  placeholder="Ex: Amadou Diallo"
                  className="input-field pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Numéro de téléphone (identifiant de connexion) *</label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={e => setForm({...form, telephone: e.target.value})}
                  placeholder="Ex: 0701234567"
                  className="input-field pl-9"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Mot de passe *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.mot_de_passe}
                  onChange={e => setForm({...form, mot_de_passe: e.target.value})}
                  placeholder="Minimum 4 caractères"
                  className="input-field pl-9 pr-9"
                  required
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirmer le mot de passe *</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={form.confirmer_mdp}
                  onChange={e => setForm({...form, confirmer_mdp: e.target.value})}
                  placeholder="Retapez votre mot de passe"
                  className="input-field pl-9"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full justify-center py-3 text-base mt-2"
            >
              {loading
                ? <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                : 'Créer mon compte gratuitement'
              }
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-4">
            Déjà un compte ?{' '}
            <Link to="/connexion" className="text-blue-600 hover:text-blue-700 font-medium">
              Se connecter
            </Link>
          </p>
        </div>

        <Link to="/connexion" className="flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/60 mt-4 transition-colors">
          <ArrowLeft size={12} /> Retour à la connexion
        </Link>
      </div>
    </div>
  )
}
