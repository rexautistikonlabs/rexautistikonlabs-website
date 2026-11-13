/// <reference types="astro/client" />

interface ImportMetaEnv {
  readonly PUBLIC_GA4_MEASUREMENT_ID?: string;
  readonly PUBLIC_TURNSTILE_SITE_KEY?: string;
  readonly PUBLIC_FORM_WORKER_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
