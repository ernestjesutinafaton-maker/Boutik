# Boutik

Application de gestion de stock, de caisse et de ventes à crédit pour les boutiques en Afrique.
Un seul code pour Android, iOS et le web (Expo + TypeScript).

- Le plan du projet et l'avancement : [docs/PLAN.md](docs/PLAN.md)
- Les besoins détaillés : [docs/CAHIER_DES_CHARGES.md](docs/CAHIER_DES_CHARGES.md)

## Lancer le projet

1. Installer les bibliothèques (une seule fois, puis après chaque récupération du code) :

   ```bash
   npm install
   ```

2. Démarrer le serveur de développement :

   ```bash
   npx expo start
   ```

3. Ouvrir l'application :
   - sur la tablette ou le téléphone Android : scanner le QR code avec **Expo Go** ;
   - dans le navigateur : appuyer sur la touche **w** dans le terminal.

4. Arrêter le serveur : **Ctrl + C** dans le terminal.

⚠️ Ne jamais lancer `npm audit fix --force` : cette commande remplacerait Expo par une très vieille version et casserait le projet.

> Le README complet (variables d'environnement, fabrication des applications Android/iOS/Windows, publication des mises à jour) sera écrit à l'étape 20.
