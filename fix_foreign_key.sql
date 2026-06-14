-- Ajoute la contrainte de clé étrangère manquante entre utilisateurs.role_id et roles.id
-- Cela permettra à Supabase de faire la jointure automatique roles(*)

ALTER TABLE utilisateurs
  ADD CONSTRAINT fk_utilisateurs_role
  FOREIGN KEY (role_id) REFERENCES roles(id);

-- Vérification : ce SELECT doit maintenant renvoyer le rôle correctement
SELECT u.nom, u.role_id, r.nom as role_nom
FROM utilisateurs u
LEFT JOIN roles r ON u.role_id = r.id;
