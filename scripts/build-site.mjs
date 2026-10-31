// Assemble le site vitrine (site/) dans dist/ : une page HTML par fichier de site/pages,
// avec l'en-tête et le pied de page communs (site/layout.html) et les réglages de site/config.json.
// L'appli web, elle, est dans dist/app (expo export).
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const site = join(root, 'site');
const dist = join(root, 'dist');
const config = JSON.parse(readFileSync(join(site, 'config.json'), 'utf8'));
const layout = readFileSync(join(site, 'layout.html'), 'utf8');

// Une valeur vide (ou null) dans config.json n'affiche rien sur le site
const todo = '';
// Un fichier à télécharger qui n'est pas encore fabriqué (dossier downloads/) : bouton « Bientôt disponible »
const isAvailable = (href) =>
  !href.startsWith('/telecharger/') ||
  existsSync(join(root, 'downloads', decodeURIComponent(href.slice('/telecharger/'.length))));
const markUnavailable = (html) =>
  html.replace(/<a([^>]*?)href="([^"]+)"([^>]*)>/g, (tag, before, href, after) =>
    isAvailable(href)
      ? tag
      : `<a${before}href="/telecharger"${after.replace(/\s+download\b/, '')} data-soon aria-disabled="true" title="Bientôt disponible">`
  );
// Nettoie ce que laissent les valeurs vides : lignes vides, virgules doublées
const tidy = (html) =>
  html
    .replace(/(<br \/>\s*){2,}/g, '<br />')
    .replace(/,\s*,/g, ',')
    .replace(/<p>\s*<\/p>/g, '');
const today = new Date().toLocaleDateString('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
const contact = [
  config.whatsapp &&
    `<a class="btn btn-primary btn-lg" href="https://wa.me/${config.whatsapp.replace(/\D/g, '')}">💬 WhatsApp</a>`,
  config.contactEmail &&
    `<a class="btn btn-ghost btn-lg" href="mailto:${config.contactEmail}">✉️ ${config.contactEmail}</a>`,
]
  .filter(Boolean)
  .join('\n');

// Logos officiels (site/icons/*.svg) insérés dans la page : {{icon.android}}, {{icon.windows}}…
const icons = Object.fromEntries(
  readdirSync(join(site, 'icons')).map((file) => [
    `icon.${file.replace('.svg', '')}`,
    readFileSync(join(site, 'icons', file), 'utf8')
      .trim()
      .replace('<svg ', '<svg aria-hidden="true" focusable="false" width="40" height="40" ')
      .replace(/<title>.*?<\/title>/, ''),
  ])
);

const values = {
  ...icons,
  siteUrl: config.siteUrl,
  version: config.version,
  year: String(new Date().getFullYear()),
  today,
  contactEmail: config.contactEmail
    ? `<a href="mailto:${config.contactEmail}">${config.contactEmail}</a>`
    : todo,
  'editeur.nom': config.editeur.nom || todo,
  'editeur.adresse': config.editeur.adresse || todo,
  'editeur.pays': config.editeur.pays || todo,
  rccmLine: config.editeur.rccm ? `<p>Numéro RCCM / IFU : ${config.editeur.rccm}</p>` : '',
  'downloads.android': config.downloads.android,
  'downloads.windows': config.downloads.windows,
  'downloads.linux': config.downloads.linux,
  contactButtons: contact || `<p>Contact : ${todo}</p>`,
};
const fill = (text, extra = {}) =>
  text.replace(/\{\{([\w.]+)\}\}/g, (all, key) => ({ ...values, ...extra })[key] ?? all);

mkdirSync(dist, { recursive: true });
for (const file of readdirSync(join(site, 'pages'))) {
  const source = readFileSync(join(site, 'pages', file), 'utf8');
  const meta = /^<!--([\s\S]*?)-->/.exec(source)?.[1] ?? '';
  const title = /title:\s*(.+)/.exec(meta)?.[1].trim() ?? 'Boutik';
  const description = /description:\s*(.+)/.exec(meta)?.[1].trim() ?? '';
  const name = file.replace(/\.html$/, '');
  const path = name === 'index' ? '/' : `/${name}`;
  const content = fill(source.replace(/^<!--[\s\S]*?-->\s*/, ''));
  writeFileSync(
    join(dist, file),
    tidy(markUnavailable(fill(layout, { title, description, path, content })))
  );
}

mkdirSync(join(dist, 'site'), { recursive: true });
for (const asset of readdirSync(join(site, 'assets'))) {
  copyFileSync(join(site, 'assets', asset), join(dist, 'site', asset));
}
copyFileSync(join(site, 'vercel.json'), join(dist, 'vercel.json'));
// Mêmes règles pour l'essai sur le PC (npx serve dist)
writeFileSync(
  join(dist, 'serve.json'),
  JSON.stringify({
    cleanUrls: true,
    rewrites: [{ source: '/app/**', destination: '/app/index.html' }],
  })
);

// Les fichiers à télécharger que le site sert lui-même (liens « /telecharger/… » de config.json),
// s'ils ont été fabriqués (dossier downloads/, hors Git). Les autres fichiers de downloads/ ne
// sont PAS copiés : l'APK (plus de 100 Mo) est hébergé sur GitHub, car Vercel refuse un envoi
// de plus de 100 Mo au total.
const downloads = join(root, 'downloads');
rmSync(join(dist, 'telecharger'), { recursive: true, force: true });
mkdirSync(join(dist, 'telecharger'), { recursive: true });
for (const href of Object.values(config.downloads)) {
  if (!href.startsWith('/telecharger/')) continue;
  const file = decodeURIComponent(href.slice('/telecharger/'.length));
  if (existsSync(join(downloads, file))) {
    copyFileSync(join(downloads, file), join(dist, 'telecharger', file));
  }
}
console.log('Site vitrine assemblé dans dist/');
