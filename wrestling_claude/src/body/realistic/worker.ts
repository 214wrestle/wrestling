import { generateBody } from './generate';
import type { BodyParams } from './anatomy';

self.onmessage = (event: MessageEvent<{id: number; params: BodyParams; quality: 'high' | 'low'; sides: number}>) => {
  const {id, params, quality, sides} = event.data;
  const geo = generateBody(params, quality, true, sides);
  // AO and patch arrays can share buffers. Transfer each buffer only once.
  const buffers = new Set<ArrayBuffer>();
  for (const mesh of [geo.body, geo.head, geo.face, ...geo.hands, geo.headgear, geo.scalp]) {
    if (!mesh) continue;
    for (const value of Object.values(mesh)) if (ArrayBuffer.isView(value)) buffers.add(value.buffer as ArrayBuffer);
  }
  if (geo.scalpLen) buffers.add(geo.scalpLen.buffer as ArrayBuffer);
  (self as unknown as Worker).postMessage({id, geo}, [...buffers]);
};
