// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { fileURLToPath, URL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    outDir: '.', // Output directly to root directory
    emptyOutDir: false, // Don't delete everything, just overwrite what we build
    rollupOptions: {
      input: {
        // Build JavaScript entry points only
        'background': resolve(__dirname, 'src/background.js'),
        'offscreen': resolve(__dirname, 'src/offscreen.js'), 
        'transformers-worker': resolve(__dirname, 'src/transformers-worker.js'),
        'webllm-worker': resolve(__dirname, 'src/webllm-worker.js'),
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: '[name].[ext]',
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // Copy the transformers.js library files (use non-minified for Web Worker compatibility)
        {
          src: 'node_modules/@xenova/transformers/dist/transformers.js',
          dest: '.'
        },
        // Copy the WASM files for ONNX runtime
        {
          src: 'node_modules/@xenova/transformers/dist/*.wasm',
          dest: '.'
        },
        // Copy the updated manifest.json to replace the old one
        {
          src: 'src/manifest.json',
          dest: '.'
        },
        // Copy the offscreen HTML file
        {
          src: 'src/offscreen.html',
          dest: '.'
        }
      ]
    })
  ]
});