/// <reference types="vite/client" />

/**
 * Vite's ambient types give `import.meta.env` its shape (DEV, PROD, MODE).
 * Without this reference TypeScript cannot type-check the dev/prod guards in
 * services/api.ts.
 */
interface ImportMetaEnv {
  readonly DEV: boolean;
  readonly PROD: boolean;
  readonly MODE: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
