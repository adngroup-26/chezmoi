import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, Link } from 'react-router-dom'
import { Phone, HelpCircle, Lock, Store, Eye, EyeOff, ArrowLeft, Check } from 'lucide-react'
import toast from 'react-hot-toast'

type Etape = 'telephone' | 'question' | 'succes'

export default function MotDePasseOubliePage() {
  const navigate = useNavigate()
  const [etape, setEtape] = useState<Etape>('telephone')
  const [telephone, setTelephone] = useState('')
  const [question, setQuestion] = useState('')
  const [reponse, setReponse] = useState('')
  const [nouveauMdp, setNouveauMdp] = useState('')
  const [confirmerMdp, setConfirmerMdp] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const rechercherQuestion = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!telephone) { toast.error('Entrez votre numéro de téléphone'); return }
    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('obtenir_question_secrete', { p_telephone: telephone })
      if (error || !data || data.length === 0) {
        toast.error('Numéro de téléphone introuvable')
        setLoading(false)
        return
      }
      const result = data[0]
      if (!result.a_une_question || !result.question) {
        toast.error('Aucune question secrète configurée pour ce compte. Contactez votre administrateur.')
        setLoading(false)
        return
      }
      setQuestion(result.question)
      setEtape('question')
    } catch {
      toast.error('Erreur de connexion')
    }
    setLoading(false)
  }

  const verifierEtReinitialiser = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reponse) { toast.error('Répondez à la question secrète'); return }
    if (nouveauMdp.length < 4) { toast.error('Le mot de passe doit contenir au moins 4 caractères'); return }
    if (nouveauMdp !== confirmerMdp) { toast.error('Les mots de passe ne correspondent pas'); return }

    setLoading(true)
    try {
      const { data, error } = await supabase.rpc('reinitialiser_mot_de_passe', {
        p_telephone: telephone,
        p_reponse: reponse,
        p_nouveau_mot_de_passe: nouveauMdp
      })
      if (error || !data) {
        toast.error('Réponse incorrecte')
        setLoading(false)
        return
      }
      setEtape('succes')
    } catch {
      toast.error('Erreur de connexion')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#1B2B4B] to-[#0f1b2d] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Store size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">ChezMoi</h1>
          <p className="text-white/50 text-sm mt-1">Réinitialisation du mot de passe</p>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-2xl">
          {etape === 'telephone' && (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Mot de passe oublié</h2>
              <p className="text-xs text-gray-500 mb-5">Entrez votre numéro de téléphone pour commencer.</p>
              <form onSubmit={rechercherQuestion} className="space-y-4">
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
                      autoFocus
                    />
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                  {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Continuer'}
                </button>
              </form>
            </>
          )}

          {etape === 'question' && (
            <>
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Question secrète</h2>
              <div className="flex items-start gap-2 mb-5 p-3 bg-blue-50 rounded-lg">
                <HelpCircle size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-blue-800 font-medium">{question}</p>
              </div>
              <form onSubmit={verifierEtReinitialiser} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Votre réponse</label>
                  <input
                    type="text"
                    value={reponse}
                    onChange={e => setReponse(e.target.value)}
                    placeholder="Votre réponse"
                    className="input-field"
                    required
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Nouveau mot de passe</label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={nouveauMdp}
                      onChange={e => setNouveauMdp(e.target.value)}
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
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Confirmer le mot de passe</label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmerMdp}
                    onChange={e => setConfirmerMdp(e.target.value)}
                    placeholder="Retapez le mot de passe"
                    className="input-field"
                    required
                  />
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
                  {loading ? <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> : 'Réinitialiser le mot de passe'}
                </button>
              </form>
            </>
          )}

          {etape === 'succes' && (
            <div className="text-center py-4">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={24} className="text-emerald-600" />
              </div>
              <h2 className="text-lg font-semibold text-gray-800 mb-2">Mot de passe réinitialisé !</h2>
              <p className="text-sm text-gray-500 mb-5">Tu peux maintenant te connecter avec ton nouveau mot de passe.</p>
              <button onClick={() => navigate('/connexion')} className="btn-primary w-full justify-center py-2.5">
                Aller à la connexion
              </button>
            </div>
          )}

          {etape !== 'succes' && (
            <Link to="/connexion" className="flex items-center justify-center gap-1.5 text-xs text-gray-400 hover:text-gray-600 mt-4 transition-colors">
              <ArrowLeft size={12} /> Retour à la connexion
            </Link>
          )}
        </div>
      </div>
    </div>
  )
}
