-- Ajouter cette colonne à la table utilisateurs
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS mot_de_passe_hash text;

-- Fonction de vérification du mot de passe
CREATE OR REPLACE FUNCTION verifier_mot_de_passe(p_telephone text, p_mot_de_passe text)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT mot_de_passe_hash INTO stored_hash
  FROM utilisateurs
  WHERE telephone = p_telephone AND actif = true;
  
  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;
  
  -- Compare with base64 encoded password (simple version)
  RETURN stored_hash = encode(p_mot_de_passe::bytea, 'base64');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Créer le premier utilisateur admin
-- REMPLACE: 'TON_TELEPHONE' et 'TON_MOT_DE_PASSE'
INSERT INTO utilisateurs (telephone, nom, role_id, mot_de_passe_hash, actif)
SELECT 
  '0700000000',
  'Administrateur',
  r.id,
  encode('admin123'::bytea, 'base64'),
  true
FROM roles r WHERE r.nom = 'admin'
ON CONFLICT (telephone) DO NOTHING;

-- Politique de sécurité (RLS) - désactiver pour commencer
ALTER TABLE utilisateurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE articles DISABLE ROW LEVEL SECURITY;
ALTER TABLE ventes DISABLE ROW LEVEL SECURITY;
ALTER TABLE details_ventes DISABLE ROW LEVEL SECURITY;
ALTER TABLE clients DISABLE ROW LEVEL SECURITY;
ALTER TABLE fournisseurs DISABLE ROW LEVEL SECURITY;
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE mouvements_stock DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE parametres DISABLE ROW LEVEL SECURITY;
