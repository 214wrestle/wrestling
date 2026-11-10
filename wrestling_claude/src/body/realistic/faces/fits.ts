import type { FaceFitData } from '../faceFit';

/** Photo fits per wrestler, one `<slug>.fit.json` each, saved by `?lab=facefit&...&save=1`; don't hand-edit. */
const files = import.meta.glob('./*.fit.json', { eager: true, import: 'default' }) as Record<string, FaceFitData & { name: string }>;
export const FACE_FITS: Record<string, FaceFitData> = Object.fromEntries(Object.values(files).map((f) => [f.name, f]));
