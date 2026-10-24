/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Zaka — every rand, with a plan',
        short_name: 'Zaka',
        description: 'A cash-first money plan for uneven income: safe to spend, tight days ahead, scam and loan checks.',
        theme_color: '#006B64',
        background_color: '#FAF8F2',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        scope: '/',
        lang: 'en-ZA',
        categories: ['finance'],
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/index.html',
        // Never cache Supabase API/auth responses in the service worker; the app keeps its own encrypted-at-rest-by-OS IndexedDB cache.
        navigateFallbackDenylist: [/^\/functions\//, /^\/auth\//, /^\/rest\//],
      },
    }),
  ],
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
