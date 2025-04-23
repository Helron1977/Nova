import { defineConfig, type UserConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { InlineConfig } from 'vitest'
import path from 'path'
/// <reference types="vitest/config" />

// Fusionner les types pour la configuration
interface VitestConfigExport extends UserConfig {
  test: InlineConfig
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5000,
  },
  // optimizeDeps: {
  //   include: ['loglevel'],
  // },
  // Ajouter la configuration pour Vitest
  test: {
    globals: true, // Pour ne pas avoir à importer describe, it, etc. partout
    environment: 'jsdom', // Utiliser jsdom pour simuler un environnement navigateur (inclut localStorage)
    setupFiles: './src/setupTests.ts', // Fichier optionnel pour setup global des tests
  },
} as VitestConfigExport)