# Boutik

Application de gestion de  **stock**, de **caisse** et de **ventes à crédit** pour les boutiques
en Afrique (lancement au Bénin, FCFA). Elle fonctionne **sans internet** : tout est enregistré dans
l'appareil, puis synchronisé avec le serveur dès que le réseau revient.

Un seul code pour Android (prioritaire), iPhone (version web installable) et ordinateur.

- **La documentation technique** (commandes, procédures, architecture, fonctionnalités, base de données) : [docs/DOCUMENTATION-TECHNIQUE.md](docs/DOCUMENTATION-TECHNIQUE.md)
- Le plan, les décisions et l'avancement : [docs/PLAN.md](docs/PLAN.md)
- Les besoins d'origine : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)
- Avant le lancement, et les choix à faire (Windows, abonnement) : [docs/LANCEMENT.md](docs/LANCEMENT.md)

## Ce que fait Boutik

| Rubrique              | Contenu                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Caisse**            | panier rapide (recherche, code-barres, lecteur USB), unités (sac, kilo, carton…), remise limitée par personne, paiement mixte ou partiel (le reste passe en crédit), monnaie à rendre, annulation et retour d'articles |
| **Factures**          | PDF fabriqué dans l'appareil, numéro unique même hors ligne (`F2-000123`), WhatsApp, file « À envoyer », ticket Bluetooth 58/80 mm, impression A4                                                                      |
| **Produits et stock** | fiches avec photo, rayons, plusieurs unités et prix, réceptions de marchandise, lots et dates de péremption (le plus proche sort en premier), alertes J-30 / J-7, pertes, stock bas, inventaire « à l'aveugle »        |
| **Clients et crédit** | carnet de dettes, plafond de crédit, remboursements avec reçu, débiteurs classés par ancienneté, relance WhatsApp, dettes anciennes                                                                                    |
| **Caisse du jour**    | fond de caisse, dépenses et sorties, « Clôturer la journée » (argent attendu / compté, écarts), « Faire un compte », archives par jour / semaine / mois                                                                |
| **Tableau de bord**   | chiffre d'affaires, bénéfice réel, argent encaissé, dettes, valeur du stock, meilleures ventes, produits qui dorment, alertes                                                                                          |
| **Équipe**            | plusieurs rôles par personne (propriétaire, gérant, caissier, vendeur, gestionnaire de stock, compteur), code PIN hors ligne, journal de toutes les actions sensibles                                                  |
| **Réglages**          | paramètres de la boutique, modes de paiement, imprimante, export Excel/CSV, boutique de démonstration                                                                                                                  |

## Les outils

- **Expo SDK 58** (React Native, TypeScript, Expo Router), **React Native Paper** (thème « Vert Commerce »).
- **Supabase** : base PostgreSQL, comptes, sécurité ligne par ligne (une boutique ne voit jamais une autre), stockage des photos.
- **PowerSync** : la base SQLite dans l'appareil, synchronisée avec Supabase.
- **EAS** (Expo Application Services) : fabrication des applis dans le cloud et mises à jour à distance.

## Lancer le projet sur le PC

1. Installer les bibliothèques (une fois, puis après chaque récupération du code) :

   ```bash
   npm install
   ```

2. Créer le fichier `.env` à partir de `.env.example` (adresses Supabase et PowerSync, clé « publishable »).
   **Jamais** de clé secrète dans ce fichier, ni dans Git.

3. Démarrer :

   ```bash
   npx expo start            # téléphone / tablette (avec la version de test « dev »)
   npx expo start --web      # navigateur
   ```

## Vérifier le code

```bash
npm test             # tous les tests automatiques (calculs, sécurité de la base, opérations complètes)
npm run typecheck    # TypeScript
npm run lint         # ESLint + Prettier
npx expo-doctor      # santé du projet Expo
```

Les tests sont de trois sortes :

- `src/**/*.test.ts` : les règles métier (argent, quantités, stock, crédit, rapports…) ;
- `supabase/tests/` : la sécurité de la base, avec les vraies migrations, dans un PostgreSQL en mémoire ;
- `tests/` : les vraies opérations de l'appli et les lectures des écrans, sur un vrai SQLite en mémoire.

## Fabriquer et publier

| Quoi                                      | Commande                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------- |
| Version de test (dev) Android             | `npx eas-cli@latest build --profile development --platform android`                     |
| APK d'essai autonome                      | `npx eas-cli@latest build --profile preview --platform android`                         |
| APK final                                 | `npx eas-cli@latest build --profile production --platform android`                      |
| Mise à jour à distance (sans réinstaller) | `npx eas-cli@latest update --channel production --message "…" --environment production` |
| Version web installable (dossier `dist/`) | `npm run build:web`                                                                     |
| Base de données                           | `npx supabase db push --linked` puis `npm run db:types`                                 |

⚠️ Après une migration qui ajoute une table : l'ajouter aussi dans `powersync/sync-config.yaml`
et recopier ce fichier dans le tableau de bord PowerSync.

## Organisation du code

```
src/app/         les écrans (Expo Router)
src/domain/      les règles métier « pures », testées (argent, stock, crédit, rapports…)
src/products/    produits      src/stock/     stock, lots, inventaire
src/sales/       caisse        src/customers/ clients et crédit
src/cash/        caisse du jour  src/reports/ clôtures et comptes
src/invoices/    factures, reçus, partage    src/printing/ tickets ESC/POS
src/dashboard/   tableau de bord  src/export/  export Excel/CSV
src/db/          base locale et synchronisation   src/i18n/  tous les textes (français)
src/theme/       couleurs et tailles (un seul fichier : tokens.ts)
supabase/        migrations et tests de sécurité   powersync/ règles de synchronisation
```
