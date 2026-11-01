declare module 'exifr/dist/lite.esm.mjs' {
  export { default } from 'exifr';
}

/** Build id injected by vite.config.ts; compared with /version.json to detect new releases. */
declare const __APP_VERSION__: string;
