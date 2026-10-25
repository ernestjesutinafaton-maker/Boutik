# Cahier des charges — Boutik

> Texte de la demande d'origine (25/10/2026), recopié tel quel.
> Le plan validé, les décisions prises et l'avancement sont dans [PLAN.md](PLAN.md).

Tu es mon développeur senior et mon mentor. Je suis DÉBUTANT en programmation : explique chaque action simplement, en français, et ne suppose jamais que je sais faire quelque chose. Tu as accès au dossier du projet dans VS Code : crée et modifie toi-même les fichiers, et donne-moi les commandes exactes à lancer dans le terminal quand c'est nécessaire.

## LE PROJET

Nom provisoire : "Boutik". Une application de gestion de stock, de caisse et de ventes à crédit pour les BOUTIQUES en Afrique (superettes, quincailleries, alimentation générale, pièces détachées, cosmétiques, boissons…). PAS les pharmacies.

Lancement au BÉNIN, mais l'application doit être prévue dès le départ pour toute l'Afrique (voir "Multi-pays").

Problème : les commerçants gèrent leur stock dans un cahier, ne connaissent pas leur bénéfice réel, perdent de l'argent à cause des vols, des produits périmés et des ventes à crédit non remboursées, et le réseau internet est souvent instable.

## PLATEFORMES (UN SEUL CODE POUR TOUT)

- Application mobile Android (Google Play Store, PRIORITAIRE) et iOS (App Store)
- Version web dans le navigateur, installable sur l'écran d'accueil et sur ordinateur (PWA), utilisable hors connexion après une première ouverture
- Version ordinateur : d'abord la PWA installée sur PC (fenêtre propre, icône sur le bureau). Plus tard, en fin de projet, un logiciel Windows installable (.exe) qui emballe la version web : propose-moi alors la solution la plus simple (Electron ou Tauri) et explique pourquoi.
- Usage PRINCIPAL : téléphone Android. Conçois tout d'abord pour un petit écran, puis adapte pour tablette et ordinateur (sur grand écran : menu latéral et tableaux plus larges).

## HORS CONNEXION D'ABORD ("OFFLINE-FIRST") — EXIGENCE N°1

L'application doit fonctionner COMPLÈTEMENT sans internet, sur mobile ET sur web/ordinateur, pour tout ce qui ne demande pas forcément le réseau : ventes, caisse, gestion du stock, lots et dates de péremption, ventes à crédit et remboursements, clients, inventaire, tableau de bord, génération des factures PDF, impression Bluetooth.

Seuls ces éléments demandent internet : la toute première connexion/création de compte, la synchronisation entre appareils, l'envoi WhatsApp, l'abonnement.

Architecture demandée :

- Base de données LOCALE SQLite dans l'appareil = source de vérité pour l'interface (lecture et écriture instantanées, même hors ligne).
- Synchronisation automatique avec Supabase (PostgreSQL) quand le réseau est disponible, via PowerSync (SDK React Native/Expo et SDK Web, avec l'intégration Supabase). Si tu vois une meilleure option adaptée à un débutant, explique-moi les avantages/inconvénients AVANT de changer.
- Identifiants générés côté appareil (UUID) pour éviter les conflits.
- Le STOCK n'est jamais une simple valeur écrasée : il est calculé à partir de MOUVEMENTS de stock (entrée, vente, retour, perte, ajustement d'inventaire, transfert). Ainsi, deux appareils qui vendent hors ligne en même temps ne s'écrasent pas : à la synchronisation, les mouvements s'additionnent.
- Indicateur visible en permanence : "En ligne / Hors ligne" et "X opérations en attente de synchronisation".
- Après la première connexion en ligne, l'utilisateur doit pouvoir rouvrir l'application et travailler hors ligne sans se reconnecter.

## STACK TECHNIQUE (ne pas changer sans me demander)

- Expo (React Native) + TypeScript + Expo Router, avec le support web activé (un seul code pour Android, iOS et web)
- Builds de développement Expo (development build) et EAS Build pour générer les applications Android/iOS (explique-moi pourquoi Expo Go ne suffira pas, à cause des modules natifs : SQLite/PowerSync, Bluetooth)
- Supabase : PostgreSQL, authentification, Row Level Security (RLS), stockage des images (photos produits, logo)
- PowerSync pour la synchronisation hors ligne
- Interface : composants simples et cohérents (propose une bibliothèque UI compatible Expo + web, par exemple Tamagui ou NativeWind), icônes claires
- Génération de PDF côté appareil (fonctionne hors ligne)
- Impression : imprimante thermique Bluetooth 58 mm / 80 mm (ESC/POS) sur Android, et impression système (imprimante A4 USB ou wifi) sur toutes les plateformes
- Validation des données avec Zod
- Tests unitaires pour toute la logique métier (calcul du stock, unités, lots, crédit, bénéfice)

## THÈME ET DESIGN

Thème "Vert Commerce" :

- Couleur principale : vert émeraude #059669
- Accent : orange #F59E0B (boutons importants, alertes de stock bas)
- Danger : rouge #DC2626 (dettes, produits périmés, erreurs)
- Fond clair par défaut (lisible en plein soleil), mode sombre en option

Règles de design :

- Toutes les couleurs, tailles et espacements définis à UN SEUL endroit (fichier de thème) pour pouvoir changer facilement de thème plus tard
- Gros boutons faciles à toucher, gros chiffres, texte lisible, peu d'écrans pour faire une vente
- Interface en français, simple pour des personnes peu habituées aux applications

## MULTI-PAYS ET LANGUE

- Pays et monnaie configurables par boutique. Par défaut : Bénin, FCFA (XOF), indicatif +229. Prévoir aussi XAF, GNF, NGN, GHS, etc.
- Montants stockés en ENTIERS dans la plus petite unité de la monnaie (le FCFA n'a pas de centimes). Format : "32 000 FCFA".
- Interface en français, avec un système de traduction (i18n) prêt pour ajouter l'anglais plus tard.
- Modes de paiement configurables par pays. Bénin : Espèces, MTN MoMo, Moov Money, Celtiis Cash, Crédit, Autre. (Dans le MVP, on ENREGISTRE le mode de paiement ; pas d'encaissement Mobile Money automatique.)

## UTILISATEURS ET RÔLES

- Propriétaire : tout voir et tout gérer, y compris à distance depuis son téléphone quand il est en ligne.
- Vendeur : peut vendre, encaisser, enregistrer un remboursement de crédit. NE PEUT PAS voir les prix d'achat ni les bénéfices, modifier les prix, supprimer une vente, faire un ajustement de stock ou accorder une remise au-delà d'une limite fixée par le propriétaire.
- Sur un appareil partagé de la boutique : changement rapide d'utilisateur avec un code PIN à 4 chiffres, qui fonctionne hors ligne.
- Historique de TOUTES les actions sensibles (qui, quoi, quand, sur quel appareil) : ventes, annulations, modifications de prix, ajustements de stock, remises. Rien n'est vraiment supprimé : une annulation crée une trace.
- Multi-boutiques dans les données (chaque donnée appartient à une boutique `shop_id`). Une boutique ne doit JAMAIS voir les données d'une autre : politiques RLS + règles de synchronisation PowerSync par boutique, avec un test qui le vérifie. (L'interface pour gérer plusieurs boutiques d'un même propriétaire viendra en V2, mais la base doit déjà le permettre.)

## FONCTIONNALITÉS DU MVP

1. Produits
   - Fiche : nom, catégorie, photo facultative, code-barres facultatif (scan avec la caméra), unité de base, seuil d'alerte de stock bas, option "suivre les dates de péremption" (oui/non).
   - Recherche rapide par nom ou code-barres.

2. UNITÉS MULTIPLES ET CONDITIONNEMENTS (important)
   - Chaque produit a une unité de base (kg, pièce, litre, mètre, boîte…). Le stock est TOUJOURS compté dans cette unité.
   - Le produit peut avoir plusieurs unités de vente, chacune avec son facteur de conversion ET son propre prix de vente.
     - Exemple riz : base = kg ; "Sac 50 kg" = 50 kg à 32 000 ; "Sac 25 kg" = 25 kg à 16 500 ; "Kilo" = 1 kg à 700 ; mesure locale "Tine" = 2,5 kg (nom et facteur définis par le commerçant).
     - Exemple conserve : base = boîte ; "Carton" = 24 boîtes.
   - Affichage du stock lisible : "9 sacs + 47 kg" (et en unité de base).
   - Les achats/entrées peuvent aussi se faire dans n'importe quelle unité (ex. réception de 10 sacs).
   - Gérer correctement les quantités décimales (ex. 2,5 kg) sans erreurs d'arrondi (stocker en entiers dans une sous-unité, par exemple en grammes, ou utiliser une méthode sûre que tu m'expliqueras).

3. LOTS ET DATES DE PÉREMPTION (pour les produits où l'option est activée)
   - Chaque entrée de stock crée un lot : quantité, prix d'achat, date de péremption, fournisseur facultatif.
   - Un même produit peut avoir plusieurs lots avec des dates différentes (ex. Tomate Tomato : lot de 20 boîtes au 12/10, lot de 30 boîtes au 25/10).
   - À la vente, sortie automatique du lot qui expire le plus tôt ("premier périmé, premier sorti", FEFO), sur plusieurs lots si nécessaire.
   - Alertes avant péremption (délais réglables, par défaut J-30 et J-7) et liste "produits bientôt périmés".
   - Produits périmés bloqués à la vente (avec possibilité pour le propriétaire de forcer, avec trace).
   - Enregistrement des pertes (périmé, cassé, volé, autre) avec leur valeur en prix d'achat.
   - Le prix d'achat de chaque lot sert à calculer le bénéfice réel de chaque vente.

4. Entrées de stock et inventaire
   - Réception de marchandise : produits, quantités, unités, prix d'achat, dates de péremption si besoin, fournisseur facultatif.
   - Inventaire : saisir le stock réellement compté, voir les écarts avec le stock théorique, valider (crée des mouvements d'ajustement tracés). Uniquement pour le propriétaire.
   - Alerte et liste des produits en stock bas.

5. Caisse / ventes (doit être TRÈS rapide : une vente simple en quelques touches)
   - Recherche ou scan du produit, choix de l'unité, quantité, panier, total.
   - Client facultatif (nom + téléphone), obligatoire pour une vente à crédit.
   - Modes de paiement, y compris paiement mixte (ex. une partie en espèces, une partie en MoMo) et paiement partiel (le reste passe en crédit).
   - Remise (limitée pour les vendeurs).
   - Calcul du rendu de monnaie pour les espèces.
   - Annulation / retour d'une vente (propriétaire), avec remise en stock dans le bon lot et trace.

6. FACTURES ET REÇUS
   - Génération d'une facture PDF HORS LIGNE après chaque vente : nom et logo de la boutique, numéro de facture unique (unique même entre plusieurs appareils hors ligne), date et heure, vendeur, client (nom, téléphone) si renseigné, liste des articles avec quantité, unité, prix unitaire, total de ligne, remise, total, montant payé, mode(s) de paiement, reste dû si crédit.
   - Trois actions possibles :
     - a. Envoyer au client par WhatsApp (partage du fichier PDF vers le numéro du client). Hors ligne : la facture va dans une file "À envoyer" et l'application rappelle de l'envoyer quand le réseau revient.
     - b. Imprimer un ticket sur une imprimante thermique Bluetooth (fonctionne sans internet) : écran pour associer l'imprimante une fois, puis impression en un clic.
     - c. Imprimer en A4 sur une imprimante classique via l'impression système.
   - Retrouver, renvoyer ou réimprimer toute ancienne facture.

7. VENTES À CRÉDIT (carnet de dettes digital)
   - Fiche client : nom, téléphone, total dû, historique des achats et remboursements.
   - Plafond de crédit facultatif par client.
   - Remboursements partiels, avec reçu.
   - Liste des clients débiteurs triée par montant ou ancienneté de la dette (badge : récent / plus de 30 jours / plus de 60 jours).
   - Bouton "Rappeler par WhatsApp" avec un message pré-rempli modifiable (nom, montant dû, nom de la boutique).

8. Caisse du jour
   - Ouverture de caisse (fond de caisse) et clôture : argent attendu par mode de paiement vs argent réellement compté, écart affiché et enregistré.

9. TABLEAU DE BORD DU PROPRIÉTAIRE
   - Ventes du jour / de la semaine / du mois, nombre de ventes, panier moyen
   - BÉNÉFICE RÉEL (ventes − prix d'achat des lots vendus − pertes)
   - Produits les plus vendus et produits qui ne se vendent pas (aucune vente depuis X jours)
   - Valeur totale du stock (en prix d'achat et en prix de vente)
   - Total des dettes clients
   - Produits en stock bas et bientôt périmés
   - Écarts de caisse
   - Le tout fonctionne hors ligne avec les données locales.

10. Paramètres de la boutique
    - Nom, logo, adresse, téléphone, pays/monnaie, modes de paiement, mentions sur la facture, délais d'alerte de péremption, limite de remise des vendeurs, gestion des utilisateurs et codes PIN, imprimante associée, thème clair/sombre.

11. Sauvegarde et sécurité des données
    - Les données sont sauvegardées sur le serveur à chaque synchronisation.
    - Export Excel/CSV des ventes, du stock et des dettes (propriétaire).

HORS PÉRIMÈTRE pour l'instant (V2, ne pas coder maintenant, mais ne rien faire qui l'empêche) : interface multi-boutiques, gestion des fournisseurs et de leurs dettes, dépenses de la boutique, rapport du soir par SMS/WhatsApp, encaissement Mobile Money intégré, pharmacies.

12. Abonnement (à faire en TOUT DERNIER) : essai gratuit de 30 jours, puis abonnement mensuel par boutique. Avant de coder, explique-moi les règles d'Apple et Google sur la vente d'abonnements dans une application et propose la solution la plus simple et conforme.

## EXIGENCES DE QUALITÉ

- Toute la logique métier (conversion d'unités, sortie des lots FEFO, calcul du stock à partir des mouvements, bénéfice, crédit, caisse) dans des fonctions séparées et bien testées, réutilisées partout.
- Tests sur des cas réels : vente au détail d'un sac de riz entamé, vente qui prend sur deux lots, retour de vente, deux appareils qui vendent le même produit hors ligne puis se synchronisent, paiement partiel qui crée une dette, remboursement partiel.
- Clés secrètes uniquement dans les fichiers d'environnement, jamais dans le code ; fournir un `.env.example`.
- Messages d'erreur clairs en français.
- Données de démonstration : un script qui crée une boutique fictive avec une trentaine de produits (riz en sacs et au kilo, conserves avec lots et dates de péremption différentes, boissons en casiers, quincaillerie), des ventes sur 30 jours, des clients à crédit, pour tester tous les écrans.
- Application légère et rapide, même sur un téléphone Android d'entrée de gamme.
- Code commenté en français aux endroits importants ; explique-moi la structure des dossiers.

## MÉTHODE DE TRAVAIL (TRÈS IMPORTANT)

1. Avant d'écrire du code : présente-moi le PLAN complet en petites étapes numérotées (environ 15 à 20), le schéma de la base de données expliqué simplement (produits, unités, lots, mouvements de stock, ventes, lignes de vente, paiements, clients, crédits, caisses, utilisateurs, journal d'actions), et l'architecture hors ligne avec un petit schéma. Attends ma validation.
2. Ensuite, UNE étape à la fois. À chaque étape :
   - dis ce que tu vas faire et pourquoi, en 2-3 phrases simples
   - crée/modifie les fichiers
   - donne-moi les commandes exactes à copier-coller, une par une, et ce que je dois voir s'afficher
   - dis-moi comment vérifier que ça marche (sur mon téléphone Android, dans le navigateur, et en coupant internet pour tester le hors ligne)
   - ATTENDS que je réponde "OK" avant de passer à la suite
3. Pour tout ce qui se passe hors de VS Code (installer Node.js, Git, Android Studio ou configurer mon téléphone Android en mode développeur, créer les comptes Supabase, PowerSync, Expo/EAS, Google Play Console, Apple Developer, récupérer les clés), guide-moi clic par clic.
4. Si je t'envoie une erreur : explique sa cause simplement, puis corrige.
5. Après chaque étape terminée : propose un commit Git avec un message clair.
6. Ordre conseillé :
   installation des outils → création du projet Expo (mobile + web) → thème et navigation → base de données Supabase + RLS → base locale + synchronisation PowerSync (tester hors ligne dès maintenant) → authentification, création de boutique, utilisateurs, PIN → produits et unités multiples → entrées de stock, lots et péremption → mouvements et calcul du stock + tests → caisse et ventes → factures PDF → partage WhatsApp et file "À envoyer" → impression Bluetooth et A4 → ventes à crédit et clients → caisse du jour → tableau de bord → historique des actions et permissions → export Excel → données de démonstration → version web installable (PWA) testée hors ligne → build Android (APK de test puis Play Store) → build iOS → logiciel Windows → abonnement → checklist de mise en production.
7. Quand j'aurai de nouvelles idées de fonctionnalités, aide-moi à juger si elles vont dans le MVP ou en V2, et intègre-les proprement sans casser l'existant.
8. À la fin : un README en français (lancer le projet, variables d'environnement, générer les applications Android/iOS/web/Windows, publier une mise à jour).
