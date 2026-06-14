-- Ajoute une colonne pour figer le coût unitaire au moment de la saisie/modification de l'article.
-- C'est ce coût qui sera multiplié par la quantité restante pour calculer la valeur du stock,
-- afin que cette valeur diminue automatiquement avec les ventes.
ALTER TABLE articles ADD COLUMN IF NOT EXISTS cout_unitaire numeric(14,4) DEFAULT 0;

-- Initialisation à partir des données existantes :
-- cout_unitaire = ROUND((prix_achat + transport) / quantité actuelle), arrondi à l'entier
-- (le FCFA n'a pas de centimes, ce qui garantit des calculs exacts et sans décimales)
UPDATE articles
SET cout_unitaire = CASE
  WHEN quantite > 0 THEN ROUND((prix_achat + transport) / quantite)
  ELSE 0
END
WHERE cout_unitaire = 0 OR cout_unitaire IS NULL;
