import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default ({ mode }: { mode: string }) => {
  // Load env vars so we can access VITE_BALDONTLIE_KEY during dev
  const env = loadEnv(mode, process.cwd(), '')
  const BAL_KEY = env.VITE_BALDONTLIE_KEY

  return defineConfig({
    plugins: [react()],
    server: {
      proxy: {
        // Proxy requests starting with /api/balldontlie to the external API.
        // The proxy will inject the Authorization header (server-side) so
        // the browser doesn't need to send custom headers and trigger CORS.
        '/api/balldontlie': {
          target: 'https://api.balldontlie.io',
          changeOrigin: true,
          secure: true,
          rewrite: (path) => path.replace(/^\/api\/balldontlie/, ''),
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              if (BAL_KEY) {
                proxyReq.setHeader('Authorization', `Bearer ${BAL_KEY}`)
              }
            })
          },
        },
        // During local development proxy Supabase requests to avoid CORS.
        // Client code will use `/supabase` as the base URL in DEV.
        '/supabase': (() => {
          const supabaseTarget = env.VITE_SUPABASE_URL || '';
          if (!supabaseTarget) return null;
          return {
            target: supabaseTarget,
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/supabase/, ''),
          };
        })(),
      },
    },
  })
}
