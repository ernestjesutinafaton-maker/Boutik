# Boutik — Plan du projet

Application de gestion de **stock**, de **caisse** et de **ventes à crédit** pour les boutiques en Afrique
(superettes, quincailleries, alimentation générale, pièces détachées, cosmétiques, boissons… — pas les pharmacies).
Lancement au Bénin (FCFA), prévue dès le départ pour toute l'Afrique.

- Les besoins détaillés : [CAHIER_DES_CHARGES.md](CAHIER_DES_CHARGES.md)
- Ce plan a été validé le **25/10/2026**.

## Où en est-on ?

👉 **Étape en cours : 5 — Hors ligne et synchronisation** (préparation des comptes Expo et PowerSync)

Dans le plan plus bas, une case cochée = une étape terminée et validée.

## Méthode de travail

- Une seule étape à la fois. Pour chaque étape :
  - ce qu'on va faire et pourquoi, en 2-3 phrases simples ;
  - les fichiers sont créés et modifiés directement dans le projet ;
  - les commandes à copier-coller une par une, avec ce qui doit s'afficher ;
  - comment vérifier : sur le téléphone Android, dans le navigateur, et en coupant internet ;
  - on attend « OK » avant de passer à la suite.
- Tout ce qui se passe hors de VS Code (comptes, clés, réglages du téléphone) est expliqué clic par clic.
- En cas d'erreur : on explique la cause simplement, puis on corrige.
- À la fin de chaque étape : un commit Git avec un message clair.
- Nouvelle idée de fonctionnalité : on décide ensemble si elle va dans le MVP ou en V2.

## Les décisions validées

1. **Synchronisation : PowerSync (conservé).** Intégration officielle avec Supabase, vraie base SQLite sur Android, iOS et web. Les alternatives (WatermelonDB, RxDB, ElectricSQL…) obligent à écrire soi-même une partie de la synchronisation.
2. **Bibliothèque d'interface : React Native Paper.** Composants prêts (boutons, champs, fenêtres, tableaux), un seul fichier de thème, mode sombre inclus, style Android familier aux utilisateurs.
3. **Fabrication des applications : EAS Build (dans le cloud) + development build.** Pas besoin d'Android Studio, et l'appli iPhone peut être fabriquée sans Mac. Expo Go ne suffit pas : il ne contient pas les modules natifs dont on a besoin (base SQLite de PowerSync, Bluetooth). On fabrique donc notre propre « Expo Go » avec nos modules.
4. **Vendeurs : un profil + un code PIN, sans e-mail.** Le propriétaire se connecte une fois sur chaque appareil de la boutique ; les vendeurs changent d'utilisateur avec leur PIN, même hors ligne. Les droits sont appliqués par l'application. Un vendeur avec son propre compte sur son propre téléphone = V2 (la base le permet déjà).
5. **Connexion du propriétaire : e-mail + mot de passe.** Gratuit. Le code par SMS ou WhatsApp (payant à chaque envoi) viendra plus tard si besoin.
6. **Stock affiché à 0 : la vente reste possible, avec un avertissement** (réglable par le propriétaire). Les produits **périmés** restent bloqués ; le propriétaire peut forcer, avec une trace.
7. **Android : un fichier APK à télécharger depuis le site de Boutik, sans Play Store pour l'instant** (décidé par Ernest le 25/10/2026, pour éviter les 25 $). Les mises à jour du code arrivent à distance (EAS Update) ; quand un nouvel APK est nécessaire, l'appli prévient. Sur iPhone : la version web installable (PWA). Play Store et App Store restent possibles plus tard.
8. **Plusieurs rôles dans l'équipe d'une boutique, et plusieurs rôles possibles pour une même personne** (demandé par Ernest le 25/10/2026) : propriétaire, gérant, caissier, vendeur, gestionnaire de stock, compteur d'inventaire. Exemple : une personne à la fois gérant, vendeur et caissier. Ses droits = la réunion des droits de ses rôles. En base : table de liaison `shop_member_roles` (un rôle retiré garde sa ligne, pour l'historique). Le détail des droits dans l'appli sera fixé à l'étape 7.

Changements par rapport à l'ordre conseillé dans le cahier des charges :

- « Entrées de stock » et « mouvements + calcul du stock » sont réunis : une réception, ce sont justement des mouvements.
- Le journal des actions et les droits sont posés dès l'étape 7 et utilisés ensuite partout ; l'écran d'historique et la vérification complète arrivent à l'étape 17.
- Les données de démonstration arrivent juste avant le tableau de bord : il faut 30 jours de ventes pour vérifier ses calculs.

## L'architecture hors ligne

```
 APPAREIL (téléphone, navigateur ou PC)
 ┌────────────────────────────────────────┐
 │  Écrans : Caisse, Stock, Clients...    │
 │      ▲ lit               │ écrit       │
 │      │                   ▼             │
 │  ┌──────────────────────────────────┐  │
 │  │  Base locale SQLite              │  │
 │  │  = marche TOUJOURS, même sans    │  │
 │  │    internet                      │  │
 │  │  + file "en attente de synchro"  │  │
 │  └──────────────────────────────────┘  │
 └──────┬─────────────────────▲───────────┘
        │ (1) envoie les      │ (2) reçoit les
        │ opérations en       │ nouveautés de
        │ attente             │ SA boutique
        ▼                     │
 ┌──────────────────┐   ┌─────┴────────────┐
 │ SUPABASE         │──►│ POWERSYNC        │
 │ base PostgreSQL  │   │ trie par boutique│
 │ sécurité (RLS)   │   │ et envoie à      │
 │ photos           │   │ chaque appareil  │
 └──────────────────┘   └──────────────────┘
```

- Les écrans lisent et écrivent **uniquement** dans la base locale SQLite : tout est instantané, avec ou sans internet. Ils se mettent à jour tout seuls quand la base change.
- Chaque modification rejoint une **file d'attente**. Un bandeau affiche en permanence « En ligne » ou « Hors ligne · X opérations en attente ».
- Quand internet revient, tout se fait seul : **(1)** la file part vers Supabase, qui vérifie les droits (RLS) ; **(2)** PowerSync renvoie à chaque appareil les nouveautés de **sa** boutique, et seulement de sa boutique.
- Les identifiants (UUID) sont créés par l'appareil lui-même : deux appareils hors ligne ne peuvent pas créer le même.
- Rouvrir l'appli sans se reconnecter : la session reste enregistrée dans l'appareil. Si elle expire hors ligne, l'appli continue avec la base locale et la renouvelle au retour d'internet.
- Toute la logique métier (unités, lots, stock, bénéfice, crédit, caisse) est faite de fonctions séparées, testées automatiquement et réutilisées par tous les écrans.
- Seuls ces éléments demandent internet : la première connexion (ou la création du compte), la synchronisation entre appareils, l'envoi WhatsApp et l'abonnement.

**Pourquoi le stock est fait de « mouvements »** — l'exemple de deux téléphones :

```
Au départ : 10 sacs de riz = 500 kg

Téléphone A (hors ligne) vend 2 sacs → mouvement -100 kg
Téléphone B (hors ligne) vend 1 sac  → mouvement  -50 kg

Internet revient : les 2 mouvements arrivent sur le serveur
500 - 100 - 50 = 350 kg = 7 sacs              ✅ juste

Si on écrasait simplement le chiffre du stock :
A écrit « 400 kg », B écrit « 450 kg »
le dernier arrivé gagne : 450 kg              ❌ 100 kg disparus
```

## Le schéma de la base de données

Une table, c'est un tableau, comme une feuille Excel. Il y en a 20. Chaque ligne de chaque table contient :

- un `id` : identifiant unique (UUID, ex. `3f2b8c1e-…`) **créé par l'appareil lui-même** ;
- un `shop_id` : la boutique à qui appartient la ligne (une boutique ne voit jamais les données d'une autre) ;
- qui a créé la ligne, sur quel appareil, et quand.

**La boutique et les personnes**

| Table | À quoi elle sert |
|---|---|
| `shops` | La boutique : nom, logo, adresse, pays, monnaie, réglages |
| `shop_members` | Les personnes de l'équipe : nom, code PIN protégé, limite de remise |
| `shop_member_roles` | Les rôles de chaque personne (une personne peut en avoir plusieurs) : propriétaire, gérant, caissier, vendeur, gestionnaire de stock, compteur |
| `devices` | Les appareils de la boutique, chacun avec un numéro |
| `customers` | Les clients : nom, téléphone, plafond de crédit |
| `payment_methods` | Les modes de paiement : Espèces, MTN MoMo, Moov Money, Celtiis Cash… |

**Les produits**

| Table | À quoi elle sert |
|---|---|
| `categories` | Les rayons : Alimentation, Boissons, Quincaillerie… |
| `products` | Le produit : nom, photo, code-barres, unité de base, seuil d'alerte, suivi de la péremption (oui ou non) |
| `product_units` | Les façons de le vendre ou de l'acheter : « Sac 50 kg » à 32 000 F, « Kilo » à 700 F, « Tine » = 2,5 kg |

**Le stock**

| Table | À quoi elle sert |
|---|---|
| `stock_receipts` | Une réception de marchandise (le bon d'entrée) |
| `stock_lots` | Un lot : prix d'achat, date de péremption, fournisseur (un simple texte pour l'instant) |
| `stock_movements` | ⭐ Chaque entrée ou sortie : +10 sacs reçus, −2,5 kg vendus, −1 boîte cassée… |
| `inventory_counts` et `inventory_lines` | Un inventaire : le stock compté, le stock calculé, les écarts |

**Les ventes et l'argent**

| Table | À quoi elle sert |
|---|---|
| `sales` | Une vente, donc une facture : numéro, client, vendeur, remise, total, reste dû, état |
| `sale_items` | Les lignes de la vente : produit, unité, quantité, prix |
| `payments` | L'argent reçu, mode par mode (exemple : 20 000 en espèces + 12 000 en MoMo) |
| `customer_ledger` | ⭐ Le carnet de dettes : +16 500 (achat à crédit), −5 000 (remboursement)… |
| `cash_sessions` | La caisse du jour, une par appareil qui encaisse : fond de caisse, argent attendu, argent compté, écart |

**La traçabilité**

| Table | À quoi elle sert |
|---|---|
| `audit_log` | Le journal des actions : qui a fait quoi, quand, sur quel appareil |

Deux petites listes restent **dans l'appareil** et ne sont jamais envoyées au serveur : les factures « À envoyer » par WhatsApp, et les réglages de l'appareil (imprimante associée, utilisateur actif).

**Exemple : ce que crée une seule vente**

```
Vente F2-000123 — total 36 500 F                → sales
├─ Riz     1 × Sac 50 kg = 32 000 F             → sale_items
│   └─ -50 kg du lot le plus ancien             → stock_movements
├─ Tomate  3 × Boîte     =  4 500 F             → sale_items
│   └─ -2 boîtes du lot qui périme le 12/11
│      -1 boîte du lot qui périme le 25/12      → stock_movements
├─ Payé : 20 000 F en espèces                   → payments
├─ Reste dû : 16 500 F, carnet de Mme Adjovi    → customer_ledger
└─ « Vente F2-000123 faite par Koffi »          → audit_log
```

**Les 5 idées clés**

1. **On n'écrit jamais directement le stock ni les dettes : on les calcule.** Le stock d'un produit, c'est la somme de ses mouvements. La dette d'un client, c'est la somme des lignes de son carnet. C'est ce qui protège les données hors ligne.
2. **On n'utilise que des nombres entiers.** En informatique, 0,1 + 0,2 donne 0,30000000000000004 ! Les nombres entiers, eux, ne font jamais d'erreur.
   - Les montants sont comptés dans la plus petite unité de la monnaie : `32000` = 32 000 FCFA (pour le naira, on compterait en kobos).
   - Les quantités sont comptées en millièmes de l'unité de base, comme si on comptait le riz en grammes : 2,5 kg → `2500`, 1 boîte → `1000`, un sac de 50 kg → `50000`.
3. **Chaque entrée de stock crée un lot, pour tous les produits.** Le lot garde son prix d'achat. À la vente, le lot qui périme le plus tôt sort en premier (FEFO) ; pour un produit sans date de péremption, c'est le plus ancien (FIFO), et ses lots n'apparaissent pas à l'écran. Chaque sortie garde son prix d'achat, d'où le **bénéfice réel = ventes − prix d'achat des lots vendus − pertes**.
4. **On ne supprime jamais rien.** Une vente annulée reste visible (« annulée ») ; des mouvements « retour » remettent la marchandise dans le bon lot ; le journal garde la trace. Les produits et les clients sont archivés, jamais effacés.
5. **Chaque facture a un numéro unique, même hors ligne.** Chaque appareil reçoit un numéro à sa première connexion : `F2-000123` = appareil n° 2, 123ᵉ facture. Deux appareils ne peuvent donc jamais donner le même numéro.

## Le plan en 20 étapes

Les grosses étapes sont découpées en petites parties, avec un « OK » entre chaque partie.

### Phase 1 — Les fondations

- [x] **1. Outils et dépôt Git** — suppression du dépôt Git vide du dossier personnel, réglages Git, extensions VS Code, Expo Go sur le téléphone.
- [x] **2. Création du projet** — projet Expo en TypeScript, avec Expo Router, pour Android, iOS et le web ; premier écran sur le téléphone et dans le navigateur ; explication de chaque dossier.
- [x] **3. Thème, navigation, langue** — fichier de thème « Vert Commerce » (clair et sombre), gros boutons, champs et cartes, onglets en bas sur téléphone et menu sur le côté sur grand écran, traductions, affichage « 32 000 FCFA », premiers tests automatiques.

### Phase 2 — Les données et le hors-ligne

- [x] **4. La base Supabase** — le compte, toutes les tables, la sécurité par boutique (RLS), un test automatique qui prouve que la boutique B ne voit rien de la boutique A.
- [ ] **5. Hors ligne et synchronisation** — premier development build Android, base locale, PowerSync, règles de synchronisation par boutique (avec leur test), bandeau « En ligne / X en attente », premier vrai test en coupant internet, petit essai de la version web hors ligne.
- [ ] **6. Comptes et boutique** — inscription et connexion du propriétaire, création de la boutique (pays, monnaie, modes de paiement), enregistrement de l'appareil, réouverture hors ligne sans se reconnecter.
- [ ] **7. Utilisateurs, PIN et droits** — l'équipe de la boutique, chaque personne avec un rôle (propriétaire, caissier, vendeur, gestionnaire de stock, compteur d'inventaire), code PIN hors ligne, changement rapide d'utilisateur, verrouillage automatique, règles « qui a le droit de faire quoi », journal des actions.

### Phase 3 — Le stock

- [ ] **8. Produits et unités** — fiche produit, catégories, photo, code-barres (caméra du téléphone ou lecteur USB sur PC), recherche rapide, plusieurs unités avec leur prix, affichage « 9 sacs + 47 kg », tests.
- [ ] **9. Entrées de stock et calcul du stock** — réception de marchandise dans n'importe quelle unité, lots, mouvements, calcul du stock ; tests : sac de riz entamé, deux appareils qui vendent hors ligne.
- [ ] **10. Péremption, pertes, inventaire** — sortie du lot qui périme le plus tôt, alertes 30 et 7 jours avant, blocage des périmés (forçage avec trace), pertes, stock bas, inventaire avec écarts ; tests, dont une vente prise sur deux lots.

### Phase 4 — Vendre

- [ ] **11. La caisse** — panier rapide, paiement mixte, paiement partiel (le reste passe en crédit), remise limitée, monnaie à rendre, annulation et retour, tests.
- [ ] **12. Les factures** — PDF fabriqué dans l'appareil (même hors ligne) avec un numéro unique, envoi par WhatsApp et file « À envoyer », historique pour renvoyer ou réimprimer.
- [ ] **13. L'impression** — ticket sur imprimante Bluetooth 58 ou 80 mm (association une fois, puis un clic), impression A4.
- [ ] **14. Clients et crédit** — fiche client, carnet de dettes, plafond, remboursements partiels avec reçu, liste des débiteurs (récent / plus de 30 jours / plus de 60 jours), relance WhatsApp, tests.
- [ ] **15. La caisse du jour** — ouverture et clôture, argent attendu et compté pour chaque mode de paiement, écarts, tests.

### Phase 5 — Piloter la boutique

- [ ] **16. Données de démonstration et tableau de bord** — script de la boutique fictive (30 produits, 30 jours de ventes, clients à crédit), puis tableau de bord : ventes, bénéfice réel, produits qui se vendent et qui dorment, valeur du stock, dettes, alertes, écarts de caisse ; tests.
- [ ] **17. Historique, droits, réglages, export** — écran du journal des actions, vérification complète des droits des vendeurs, écran Paramètres complet, export Excel/CSV.

### Phase 6 — Publier

- [ ] **18. Le site et la version web installable (PWA)** — installable sur téléphone et sur PC, testée hors ligne, mise en ligne, avec la page de téléchargement de l'APK Android.
- [ ] **19. L'application Android (APK)** — APK signé à télécharger depuis le site, mises à jour à distance (EAS Update), message « nouvelle version disponible ». Play Store et App Store : plus tard, si besoin.
- [ ] **20. Windows, abonnement, mise en production** — logiciel Windows (.exe, choix entre Electron et Tauri expliqué), abonnement (hors Play Store, le paiement par Mobile Money devient possible directement dans l'appli ; les règles seront expliquées avant de coder), liste des vérifications avant le lancement, README complet.

## Hors périmètre pour l'instant (V2)

À ne pas coder maintenant, mais sans rien faire qui l'empêche :

- l'interface pour gérer plusieurs boutiques d'un même propriétaire (la base le permet déjà grâce à `shop_id`) ;
- les vendeurs avec leur propre compte sur leur propre téléphone ;
- la connexion par code SMS ou WhatsApp ;
- la gestion des fournisseurs et de leurs dettes ;
- les dépenses de la boutique ;
- le rapport du soir par SMS ou WhatsApp ;
- l'encaissement Mobile Money intégré ;
- les pharmacies ;
- le parrainage : un commerçant en invite un autre et gagne une récompense (lié à l'abonnement, idée d'Ernest du 25/10/2026) ;
- la publication sur Google Play et l'App Store.

## À savoir

- 💰 **Coûts** : développer ne coûte rien (offres gratuites de Supabase, PowerSync et Expo). Distribuer l'APK depuis notre site ne coûte rien (Google Play : 25 $ une fois, App Store : 99 $ par an, seulement si un jour on y publie). Avec de vrais clients, il faudra sans doute des offres payantes pour les serveurs (par exemple, Supabase met en pause un projet gratuit qui ne sert pas pendant une semaine). On fera les comptes à l'étape 20.
- ⚠️ **APK hors Play Store** : depuis le 30/09/2026, Google exige un développeur « vérifié » dans 4 pays (Brésil, Indonésie, Singapour, Thaïlande), pour les applis venant de certaines boutiques d'applications. L'installation directe d'un APK n'y est pas encore bloquée, et le Bénin n'est pas concerné. Google prévoit d'étendre cette vérification au monde entier en 2027 : il faudra alors sans doute faire vérifier son identité de développeur. À surveiller.
- 🌐 **Le web hors ligne** : rouvrir la page sans internet demande la version installable (étape 18). Un petit essai sera fait dès l'étape 5, pour vérifier tôt que ça marche.

## Notes techniques

- Outils présents sur le PC (25/10/2026) : Node.js 24, npm 11, Git 2.54, VS Code. Pas d'Android Studio (inutile grâce à EAS). Les outils Expo et Supabase se lancent avec `npx`, sans installation.
- Git pour Windows règle `core.autocrlf=true` pour tout le PC. Le fichier `.gitattributes` du projet impose les fins de ligne « LF ».
- Les messages de Git s'affichent en anglais sur ce PC.
- Appareil de test : une tablette Xiaomi Redmi Pad 2. La mise en page « téléphone » se vérifie aussi dans le navigateur (outils de développement, mode appareil mobile).
- Projet créé avec **Expo SDK 58** (React Native 0.88, React 19.3, TypeScript 6). Les écrans sont dans `src/app/` (Expo Router). Expo change beaucoup à chaque version : avant d'utiliser une fonction d'Expo, lire la documentation de la bonne version (voir `AGENTS.md`).
- Toujours installer une bibliothèque avec `npx expo install <nom>` (et non `npm install <nom>`) : Expo choisit alors la version compatible.
- Vérifications à lancer avant chaque commit : `npm test` (tests automatiques, Vitest), `npm run lint` (ESLint + Prettier), `npm run typecheck` (TypeScript). Les tests sont à côté du code qu'ils vérifient (`money.ts` → `money.test.ts`).
- Sous Windows, `npx expo install … -- --dev` a rangé les outils dans `dependencies` au lieu de `devDependencies` : vérifier `package.json` après chaque installation d'outil de développement.
- Ne **jamais** lancer `npm audit fix --force` : les alertes de sécurité viennent des outils de développement d'Expo, et cette commande remplacerait Expo par la version 44.
- Réseau : le Wi-Fi de la maison (Bbox) était réglé en profil « Public » dans Windows, ce qui bloque la tablette → le passer en « Privé ». Expo annonce l'adresse `192.168.1.143` (le PC a aussi des cartes réseau VMware et VirtualBox, à surveiller si le QR code ne marche plus).
- Le fichier `LICENSE` du modèle Expo (licence libre MIT) a été retiré : le code de Boutik n'est pas en licence libre.
- **Thème** : toutes les couleurs, tailles et espacements sont dans `src/theme/tokens.ts` ; leur traduction pour React Native Paper est dans `src/theme/paper-theme.ts` (les écrans lisent le thème avec `useAppTheme()`). Le choix clair / sombre / auto est enregistré dans l'appareil (AsyncStorage).
- **Textes** : tous dans `src/i18n/fr.ts`, affichés avec `t('clé')`. TypeScript signale une clé inconnue.
- **Icônes** : `@react-native-vector-icons/material-design-icons` (et non `@expo/vector-icons`, qui va être abandonné). Paper le détecte tout seul. L'extension VS Code « Expo Tools » affiche un faux avertissement sur ce module dans `app.json` : Expo, lui, le lit sans problème.
- **Navigation** : `src/app/(tabs)/_layout.tsx` utilise les onglets « sans habillage » d'Expo Router (`expo-router/ui`) : une liste d'onglets invisible + notre barre du bas (`BottomNav`) ou notre menu sur le côté (`SideNav`), selon la largeur (768 points).
- **Supabase** : projet `boutik` (identifiant `twidouwbbikvqqghnhdp`), région Paris, PostgreSQL 17, sur le même compte qu'ÉcoPay. L'appli utilise la clé « publishable » (fichier `.env`, jamais dans Git) ; la clé « secret » et le mot de passe de la base ne vont jamais dans l'appli, dans Git ou dans une conversation.
- **Migrations** : la base est décrite par les fichiers de `supabase/migrations/`, envoyés avec `npx supabase db push`. Ne jamais modifier une migration déjà envoyée : en créer une nouvelle (`npx supabase migration new <nom>`).
- **Tests de sécurité** : `supabase/tests/` applique nos vraies migrations dans un PostgreSQL en mémoire (PGlite) qui imite Supabase, puis vérifie qu'une boutique ne voit ni ne modifie les données d'une autre. Ils tournent avec `npm test`, sans réseau. `npm run typecheck` vérifie l'appli ET ces tests (deux configurations TypeScript).
- **Routes typées désactivées** (`typedRoutes: false` dans `app.json`) : avec Expo 58 et le dossier `src/app`, le générateur prenait tous les fichiers de `src/` pour des écrans et écrivait `/index` au lieu de `/`. À réessayer lors d'une future mise à jour d'Expo.
