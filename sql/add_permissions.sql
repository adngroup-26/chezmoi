-- Ajoute une colonne JSON pour stocker les permissions (modules accessibles) par rôle
ALTER TABLE roles ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '[]'::jsonb;

-- L'admin a toujours accès à tout (géré côté code, mais on remplit aussi pour cohérence)
UPDATE roles SET permissions = '["dashboard","caisse","ventes","articles","categories","stock","clients","fournisseurs","utilisateurs","audit","parametres"]'::jsonb
WHERE nom = 'admin';

-- Permissions par défaut du gestionnaire (modulable ensuite depuis l'interface)
UPDATE roles SET permissions = '["caisse","ventes","articles","categories","stock","clients"]'::jsonb
WHERE nom = 'gestionnaire' AND (permissions IS NULL OR permissions = '[]'::jsonb);
