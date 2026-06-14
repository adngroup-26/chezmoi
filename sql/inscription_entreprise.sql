-- ================================================================
-- INSCRIPTION LIBRE — Création automatique entreprise + admin + licence essai
-- ================================================================
-- Fonction atomique : crée tout en une seule transaction.
-- En cas d'erreur partielle, rien n'est créé (rollback automatique).

CREATE OR REPLACE FUNCTION inscrire_entreprise(
  p_nom_entreprise text,
  p_telephone_admin text,
  p_nom_admin text,
  p_mot_de_passe text
)
RETURNS jsonb AS $$
DECLARE
  v_entreprise_id uuid;
  v_role_admin_id uuid;
  v_utilisateur_id uuid;
  v_licence_id uuid;
  v_numero_licence text;
BEGIN
  -- Vérifie si ce numéro de téléphone existe déjà
  IF EXISTS (SELECT 1 FROM utilisateurs WHERE telephone = p_telephone_admin) THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Ce numéro de téléphone est déjà utilisé.');
  END IF;

  -- Vérifie si cette entreprise existe déjà
  IF EXISTS (SELECT 1 FROM entreprises WHERE lower(nom) = lower(trim(p_nom_entreprise))) THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Une entreprise avec ce nom existe déjà.');
  END IF;

  -- Récupère l'id du rôle admin
  SELECT id INTO v_role_admin_id FROM roles WHERE nom = 'admin' LIMIT 1;
  IF v_role_admin_id IS NULL THEN
    RETURN jsonb_build_object('succes', false, 'erreur', 'Configuration système invalide (rôle admin absent).');
  END IF;

  -- 1. Crée l'entreprise
  INSERT INTO entreprises (nom, telephone, statut)
  VALUES (trim(p_nom_entreprise), p_telephone_admin, 'active')
  RETURNING id INTO v_entreprise_id;

  -- 2. Crée le premier utilisateur (administrateur de l'entreprise)
  INSERT INTO utilisateurs (telephone, nom, role_id, mot_de_passe_hash, actif, entreprise_id)
  VALUES (
    p_telephone_admin,
    trim(p_nom_admin),
    v_role_admin_id,
    encode(p_mot_de_passe::bytea, 'base64'),
    true,
    v_entreprise_id
  )
  RETURNING id INTO v_utilisateur_id;

  -- 3. Génère le numéro de licence
  v_numero_licence := 'LIC-' || to_char(now(), 'YYYYMMDD') || '-' || substr(v_entreprise_id::text, 1, 6);

  -- 4. Crée la licence d'essai gratuit 15 jours
  INSERT INTO licences (
    entreprise_id, numero_licence, type_licence,
    date_debut, date_fin, montant, statut, max_utilisateurs
  )
  VALUES (
    v_entreprise_id,
    v_numero_licence,
    'essai',
    now(),
    now() + interval '15 days',
    0,
    'essai',
    3
  )
  RETURNING id INTO v_licence_id;

  -- 5. Crée les paramètres par défaut de l'entreprise
  INSERT INTO parametres (cle, valeur, entreprise_id) VALUES
    ('nom_entreprise', trim(p_nom_entreprise), v_entreprise_id),
    ('devise', 'FCFA', v_entreprise_id),
    ('telephone', p_telephone_admin, v_entreprise_id),
    ('adresse', '', v_entreprise_id);

  RETURN jsonb_build_object(
    'succes', true,
    'entreprise_id', v_entreprise_id::text,
    'utilisateur_id', v_utilisateur_id::text,
    'licence_id', v_licence_id::text,
    'numero_licence', v_numero_licence,
    'date_fin_essai', (now() + interval '15 days')::date::text
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('succes', false, 'erreur', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
