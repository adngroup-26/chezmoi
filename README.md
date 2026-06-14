# ChezMoi — Guide de déploiement

## Étapes pour mettre en ligne

### 1. Préparer Supabase
Exécuter le fichier `supabase_setup_2.sql` dans le SQL Editor de Supabase.
Cela crée :
- La colonne mot de passe
- La fonction de vérification
- Un compte admin par défaut (téléphone: 0700000000 / mot de passe: admin123)
- Désactive les restrictions de sécurité pour commencer

### 2. Pousser le code sur GitHub
```bash
cd chezmoi
git init
git add .
git commit -m "Initial commit ChezMoi"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/chezmoi.git
git push -u origin main
```

### 3. Déployer sur Vercel
1. Aller sur vercel.com
2. "New Project" → Importer depuis GitHub → Sélectionner "chezmoi"
3. Ajouter les variables d'environnement :
   - `VITE_SUPABASE_URL` = https://fdijjkhcgzgynilbwwge.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = (ta clé anon)
4. Cliquer "Deploy"

### 4. Première connexion
- Téléphone : `0700000000`
- Mot de passe : `admin123`
- **IMPORTANT** : Changer immédiatement le mot de passe et le numéro de téléphone !
