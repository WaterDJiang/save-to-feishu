import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';
import { copyFileSync, mkdirSync, existsSync, cpSync, rmSync } from 'fs';

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'post-build-assets',
      closeBundle() {
        const distDir = resolve(__dirname, 'dist');
        const srcDir = resolve(__dirname, 'dist/src');

        if (existsSync(srcDir)) {
          if (existsSync(resolve(srcDir, 'options'))) {
            cpSync(resolve(srcDir, 'options'), resolve(distDir, 'options'), { recursive: true });
          }
          if (existsSync(resolve(srcDir, 'sidepanel'))) {
            cpSync(resolve(srcDir, 'sidepanel'), resolve(distDir, 'sidepanel'), { recursive: true });
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

        ['src', 'popup', 'content-script'].forEach((name) => {
          const target = resolve(distDir, name);
          if (existsSync(target)) {
            rmSync(target, { recursive: true, force: true });
          }
        });
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
        options: resolve(__dirname, 'src/options/index.html'),
        sidepanel: resolve(__dirname, 'src/sidepanel/index.html'),
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
