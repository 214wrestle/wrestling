import { runStyle } from './shared';
import type { StyleBuild } from './shared';

/**
 * Router for the art-direction mockups: ?lab=style&v=<folder>. Each style lives
 * in its own folder with an index.ts whose default export is a StyleBuild.
 */
const styles = import.meta.glob<{ default: StyleBuild }>('./*/index.ts');

export async function startStyle(host: HTMLElement): Promise<void> {
  const v = new URLSearchParams(location.search).get('v') ?? 'current';
  const load = styles[`./${v}/index.ts`];
  if (!load) {
    const names = Object.keys(styles).map((k) => k.split('/')[1]);
    host.textContent = `Unknown style "${v}". Available: ${names.join(', ')}`;
    host.style.cssText = 'color:#fff;font:16px system-ui;padding:20px;background:#111';
    return;
  }
  const mod = await load();
  await runStyle(host, mod.default);
}
