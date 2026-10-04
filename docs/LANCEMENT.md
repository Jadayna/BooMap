# BooMap — Plan de lancement (Halloween 2026)

## ✅ Fait le 2026-10-04
- Build réparé : `tsconfig.json` (ajouté après le MVP) écrasait `jsconfig.json` et cassait l'alias `@/` — `baseUrl`/`paths` ajoutés, `npm run build` passe.
- Icônes PWA ajoutées : `public/icon-192.png` + `public/icon-512.png` (manquantes, Chrome les exige pour l'install).
- Sécu : endpoint `POST /api/seed` protégé par `SEED_SECRET` (header `x-seed-secret`) en prod.
- Poussé sur `main`.

## 🎯 Décisions (validées par elle : « fais ce qu'il faut »)
- **Realtime** : on garde le polling 10 s, pas de Supabase. Suffisant pour une app saisonnière, un compte de moins.
- **Domaine** : `boomap.axecstudio.com` (gratuit, rapide, sous son domaine existant).
- **Stripe** : prix codé en dur côté serveur (499 ¢ CAD, `price_data` inline) — aucun produit à créer dans le dashboard, juste les clés live + webhook.

## 📋 Elle doit faire (4 trucs, comptes à elle)
1. **Token Mapbox** — https://account.mapbox.com → compte gratuit → Tokens → Default public token (scopes par défaut suffisent). Sert à : carte, autocomplétion d'adresse, itinéraires à pied.
2. **MongoDB Atlas** — https://cloud.mongodb.com → cluster gratuit M0 → Database Access (créer user + mot de passe) → Network Access → Allow access from anywhere (0.0.0.0/0) → Connect → Drivers → copier la connection string.
3. **Compte Stripe BooMap** (nouveau compte dédié, décision sept. 2026) → passer en mode **Live** → Developers → API keys → `sk_live_...` → Webhooks → Add endpoint `https://boomap.axecstudio.com/api/webhooks/stripe`, event `checkout.session.completed` → récupérer `whsec_...`.
4. **Reconnecter Vercel** dans l'app Muse (connexion sautée le 2026-10-04).

👉 Les 3 secrets (token Mapbox, connection string Mongo, clés Stripe) transitent par le **coffre**, jamais en clair.

## 🔧 Je fais ensuite (dès que j'ai les clés + Vercel)
1. Projet Vercel `boomap` + branchement du domaine `boomap.axecstudio.com` (DNS chez Spaceship).
2. Variables d'environnement : `MONGO_URL`, `DB_NAME=boomap`, `JWT_SECRET` (généré), `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_MAPBOX_TOKEN`, `SEED_SECRET` (généré), `NEXT_PUBLIC_BASE_URL=https://boomap.axecstudio.com`, `CORS_ORIGINS`.
3. Deploy + `POST /api/seed` (comptes `demo@boomap.ca` / `admin@boomap.ca` + 5 maisons démo à Montréal).
4. Test de paiement live 4,99 $ CAD (remboursé aussitôt).
5. Smoke test complet : carte, inscription donneur, override de statut, signalement, admin, FR/EN.

## ⏰ Timing
Halloween = 31 oct (27 jours). Viser la mise en ligne **mi-octobre** pour laisser ~2 semaines aux donneurs pour s'inscrire.
