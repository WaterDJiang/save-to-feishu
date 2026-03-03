import { defineConfig } from 'vite';
import { resolve } from 'path';
import { copyFileSync, existsSync, mkdirSync } from 'fs';

/**
 * Content Script 专用构建配置
 * 输出 IIFE 格式，内联所有依赖
 */
export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  publicDir: false,
  build: {
    outDir: 'dist/content-script',
    emptyOutDir: true,
    lib: {
      entry: resolve(__dirname, 'src/content-script/index.ts'),
      name: 'SaveToFeishuContentScript',
      formats: ['iife'],
      fileName: () => 'index.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
      },
    },
  },
  plugins: [
    {
      name: 'copy-css',
      closeBundle() {
        // 复制 CSS 文件到 content-script 目录
        const cssSource = resolve(__dirname, 'public/content-script/floating-panel.css');
        const cssDest = resolve(__dirname, 'dist/content-script/floating-panel.css');
        
        if (existsSync(cssSource)) {
          copyFileSync(cssSource, cssDest);
          console.log('[Content Script] CSS 文件已复制');
        }
      },
    },
  ],
});
