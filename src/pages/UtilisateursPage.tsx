import { useEntreprise } from '../lib/entreprise'
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Utilisateur, Role } from '../types'
import { Plus, Edit2, UserCog, Trash2, Phone, Circle } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

const QUESTIONS_SECRETES = [
  'Quel est le nom de votre premier animal de compagnie ?',
  'Quelle est votre ville de naissance ?',
  'Quel est le prénom de votre mère ?',
  'Quel est le nom de votre premier établissement scolaire ?',
  'Quel est votre plat préféré ?',
]

// Considéré "en ligne" si dernière connexion il y a moins de 5 minutes
const SEUIL_EN_LIGNE_MS = 5 * 60 * 1000

function estEnLigne(derniereConnexion?: string): boolean {
  if (!derniereConnexion) return false
  return Date.now() - new Date(derniereConnexion).getTime() < SEUIL_EN_LIGNE_MS
}

export default function UtilisateursPage() {
  const { eid } = useEntreprise()
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [roles, setRoles] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editItem, setEditItem] = useState<Utilisateur | null>(null)
  const [form, setForm] = useState({ nom: '', telephone: '', role_id: '', mot_de_passe: '', question_secrete: '', reponse_secrete: '' })

  useEffect(() => {
    charger()
    // Rafraîchit le statut en ligne/hors ligne toutes les 30 secondes
    const interval = setInterval(charger, 30000)
    return () => clearInterval(interval)
  }, [])

  async function charger() {
    setLoading(true)
    const [u, r] = await Promise.all([
      supabase.from('utilisateurs').select('*').eq('entreprise_id', eid),
      supabase.from('roles').select('*')
    ])

    if (u.error) console.error('[UTILISATEURS] Erreur chargement:', u.error)

    const rolesData = r.data || []
    const utilisateursAvecRole = (u.data || []).map(util => ({
      ...util,
      roles: rolesData.find(role => role.id === util.role_id)
    })).sort((a, b) => a.nom.localeCompare(b.nom))

    setUtilisateurs(utilisateursAvecRole)
    setRoles(rolesData)
    setLoading(false)
  }

  const ouvrir = (u?: Utilisateur) => {
    setEditItem(u || null)
    setForm(u
      ? { nom: u.nom, telephone: u.telephone, role_id: u.role_id, mot_de_passe: '', question_secrete: u.question_secrete || '', reponse_secrete: '' }
      : { nom: '', telephone: '', role_id: roles[0]?.id || '', mot_de_passe: '', question_secrete: '', reponse_secrete: '' })
    setShowModal(true)
  }

  const sauvegarder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.nom || !form.telephone || !form.role_id) { toast.error('Tous les champs sont requis'); return }
    if (!editItem && !form.mot_de_passe) { toast.error('Mot de passe requis pour un nouvel utilisateur'); return }

    const data: Record<string, unknown> = { nom: form.nom, telephone: form.telephone, role_id: form.role_id }
    if (form.question_secrete) data.question_secrete = form.question_secrete

    let error
    if (editItem) {
      // Mise à jour des infos de base
      ;({ error } = await supabase.from('utilisateurs').update(data).eq('id', editItem.id).eq('entreprise_id', eid))
      // Changement mot de passe via RPC bcrypt (si renseigné)
      if (!error && form.mot_de_passe) {
        const { error: pwErr } = await supabase.rpc('changer_mot_de_passe', {
          p_utilisateur_id: editItem.id,
          p_nouveau_mot_de_passe: form.mot_de_passe
        })
        if (pwErr) { toast.error('Erreur mot de passe : ' + pwErr.message); return }
      }
      // Question secrète via RPC bcrypt
      if (!error && form.reponse_secrete && form.question_secrete) {
        await supabase.rpc('definir_question_secrete', {
          p_telephone: form.telephone,
          p_question: form.question_secrete,
          p_reponse: form.reponse_secrete
        })
      }
    } else {
      // Création : mot de passe hashé via RPC bcrypt
      const { error: rpcErr } = await supabase.rpc('creer_utilisateur', {
        p_nom: form.nom,
        p_telephone: form.telephone,
        p_role_id: form.role_id,
        p_mot_de_passe: form.mot_de_passe,
        p_entreprise_id: eid
      })
      error = rpcErr
      // Question secrète après création
      if (!error && form.reponse_secrete && form.question_secrete) {
        await supabase.rpc('definir_question_secrete', {
          p_telephone: form.telephone,
          p_question: form.question_secrete,
          p_reponse: form.reponse_secrete
        })
      }
    }

    if (error) { toast.error('Erreur : ' + (error as { message: string }).message); return }
    toast.success(editItem ? 'Utilisateur modifié !' : 'Utilisateur créé !')
    setShowModal(false)
    charger()
  }

  const toggleActif = async (u: Utilisateur) => {
    await supabase.from('utilisateurs').update({ actif: !u.actif }).eq('id', u.id).eq('entreprise_id', eid)
    toast.success(u.actif ? 'Accès désactivé' : 'Accès réactivé')
    charger()
  }

  const supprimerDefinitivement = async (u: Utilisateur) => {
    if (!confirm(`Supprimer définitivement "${u.nom}" ?\n\nCette action est irréversible. Son historique de ventes sera conservé mais ne sera plus associé à ce compte.`)) return

    const { error } = await supabase.from('utilisateurs').delete().eq('id', u.id).eq('entreprise_id', eid)
    if (error) { toast.error('Erreur lors de la suppression : ' + error.message); return }
    toast.success('Utilisateur supprimé définitivement')
    charger()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">Utilisateurs</h1>
          <p className="text-sm text-gray-500">Maximum recommandé : 3 utilisateurs</p>
        </div>
        <button onClick={() => ouvrir()} className="btn-primary"><Plus size={16} /> Nouvel utilisateur</button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" /></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {utilisateurs.map(u => {
            const enLigne = estEnLigne(u.derniere_connexion)
            return (
              <div key={u.id} className={`card p-4 ${!u.actif ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-11 h-11 bg-blue-50 dark:bg-blue-900/30 rounded-full flex items-center justify-center">
                        <UserCog size={20} className="text-blue-600" />
                      </div>
                      <Circle
                        size={11}
                        className={`absolute -bottom-0.5 -right-0.5 rounded-full ring-2 ring-white dark:ring-gray-800 ${enLigne ? 'text-emerald-500 fill-emerald-500' : 'text-gray-300 fill-gray-300'}`}
                      />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900 dark:text-gray-100">{u.nom}</p>
                      <p className="text-xs text-gray-500 flex items-center gap-1"><Phone size={11} />{u.telephone}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => ouvrir(u)} className="p-1.5 hover:bg-blue-50 rounded-lg text-gray-400 hover:text-blue-600 transition-colors" title="Modifier l'accès">
                      <Edit2 size={13} />
                    </button>
                    <button onClick={() => supprimerDefinitivement(u)} className="p-1.5 hover:bg-red-50 rounded-lg text-gray-400 hover:text-red-600 transition-colors" title="Supprimer définitivement">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                <div className="mt-2 text-xs text-gray-400">
                  {enLigne
                    ? <span className="text-emerald-600 font-medium">En ligne</span>
                    : u.derniere_connexion
                      ? <>Hors ligne · vu {formatDistanceToNow(new Date(u.derniere_connexion), { addSuffix: true, locale: fr })}</>
                      : <>Jamais connecté</>
                  }
                </div>

                <div className="flex items-center justify-between mt-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${u.roles?.nom === 'admin' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'}`}>
                    {u.roles?.nom === 'admin' ? 'Administrateur' : 'Gestionnaire'}
                  </span>
                  <button
                    onClick={() => toggleActif(u)}
                    className={`text-xs px-3 py-1 rounded-full border transition-colors ${u.actif ? 'text-emerald-600 border-emerald-200 bg-emerald-50 hover:bg-emerald-100' : 'text-gray-500 border-gray-200 bg-gray-50 hover:bg-gray-100'}`}
                    title="Activer/désactiver l'accès au compte"
                  >
                    {u.actif ? 'Accès actif' : 'Accès suspendu'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900 dark:text-gray-100">{editItem ? 'Modifier l\'utilisateur' : 'Nouvel utilisateur'}</h2>
              <button onClick={() => setShowModal(false)} className="text-gray-400">✕</button>
            </div>
            <form onSubmit={sauvegarder} className="p-5 space-y-3">
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Nom complet *</label><input type="text" value={form.nom} onChange={e => setForm({...form, nom: e.target.value})} className="input-field" required /></div>
              <div><label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Téléphone (identifiant de connexion) *</label><input type="tel" value={form.telephone} onChange={e => setForm({...form, telephone: e.target.value})} className="input-field" required /></div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">Rôle / niveau d'accès *</label>
                <select value={form.role_id} onChange={e => setForm({...form, role_id: e.target.value})} className="input-field" required>
                  <option value="">Sélectionner...</option>
                  {roles.map(r => <option key={r.id} value={r.id}>{r.nom === 'admin' ? 'Administrateur' : 'Gestionnaire'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                  Mot de passe {editItem ? '(laisser vide pour ne pas changer)' : '*'}
                </label>
                <input type="password" value={form.mot_de_passe} onChange={e => setForm({...form, mot_de_passe: e.target.value})} className="input-field" placeholder={editItem ? 'Nouveau mot de passe...' : 'Mot de passe'} />
              </div>
              <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                <p className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">Question secrète (pour récupération de mot de passe)</p>
                <select value={form.question_secrete} onChange={e => setForm({...form, question_secrete: e.target.value})} className="input-field mb-2">
                  <option value="">Aucune question</option>
                  {QUESTIONS_SECRETES.map(q => <option key={q} value={q}>{q}</option>)}
                </select>
                {form.question_secrete && (
                  <input
                    type="text"
                    value={form.reponse_secrete}
                    onChange={e => setForm({...form, reponse_secrete: e.target.value})}
                    className="input-field"
                    placeholder={editItem?.question_secrete ? 'Nouvelle réponse (laisser vide pour ne pas changer)' : 'Réponse'}
                  />
                )}
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center">Annuler</button>
                <button type="submit" className="btn-primary flex-1 justify-center">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
