import { logger } from './logger'
import { createContext, useContext, useEffect, useState, useRef, ReactNode } from 'react'
import { supabase } from './supabase'
import { Utilisateur, Role } from '../types'

// ── Types ─────────────────────────────────────────────────────────────────
interface AuthContextType {
  utilisateur: Utilisateur | null
  loading: boolean
  connexion: (telephone: string, motDePasse: string) => Promise<{ error?: string }>
  deconnexion: () => Promise<void>
  isAdmin: boolean
}

// ── Messages d'erreur précis ───────────────────────────────────────────────
const MESSAGES_ERREUR: Record<string, string> = {
  compte_introuvable:         'Ce numéro de téléphone n\'est pas enregistré.',
  compte_suspendu:            'Votre compte a été suspendu. Contactez votre administrateur.',
  mot_de_passe_incorrect:     'Mot de passe incorrect. Vérifiez votre saisie.',
  mot_de_passe_non_configure: 'Mot de passe non configuré. Contactez votre administrateur.',
  question_non_configuree:    'Aucune question secrète configurée. Contactez votre administrateur.',
  reponse_incorrecte:         'Réponse à la question secrète incorrecte.',
  reseau:                     'Connexion impossible. Vérifiez votre accès internet.',
  serveur:                    'Serveur indisponible. Réessayez dans quelques instants.',
}

function getMessage(raison: string): string {
  return MESSAGES_ERREUR[raison] || `Erreur : ${raison}`
}

const AuthContext = createContext<AuthContextType | null>(null)
const STORAGE_KEY = 'chezmoi_user'

// ── Normalise l'utilisateur (gère roles comme objet ou tableau) ────────────
async function normaliserUtilisateur(data: Record<string, unknown>): Promise<Utilisateur> {
  let roles = data.roles as Role | Role[] | null
  if (Array.isArray(roles)) roles = roles.length > 0 ? roles[0] : null

  // Fallback : charge le rôle manuellement si la jointure est vide
  if (!roles && data.role_id) {
    const { data: roleData } = await supabase
      .from('roles').select('*').eq('id', data.role_id as string).single()
    roles = roleData || null
  }

  return { ...(data as unknown as Utilisateur), roles: (roles as Role) || undefined }
}

// ── Nettoie le localStorage si corrompu ───────────────────────────────────
function nettoyerSession() {
  try { localStorage.removeItem(STORAGE_KEY) } catch { /* ignore */ }
}

function lireSession(): Utilisateur | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (!stored) return null
    const u = JSON.parse(stored)
    // Vérifie que les champs essentiels sont présents
    if (!u?.id || !u?.telephone) { nettoyerSession(); return null }
    return u as Utilisateur
  } catch {
    nettoyerSession()
    return null
  }
}

function ecrireSession(u: Utilisateur) {
  try {
    const data = {
      id: u.id,
      nom: u.nom,
      telephone: u.telephone,
      role_id: u.role_id,
      actif: u.actif,
      roles: u.roles,
      entreprise_id: (u as unknown as { entreprise_id?: string }).entreprise_id,
      created_at: u.created_at,
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
  } catch { /* ignore si storage plein */ }
}

// ── Enregistre dans le journal (sans bloquer) ─────────────────────────────
async function journaliser(
  telephone: string,
  succes: boolean,
  raison: string,
  entrepriseId?: string
) {
  try {
    await supabase.from('journal_connexions').insert({
      telephone,
      succes,
      raison,
      entreprise_id: entrepriseId || null,
      user_agent: navigator.userAgent.slice(0, 200),
    })
  } catch { /* ne jamais bloquer la connexion à cause du journal */ }
}

// ── Provider ──────────────────────────────────────────────────────────────
export function AuthProvider({ children }: { children: ReactNode }) {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(null)
  const [loading, setLoading] = useState(true)
  const verificationEnCours = useRef(false)

  useEffect(() => {
    // Évite les doubles initialisations (React StrictMode)
    if (verificationEnCours.current) return
    verificationEnCours.current = true

    const sessionLocale = lireSession()

    if (sessionLocale) {
      // Affiche immédiatement l'utilisateur en cache (UX rapide)
      setUtilisateur(sessionLocale)
      setLoading(false)

      // Vérifie en arrière-plan que le compte est toujours valide
      setTimeout(async () => {
        try {
          const isOnline = navigator.onLine
          if (!isOnline) return // Hors ligne : on garde la session locale

          const { data, error } = await supabase
            .from('utilisateurs').select('*, roles(*)')
            .eq('id', sessionLocale.id).eq('actif', true).single()

          if (error || !data) {
            // Compte désactivé ou supprimé → déconnexion propre
            logger.log('[AUTH] Session invalide, déconnexion')
            nettoyerSession()
            setUtilisateur(null)
          } else {
            // Rafraîchit les données (rôle, permissions, etc.)
            const userFrais = await normaliserUtilisateur(data)
            ecrireSession(userFrais)
            setUtilisateur(userFrais)
          }
        } catch {
          // Erreur réseau → garde la session locale, ne déconnecte pas
          logger.log('[AUTH] Vérification arrière-plan échouée (réseau), session conservée')
        }
      }, 2000) // Délai pour ne pas bloquer le rendu initial

    } else {
      setLoading(false)
    }
  }, [])

  // ── Connexion ────────────────────────────────────────────────────────────
  const connexion = async (telephone: string, motDePasse: string) => {
    const tel = telephone.trim()
    const mdp = motDePasse.trim()

    if (!tel || !mdp) return { error: 'Veuillez remplir tous les champs.' }

    // Vérifie la connexion internet
    if (!navigator.onLine) {
      return { error: 'Pas de connexion internet. Vérifiez votre réseau.' }
    }

    try {
      logger.log('[AUTH] Connexion:', tel)

      // ÉTAPE 1 : Vérification du mot de passe bcrypt (RPC sécurisée)
      const { data: result, error: rpcError } = await supabase
        .rpc('verifier_mot_de_passe', {
          p_telephone: tel,
          p_mot_de_passe: mdp
        })

      if (rpcError) {
        logger.error('[AUTH] Erreur RPC verifier_mot_de_passe:', rpcError)
        await journaliser(tel, false, 'erreur_rpc')
        // Distingue erreur réseau vs erreur serveur
        if (rpcError.message?.includes('Failed to fetch') || rpcError.message?.includes('NetworkError')) {
          return { error: MESSAGES_ERREUR.reseau }
        }
        return { error: MESSAGES_ERREUR.serveur }
      }

      // La fonction retourne maintenant un JSONB avec ok + raison
      const authResult = result as { ok: boolean; raison: string }
      logger.log('[AUTH] Résultat vérification:', authResult)

      if (!authResult?.ok) {
        const raison = authResult?.raison || 'inconnu'
        await journaliser(tel, false, raison)
        return { error: getMessage(raison) }
      }

      // ÉTAPE 2 : Chargement des données utilisateur via RPC (contourne RLS)
      const { data: userData, error: userError } = await supabase
        .rpc('charger_utilisateur', { p_telephone: tel })

      if (userError || !userData || userData.length === 0) {
        logger.error('[AUTH] Chargement utilisateur échoué:', userError)
        // Fallback : tentative directe
        const { data: userData2, error: userError2 } = await supabase
          .from('utilisateurs').select('*, roles(*)')
          .eq('telephone', tel).eq('actif', true).single()
        if (userError2 || !userData2) {
          logger.error('[AUTH] Fallback échoué:', userError2)
          await journaliser(tel, false, 'chargement_utilisateur_echoue')
          return { error: getMessage('compte_introuvable') }
        }
        const userNormalise2 = await normaliserUtilisateur(userData2)
        const entrepriseId2 = (userNormalise2 as unknown as { entreprise_id?: string }).entreprise_id
        ecrireSession(userNormalise2)
        setUtilisateur(userNormalise2)
        await journaliser(tel, true, 'succes', entrepriseId2)
        supabase.rpc('enregistrer_connexion', { p_telephone: tel }).then(() => {})
        return {}
      }

      const userNormalise = await normaliserUtilisateur(userData[0] as Record<string, unknown>)
      const entrepriseId = (userNormalise as unknown as { entreprise_id?: string }).entreprise_id

      // ÉTAPE 4 : Vérification de la licence
      if (entrepriseId) {
        const { data: licenceData } = await supabase
          .rpc('verifier_licence', { p_entreprise_id: entrepriseId })
        if (licenceData && licenceData.length > 0) {
          const lic = licenceData[0] as { statut: string }
          if (lic.statut === 'resiliee') {
            await journaliser(tel, false, 'licence_resiliee', entrepriseId)
            return { error: 'Votre abonnement a été résilié. Contactez ChezMoi Pro.' }
          }
          // Note : les licences expirées permettent la connexion mais bloquent les ventes
        }
      }

      // ÉTAPE 5 : Sauvegarde session
      ecrireSession(userNormalise)
      setUtilisateur(userNormalise)

      // ÉTAPE 6 : Journal + dernière connexion (sans bloquer)
      await journaliser(tel, true, 'succes', entrepriseId)
      supabase.rpc('enregistrer_connexion', { p_telephone: tel })
        .then(({ error: e }) => { if (e) logger.error('[AUTH] Erreur enregistrement connexion:', e) })

      logger.log('[AUTH] Connexion réussie:', userNormalise.nom, '| Rôle:', userNormalise.roles?.nom)
      return {}

    } catch (e) {
      const msg = (e as Error)?.message || ''
      logger.error('[AUTH] Exception:', e)
      await journaliser(tel, false, 'exception: ' + msg)
      if (msg.includes('Failed to fetch') || msg.includes('NetworkError') || !navigator.onLine) {
        return { error: MESSAGES_ERREUR.reseau }
      }
      return { error: MESSAGES_ERREUR.serveur }
    }
  }

  // ── Déconnexion ──────────────────────────────────────────────────────────
  const deconnexion = async () => {
    const tel = utilisateur?.telephone
    nettoyerSession()
    setUtilisateur(null)
    if (tel) {
      await journaliser(tel, true, 'deconnexion').catch(() => {})
    }
  }

  const isAdmin = utilisateur?.roles?.nom === 'admin'

  return (
    <AuthContext.Provider value={{ utilisateur, loading, connexion, deconnexion, isAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
