// Réglages de Metro, l'outil qui assemble le code de l'application.
// Adapté de la démo officielle PowerSync pour React Native + web :
// https://docs.powersync.com/client-sdk-references/react-native-and-expo/react-native-web-support
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// La version navigateur de PowerSync se trouve grâce à cette « condition d'export »
config.resolver.unstable_enablePackageExports = true;
config.resolver.unstable_conditionsByPlatform.web.push('react-native-web');

// Chaque plateforme ne charge que SA version de PowerSync (sécurité en plus des fichiers
// database.ts / database.native.ts, qui font déjà ce choix)
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === 'web' && moduleName === '@powersync/react-native') {
    return { type: 'empty' };
  }
  if (platform !== 'web' && moduleName === '@powersync/web') {
    return { type: 'empty' };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
