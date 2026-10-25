// Configuration d'ESLint : l'outil qui repère les erreurs dans le code.
// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const eslintPluginPrettierRecommended = require('eslint-plugin-prettier/recommended');

module.exports = defineConfig([
  // Les règles conseillées par Expo
  expoConfig,
  // Signale aussi le code qui n'est pas mis en forme comme le veut Prettier
  eslintPluginPrettierRecommended,
  {
    ignores: ['dist/*', 'public/@powersync/*'],
  },
]);
