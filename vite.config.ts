import preact from '@preact/preset-vite';
import { defineConfig, type Plugin } from 'vite';

// A unique id per build. The app carries it, and version.json publishes the deployed one,
// so an open page can tell when a newer version has been released (src/lib/version.ts).
const version = Date.now().toString(36);

const versionFile: Plugin = {
  name: 'version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ version }) });
  },
};

export default defineConfig({
  plugins: [preact(), versionFile],
  define: { __APP_VERSION__: JSON.stringify(version) },
  // heic-to (~3 MB of WebAssembly) is only downloaded when someone uploads a HEIC file
  // from a browser that can't decode it natively.
  build: { target: 'es2020', chunkSizeWarningLimit: 3500 },
});
