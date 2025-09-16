import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        // Main entry points
        main: resolve(__dirname, 'index.html'),
        options: resolve(__dirname, 'options.html'),
        offscreen: resolve(__dirname, 'offscreen.html'),
        
        // Worker entry point - Vite will handle ES Module bundling automatically
        'transformers-worker': resolve(__dirname, 'src/transformers-worker.js'),
        
        // Service worker and other scripts
        background: resolve(__dirname, 'background.js'),
      },
      output: {
        // Ensure workers are generated in the root for Chrome extension compatibility
        entryFileNames: (chunkInfo) => {
          return chunkInfo.name === 'transformers-worker' ? 'transformers-worker.js' : '[name].js';
        }
      }
    },
    // Ensure proper chunk splitting for workers
    target: ['es2020', 'edge88', 'firefox78', 'chrome87', 'safari14']
  },
  
  // Worker-specific configuration
  worker: {
    format: 'es', // Use ES modules for workers
    plugins: []
  },
  
  // Optimization settings
  optimizeDeps: {
    include: ['@xenova/transformers']
  },
  
  // Define globals for better tree-shaking
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production')
  }
});