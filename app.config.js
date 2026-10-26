// Réglages qui changent selon la « variante » de l'application, choisie par EAS (voir eas.json) :
//   development → l'appli de test, qui charge son code depuis le PC
//   preview     → la version autonome d'essai
//   (aucune)    → la vraie application
// Chaque variante a son propre nom et son propre identifiant :
// elles peuvent être installées côte à côte sur le même téléphone.
// Les réglages communs restent dans app.json.
const VARIANTS = {
  development: { suffix: '.dev', name: 'Boutik (dev)' },
  preview: { suffix: '.preview', name: 'Boutik (essai)' },
};

// Adresse de l'appli web : sur le site, elle vit sous /app (la racine est le site vitrine).
// Dans la version ordinateur (Tauri, BOUTIK_DESKTOP=1), elle est à la racine.
const WEB_BASE = process.env.BOUTIK_DESKTOP ? '' : '/app';

module.exports = ({ config: base }) => {
  const config = {
    ...base,
    experiments: { ...base.experiments, baseUrl: WEB_BASE },
    extra: { ...base.extra, webBase: WEB_BASE },
  };
  const variant = VARIANTS[process.env.APP_VARIANT];
  if (!variant) {
    return config;
  }
  return {
    ...config,
    name: variant.name,
    android: { ...config.android, package: config.android.package + variant.suffix },
    ios: { ...config.ios, bundleIdentifier: config.ios.bundleIdentifier + variant.suffix },
  };
};
