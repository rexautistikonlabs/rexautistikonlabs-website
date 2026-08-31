/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GA4_MEASUREMENT_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
