-- ============================================
-- RÉINITIALISATION DE MOT DE PASSE — Question secrète
-- ============================================

ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS question_secrete text;
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS reponse_secrete_hash text;

-- Fonction : vérifie la réponse secrète et retourne la question pour un téléphone donné
CREATE OR REPLACE FUNCTION obtenir_question_secrete(p_telephone text)
RETURNS TABLE(question text, a_une_question boolean) AS $$
BEGIN
  RETURN QUERY
  SELECT u.question_secrete, (u.question_secrete IS NOT NULL AND u.reponse_secrete_hash IS NOT NULL)
  FROM utilisateurs u
  WHERE u.telephone = p_telephone AND u.actif = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction : vérifie la réponse et réinitialise le mot de passe si correcte
CREATE OR REPLACE FUNCTION reinitialiser_mot_de_passe(
  p_telephone text,
  p_reponse text,
  p_nouveau_mot_de_passe text
)
RETURNS boolean AS $$
DECLARE
  stored_hash text;
BEGIN
  SELECT reponse_secrete_hash INTO stored_hash
  FROM utilisateurs
  WHERE telephone = p_telephone AND actif = true;

  IF stored_hash IS NULL THEN
    RETURN false;
  END IF;

  -- Comparaison insensible à la casse et aux espaces de la réponse
  IF stored_hash != encode(lower(trim(p_reponse))::bytea, 'base64') THEN
    RETURN false;
  END IF;

  UPDATE utilisateurs
  SET mot_de_passe_hash = encode(p_nouveau_mot_de_passe::bytea, 'base64')
  WHERE telephone = p_telephone;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction : permet à un utilisateur connecté de définir/modifier sa question secrète
CREATE OR REPLACE FUNCTION definir_question_secrete(
  p_telephone text,
  p_question text,
  p_reponse text
)
RETURNS boolean AS $$
BEGIN
  UPDATE utilisateurs
  SET question_secrete = p_question,
      reponse_secrete_hash = encode(lower(trim(p_reponse))::bytea, 'base64')
  WHERE telephone = p_telephone AND actif = true;
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
