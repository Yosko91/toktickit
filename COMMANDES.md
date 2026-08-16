# Séquence à exécuter (PowerShell)

Copie d'abord tous les fichiers de ce patch dans `C:\Users\yohan\toktickit`
en écrasant les existants. Ne touche pas à `client/package.json` ni
`client/tsconfig*.json` : garde les tiens.

---

## 1. Backend

```powershell
cd C:\Users\yohan\toktickit\server

npm install cors
npm install -D @types/cors

# .env en UTF-8 (adapte user / mot de passe / base)
Set-Content -Path .env -Encoding utf8 -Value 'DATABASE_URL="postgresql://postgres:TON_MDP@localhost:5432/toktickit?schema=public"','PORT=3000'

# vérification : doit afficher l'URL, pas undefined
node -e "require('dotenv').config(); console.log(process.env.DATABASE_URL)"

npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed          # doit afficher : Seed complete - 4 categories in database
npm run prisma:seed          # relance : toujours 4 (preuve d'idempotence -> SCREEN)
```

Puis lance le serveur et vérifie l'endpoint :

```powershell
npm run dev
```

Dans le navigateur : `http://localhost:3000/api/categories`
-> doit afficher les 4 catégories en JSON. **SCREEN à prendre.**

---

## 2. Frontend

```powershell
cd C:\Users\yohan\toktickit\client

npm install bootstrap
npm install -D vitest jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event

Set-Content -Path .env -Encoding utf8 -Value 'VITE_API_URL="http://localhost:3000"'
```

Ajoute `"test": "vitest run"` dans les `scripts` de `client/package.json`.

Supprime `client/src/App.css` et `client/src/index.css` (le CSS par défaut de
Vite centre tout et casse le rendu Bootstrap). Vérifie qu'aucun `import
'./index.css'` ne reste dans `main.tsx`.

```powershell
npm run dev
```

---

## 3. Tests

```powershell
cd C:\Users\yohan\toktickit\server
npm test        # 2 tests -> SCREEN

cd ..\client
npm test        # 3 tests -> SCREEN
```

---

## 4. Captures de démo (Partie 4)

Serveur + client lancés, sur `http://localhost:5173` :

1. **SCREEN** état initial : titre `TokTickIT IT Service Desk` + bouton `[Check System]`
2. Clic -> **SCREEN** succès : `System Status: Online` + les 4 catégories numérotées
3. Arrête le serveur backend (Ctrl+C), recharge, reclique
   -> **SCREEN** échec : `System Status: Offline` + `Unable to connect to TokTickIT API`

---

## 5. Git : finaliser l'Issue 4 puis merger tout

```powershell
cd C:\Users\yohan\toktickit

# le .gitignore n'était pas suivi
git add -f .gitignore
git add .
git status                   # vérifie qu'aucun .env n'apparaît

git checkout -b feature/4-category-list
git commit -m "feat: display IT request category list from PostgreSQL via Prisma"
git push -u origin feature/4-category-list
```

Sur GitHub : ouvre la PR `feature/4-category-list` -> `lab1-staging`,
fais-la relire et approuver par ton binôme, puis merge.

Ensuite, PR `lab1-staging` -> `main`, merge.

```powershell
git checkout main
git pull
git log --oneline --graph --all --decorate    # SCREEN de l'historique
```

---

## 6. Captures restantes à prendre

- Board Kanban avec les **4 issues en Done**
- Arborescence complète du repo dans l'IDE (avec `docs/lab-01/` visible)
- `README.md` rendu sur GitHub
- Contenu du `.gitignore`
- Les PR : liste, et les commentaires de review (le sien sur tes PR, le tien sur les siennes)
- Sortie des tests backend et frontend
- Les 3 captures de démo

---

## 7. À remplir à la main

- `docs/lab-01/reviewer.md` : nom, student ID, GitHub du binôme, liens des PR,
  commentaires de review réels
- `docs/lab-01/ai_use.md` : le modèle LLM utilisé + la colonne « My Reflection »
  de chaque prompt + la réflexion finale
- `docs/lab-01/tests.md` : coller les sorties de tests
