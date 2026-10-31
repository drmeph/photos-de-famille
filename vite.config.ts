import preact from '@preact/preset-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [preact()],
  // heic-to (~3 MB of WebAssembly) is only downloaded when someone uploads a HEIC file
  // from a browser that can't decode it natively.
  build: { target: 'es2020', chunkSizeWarningLimit: 3500 },
});
