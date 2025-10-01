import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { nodePolyfills } from 'vite-plugin-node-polyfills';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 5173,
        host: '0.0.0.0',
        proxy: {
          '/api': {
            target: 'http://localhost:3000',
            changeOrigin: true,
          },
        },
      },
      plugins: [
        react(), 
        nodePolyfills({
          // Whether to polyfill specific globals.
          globals: {
            Buffer: true,
            global: true,
            process: true,
          },
          // Whether to polyfill `node:` protocol imports.
          protocolImports: true,
        })
      ],
      define: {
        global: 'globalThis',
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
          buffer: 'buffer/',
        }
      },
      optimizeDeps: {
        include: ['jszip'],
        esbuildOptions: {
          // Node.js global to browser globalThis
          define: {
            global: 'globalThis'
          },
        }
      }
    };
});
