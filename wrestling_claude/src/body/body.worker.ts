import { generateBody } from './generate';
import type { BodyParams } from './anatomy';
import type { MeshQuality } from './generate';

/** Builds body geometry off the main thread; buffers are transferred back. */
self.onmessage = (e: MessageEvent<{ id: number; params: BodyParams; quality: MeshQuality; withHeadgear: boolean }>) => {
  const { id, params, quality, withHeadgear } = e.data;
  const geo = generateBody(params, quality, withHeadgear);
  const transfer: ArrayBuffer[] = [];
  for (const m of [geo.body, geo.head, ...geo.hands, geo.headgear]) {
    if (!m) continue;
    transfer.push(
      m.positions.buffer as ArrayBuffer,
      m.normals.buffer as ArrayBuffer,
      m.indices.buffer as ArrayBuffer,
      m.skinIndex.buffer as ArrayBuffer,
      m.skinWeight.buffer as ArrayBuffer,
      m.part.buffer as ArrayBuffer,
    );
  }
  (self as unknown as Worker).postMessage({ id, geo }, transfer);
};
