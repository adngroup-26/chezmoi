-- ================================================================
-- CORRECTION : Contrainte unique sur parametres
-- ================================================================
-- Problème : la contrainte unique porte sur (cle) seule,
-- ce qui empêche plusieurs entreprises d'avoir les mêmes clés
-- (nom_entreprise, devise, etc.)
-- Solution : contrainte unique sur (cle, entreprise_id) combinés.

-- 1. Supprime l'ancienne contrainte
ALTER TABLE parametres DROP CONSTRAINT IF EXISTS parametres_cle_key;

-- 2. Ajoute la nouvelle contrainte (cle + entreprise_id)
ALTER TABLE parametres ADD CONSTRAINT parametres_cle_entreprise_key
  UNIQUE (cle, entreprise_id);
