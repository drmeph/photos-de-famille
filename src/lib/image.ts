// Everything that happens to a photo in the browser before it is uploaded:
// HEIC decoding, EXIF date, resizing to display/thumbnail JPEGs, content hash.
// Doing this client-side keeps the server trivial (no image processing to pay for).

import { DISPLAY_MAX, THUMB_MAX, type LocalDateTime } from '../../shared/types';
import { parseExifDate, toLocalDateTime } from './dates';

export interface PreparedPhoto {
  id: string; // first 20 hex chars of SHA-256(original) — identical files get the same id
  original: File;
  originalType: string;
  display: Blob;
  thumb: Blob;
  width: number; // of `display`
  height: number;
  takenAt: LocalDateTime;
  dateSource: 'exif' | 'upload';
}

export function isHeic(file: File): boolean {
  return /^image\/hei[cf]/.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

/** The Content-Type to store for the original. Some browsers report HEIC files with an empty type. */
function originalType(file: File): string {
  if (file.type) return file.type.toLowerCase();
  if (isHeic(file)) return 'image/heic';
  if (/\.png$/i.test(file.name)) return 'image/png';
  return 'image/jpeg';
}

export async function preparePhoto(file: File): Promise<PreparedPhoto> {
  const [id, exifDate, source] = await Promise.all([hashFile(file), readExifDate(file), decode(file)]);
  const display = await resize(source, DISPLAY_MAX);
  const thumb = await resize(display.canvas, THUMB_MAX);
  return {
    id,
    original: file,
    originalType: originalType(file),
    display: await toJpeg(display.canvas, 0.85),
    thumb: await toJpeg(thumb.canvas, 0.8),
    width: display.canvas.width,
    height: display.canvas.height,
    takenAt: exifDate ?? toLocalDateTime(new Date()),
    dateSource: exifDate ? 'exif' : 'upload',
  };
}

async function hashFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return Array.from(new Uint8Array(digest).slice(0, 10), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function readExifDate(file: File): Promise<LocalDateTime | null> {
  try {
    // The "lite" build reads JPEG and HEIC EXIF and is a third of the size of the full one.
    const { default: exifr } = await import('exifr/dist/lite.esm.mjs');
    const tags = await exifr.parse(file, {
      // Only the EXIF block (where the dates live). Note: `pick` is broken in the lite build.
      exif: true,
      gps: false,
      interop: false,
      reviveValues: false, // keep raw strings: EXIF dates have no timezone, don't let Date() shift them
    });
    return parseExifDate(tags?.DateTimeOriginal) ?? parseExifDate(tags?.CreateDate) ?? parseExifDate(tags?.DateTimeDigitized);
  } catch {
    return null;
  }
}

/** Decode with the browser (which applies EXIF rotation); fall back to a WASM decoder for HEIC. */
async function decode(file: File): Promise<HTMLImageElement> {
  try {
    return await loadImage(file);
  } catch (err) {
    if (!isHeic(file)) throw err;
    // Safari decodes HEIC natively; Chrome/Firefox need libheif (≈3 MB, only loaded when needed).
    const { heicTo } = await import('heic-to/csp');
    return loadImage(await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 }));
  }
}

async function loadImage(blob: Blob): Promise<HTMLImageElement> {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.naturalWidth) throw new Error('Empty image');
    return img;
  } finally {
    // The decoded pixels stay available to drawImage after revoking.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
}

function sizeOf(src: HTMLImageElement | HTMLCanvasElement) {
  return src instanceof HTMLImageElement ? { w: src.naturalWidth, h: src.naturalHeight } : { w: src.width, h: src.height };
}

/** Draw straight into a canvas of the *target* size: iOS refuses canvases over ~16 megapixels,
 *  and recent iPhones take 24-48 MP photos, so we never create a full-size canvas. */
async function resize(src: HTMLImageElement | HTMLCanvasElement, maxEdge: number) {
  const { w, h } = sizeOf(src);
  const scale = Math.min(1, maxEdge / Math.max(w, h));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(w * scale));
  canvas.height = Math.max(1, Math.round(h * scale));
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#fff'; // transparent PNGs would otherwise turn black in JPEG
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
  return { canvas };
}

function toJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('JPEG encoding failed'))), 'image/jpeg', quality),
  );
}
