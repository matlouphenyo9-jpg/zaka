// Shrinks a photo on the phone before it is sent: at most 1280 px on the long side, JPEG, aiming under 300 KB, so
// a scan costs little data. PDFs are sent as they are (the server checks size, type and pages again).
import { MAX_PDF_BYTES } from './slipRules';

export type Prepared = { blob: Blob; preview: string | null; kind: 'image' | 'pdf' } | { error: 'too_big' | 'unsupported_type' };

export async function prepareSlip(file: Blob, allowPdf: boolean): Promise<Prepared> {
  const head = new Uint8Array(await file.slice(0, 5).arrayBuffer());
  const isPdf = String.fromCharCode(...head) === '%PDF-';
  if (isPdf) {
    if (!allowPdf) return { error: 'unsupported_type' };
    if (file.size > MAX_PDF_BYTES) return { error: 'too_big' };
    return { blob: file, preview: null, kind: 'pdf' };
  }
  if (file.size > 25_000_000) return { error: 'too_big' };
  let bmp: ImageBitmap;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return { error: 'unsupported_type' }; // not an image this phone can open (or not an image at all)
  }
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bmp.width * scale));
  canvas.height = Math.max(1, Math.round(bmp.height * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  let blob: Blob | null = null;
  for (const q of [0.82, 0.7, 0.58, 0.46]) {
    blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', q));
    if (blob && blob.size <= 300_000) break;
  }
  if (!blob) return { error: 'unsupported_type' };
  if (blob.size > 1_500_000) return { error: 'too_big' };
  return { blob, preview: URL.createObjectURL(blob), kind: 'image' };
}
