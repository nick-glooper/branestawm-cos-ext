// vite.config.js
import { resolve } from 'path';
import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { fileURLToPath, URL } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // Define all your script entry points
        background: resolve(__dirname, 'src/background.js'),
        offscreen: resolve(__dirname, 'src/offscreen.html'),
        'transformers-worker': resolve(__dirname, 'src/transformers-worker.js'),
      },
      output: {
        entryFileNames: '[name].js', // Keep original filenames
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name].[ext]',
      }
    }
  },
  plugins: [
    viteStaticCopy({
      targets: [
        // Copy the transformers.js library files
        {
          src: 'node_modules/@xenova/transformers/dist/transformers.min.js',
          dest: '.'
        },
        // Copy the WASM files for ONNX runtime
        {
          src: 'node_modules/@xenova/transformers/dist/*.wasm',
          dest: '.'
        },
        // Copy the manifest.json
        {
          src: 'src/manifest.json',
          dest: '.'
        },
        // Copy other static assets
        {
          src: 'icons/*',
          dest: 'icons'
        },
        {
          src: 'options.html',
          dest: '.'
        },
        {
          src: 'options.js',
          dest: '.'
        },
        {
          src: 'content-google.js',
          dest: '.'
        },
        {
          src: 'content-perplexity.js',
          dest: '.'
        }
      ]
    })
  ]
});