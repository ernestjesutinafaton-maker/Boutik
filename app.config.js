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

module.exports = ({ config }) => {
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
