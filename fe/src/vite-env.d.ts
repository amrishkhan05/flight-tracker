interface ViteTypeOptions {
  strictImportMetaEnv: unknown;
}

interface ImportMetaEnv {
  readonly VITE_WS_BASE_URL?: string;
  readonly VITE_AUTO_RECONNECT?: string;
  readonly VITE_OBSERVED_TRAILS?: string;
  readonly VITE_TRAIL_MAX_POINTS?: string;
}
