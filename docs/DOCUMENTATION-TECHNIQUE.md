# Boutik — Documentation technique

> État au **02/11/2026** · APK Android **1.0.2** · 58 fichiers de tests, 403 tests.
> Pour qui : Ernest, et tout développeur qui reprend le projet.
> Les autres documents : [PLAN.md](PLAN.md) (plan d'origine et décisions),
> [LANCEMENT.md](LANCEMENT.md) (liste avant le lancement), [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md)
> (besoins d'origine).

## Sommaire

1. [Présentation](#1-présentation)
2. [Comptes et services en ligne](#2-comptes-et-services-en-ligne)
3. [Installer le projet sur un PC](#3-installer-le-projet-sur-un-pc)
4. [Toutes les commandes](#4-toutes-les-commandes)
5. [Procédures pas à pas](#5-procédures-pas-à-pas)
6. [Architecture](#6-architecture)
7. [Organisation du code](#7-organisation-du-code)
8. [Les écrans](#8-les-écrans)
9. [Les fonctionnalités](#9-les-fonctionnalités)
10. [Rôles et droits](#10-rôles-et-droits)
11. [La base de données](#11-la-base-de-données)
12. [Règles métier importantes](#12-règles-métier-importantes)
13. [Tests et vérifications](#13-tests-et-vérifications)
14. [Pièges connus](#14-pièges-connus)
15. [Ce qu'il reste à faire](#15-ce-quil-reste-à-faire)

---

## 1. Présentation

**Boutik** gère le **stock**, la **caisse**, les **ventes à crédit** et les **livraisons** des
boutiques d'Afrique de l'Ouest. Il vise d'abord les quincailleries du Bénin (monnaie FCFA/XOF,
numéros +229).

**Exigence n° 1 : tout fonctionne sans internet.** Chaque appareil a sa propre base SQLite, et la
synchronisation se fait dès que le réseau revient.

| Plateforme | Forme | Où l'obtenir |
|---|---|---|
| Android (prioritaire) | APK, hors Play Store | bouton du site → GitHub Releases (`…/releases/latest/download/boutik.apk`) |
| Navigateur, iPhone | appli web installable (PWA) | https://boutik-services.vercel.app/app/ |
| Windows | logiciel `.exe` (Tauri) | page Télécharger du site |
| Site vitrine | pages statiques | https://boutik-services.vercel.app |

**Un seul code** (Expo + React Native + TypeScript) sert à Android, au web et à Windows.

---

## 2. Comptes et services en ligne

| Service | Rôle | Repère |
|---|---|---|
| **GitHub** | le code (dépôt **privé**) | `ernestjesutinafaton-maker/Boutik`, branche `main` |
| **GitHub** (public) | les APK à télécharger (Releases) | `ernestjesutinafaton-maker/Boutik-presentation` |
| **Supabase** | base PostgreSQL, comptes, sécurité (RLS), stockage de fichiers | projet `twidouwbbikvqqghnhdp` |
| **PowerSync** | synchronisation base locale ↔ serveur | instance `6ade47fbb32a60a89a2ecb98.powersync.journeyapps.com` |
| **Expo / EAS** | fabrication des APK (EAS Build), mises à jour à distance (EAS Update) | compte `ernest_afaton`, projet `boutik` (id `95d5a20f-3546-4e2e-a82c-516a120c689d`), canal `production` |
| **Vercel** | hébergement du site et de l'appli web | projet `boutik` → `boutik-services.vercel.app` |
| **Nom de domaine** | e-mails (puis site, plus tard) | `boutik-services.com` (achat en cours, 02/11/2026) |
| **Brevo** (à venir) | envoi des e-mails (confirmation, mot de passe oublié) | — |

**Les secrets.**
- Aucun secret n'est dans Git. Le fichier `.env` reste sur le PC (il est ignoré par Git).
- L'appli n'utilise que des valeurs **publiques** : l'adresse Supabase, la clé « publishable » et l'adresse PowerSync. Elles sont écrites à trois endroits, à garder identiques :
  - `.env`, pour le PC et l'appli web ;
  - `eas.json` (`build.base.env`), pour les APK ;
  - l'environnement **production** d'EAS, pour les mises à jour.
- La **clé de signature Android** est gardée par EAS. Une copie de secours (`.jks` et ses mots de passe) est conservée hors du projet.
- La double authentification est activée sur GitHub, Google, Expo et Supabase.

---

## 3. Installer le projet sur un PC

**Prérequis**
- Node.js 24 et Git.
- Chrome, pour les vérifications visuelles.
- Pour fabriquer le `.exe` Windows : Rust et les outils de compilation Microsoft.

```powershell
git clone https://github.com/ernestjesutinafaton-maker/Boutik.git
cd Boutik
npm install                        # copie aussi les fichiers web de PowerSync dans public/
copy .env.example .env             # puis remplir les 3 variables EXPO_PUBLIC_…
npx expo start                     # serveur de développement (touche w = navigateur)
```

**Se connecter aux outils** (une fois par PC) :

```powershell
npx eas-cli@latest login
npx vercel login
npx supabase login
npx supabase link --project-ref twidouwbbikvqqghnhdp
gh auth login
```

**Les variables de `.env`** :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | oui | adresse du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | oui | clé publique de Supabase |
| `EXPO_PUBLIC_POWERSYNC_URL` | oui | adresse de l'instance PowerSync |
| `EXPO_PUBLIC_SITE_URL` | non | adresse du site (défaut : `https://boutik-services.vercel.app`) |
| `EXPO_PUBLIC_APK_URL` | non | lien de l'APK (défaut : dernière Release GitHub) |
| `EXPO_PUBLIC_VERSION_URL` | non | fichier d'annonce des versions (défaut : `/app/version.json` du site) |

> Pour ajouter un paquet : **toujours** `npx expo install <paquet>`, jamais `npm install <paquet>`.
> Cette commande choisit la version compatible avec Expo 58.

---

## 4. Toutes les commandes

### Scripts du projet (`npm run …`)

| Commande | Ce qu'elle fait |
|---|---|
| `npm start` | serveur de développement Expo |
| `npm run android` / `npm run web` | démarre sur Android / dans le navigateur |
| `npm run build:web` | vide `dist/` (garde `dist/.vercel`) → exporte l'appli web dans `dist/app` → corrige les polices → service worker (Workbox) → assemble le site vitrine dans `dist/` |
| `npm run deploy:web` | `build:web`, puis publie `dist/` sur Vercel (production) |
| `npm run update:android -- --message "…"` | mise à jour Android sans réinstaller (EAS Update, canal `production`), pour la version de l'APK écrite dans `app.json`. Sans message : titre du dernier commit |
| `npm run build:desktop-web` | export web pour le logiciel Windows (`dist-desktop`) |
| `npm run desktop` | logiciel Windows en mode développement (Tauri) |
| `npm run build:desktop` | fabrique l'installateur Windows (Tauri) |
| `npm run lint` | vérification du style et des erreurs (ESLint, Prettier) |
| `npm run typecheck` | vérification des types (appli, tests serveur, tests locaux) |
| `npm test` | tous les tests (Vitest) |
| `npm run test:watch` | tests relancés à chaque modification |
| `npm run db:types` | régénère `src/lib/database.types.ts` depuis la base **en ligne** |

### Autres commandes utiles

| Commande | Usage |
|---|---|
| `npx tsc --noEmit` | types de l'appli seulement (rapide) |
| `npx expo lint` | lint (à lancer avant chaque commit) |
| `npx vitest run chemin/du/test.ts` | un seul fichier de tests |
| `npx expo-doctor` | diagnostic des dépendances Expo |
| `npx supabase db push --linked --yes` | applique les nouvelles migrations à la base en ligne |
| `npx eas-cli@latest build --platform android --profile production` | fabrique un APK dans le cloud |
| `npx eas-cli@latest build:view <id> --json` | état d'une fabrication, lien de l'APK |
| `npx eas-cli@latest update:list --branch production` | dernières mises à jour publiées |
| `npx eas-cli@latest env:list production` | variables de l'environnement EAS « production » |
| `npx eas-cli@latest env:set production --name … --value … --visibility plaintext` | ajoute ou change une variable EAS |
| `npx eas-cli@latest credentials -p android` | clé de signature (copie de secours, empreinte SHA-256) |
| `gh release create vX.Y.Z downloads/boutik.apk --repo ernestjesutinafaton-maker/Boutik-presentation --title "…" --notes "…"` | publie un APK (Release GitHub) |

---

## 5. Procédures pas à pas

### 5.1 Changer la base de données
1. Écrire une migration `supabase/migrations/AAAAMMJJHHMMSS_nom.sql` (jamais modifier une migration déjà appliquée).
2. Écrire ses tests dans `supabase/tests/` (PGlite rejoue toutes les migrations), puis `npx vitest run supabase/tests`.
3. `npx supabase db push --linked --yes`, puis `npm run db:types` pour régénérer les types.
4. **Si une table doit se synchroniser** :
   - l'ajouter à la publication (`alter publication powersync add table …`), dans la migration ;
   - l'ajouter à `src/db/schema.ts` ;
   - l'ajouter à `powersync/sync-config.yaml`, dans les **3 flux** ;
   - lancer le garde-fou `tests/sync-config.test.ts` ;
   - copier `sync-config.yaml` dans le tableau de bord PowerSync (Sync Streams → **Validate** → **Deploy**), **après** le `db push`.
5. Une table ajoutée ? Penser aussi à `public.reset_shop_data` (effacement des données de test).

### 5.2 Publier le site et l'appli web
`npm run deploy:web`, puis vérifier https://boutik-services.vercel.app/app/. Le service worker
propose « Mettre à jour » aux utilisateurs.

### 5.3 Mise à jour Android sans réinstaller (code JavaScript seulement)
1. Code enregistré (commit) et tests au vert.
2. `npm run update:android -- --message "Ce qui change"`. La commande affiche la version visée.
3. Les téléphones la téléchargent à l'ouverture, puis un bandeau propose de redémarrer.

### 5.4 Nouvel APK (quand le natif change)
Il faut un nouvel APK après l'ajout d'un module natif, ou après un changement de réglage natif
dans `app.json` (permissions, liens…).
1. **Avant** de changer de version, publier une dernière mise à jour pour l'ancienne version (5.3) :
   une mise à jour ne vise que la version écrite dans `app.json`.
2. Augmenter `version` dans `app.json` (ex. 1.0.2 → 1.0.3), puis enregistrer (commit).
3. `npx eas-cli@latest build --platform android --profile production`. Le `versionCode` s'incrémente
   tout seul.
4. Télécharger l'APK fabriqué dans `downloads/boutik.apk` (dossier ignoré par Git), puis vérifier
   son empreinte de signature. Elle doit être identique à celle de `site/assetlinks.json`.
5. Publier la Release GitHub (`gh release create vX.Y.Z …`).
6. Mettre la nouvelle version dans `public/version.json` **et** `site/config.json`, puis
   `npm run deploy:web`. Les anciens APK affichent alors « Nouvelle version disponible ».

### 5.5 Logiciel Windows
`npm run build:desktop` (Rust nécessaire). L'installateur sort dans `src-tauri/target/release/bundle/`.
Le copier en `downloads/Boutik-setup.exe`, puis `npm run deploy:web` : le site le sert sous
`/telecharger/Boutik-setup.exe`.

### 5.6 Effacer les données de test d'une boutique
Dans l'appli : Paramètres → « Effacer toutes les données de test ».
- Le propriétaire peut le faire pendant les 15 jours d'essai, l'administrateur Boutik à tout moment.
- L'équipe, les appareils, les modes de paiement et l'abonnement sont gardés.

---

## 6. Architecture

```
 Téléphone / navigateur / PC                                        Serveurs
┌──────────────────────────────┐     lecture : Sync Streams     ┌────────────┐   réplication   ┌─────────────────┐
│ Appli Expo (React Native)    │ ◄───────────────────────────── │ PowerSync  │ ◄────────────── │ Supabase        │
│  base SQLite LOCALE          │      (selon le niveau)         └────────────┘                 │ PostgreSQL      │
│  écrans : lecture locale     │                                                               │ + RLS, triggers │
│  écritures : file d'attente  │ ── écritures : RPC apply_changes (tout ou rien, RLS) ───────► │ + Auth, Storage │
└──────────────────────────────┘                                                               └─────────────────┘
```

### Hors ligne et synchronisation
- **Lecture** : tous les écrans lisent la base locale (`useQuery`), donc ils marchent sans internet.
- **Écriture**, dans l'appareil :
  - chaque action est une transaction locale (`db.writeTransaction`), qui note aussi l'action dans le journal ;
  - le connecteur (`src/db/connector.ts`) envoie chaque transaction en **un seul** appel à `apply_changes` : tout est accepté, ou rien.
- **Écriture**, côté serveur : `apply_changes` tourne avec les droits de la personne. Les règles de sécurité (RLS) et les triggers s'appliquent donc normalement.
- **Si le serveur refuse** :
  - codes `22…`, `23…`, `42…`, `P0…` : refus définitif. La modification est mise de côté dans `local_rejected_changes`, puis la file continue ;
  - code `BK001` (boutique en pause) : rien n'est perdu, nouvel essai toutes les 30 s ;
  - autres erreurs (réseau) : nouvel essai automatique.
- **Premier arrivé, premier servi** : un changement refusé est remplacé par la version du serveur à la synchronisation suivante.

### Synchronisation par niveau d'accès (`powersync/sync-config.yaml`)
Le serveur calcule le niveau de chaque membre à partir de ses rôles (`shop_members.access_level`).

| Niveau | Qui | Reçoit |
|---|---|---|
| `owner` | propriétaire | tout, y compris les codes PIN (tablette partagée) |
| `costs` | gérant, responsable du stock | tout sauf les codes PIN |
| `team` | vendeur, caissier, compteur, livreur | ni prix d'achat, ni coûts, ni comptes (`reports`), ni journal, ni codes PIN ; seulement **ses** dépenses de livraison |

Le test `tests/sync-config.test.ts` vérifie qu'aucune colonne secrète ne part vers le niveau
« équipe », et que chaque requête est limitée aux boutiques de la personne.

### Comptes et appareil partagé
- **Comptes** : e-mail et mot de passe (Supabase Auth). La session est gardée chiffrée dans l'appareil. La confirmation des e-mails est **désactivée** pour l'instant (choix d'Ernest, en attendant Brevo).
- **Appareil partagé** : des profils avec un code PIN de 4 chiffres. L'écran « Qui êtes-vous ? » ne s'affiche que sur le compte du propriétaire, quand d'autres profils ont un code PIN.
- **Membre de l'équipe** : il peut avoir son propre compte, grâce à un **lien d'invitation personnel** (une seule fois, valable 7 jours). Seule l'empreinte sha256 du code est gardée.

### Stockage de fichiers (Supabase Storage)

| Bucket | Accès | Contenu |
|---|---|---|
| `product-photos` | lecture publique, écriture : membres de la boutique | photos des produits (envoyées dès qu'internet revient) |
| `payment-proofs` | **privé** : propriétaire de la boutique + administrateur Boutik | captures des paiements d'abonnement |
| `delivery-proofs` | **privé** : le livreur (son dossier `<boutique>/<livreur>/`) + propriétaire et responsables | photos des reçus des livreurs |

### Mises à jour
- **APK** : EAS Update, avec `runtimeVersion` = version de l'appli. Le code est téléchargé à l'ouverture, puis un bandeau propose de redémarrer.
- **Nouvel APK** : l'appli lit `/app/version.json` et propose de le télécharger.
- **Web** : un service worker (Workbox) garde l'appli hors ligne et propose « Mettre à jour ».

### Web et liens
- L'appli web vit sous `/app`. Vercel renvoie `/app/*` vers `/app` (réécriture, dans `site/vercel.json`).
- **Liens Android (App Links)** : les liens `https://boutik-services.vercel.app/app/…` ouvrent l'appli installée, depuis la version 1.0.2. Trois pièces les font marcher :
  - le fichier de confiance `/.well-known/assetlinks.json`, tiré de `site/assetlinks.json` ;
  - les `intentFilters` dans `app.json` ;
  - `src/app/+native-intent.tsx`, qui enlève « /app » de l'adresse.

### Interface
- **React Native Paper** et des jetons de thème (`src/theme/tokens.ts`) : 3 couleurs (vert par défaut, violet, orangé), chacune en clair ou sombre.
- **Icônes 3D** Fluent Emoji (licence MIT).
- **Relief sans ombre floue**, pour rester rapide sur les vieux téléphones. Les longues listes sont virtualisées (`CardList`, FlatList), et le catalogue n'est lu qu'une fois (`CatalogProvider`).
- **Mise en page web** : un écran qui a sa propre liste utilise `<Screen scroll={false}>`. Toutes les puces (Chip) utilisent `fitChip` : une étiquette trop longue est raccourcie avec « … ».
- **Textes** : tous en français, dans `src/i18n/fr*.ts`, avec des clés typées.
- **React Compiler** activé : aucun appel « impur » pendant l'affichage (par exemple, l'heure se lit dans `useState(() => …)`).

---

## 7. Organisation du code

| Dossier | Contenu |
|---|---|
| `src/app/` | **les écrans** (Expo Router : un fichier = une adresse ; `_layout.tsx` = navigation). Rien d'autre ici |
| `src/domain/` | règles métier **pures**, sans écran, toutes testées : argent, quantités, stock, ventes, crédit, caisse, rapports, abonnement, droits, livraisons… |
| `src/db/` | schéma de la base locale (`schema.ts`), connecteur PowerSync, ouverture de la base |
| `src/data/` | journal des actions (`audit.ts`), identifiants, contexte d'action |
| `src/sales/`, `src/stock/`, `src/products/`, `src/customers/`, `src/cash/`, `src/reports/`, `src/deliveries/` | données (hooks de lecture) et actions (écritures) de chaque rubrique |
| `src/invoices/`, `src/printing/` | factures (HTML/PDF, WhatsApp, file « À envoyer »), tickets Bluetooth ESC/POS |
| `src/team/` | équipe, codes PIN, invitations, « Mon profil » |
| `src/subscription/` | abonnement, captures de paiement, écran de pause |
| `src/shop/`, `src/auth/` | boutique active, réglages, connexion |
| `src/dashboard/`, `src/history/`, `src/export/`, `src/demo/`, `src/guide/` | tableaux de bord, journal, export Excel, boutique de démonstration, guide |
| `src/components/` | composants partagés (Screen, Card, CardList, BigButton, TextField, Notice, StatusChip, fitChip, navigation…) |
| `src/theme/`, `src/i18n/`, `src/config/`, `src/lib/` | thème, textes, réglages (adresses, abonnement, pays), utilitaires (Supabase, validation, erreurs) |
| `src/pwa/`, `src/updates/`, `src/device/` | version web installable, mises à jour, appareil |
| `supabase/migrations/` | la base (tables, sécurité, fonctions), dans l'ordre |
| `supabase/tests/` | tests du serveur (PGlite + fausse Supabase) |
| `tests/` | tests sur une vraie base SQLite locale (node:sqlite) et garde-fous |
| `powersync/` | règles de synchronisation (à coller dans PowerSync) |
| `site/` | site vitrine : `pages/`, `layout.html`, `assets/`, `config.json`, `vercel.json`, `assetlinks.json` |
| `scripts/` | `build-site.mjs`, `clean-dist.mjs`, `fix-web-assets.mjs`, `update-android.mjs` |
| `public/` | fichiers servis tels quels par l'appli web (`index.html`, `manifest.json`, `version.json`, PowerSync) |
| `src-tauri/` | logiciel Windows (Tauri) |
| `downloads/` | fichiers fabriqués à servir (APK, `.exe`) — **hors Git** |
| `docs/` | documentation |

---

## 8. Les écrans

| Adresse | Écran |
|---|---|
| `/sign-in`, `/sign-up`, `/create-shop` | connexion, inscription, création de la boutique |
| `/invitation/[code]` | lien d'invitation d'un membre (accessible sans être connecté) |
| `/telecharger` | téléchargements (dans l'appli web) |
| **Onglets** `/`, `/products`, `/customers`, `/dashboard`, `/more` | Caisse (Vendre), Produits, Clients, Tableau de bord, Plus |
| Onglet `/deliveries` | « Livraisons », à la place de « Caisse » pour un livreur seul |
| `/sale/checkout`, `/sale`, `/sale/[saleId]`, `/sale/[saleId]/return`, `/sale/outbox` | encaisser, ventes, fiche de vente, retour, « À envoyer » |
| `/product/new`, `/product/[productId]`, `/product/[productId]/edit` | produits |
| `/stock/receive`, `/stock/loss`, `/stock/alerts` | réception, perte, alertes |
| `/inventory`, `/inventory/[countId]` | inventaires |
| `/customer/new`, `/customer/[customerId]` (+ `edit`, `repay`, `old-debt`, `receipt`) | clients et crédit |
| `/cash`, `/cash/movement`, `/cash/close` | caisse du jour, dépense ou sortie, clôture |
| `/report`, `/report/[reportId]` | comptes et archives |
| `/delivery`, `/delivery/new`, `/delivery/[deliveryId]`, `/delivery/cash`, `/delivery/expense` | livraisons, argent des livreurs, dépenses |
| `/team`, `/team/new`, `/team/invite`, `/team/[memberId]` | équipe et invitations |
| `/profile` | Mon profil (nom, code PIN, mot de passe) |
| `/settings`, `/printer`, `/export`, `/history`, `/guide`, `/demo` | paramètres, imprimante, export, journal, guide, démonstration |
| `/subscription`, `/admin-payments` | abonnement ; paiements à vérifier (administrateur Boutik) |

---

## 9. Les fonctionnalités

### Comptes, boutique, appareils
- Inscription et connexion par e-mail et mot de passe. Création de la boutique : pays, monnaie et modes de paiement du pays.
- Chaque appareil reçoit un **numéro** (`register_device`), utilisé dans les numéros de facture.
- **Mon profil** : changer son nom, son code PIN et son mot de passe.
- Se déconnecter est impossible tant que des opérations attendent d'être envoyées (sinon elles seraient perdues).

### Équipe
- 7 rôles, et plusieurs rôles possibles par personne : voir la partie 10.
- **Profils à code PIN**, sur l'appareil de la boutique : changement rapide de personne, verrouillage après 5 essais.
- **Comptes personnels**, par lien d'invitation (WhatsApp ou partage) :
  - les rôles sont fixés par le propriétaire ;
  - le membre choisit son e-mail, son mot de passe, son nom et son code PIN ;
  - il arrive directement sur **son** interface.
- **Retirer un membre** : son appli affiche « Accès retiré », et le serveur n'accepte plus rien de lui.

### Produits et catalogue
- Fiche produit :
  - photo, prise même hors ligne et envoyée plus tard ;
  - rayon, code-barres (caméra, ou lecteur USB sur PC) ;
  - seuil de stock bas, suivi de la péremption, archivage.
- **Plusieurs unités** par produit (sac, kilo, carton…), chacune avec son facteur, son prix de vente et son prix d'achat.
- Le stock est compté dans l'unité de base, en millièmes.

### Stock
- **Réceptions** : chaque entrée crée un **lot**, avec son prix d'achat et sa date de péremption.
- **Sortie du lot qui périme le plus tôt.** Les lots périmés sont bloqués ; seul le propriétaire peut forcer, et c'est tracé.
- **Pertes** (périmé, cassé, volé, autre), **alertes** (péremption à J-30 et J-7, stock bas).
- **Inventaire « à l'aveugle »** : le compteur ne voit pas le stock calculé. La validation crée les ajustements.
- **Le stock ne devient jamais négatif** : un manque bloque la vente.

### Caisse et ventes
- Panier rapide :
  - recherche, scanner, rayons ;
  - sur tablette ou ordinateur, la liste des produits à gauche et le panier à droite.
- **Remise** limitée selon la personne. **Paiement mixte** ; **paiement partiel**, où le reste passe en crédit (client obligatoire) ; monnaie à rendre.
- **Numéro de facture unique, même hors ligne** : `F2-000123` (appareil 2, 123e facture).
- **Annuler**, **reprendre des articles**, et **modifier une vente** :
  - modifier crée une nouvelle vente qui remplace l'ancienne (`replaces_sale_id`) ;
  - c'est possible pendant le délai choisi par le propriétaire (24 h par défaut) ;
  - ensuite, seul le propriétaire peut encore la modifier.

### Factures et impression
- Facture HTML/PDF fabriquée dans l'appareil (A4, ticket 58 mm, ticket 80 mm), avec les pluriels (« 2 sacs »).
- Envoi par WhatsApp. La file « À envoyer » garde ce qui n'a pas pu partir sans réseau.
- Ticket sur imprimante Bluetooth 58 ou 80 mm (ESC/POS).

### Clients et crédit
- Carnet de dettes : dette, remboursement, annulation, dette effacée, dette ancienne.
- Plafond de crédit. Ancienneté des dettes (récente, plus de 30 jours, plus de 60 jours).
- Reçus de remboursement, relances WhatsApp.

### Caisse du jour, dépenses, comptes
- Ouverture de la caisse avec un fond de caisse.
- Mouvements de caisse : dépenses par catégorie, achats de marchandise, retraits du propriétaire, ajouts d'argent, **remises des livreurs**.
- **Clôturer la journée** : on compte chaque mode de paiement, les écarts sont calculés, et la fiche est archivée.
- **Faire un compte** (propriétaire et gérant) : le bilan depuis le compte précédent :
  - ventes et chiffre d'affaires, coût des marchandises, bénéfices, dépenses ;
  - pertes, ajustements, paiements par mode, crédit ;
  - valeur du stock, meilleures ventes, débiteurs.
- Archives par jour, par semaine ou par mois. Une fiche faite par l'équipe n'a pas les coûts.

### Livraisons
- **Créer une livraison** depuis une vente (« Livrer cette vente ») : adresse, repère, personne à appeler, heure souhaitée, un livreur précis ou « ouverte à tous », argent à encaisser.
- **Le livreur**, avec son onglet « Livraisons » :
  - il prend une livraison (« Je m'en occupe » ; premier arrivé, premier servi) ;
  - il appelle le client, lui écrit sur WhatsApp, ouvre la carte ;
  - il la livre en encaissant : c'est un remboursement de la dette du client, et l'argent reste « chez le livreur » ;
  - sinon, il la marque « Pas livrée », avec la raison, ou il la rend.
- **Dépenses du livreur** : photo du reçu obligatoire, stockage privé, envoi dès qu'internet revient.
- **Argent des livreurs** :
  - la remise à la caisse est notée par le caissier, le gérant ou le propriétaire ;
  - les dépenses sont **remboursées** (c'est une dépense de la caisse, comptée dans le compte) ou **refusées** avec une raison.
- **Une vente modifiée** garde sa livraison.

### Tableau de bord, journal, export
- **Tableau de bord** du propriétaire :
  - aujourd'hui, la semaine ou le mois ;
  - chiffres clés, alertes, accès rapide.
- **Tableaux de bord par rôle** : mes ventes, ma caisse, le stock, mes livraisons.
- **Journal des actions** : qui, quoi, quand, sur quel appareil, avec des filtres.
- **Export pour Excel** : produits, ventes, lignes de vente, clients, dépenses, inventaire.

### Abonnement
- **Les durées** :
  - 15 jours d'essai, puis 7 jours de grâce ;
  - au-delà, la boutique est **en pause** : tout est bloqué sauf le paiement, et le serveur refuse les données avec le code `BK001`. Les données sont gardées.
- **Le prix** :
  - de 10 000 F par mois pendant les 3 premiers mois ;
  - ensuite, il dépend de la moyenne mensuelle des ventes du trimestre précédent : 10 000, 15 000 ou 25 000 F ;
  - durées de 1, 3 ou 6 mois.
- **Le paiement** :
  - par Mobile Money (MTN, Moov, Celtiis…) ;
  - le client déclare l'heure, le message et la **capture** (obligatoire) ;
  - accès provisoire de 3 jours, une fois par 30 jours ;
  - un numéro de transaction ne sert qu'une fois.
- **Écran administrateur** : capture, contact, validation, refus motivé, et vue d'ensemble des boutiques.

### Paramètres et outils
- Nom, téléphone, adresse, pied de facture, alertes de péremption, limite de remise des vendeurs, vente sans stock, délai de modification des ventes.
- Modes de paiement, thème (3 couleurs, clair ou sombre), imprimante.
- Boutique de démonstration, guide, effacement des données de test.

### Site vitrine
- Pages : accueil, télécharger, FAQ, conditions, confidentialité, mentions légales, e-mail confirmé.
- Elles sont assemblées par `scripts/build-site.mjs`, à partir de `site/`, avec les réglages de `site/config.json`.

---

## 10. Rôles et droits

Les droits sont définis dans `src/domain/permissions.ts`. Une personne a la **réunion** des droits de ses rôles.

| Rôle | Droits principaux | Niveau de synchro |
|---|---|---|
| Propriétaire (`owner`) | tous | `owner` |
| Gérant (`manager`) | tous, sauf : bénéfices, équipe, paramètres, effacer une dette, suppressions, catalogue et prix, modifier une vente après le délai | `costs` |
| Caissier (`cashier`) | vendre, remboursement de crédit, clients, ouvrir et fermer la caisse, dépenses, créer des livraisons, recevoir l'argent des livreurs | `team` |
| Vendeur (`seller`) | vendre, remboursement de crédit, clients, créer des livraisons | `team` |
| Gestionnaire de stock (`stock_manager`) | recevoir, compter, ajuster, voir les coûts | `costs` |
| Compteur (`stock_counter`) | compter le stock | `team` |
| Livreur (`delivery`) | livrer et encaisser (remboursement de crédit), noter ses dépenses | `team` |

> ⚠️ Le contrôle `can()` de l'appli ne sert qu'à **afficher** les bons boutons. La vraie protection,
> c'est le serveur : RLS, triggers et fonctions `security definer`.

---

## 11. La base de données

### Conventions
- **Identifiants** UUID, créés par l'appareil, même hors ligne. Chaque ligne a un `shop_id`.
- **Montants** : nombres **entiers**, dans la plus petite unité (32 000 FCFA → `32000`).
- **Quantités** : entiers en **millièmes** de l'unité de base (2,5 kg → `2500`).
- **Rien ne s'efface** : on archive (`archived_at`) ou on annule (statut et trace).
- **Traçabilité** : `created_by` (la personne), `device_id` (l'appareil), `occurred_at` (le vrai moment).
- **Pas de contrainte d'unicité** que deux appareils hors ligne pourraient enfreindre. Exceptions voulues :
  - le numéro de facture, par appareil ;
  - un seul remboursement par dépense de livreur.

### Les tables
| Table | Contenu |
|---|---|
| `shops` | la boutique et ses réglages ; abonnement (`paid_until`, `provisional_until`, modifiables seulement par le serveur) |
| `shop_members` | les personnes (nom, code PIN haché, limite de remise, `access_level` calculé) |
| `shop_member_roles` | les rôles de chaque personne (un rôle retiré garde sa ligne) |
| `team_invites` | liens d'invitation (empreinte du code, 7 jours, une seule fois) |
| `devices` | les appareils et leur numéro |
| `customers`, `customer_ledger` | clients ; carnet de dettes (la dette = la somme des lignes) |
| `payment_methods` | modes de paiement (espèces, Mobile Money…) |
| `categories`, `products`, `product_units` | rayons, produits, unités (facteur, prix de vente, prix d'achat) |
| `stock_receipts`, `stock_lots`, `stock_movements` | réceptions, lots (coût, péremption), mouvements (le stock = la somme) |
| `inventory_counts`, `inventory_lines` | inventaires et lignes comptées |
| `cash_sessions`, `cash_movements` | caisse du jour ; dépenses, achats, retraits, ajouts, remises des livreurs, remboursements de dépenses |
| `sales`, `sale_items`, `payments` | ventes (une vente = une facture), lignes, paiements (vente, remboursement, rendu) |
| `reports` | fiches archivées (clôtures de journée, comptes) |
| `deliveries`, `delivery_expenses` | livraisons ; dépenses des livreurs (photo, décision) |
| `audit_log` | journal des actions sensibles |
| `subscription_payments` | paiements d'abonnement déclarés (capture, décision) |
| `platform_admins` | administrateurs de la plateforme Boutik |

### Les fonctions du serveur (RPC)
| Fonction | Rôle |
|---|---|
| `create_shop` | crée la boutique, son propriétaire et ses modes de paiement |
| `register_device` | numéro de l'appareil dans la boutique |
| `apply_changes` | reçoit les modifications d'un appareil, tout ou rien (refus `BK001` si la boutique est en pause) |
| `reset_shop_data` | efface les données de test |
| `invite_team_member`, `create_team_invite`, `revoke_team_invite` | invitations (propriétaire) |
| `get_team_invite`, `accept_team_invite` | page du lien (accessible sans être connecté) ; acceptation |
| `update_my_member_profile`, `my_membership_status` | son nom et son code PIN ; actif ou retiré |
| `subscription_quote`, `declare_subscription_payment` | prix de l'abonnement ; déclaration d'un paiement |
| `review_subscription_payment`, `admin_subscription_payments`, `admin_overview`, `am_i_platform_admin` | côté administrateur Boutik |

### Les règles vérifiées par le serveur (triggers)
- Le niveau d'accès d'un membre est recalculé à chaque changement de rôle.
- Le coût des sorties de stock d'un membre « équipe » est calculé par le serveur, puisque son téléphone n'a pas les coûts.
- Une clôture faite par l'équipe est archivée sans les bénéfices.
- Un vendeur peut seulement **annuler SA** vente, dans le délai.
- L'équipe ne corrige que la date de péremption d'un lot.
- La date d'abonnement ne change que par la validation d'un paiement.
- Livraisons :
  - un livreur ne change que l'état de **ses** livraisons (premier arrivé, premier servi) ;
  - l'argent encaissé est toujours enregistré, au nom du livreur ;
  - un remboursement de dépense se fait une seule fois, au bon montant.

### Les migrations (dans l'ordre)
| Fichier | Contenu |
|---|---|
| `20261025150903_schema` | toutes les tables de départ |
| `20261025150906_security` | sécurité par boutique (RLS), `create_shop`, `register_device` |
| `20261025155548_member_roles` | plusieurs rôles par personne |
| `20261025174038_powersync_publication` | publication pour PowerSync |
| `20261025190731_apply_changes` | réception « tout ou rien » des modifications |
| `20261025210000_product_photos` | stockage des photos de produits |
| `20261026090000_cash_and_reports` | mouvements de caisse, rapports archivés |
| `20261027090000_abonnement`, `…090100_administrateur` | abonnement, administrateurs |
| `20261030090000_effacer_donnees_test` | effacement des données de test |
| `20261030100000_tableau_admin` | vue d'ensemble de l'administrateur |
| `20261030110000_prix_achat_unite` | prix d'achat par unité |
| `20261031090000_modifier_ventes` | délai de modification, vente qui en remplace une autre |
| `20261101090000_abonnement_securise` | capture obligatoire, accès provisoire, pause (`BK001`) |
| `20261101120000_comptes_equipe` | comptes de l'équipe, niveaux d'accès, invitations, rôle livreur |
| `20261101150000_livraisons` | livraisons, dépenses des livreurs, remises à la caisse |

---

## 12. Règles métier importantes

- **Arrondis** : une règle de trois (`mulDiv`) arrondit au plus proche, les demis vers le haut. Le serveur applique la même (`private.cost_for_quantity`).
- **Argent attendu dans la caisse** = fond de caisse + ventes et remboursements encaissés − argent rendu − dépenses, achats et retraits + ajouts d'argent + remises des livreurs.
- **Vente à crédit** : `reste dû = total − payé`. Un reste dû exige un client, et crée une ligne « dette » dans le carnet.
- **Argent « chez un livreur »** = paiements en espèces reliés à une livraison et hors caisse ouverte, moins ses remises à la caisse.
- **Dépense de livreur** : elle ne compte dans le « compte » qu'une fois **remboursée**. Une dépense refusée ne compte jamais.
- **Abonnement** :
  - mêmes règles dans `src/domain/subscription.ts` et côté serveur ;
  - les prix se changent dans ce fichier **et** dans la migration de l'abonnement.

---

## 13. Tests et vérifications

| Famille | Où | Comment |
|---|---|---|
| Règles métier | `src/**/*.test.ts` | fonctions pures |
| Serveur | `supabase/tests/*.test.ts` | PGlite (PostgreSQL en mémoire) rejoue **toutes** les migrations, plus une imitation de Supabase (rôles, `auth.uid()`, stockage) |
| Base locale | `tests/*.test.ts` | vraie base SQLite (`node:sqlite`) avec le schéma de l'appli : les vraies actions et les vraies requêtes |
| Garde-fous | `tests/sync-config.test.ts`, `src/history/audit-summary.test.ts`… | synchronisation, noms des actions du journal… |

**Avant chaque commit** : `npx tsc --noEmit`, `npx expo lint`, puis `npx vitest run`.
Lancer Vitest **seul** : enchaîné juste après le lint dans la même commande, il peut échouer sans
raison (différence c:/C: dans les chemins).

**Vérification visuelle** :
- Un « atelier » temporaire (route `src/app/atelier.tsx`, **jamais** enregistrée) affiche les vrais écrans, avec une boutique de démonstration.
- Un script pilote Chrome à **6 tailles réelles** : 1366×657, 1920×969, 1280×720, 800×1180, 412×780 et 360×640.
- Le script signale tout ce qui sort de l'écran sans pouvoir défiler.
- Ne pas se fier à une page géante : c'est ce qui avait caché un bug de défilement sur le web.

---

## 14. Pièges connus

| Piège | Bonne pratique |
|---|---|
| `eas update` seul vide `dist/` (le dossier du site) | toujours `npm run update:android` (dossier `dist-update`) |
| Depuis Expo 55, `eas update` **ignore `.env`** | les 3 variables sont dans l'environnement EAS « production » (`eas env:list production`) |
| Une mise à jour ne vise que la version de `app.json` | publier pour l'ancienne version **avant** d'augmenter le numéro |
| `vercel link` crée `dist/.env.local` avec une clé | `.vercelignore` exclut `.env*` (écrit par `build-site.mjs`) |
| `cleanUrls` + réécriture vers `/app/index.html` = 404 | réécrire vers `/app` |
| PowerSync refuse une config qui cite une colonne ou table inexistante | coller `sync-config.yaml` **après** le `db push` |
| Sync Streams : syntaxe limitée | plusieurs CTE permis, une CTE ne cite pas une autre CTE, pas de `NOT IN (sous-requête)` |
| Une liste qui ne défile pas sur le web | `<Screen scroll={false}>` pour les écrans à liste (le cadre prend la hauteur de la fenêtre) |
| Étiquettes trop longues sur un petit téléphone | `fitChip` sur toutes les puces |
| Le service d'e-mails par défaut de Supabase n'écrit qu'aux membres du projet | Brevo (SMTP) avant de réactiver la confirmation des e-mails |
| Vercel Hobby : usage non commercial, 100 Mo par envoi | offre Pro avant de vendre ; APK sur GitHub Releases |
| La clé de signature change | mettre la nouvelle empreinte SHA-256 dans `site/assetlinks.json` |
| Chemins `/…` dans Git Bash | préfixer la commande par `MSYS_NO_PATHCONV=1` |
| Créer une Release GitHub ou pousser la base depuis l'assistant | c'est Ernest qui lance `gh release` et `supabase db push` |

---

## 15. Ce qu'il reste à faire

**Bloc 4 — préparer le lancement** (en cours)
- [x] Supprimer le compte à l'e-mail mal tapé · changer le mot de passe · double authentification · copie de la clé de signature.
- [ ] Publier la mise à jour Android « Changer son mot de passe ».
- [ ] Acheter `boutik-services.com` → compte Brevo relié au domaine → SMTP dans Supabase et e-mails en français → « Mot de passe oublié ? » dans l'appli → réactiver la confirmation des e-mails.
- [ ] Offres payantes avant le premier client payant : Supabase Pro (sauvegardes, pas de mise en pause), Vercel Pro, limites PowerSync.

**Bloc 2 — l'espace acheteurs**, en 4 étapes
1. Base et sécurité.
2. Côté commerçant : le lien depuis la fiche client.
3. Côté acheteur : photo, prix, « Disponible » ou « Épuisé » ; pas de tri « le moins cher ».
4. Finitions.

**Bloc 5 — les essais réels**
- 2 ou 3 téléphones bon marché, l'imprimante Bluetooth.
- Une semaine dans une vraie quincaillerie, puis la formation de la boutique.
- Ensuite, cocher les étapes de [PLAN.md](PLAN.md).

**Plus tard (V2)** : version Linux, connexion par SMS, notifications pour les livreurs, Play Store,
site sur `boutik-services.com` (demandera un nouvel APK pour les liens).
