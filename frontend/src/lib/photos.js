// frontend/src/lib/photos.js — shrink photos in the browser before upload, and their addresses
import { API_BASE } from './api';

export const photoUrl = (id, thumb) => `${API_BASE}/public/photo/${id}${thumb ? '?size=thumb' : ''}`;

async function load(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch { /* fall back */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('This file is not a photo the browser can read'));
    img.src = URL.createObjectURL(file);
  });
}

function draw(src, max, quality) {
  const w0 = src.width, h0 = src.height;
  const scale = Math.min(1, max / Math.max(w0, h0));
  const w = Math.round(w0 * scale), h = Math.round(h0 * scale);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(src, 0, 0, w, h);
  return { data: c.toDataURL('image/jpeg', quality).split(',')[1], width: w, height: h };
}

// → { data, thumb (base64 JPEG), width, height }
export async function compressPhoto(file) {
  const src = await load(file);
  const full = draw(src, 1600, 0.82);
  const thumb = draw(src, 480, 0.72);
  return { data: full.data, thumb: thumb.data, width: full.width, height: full.height };
}
