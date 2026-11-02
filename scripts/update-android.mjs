// Publie une mise à jour Android sans réinstaller (EAS Update), pour les téléphones qui ont
// la version de l'APK écrite dans app.json.
//   npm run update:android -- --message "Ce qui change"
//   npm run update:android            (message : le titre du dernier commit)
// Le code est préparé dans dist-update/ (jamais dans dist/, le dossier du site).
import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const args = process.argv.slice(2);
let message = '';
const index = args.indexOf('--message');
if (index >= 0) {
  message = args[index + 1] ?? '';
  args.splice(index, 2);
}
if (!message.trim()) {
  message = execFileSync('git', ['log', '-1', '--pretty=%s'], { encoding: 'utf8' }).trim();
}
// Court et sans guillemets : il passe tel quel dans le terminal de Windows
message = message.replace(/"/g, "'").slice(0, 120);

const version = JSON.parse(readFileSync('app.json', 'utf8')).expo.version;
console.log(`Mise à jour pour les téléphones en version ${version} : « ${message} »`);

const result = spawnSync(
  'npx',
  [
    'eas-cli@latest',
    'update',
    '--channel',
    'production',
    '--platform',
    'android',
    '--environment',
    'production',
    '--input-dir',
    'dist-update',
    '--non-interactive',
    '--message',
    `"${message}"`,
    ...args,
  ],
  // Sous Windows, « npx » est un script : il faut passer par le terminal
  { stdio: 'inherit', shell: true }
);
process.exit(result.status ?? 1);
