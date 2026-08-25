import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Only VITE_-prefixed vars are exposed to client code by default — the same
  // rule applies here to loadEnv, which is what we want since this value also
  // needs to be readable at runtime via import.meta.env.BASE_URL (see below).
  const env = loadEnv(mode, process.cwd(), 'VITE_');

  // Lets the app be hosted under a subpath (e.g. a personal server directory
  // like /~jlcf/) without touching source. Defaults to root, which is what
  // the production domain (served from /) needs.
  const rawBase = env.VITE_BASE_PATH || '/';
  const base = rawBase.endsWith('/') ? rawBase : `${rawBase}/`;

  return {
    base,
    plugins: [react(), tailwindcss()],
  };
});
