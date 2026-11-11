type Runtime = import("@astrojs/cloudflare").Runtime<Env>;

declare namespace App {
  interface Locals extends Runtime {}
}

interface ImportMetaEnv {
  readonly PUBLIC_GIT_COMMIT_DATE?: string;
  readonly PUBLIC_GIT_COMMIT_HASH?: string;
  readonly PUBLIC_GIT_COMMIT_SHORT_HASH?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
