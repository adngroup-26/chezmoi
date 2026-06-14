-- Optionnel : nettoyer la contrainte FK en double pour garder un schéma propre
-- (Pas obligatoire — le code ne dépend plus de la jointure automatique)

SELECT conname FROM pg_constraint
WHERE conrelid = 'utilisateurs'::regclass
  AND confrelid = 'roles'::regclass;

-- Une fois que tu as le nom de la contrainte EN TROP (celle nommée fk_utilisateurs_role
-- si elle apparaît en double), tu peux la supprimer avec :
-- ALTER TABLE utilisateurs DROP CONSTRAINT fk_utilisateurs_role;
