import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    // Target Chrome extension environment
    target: ['chrome87'],
    // Disable minification to avoid eval issues with onnxruntime-web
    minify: false,
    // Build as library in IIFE format for Chrome extension worker
    lib: {
      entry: resolve(__dirname, 'src/transformers-worker.js'),
      name: 'TransformersWorker',
      formats: ['iife'],
      fileName: () => 'transformers-worker.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true, // Bundle everything into single file
        dir: '.' // Output directly to root directory for Chrome extension
      }
    }
  },
  
  // Optimization settings
  optimizeDeps: {
    include: ['@xenova/transformers']
  },
  
  // Define globals for Chrome extension compatibility
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
    'import.meta.env': '{}',
    'import.meta.hot': 'undefined',
    'import.meta.url': '"worker-script"',
    global: 'globalThis'
  }
});