-- Active la réplication temps réel (Realtime) sur les tables principales
-- Nécessaire pour que le tableau de bord se mette à jour automatiquement

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE articles;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE ventes;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE clients;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE mouvements_stock;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
