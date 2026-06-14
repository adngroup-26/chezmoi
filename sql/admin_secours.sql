-- Crée un compte administrateur de secours
-- Téléphone : 0700000099
-- Mot de passe : admin2024

INSERT INTO utilisateurs (telephone, nom, role_id, mot_de_passe_hash, actif)
SELECT
  '0700000099',
  'Admin Secours',
  r.id,
  encode('admin2024'::bytea, 'base64'),
  true
FROM roles r WHERE r.nom = 'admin'
ON CONFLICT (telephone) DO UPDATE
  SET mot_de_passe_hash = encode('admin2024'::bytea, 'base64'),
      actif = true,
      role_id = (SELECT id FROM roles WHERE nom = 'admin');

-- Vérification
SELECT u.nom, u.telephone, u.actif, r.nom as role
FROM utilisateurs u
LEFT JOIN roles r ON u.role_id = r.id
WHERE u.telephone = '0700000099';
