/// <reference types="vitest" />
import { defineConfig, loadEnv, type Plugin, type ViteDevServer, type PreviewServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

/** Serves /api/gemini locally (same handler as the Vercel function). Key comes from .env.local, never the bundle. */
function geminiApi(env: Record<string, string>): Plugin {
  const mount = (server: ViteDevServer | PreviewServer, load: () => Promise<typeof import('./server/gemini')>) => {
    server.middlewares.use('/api/gemini', async (req: IncomingMessage, res: ServerResponse) => {
      const chunks: Buffer[] = [];
      for await (const c of req) chunks.push(c as Buffer);
      const { handleGemini } = await load();
      const out = await handleGemini(req.method ?? 'GET', Buffer.concat(chunks).toString('utf8'), {
        OPENROUTER_API_KEY: env.OPENROUTER_API_KEY,
        OPENROUTER_MODEL: env.OPENROUTER_MODEL,
      });
      res.statusCode = out.status;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(out.json));
    });
  };
  return {
    name: 'gemini-api',
    configureServer(server) {
      mount(server, () => server.ssrLoadModule('/server/gemini.ts') as Promise<typeof import('./server/gemini')>);
    },
    configurePreviewServer(server) {
      mount(server, () => import('./server/gemini'));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), geminiApi(env)],
    resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
    build: {
      chunkSizeWarningLimit: 1200,
      rollupOptions: {
        output: {
          manualChunks: {
            react: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts'],
            map: ['leaflet', 'react-leaflet'],
            xlsx: ['xlsx'],
          },
        },
      },
    },
    test: { environment: 'node' },
  };
});
