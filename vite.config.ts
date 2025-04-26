import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
// Il faut aussi importer les types pour la config Vitest
import type { UserConfig } from 'vite'
import type { InlineConfig } from 'vitest'

// On peut définir une interface pour combiner les deux configurations
interface VitestConfigExport extends UserConfig {
  test: InlineConfig
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Forcer une seule instance pour ces paquets CodeMirror
    dedupe: [
      '@codemirror/state',
      '@codemirror/view',
      '@codemirror/commands',
      '@codemirror/language',
      // Ajoutez d'autres paquets @codemirror/* que vous utilisez directement ici
    ],
  },
  // On retire l'exclusion ici
  // optimizeDeps: {
  //   exclude: ['@codemirror/state'],
  // },
  build: {
    outDir: '../electron/dist_vite', // Spécifier le répertoire de sortie pour Electron
    emptyOutDir: true, // Vider le répertoire avant de construire
  },
  base: './', // Important pour Electron pour résoudre correctement les chemins
  // Ajouter la configuration pour Vitest
  test: {
    globals: true, // <-- C'est la ligne clé !
    environment: 'jsdom', // Important pour les tests React et DOM
    // setupFiles: './src/setupTests.ts', // Décommentez si vous avez un fichier de setup
  },
} as VitestConfigExport) // Important: caster la config