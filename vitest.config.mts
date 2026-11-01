import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Configuration des tests automatiques (Vitest).
// On y teste la logique métier « pure » (les calculs, sans aucun écran)
// la sécurité de la base de données (supabase/tests) et les opérations complètes
// sur une vraie base locale SQLite (tests/).
export default defineConfig({
  resolve: {
    alias: {
      // Même raccourci que dans tsconfig.json : « @/ » veut dire « dossier src/ »
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'supabase/tests/**/*.test.ts', 'tests/**/*.test.ts'],
    // Chaque test de la base (supabase/tests) recrée une base PostgreSQL en mémoire et rejoue
    // toutes les migrations : quand tous les tests tournent ensemble, l'ordinateur est chargé.
    // On leur laisse donc plus de temps que les 5 et 10 secondes par défaut.
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
