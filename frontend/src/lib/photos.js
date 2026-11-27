// frontend/src/lib/photos.js — shrink photos in the browser before upload, and their addresses
import { API_BASE, tokenStore } from './api';

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

// Public address of a file, with an optional download name
export const downloadUrl = (id, name) => `${API_BASE}/public/photo/${id}?download=${encodeURIComponent(name || 'sakanly')}`;
// Full web address (for sharing outside the CRM)
export const publicUrl = id => new URL(photoUrl(id), window.location.href).toString();

export const isVideoFile = f => f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm)$/i.test(f.name);
export const VIDEO_MAX = 80 * 1024 * 1024;

// A poster frame (about 1 second in), plus size and length, read in the browser
export function videoPoster(file) {
  return new Promise(resolve => {
    const v = document.createElement('video');
    const url = URL.createObjectURL(file);
    let done = false;
    const finish = out => { if (done) return; done = true; URL.revokeObjectURL(url); resolve(out); };
    v.preload = 'metadata'; v.muted = true; v.playsInline = true; v.src = url;
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 2) / 2); };
    v.onseeked = () => {
      try {
        const out = draw(v, 480, 0.72);
        finish({ thumb: out.data, width: v.videoWidth, height: v.videoHeight, duration: Math.round(v.duration) || null });
      } catch { finish({ width: v.videoWidth, height: v.videoHeight, duration: Math.round(v.duration) || null }); }
    };
    v.onerror = () => finish({});
    setTimeout(() => finish({}), 8000);
  });
}

// Send the video file itself, reporting progress 0…1
export function uploadVideoFile(id, file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('PUT', `${API_BASE}/photos/${id}/file`);
    const token = tokenStore.get();
    if (token) x.setRequestHeader('Authorization', `Bearer ${token}`);
    x.setRequestHeader('Content-Type', file.type || 'video/mp4');
    x.upload.onprogress = e => e.lengthComputable && onProgress?.(e.loaded / e.total);
    x.onload = () => {
      let data = {}; try { data = JSON.parse(x.responseText); } catch { /* empty */ }
      x.status < 300 ? resolve(data) : reject(new Error(data.error || `Upload failed (${x.status})`));
    };
    x.onerror = () => reject(new Error('Cannot reach the server. Check your internet connection.'));
    x.send(file);
  });
}

export const duration = s => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : '');
