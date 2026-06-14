-- ================================================================
-- CHEZMOI PRO — PHASE 1 : FONDATION MULTI-TENANT + LICENCES
-- ================================================================
-- IMPORTANT : Ce script transforme ChezMoi en application multi-entreprises.
-- Toutes les données existantes seront rattachées à une "entreprise" par défaut
-- (celle de l'utilisateur admin actuel), afin de ne rien casser.

-- ================================================================
-- 1. TABLE ENTREPRISES (un compte = une entreprise = un tenant)
-- ================================================================
CREATE TABLE IF NOT EXISTS entreprises (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  nom text NOT NULL,
  telephone text,
  adresse text,
  email text,
  statut text NOT NULL DEFAULT 'active', -- active, suspendue, resiliee
  created_at timestamptz DEFAULT now()
);

-- ================================================================
-- 2. TABLE LICENCES
-- ================================================================
CREATE TABLE IF NOT EXISTS licences (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  entreprise_id uuid REFERENCES entreprises(id) ON DELETE CASCADE,
  numero_licence text UNIQUE NOT NULL,
  type_licence text NOT NULL DEFAULT 'essai', -- essai, mensuelle, semestrielle, annuelle, a_vie
  date_debut timestamptz NOT NULL DEFAULT now(),
  date_fin timestamptz, -- NULL pour licence à vie
  montant numeric(12,2) DEFAULT 0,
  statut text NOT NULL DEFAULT 'essai', -- essai, active, expiree, suspendue, resiliee
  max_utilisateurs integer NOT NULL DEFAULT 3,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_licences_entreprise ON licences(entreprise_id);
CREATE INDEX IF NOT EXISTS idx_licences_statut ON licences(statut);
CREATE INDEX IF NOT EXISTS idx_licences_date_fin ON licences(date_fin);

-- ================================================================
-- 3. TABLE PAIEMENTS
-- ================================================================
CREATE TABLE IF NOT EXISTS paiements (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  licence_id uuid REFERENCES licences(id) ON DELETE CASCADE,
  montant numeric(12,2) NOT NULL,
  moyen_paiement text, -- mobile_money, especes, virement, carte
  reference_paiement text,
  date_paiement timestamptz NOT NULL DEFAULT now(),
  statut text NOT NULL DEFAULT 'paye', -- paye, en_attente, rembourse, annule
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_paiements_licence ON paiements(licence_id);
CREATE INDEX IF NOT EXISTS idx_paiements_date ON paiements(date_paiement);

-- ================================================================
-- 4. TABLE ACTIVATIONS (suivi des appareils/connexions pour le mode hors ligne 30j)
-- ================================================================
CREATE TABLE IF NOT EXISTS activations (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  licence_id uuid REFERENCES licences(id) ON DELETE CASCADE,
  appareil text,
  adresse_ip text,
  date_activation timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activations_licence ON activations(licence_id);

-- ================================================================
-- 5. RATTACHEMENT DES DONNÉES EXISTANTES À UNE ENTREPRISE PAR DÉFAUT
-- ================================================================

-- Crée l'entreprise par défaut à partir des paramètres existants
DO $$
DECLARE
  v_entreprise_id uuid;
  v_nom text;
  v_tel text;
  v_adresse text;
BEGIN
  SELECT valeur INTO v_nom FROM parametres WHERE cle = 'nom_entreprise';
  SELECT valeur INTO v_tel FROM parametres WHERE cle = 'telephone';
  SELECT valeur INTO v_adresse FROM parametres WHERE cle = 'adresse';

  INSERT INTO entreprises (nom, telephone, adresse, statut)
  VALUES (COALESCE(v_nom, 'Mon Commerce'), v_tel, v_adresse, 'active')
  RETURNING id INTO v_entreprise_id;

  -- Crée une licence d'essai de 15 jours pour cette entreprise
  INSERT INTO licences (entreprise_id, numero_licence, type_licence, date_debut, date_fin, montant, statut, max_utilisateurs)
  VALUES (
    v_entreprise_id,
    'LIC-' || to_char(now(), 'YYYYMMDD') || '-' || substr(v_entreprise_id::text, 1, 6),
    'essai',
    now(),
    now() + interval '15 days',
    0,
    'essai',
    3
  );

  -- Ajoute la colonne entreprise_id aux tables existantes et rattache toutes les données
  -- à cette entreprise par défaut (idempotent : ne fait rien si déjà fait)
  PERFORM 1; -- placeholder, voir ALTER TABLE ci-dessous

  -- Stocke l'id pour les ALTER TABLE suivants via une table temporaire de config
  CREATE TABLE IF NOT EXISTS _migration_config (cle text PRIMARY KEY, valeur text);
  INSERT INTO _migration_config (cle, valeur) VALUES ('entreprise_par_defaut', v_entreprise_id::text)
    ON CONFLICT (cle) DO UPDATE SET valeur = v_entreprise_id::text;
END $$;

-- ================================================================
-- 6. AJOUT DE entreprise_id AUX TABLES MÉTIER EXISTANTES
-- ================================================================

DO $$
DECLARE
  v_entreprise_id uuid;
  v_table text;
BEGIN
  SELECT valeur::uuid INTO v_entreprise_id FROM _migration_config WHERE cle = 'entreprise_par_defaut';

  FOREACH v_table IN ARRAY ARRAY['utilisateurs','articles','categories','fournisseurs','clients','ventes','mouvements_stock','audit_logs','parametres']
  LOOP
    EXECUTE format('ALTER TABLE %I ADD COLUMN IF NOT EXISTS entreprise_id uuid REFERENCES entreprises(id)', v_table);
    EXECUTE format('UPDATE %I SET entreprise_id = $1 WHERE entreprise_id IS NULL', v_table) USING v_entreprise_id;
    EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%s_entreprise ON %I(entreprise_id)', v_table, v_table);
  END LOOP;
END $$;

-- Nettoyage de la table temporaire
DROP TABLE IF EXISTS _migration_config;

-- ================================================================
-- 7. FONCTION DE VÉRIFICATION DE LICENCE
-- ================================================================
-- Retourne le statut courant de la licence d'une entreprise, en recalculant
-- "expiree" si date_fin est dépassée (sans attendre un job planifié)
CREATE OR REPLACE FUNCTION verifier_licence(p_entreprise_id uuid)
RETURNS TABLE(
  statut text,
  type_licence text,
  date_fin timestamptz,
  jours_restants integer,
  max_utilisateurs integer,
  nb_utilisateurs_actuels integer
) AS $$
DECLARE
  v_licence record;
  v_statut_calcule text;
  v_jours integer;
BEGIN
  SELECT * INTO v_licence
  FROM licences l
  WHERE l.entreprise_id = p_entreprise_id
  ORDER BY l.created_at DESC
  LIMIT 1;

  IF v_licence IS NULL THEN
    RETURN QUERY SELECT 'introuvable'::text, NULL::text, NULL::timestamptz, 0, 0, 0;
    RETURN;
  END IF;

  v_statut_calcule := v_licence.statut;

  -- Recalcule "expiree" si la date est dépassée et que le statut ne le reflète pas déjà
  IF v_licence.date_fin IS NOT NULL AND v_licence.date_fin < now()
     AND v_licence.statut IN ('essai', 'active') THEN
    v_statut_calcule := 'expiree';
  END IF;

  v_jours := CASE
    WHEN v_licence.date_fin IS NULL THEN 999999 -- licence à vie
    ELSE CEIL(EXTRACT(EPOCH FROM (v_licence.date_fin - now())) / 86400)::integer
  END;

  RETURN QUERY SELECT
    v_statut_calcule,
    v_licence.type_licence,
    v_licence.date_fin,
    v_jours,
    v_licence.max_utilisateurs,
    (SELECT COUNT(*)::integer FROM utilisateurs u WHERE u.entreprise_id = p_entreprise_id AND u.actif = true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ================================================================
-- 8. SÉCURITÉ : RLS PAR ENTREPRISE
-- ================================================================
-- Note : l'app utilise actuellement la clé "anon" sans Supabase Auth natif,
-- donc RLS basé sur auth.uid() n'est pas applicable directement.
-- L'isolation est assurée côté application (filtre entreprise_id sur chaque requête).
-- RLS reste désactivé sur ces tables (cohérent avec le reste du projet).
