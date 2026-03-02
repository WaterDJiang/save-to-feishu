import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, cpSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'post-build-assets',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        const srcDir = resolve(__dirname, 'dist/src');

        if (existsSync(srcDir)) {
          if (existsSync(resolve(srcDir, 'popup'))) {
            cpSync(resolve(srcDir, 'popup'), resolve(distDir, 'popup'), { recursive: true });
          }
          if (existsSync(resolve(srcDir, 'options'))) {
            cpSync(resolve(srcDir, 'options'), resolve(distDir, 'options'), { recursive: true });
          }
        }

        copyFileSync(
          resolve(__dirname, 'public/manifest.json'),
          resolve(distDir, 'manifest.json')
        );

        const iconsDir = resolve(distDir, 'icons');
        if (!existsSync(iconsDir)) {
          mkdirSync(iconsDir);
        }
      },
    },
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
      },
      output: {
        entryFileNames: '[name]/index.js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
  publicDir: 'public',
});
