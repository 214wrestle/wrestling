import { fileURLToPath } from 'node:url';
import { mkdirSync, writeFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';

/** Dev server only: the face-fit lab saves a fit as src/body/realistic/faces/<slug>.fit.json. */
function saveFaceFits(): Plugin {
  return {
    name: 'save-face-fits',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use('/__facefit/save', (req, res) => {
        const slug = new URL(req.url ?? '', 'http://x').searchParams.get('slug') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9-]{2,60}$/.test(slug)) { res.statusCode = 400; res.end('bad request'); return; }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 400000) req.destroy(); });
        req.on('end', () => {
          try {
            JSON.parse(body);
            writeFileSync(fileURLToPath(new URL(`./src/body/realistic/faces/${slug}.fit.json`, import.meta.url)), body + '\n');
            res.end('saved');
          } catch { res.statusCode = 400; res.end('not json'); }
        });
      });
      // A batch of fits at once ([{slug, fit}]), so saving doesn't reload the page between fits.
      server.middlewares.use('/__facefit/saveMany', (req, res) => {
        if (req.method !== 'POST') { res.statusCode = 400; res.end('bad request'); return; }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 20000000) req.destroy(); });
        req.on('end', () => {
          try {
            const items = JSON.parse(body) as { slug: string; fit: unknown }[];
            for (const { slug, fit } of items) {
              if (!/^[a-z0-9-]{2,60}$/.test(slug)) continue;
              writeFileSync(fileURLToPath(new URL(`./src/body/realistic/faces/${slug}.fit.json`, import.meta.url)), JSON.stringify(fit) + '\n');
            }
            res.end(`saved ${items.length}`);
          } catch { res.statusCode = 400; res.end('not json'); }
        });
      });
      // Lab screenshots straight from the canvas (works while the window isn't painting).
      server.middlewares.use('/__shot/save', (req, res) => {
        const name = new URL(req.url ?? '', 'http://x').searchParams.get('name') ?? '';
        if (req.method !== 'POST' || !/^[a-z0-9-]{2,80}$/.test(name)) { res.statusCode = 400; res.end('bad request'); return; }
        let body = '';
        req.on('data', (c) => { body += c; if (body.length > 12000000) req.destroy(); });
        req.on('end', () => {
          const m = /^data:image\/(jpeg|png);base64,(.+)$/.exec(body);
          if (!m) { res.statusCode = 400; res.end('not an image'); return; }
          const dir = fileURLToPath(new URL('./outputs/nov08-likeness/shots/', import.meta.url));
          mkdirSync(dir, { recursive: true });
          writeFileSync(`${dir}${name}.${m[1] === 'png' ? 'png' : 'jpg'}`, Buffer.from(m[2], 'base64'));
          res.end('saved');
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), saveFaceFits()],
  server: {
    port: 5190,
    host: true,
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      // The game, plus the character style mockups as a second page.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        mockups: fileURLToPath(new URL('./mockups.html', import.meta.url)),
      },
    },
  },
});
