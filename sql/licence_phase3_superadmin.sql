-- ================================================================
-- CHEZMOI PRO — PHASE 3 : PORTAIL SUPER ADMINISTRATEUR
-- ================================================================

-- Table des super-administrateurs (totalement séparée des utilisateurs d'entreprise)
CREATE TABLE IF NOT EXISTS super_admins (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  telephone text UNIQUE NOT NULL,
  nom text NOT NULL,
  mot_de_passe_hash text NOT NULL,
  actif boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE super_admins DISABLE ROW LEVEL SECURITY;

-- Fonction de vérification du mot de passe super-admin
CREATE OR REPLACE FUNCTION verifier_super_admin(p_telephone text, p_mot_de_passe text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT mot_de_passe_hash INTO stored_hash
  FROM super_admins
  WHERE telephone = p_telephone AND actif = true;

  IF stored_hash IS NULL THEN RETURN false; END IF;
  RETURN stored_hash = encode(p_mot_de_passe::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Crée le premier compte super-admin
-- ⚠️ Téléphone : 0900000001 / Mot de passe : superadmin2026
-- À changer immédiatement après la première connexion !
INSERT INTO super_admins (telephone, nom, mot_de_passe_hash, actif)
VALUES ('0900000001', 'Super Admin', encode('superadmin2026'::bytea, 'base64'), true)
ON CONFLICT (telephone) DO NOTHING;

-- ================================================================
-- FONCTIONS DE GESTION POUR LE PORTAIL ADMIN
-- ================================================================

-- Vue agrégée pour le tableau de bord admin
CREATE OR REPLACE FUNCTION admin_stats_globales()
RETURNS TABLE(
  total_entreprises bigint,
  licences_actives bigint,
  licences_expirees bigint,
  licences_essai bigint,
  licences_suspendues bigint,
  total_utilisateurs bigint,
  revenus_mois numeric,
  revenus_annee numeric
) AS $$
BEGIN
  RETURN QUERY SELECT
    (SELECT COUNT(*) FROM entreprises),
    (SELECT COUNT(*) FROM licences WHERE statut = 'active'),
    (SELECT COUNT(*) FROM licences WHERE statut = 'expiree' OR (date_fin IS NOT NULL AND date_fin < now() AND statut IN ('essai','active'))),
    (SELECT COUNT(*) FROM licences WHERE statut = 'essai' AND (date_fin IS NULL OR date_fin >= now())),
    (SELECT COUNT(*) FROM licences WHERE statut = 'suspendue'),
    (SELECT COUNT(*) FROM utilisateurs WHERE actif = true),
    (SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE statut = 'paye' AND date_paiement >= date_trunc('month', now())),
    (SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE statut = 'paye' AND date_paiement >= date_trunc('year', now()));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
