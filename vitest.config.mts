import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Configuration des tests automatiques (Vitest).
// On y teste la logique métier « pure » : les calculs, sans aucun écran.
export default defineConfig({
  resolve: {
    alias: {
      // Même raccourci que dans tsconfig.json : « @/ » veut dire « dossier src/ »
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
