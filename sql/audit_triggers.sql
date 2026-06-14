-- ============================================
-- SYSTÈME D'AUDIT AUTOMATIQUE — ChezMoi
-- ============================================
-- Ces triggers enregistrent automatiquement toute création,
-- modification ou suppression dans les tables principales.

ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- Fonction générique d'audit
CREATE OR REPLACE FUNCTION fn_audit_trigger()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id uuid;
BEGIN
  -- Tente de récupérer l'utilisateur depuis la nouvelle ou ancienne ligne
  IF TG_OP = 'DELETE' THEN
    v_user_id := NULLIF((OLD.utilisateur_id)::text, '')::uuid;
  ELSE
    BEGIN
      v_user_id := NULLIF((NEW.utilisateur_id)::text, '')::uuid;
    EXCEPTION WHEN OTHERS THEN
      v_user_id := NULL;
    END;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_logs (utilisateur_id, table_name, action, ancienne_valeur, nouvelle_valeur)
    VALUES (v_user_id, TG_TABLE_NAME, 'creation', NULL, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_logs (utilisateur_id, table_name, action, ancienne_valeur, nouvelle_valeur)
    VALUES (v_user_id, TG_TABLE_NAME, 'modification', row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_logs (utilisateur_id, table_name, action, ancienne_valeur, nouvelle_valeur)
    VALUES (v_user_id, TG_TABLE_NAME, 'suppression', row_to_json(OLD)::jsonb, NULL);
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Articles
DROP TRIGGER IF EXISTS trg_audit_articles ON articles;
CREATE TRIGGER trg_audit_articles
AFTER INSERT OR UPDATE OR DELETE ON articles
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Clients
DROP TRIGGER IF EXISTS trg_audit_clients ON clients;
CREATE TRIGGER trg_audit_clients
AFTER INSERT OR UPDATE OR DELETE ON clients
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Fournisseurs
DROP TRIGGER IF EXISTS trg_audit_fournisseurs ON fournisseurs;
CREATE TRIGGER trg_audit_fournisseurs
AFTER INSERT OR UPDATE OR DELETE ON fournisseurs
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Ventes
DROP TRIGGER IF EXISTS trg_audit_ventes ON ventes;
CREATE TRIGGER trg_audit_ventes
AFTER INSERT OR UPDATE OR DELETE ON ventes
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Mouvements de stock
DROP TRIGGER IF EXISTS trg_audit_mouvements ON mouvements_stock;
CREATE TRIGGER trg_audit_mouvements
AFTER INSERT OR UPDATE OR DELETE ON mouvements_stock
FOR EACH ROW EXECUTE FUNCTION fn_audit_trigger();

-- Index pour accélérer la consultation
CREATE INDEX IF NOT EXISTS idx_audit_table_name ON audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs(action);
