import { defineConfig } from 'vite';
import { resolve } from 'path';

/**
 * Background Script 专用构建配置
 * 输出 IIFE 格式，内联所有依赖
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist/background',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      name: 'SaveToFeishuBackground',
      formats: ['iife'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
});
