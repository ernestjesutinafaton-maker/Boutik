// Réglages du « service worker » de la version web installable (PWA), fabriqué par Workbox.
// Il garde dans le navigateur tous les fichiers de l'appli : elle s'ouvre ensuite sans internet.
// Utilisé par « npm run build:web » (après « expo export »).
module.exports = {
  globDirectory: 'dist/',
  // Tous les fichiers de l'appli, dont le moteur SQLite de PowerSync (.wasm)
  globPatterns: ['**/*.{js,mjs,html,css,ttf,otf,woff,woff2,ico,json,png,jpg,svg,wasm}'],
  swDest: 'dist/sw.js',
  // Appli « une seule page » : toute adresse ouvre index.html (même hors ligne)
  navigateFallback: '/index.html',
  navigateFallbackDenylist: [/^\/sw\.js$/, /\.apk$/],
  // Le moteur SQLite pèse plusieurs Mo
  maximumFileSizeToCacheInBytes: 30 * 1024 * 1024,
  ignoreURLParametersMatching: [/^utm_/, /^fbclid$/],
  // Une nouvelle version attend l'accord de la personne (bandeau « Nouvelle version »)
  skipWaiting: false,
  clientsClaim: true,
  cleanupOutdatedCaches: true,
  runtimeCaching: [
    {
      // Les photos des produits (stockage Supabase) : gardées pour s'afficher hors ligne
      urlPattern: /\/storage\/v1\/object\/public\/product-photos\//,
      handler: 'CacheFirst',
      options: {
        cacheName: 'product-photos',
        expiration: { maxEntries: 1000, maxAgeSeconds: 60 * 60 * 24 * 90 },
      },
    },
  ],
};
