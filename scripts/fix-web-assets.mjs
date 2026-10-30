// Vercel n'envoie jamais les dossiers nommés « node_modules » : la police des icônes
// (dist/app/assets/node_modules/...) répondait 404 et les icônes restaient vides sur le web.
// On déplace ces fichiers dans assets/vendor et on corrige les chemins dans le code exporté.
// À lancer juste après « expo export », avant workbox (qui liste les fichiers à garder hors ligne).
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist/app';
const from = join(outDir, 'assets', 'node_modules');
const to = join(outDir, 'assets', 'vendor');

if (!existsSync(from)) {
  console.log('fix-web-assets : rien à déplacer');
  process.exit(0);
}
renameSync(from, to);

function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(js|html|json)$/.test(name)) {
      const text = readFileSync(path, 'utf8');
      if (text.includes('assets/node_modules/')) {
        writeFileSync(path, text.replaceAll('assets/node_modules/', 'assets/vendor/'));
      }
    }
  }
}
walk(outDir);
console.log('fix-web-assets : polices déplacées dans assets/vendor');
