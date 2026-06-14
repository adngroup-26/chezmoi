-- ============================================
-- STATUT EN LIGNE/HORS LIGNE + SUPPRESSION DÉFINITIVE
-- ============================================

-- Suivi de la dernière connexion
ALTER TABLE utilisateurs ADD COLUMN IF NOT EXISTS derniere_connexion timestamptz;

-- Fonction appelée à chaque connexion réussie
CREATE OR REPLACE FUNCTION enregistrer_connexion(p_telephone text)
RETURNS void AS $$
BEGIN
  UPDATE utilisateurs SET derniere_connexion = now() WHERE telephone = p_telephone;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permet la suppression définitive d'un utilisateur :
-- les ventes/mouvements existants conservent leur trace mais perdent la référence (utilisateur_id = NULL)
ALTER TABLE ventes DROP CONSTRAINT IF EXISTS ventes_utilisateur_id_fkey;
ALTER TABLE ventes ADD CONSTRAINT ventes_utilisateur_id_fkey
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL;

ALTER TABLE mouvements_stock DROP CONSTRAINT IF EXISTS mouvements_stock_utilisateur_id_fkey;
ALTER TABLE mouvements_stock ADD CONSTRAINT mouvements_stock_utilisateur_id_fkey
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL;

ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_utilisateur_id_fkey;
ALTER TABLE audit_logs ADD CONSTRAINT audit_logs_utilisateur_id_fkey
  FOREIGN KEY (utilisateur_id) REFERENCES utilisateurs(id) ON DELETE SET NULL;
