# README_BACKEND.md — Connexion Supabase

Guide pas à pas pour passer du mode mocké (`USE_MOCK = true` dans
`services/api.ts`) à un vrai backend Supabase. Ne nécessite qu'un
navigateur — peut se faire depuis n'importe quel réseau, y compris
un Wi-Fi de bar.

## 1. Créer le projet Supabase

1. Va sur https://supabase.com/dashboard et connecte-toi (ou crée un compte).
2. Clique **New Project**.
3. Nom : `panier-malin` (ou ce que tu veux).
4. Choisis un mot de passe de base de données fort — **note-le quelque part**,
   tu en auras besoin une seule fois si tu dois te connecter en direct à
   Postgres, mais pas pour l'usage normal de l'app.
5. Région : `eu-west-3 (Paris)` de préférence, pour la latence.
6. Clique **Create new project**. Patiente ~2 minutes que le projet se
   provisionne.

## 2. Exécuter le schéma

1. Une fois le projet prêt, va dans le menu de gauche → **SQL Editor**.
2. Clique **New query**.
3. Ouvre le fichier `supabase/schema.sql` de ce projet, copie tout son
   contenu, colle-le dans l'éditeur.
4. Clique **Run** (ou Cmd+Entrée).
5. Tu dois voir `Success. No rows returned` (ou similaire). Si une erreur
   apparaît, copie-la moi exactement — ne réessaie pas en modifiant à
   l'aveugle, certaines instructions (`create table if not exists`) sont
   idempotentes mais d'autres (policies) ne le sont pas et peuvent échouer
   au 2e essai avec un message normal ("policy already exists").

## 3. Vérifier que les tables existent

1. Menu de gauche → **Table Editor**.
2. Tu dois voir : `users_profiles`, `follows`, `stores`, `products`,
   `prices`, `shopping_lists`, `list_items`, `list_collaborators`,
   `saved_baskets`, `saved_basket_items`, `basket_collaborators`,
   `community_activity`, `events`, `event_participants`, `event_items`.

## 4. Vérifier le bucket de stockage

1. Menu de gauche → **Storage**.
2. Tu dois voir un bucket `price-proofs` marqué **Public**.
3. S'il n'apparaît pas (l'insert SQL peut être bloqué selon les droits),
   crée-le manuellement : **New bucket** → nom `price-proofs` → coche
   **Public bucket** → Create.

## 5. Récupérer les clés API

1. Menu de gauche → **Project Settings** (icône engrenage) → **API**.
2. Copie :
   - **Project URL** (ex: `https://xxxxxxxx.supabase.co`)
   - **anon public** key (sous "Project API keys")

## 6. Configurer le projet local

Sur ton Mac, dans `~/Desktop/PanierMalin` :

```bash
cp .env.example .env
```

Ouvre `.env` et remplace les valeurs :

```
EXPO_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJxxxxxxxxxxxxxxxxxxxxxxxx
```

(les vraies valeurs copiées à l'étape 5)

## 7. Activer l'authentification par email

1. Menu de gauche → **Authentication** → **Providers**.
2. Vérifie que **Email** est activé (c'est le cas par défaut).
3. Pour le développement, dans **Authentication** → **Settings**, tu peux
   désactiver "Confirm email" temporairement pour tester plus vite sans
   avoir à cliquer un lien reçu par mail à chaque inscription.

## Ce qui n'est PAS encore fait après ces étapes

- Aucune donnée de test (produits, magasins, prix) n'est insérée — les
  tables sont vides. `USE_MOCK` doit rester `true` dans `services/api.ts`
  jusqu'à ce qu'on bascule chaque fonction individuellement ET qu'on ait
  un minimum de données réelles ou de test à afficher.
- Les Edge Functions (`optimize-basket`, `award-points`) ne sont pas encore
  écrites — l'optimisation de panier et le calcul de points restent mockés
  même après connexion Supabase.
- L'authentification n'est pas branchée dans l'app (pas d'écran login/signup
  fonctionnel) — c'est la prochaine étape une fois ce guide terminé.

## Prochaine étape une fois ce guide suivi

Dis-moi quand les étapes 1 à 7 sont faites (tu peux juste répondre "fait"),
et on passe à l'écriture des écrans d'authentification réels connectés à
`supabase.auth`.
