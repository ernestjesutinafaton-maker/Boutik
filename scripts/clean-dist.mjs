// Vide le dossier dist/ avant de reconstruire le site et l'appli web, SAUF dist/.vercel (le lien
// avec le projet Vercel « boutik »). Sans ce nettoyage, des fichiers laissés par un autre outil
// (ex. « eas update », qui prépare son code dans dist/ par défaut) partiraient avec le site.
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = join(dirname(fileURLToPath(import.meta.url)), '..', 'dist');

if (existsSync(dist)) {
  for (const name of readdirSync(dist)) {
    if (name !== '.vercel') {
      rmSync(join(dist, name), { recursive: true, force: true });
    }
  }
}
console.log('dist/ nettoyé (le lien avec Vercel est gardé)');
