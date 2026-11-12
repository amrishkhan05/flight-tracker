import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateFrontendEnv } from './src/lib/env';

export default defineConfig(({ mode }) => {
  // Fail the build here, before bundling, so a bad flag names its variable.
  validateFrontendEnv(loadEnv(mode, '.', 'VITE_'));
  return {
    plugins: [react()],
  };
});
