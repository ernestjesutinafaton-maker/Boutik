# Boutik — Avant le lancement

Ce document rassemble ce qu'il reste à faire avant d'ouvrir Boutik à de vraies boutiques,
et les deux choix qui reviennent à Ernest (logiciel Windows, abonnement).

## 1. Liste des vérifications

### Comptes et sécurité
- [ ] Brancher un vrai service d'envoi d'e-mails dans Supabase (Authentication → Emails → SMTP),
      par exemple Brevo ou Resend : le service par défaut de Supabase est limité à quelques e-mails par heure.
- [ ] Garder « Confirm email » activé (il l'est aujourd'hui) et traduire les e-mails en français
      (Authentication → Email Templates).
- [ ] Changer le mot de passe du compte utilisé pour les essais (il a été écrit dans une conversation).
- [ ] Vérifier qu'aucune clé secrète n'est dans Git : `git grep -i "service_role\|secret"`.
- [ ] Activer la double authentification sur les comptes Supabase, PowerSync, Expo et GitHub.

### Serveurs
- [ ] Supabase : passer à l'offre payante (le projet gratuit se met en pause après 7 jours sans activité)
      et activer les sauvegardes quotidiennes.
- [ ] PowerSync : vérifier les limites de l'offre (nombre d'appareils connectés, données synchronisées).
- [ ] Recopier `powersync/sync-config.yaml` dans le tableau de bord PowerSync après chaque nouvelle table.

### Application Android
- [ ] Choisir l'identifiant définitif (`com.boutik.app`) : il ne pourra plus changer.
- [ ] Garder précieusement la clé de signature (EAS la conserve ; en télécharger une copie de secours :
      `npx eas-cli@latest credentials`).
- [x] APK final fabriqué le 31/10/2026 (EAS, profil `production`, version 1.0.0) et publié sur GitHub :
      dépôt public `Boutik-presentation` → « Releases » (le fichier, 131 Mo, dépasse la limite de 100 Mo
      d'un envoi sur Vercel). Le site, l'appli web et `public/version.json` pointent vers
      `…/releases/latest/download/boutik.apk`, qui donne toujours la dernière version. Pour une
      nouvelle version : `gh release create vX.Y.Z downloads/boutik.apk --repo ernestjesutinafaton-maker/Boutik-presentation`.
- [x] Version 1.0.1 (38 Mo au lieu de 131) publiée le 01/11/2026 : Release `v1.0.1`.
- [x] Mises à jour sans réinstaller (EAS Update) : `npm run update:android -- --message "…"`
      (jamais `eas update` seul : il viderait `dist/`, le dossier du site). Depuis Expo 55, cette
      commande ne lit PLUS le fichier `.env` : les trois réglages du serveur (`EXPO_PUBLIC_SUPABASE_URL`,
      `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `EXPO_PUBLIC_POWERSYNC_URL`) sont enregistrés sur EAS,
      environnement « production » (01/11/2026). Ils existent donc à trois endroits : `.env` (PC et
      appli web), `eas.json` (APK) et EAS (mises à jour). Si l'un change, changer les trois
      (`npx eas-cli@latest env:set production --name … --value … --visibility plaintext`).
- [ ] Renseigner `EXPO_PUBLIC_VERSION_URL` (adresse de `version.json` sur le site) dans `eas.json`
      pour que l'appli annonce les nouvelles versions de l'APK.
- [ ] Tester sur 2 ou 3 téléphones bon marché (Android 10 et plus), dont un sans Google Play.

### Site et version web
- [x] Adresse choisie par Ernest (26/10/2026) : **https://boutik-services.vercel.app** (hébergement Vercel, réglages dans `public/vercel.json`, publication avec `npm run deploy:web`).
- [x] Site et appli web publiés le 31/10/2026 (`npm run deploy:web`) ; aucune page ne déborde de 320 à 1 280 px.
- [ ] Vérifier l'installation sur Android, iPhone et ordinateur.
- [ ] Avant de vendre des abonnements : passer Vercel à l'offre **Pro** (payante) ou changer d'hébergeur.
      L'offre gratuite « Hobby » est réservée à un usage personnel non commercial ; un site qui
      présente un service payant est un usage commercial (règles d'usage de Vercel, « Commercial usage »).

### Essais en boutique
- [ ] Une semaine d'essai dans une vraie boutique : ventes, crédit, clôtures, inventaire, coupures de réseau.
- [ ] Vérifier l'imprimante Bluetooth réellement utilisée (accents, largeur du papier).
- [ ] Former la première boutique (30 minutes) et noter ce qui n'est pas clair.

## 2. Le logiciel Windows : Electron ou Tauri ?

Aujourd'hui, Boutik **s'installe déjà sur un ordinateur** : dans Chrome ou Edge, le bouton « Installer »
crée une icône sur le bureau, et l'appli marche sans internet (version web installable, étape 18).
Un vrai fichier `.exe` n'apporte que deux choses : une installation « classique » qui rassure certains
clients, et l'accès direct aux imprimantes USB de tickets (sans passer par la fenêtre d'impression).

| | **Electron** | **Tauri** |
|---|---|---|
| Principe | embarque son propre navigateur (Chromium) | utilise le navigateur déjà présent dans Windows (WebView2) |
| Taille de l'installateur | ~80 à 120 Mo | ~5 à 10 Mo |
| Mémoire utilisée | élevée (300 Mo et plus) | faible |
| Outils à installer sur le PC du développeur | Node.js seulement (déjà là) | Rust + outils de compilation Microsoft |
| Maturité, documentation | très grande (VS Code, WhatsApp Desktop…) | bonne, plus récente |
| Mises à jour automatiques | oui (electron-updater) | oui (plugin updater) |

**Recommandation :** commencer **sans .exe** (la version installable suffit), puis, si les boutiques le
demandent, choisir **Tauri** : un installateur 10 fois plus léger compte beaucoup avec des connexions
lentes et des PC modestes. Electron reste le choix le plus simple si l'on veut aller vite sans installer Rust.

👉 **Décision à prendre par Ernest** : rester sur la version installable, ou Tauri, ou Electron.

## 3. L'abonnement : comment faire payer ?

Boutik étant distribué hors Play Store, **aucune commission de Google** : on peut faire payer
directement par Mobile Money.

### Formules possibles
1. **Abonnement mensuel par boutique** (ex. 3 000 à 5 000 FCFA / mois), avec 1 mois d'essai gratuit.
2. **Prix selon la taille** : Essentiel (1 appareil), Pro (3 appareils, équipe, rapports), Grossiste (illimité).
3. **Paiement annuel** avec 2 mois offerts (moins de relances, plus de trésorerie).

### Encaisser par Mobile Money (Bénin)
Des agrégateurs béninois acceptent MTN MoMo, Moov Money et Celtiis, avec une seule intégration :
**FedaPay** et **KKiaPay** sont les plus utilisés. Ils prennent une commission (environ 2 à 4 %)
et demandent les documents de l'entreprise (RCCM, IFU).

### Ce qu'il faudra coder (après la décision)
- une table `subscriptions` (boutique, formule, date de fin) et une fonction serveur qui la met à jour
  quand l'agrégateur confirme le paiement (« webhook ») ;
- dans l'appli : écran « Mon abonnement », rappel 7 jours avant la fin ;
- **règle choisie par Ernest (01/11/2026)** : 7 jours de grâce après la fin de l'essai ou de l'abonnement,
  puis la boutique est EN PAUSE (tout bloqué sauf le paiement, vérifié aussi par le serveur : code BK001,
  l'appareil garde ses données et les envoie après validation). Une déclaration de paiement (capture
  obligatoire) ouvre 3 jours d'accès provisoire, une fois par 30 jours, jamais juste après un refus.

👉 **Décisions à prendre par Ernest** : la formule et les prix, l'agrégateur (FedaPay ou KKiaPay),
la durée de l'essai gratuit et le délai de grâce.
