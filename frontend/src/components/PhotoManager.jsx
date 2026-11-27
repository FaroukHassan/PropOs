// frontend/src/components/PhotoManager.jsx — photos and videos of one apartment and its rooms:
// upload, cover, which room, delete, download, copy the link
import { useState } from 'react';
import { t } from '../lib/i18n';
import { useApi } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { compressPhoto, photoUrl, downloadUrl, publicUrl, isVideoFile, videoPoster, uploadVideoFile, VIDEO_MAX, duration } from '../lib/photos';
import { Modal, useToast } from './ui';

export default function PhotoManager({ unit, spaces = [], onChanged, focusSpace }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: media, refetch } = useApi(`/photos?unitId=${unit.id}`);
  const [busy, setBusy] = useState(null); // "3 / 8"
  const [view, setView] = useState(null);
  const [room, setRoom] = useState(focusSpace || '');
  const [linkOpen, setLinkOpen] = useState(false);
  const changed = () => { refetch(); onChanged?.(); };
  const roomName = id => spaces.find(s => s.id === id)?.code;
  const fileName = m => [`Flat ${unit.number}`, m.spaceId ? roomName(m.spaceId) : 'shared', m.kind === 'VIDEO' ? 'video' : 'photo', m.id.slice(0, 4)].filter(Boolean).join(' ');

  const upload = async files => {
    const list = [...files].filter(f => f.type.startsWith('image/') || isVideoFile(f) || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    let done = 0, failed = 0;
    for (const f of list) {
      const label = `${done + 1} / ${list.length}`;
      setBusy(label);
      try {
        if (isVideoFile(f)) {
          if (f.size > VIDEO_MAX) throw new Error(t('Videos can be up to 80 MB. Export a smaller copy (1080p) and try again.'));
          const poster = await videoPoster(f);
          const item = await api.post('/photos', { unitId: unit.id, spaceId: room || null, kind: 'VIDEO', ...poster });
          try {
            await uploadVideoFile(item.id, f, p => setBusy(`${label} · ${Math.round(p * 100)}%`));
          } catch (e) { await api.del(`/photos/${item.id}`).catch(() => {}); throw e; }
        } else {
          const p = await compressPhoto(f);
          await api.post('/photos', { unitId: unit.id, spaceId: room || null, ...p });
        }
      } catch (e) { failed++; if (failed === 1) toast(`${f.name}: ${e.message}`, 'error'); }
      done++;
    }
    setBusy(null);
    toast(t('{0} files uploaded', [done - failed]));
    changed();
  };

  const addLink = async e => {
    e.preventDefault();
    const url = new FormData(e.target).get('url');
    try {
      await api.post('/photos', { unitId: unit.id, spaceId: room || null, kind: 'VIDEO', url });
      setLinkOpen(false); changed();
    } catch (err) { toast(err.message, 'error'); }
  };

  const copy = async m => {
    try { await navigator.clipboard.writeText(m.url || publicUrl(m.id)); toast(t('Link copied')); } catch { toast(m.url || publicUrl(m.id)); }
  };

  const shown = (media || []).filter(p => !focusSpace || p.spaceId === focusSpace || !p.spaceId);

  return (
    <div className="photos">
      {can.write && (
        <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
          {spaces.length > 0 && (
            <select className="input input-sm" style={{ width: 'auto' }} value={room} onChange={e => setRoom(e.target.value)} aria-label={t('Photos of')}>
              <option value="">{t('Whole apartment (shared areas)')}</option>
              {spaces.map(s => <option key={s.id} value={s.id}>{t('Room')} {s.code}</option>)}
            </select>
          )}
          <label className={`btn btn-primary btn-sm ${busy ? 'disabled' : ''}`}>
            {busy ? t('Uploading {0}…', [busy]) : t('+ Add photos / videos')}
            <input type="file" accept="image/*,video/*" multiple hidden disabled={!!busy} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
          </label>
          <button className="btn btn-sm" onClick={() => setLinkOpen(v => !v)}>{t('+ Video link')}</button>
          <span className="tiny faint">{t('Pick many at once. Photos are resized automatically; videos up to 80 MB.')}</span>
        </div>
      )}
      {linkOpen && (
        <form className="row" style={{ gap: 8, marginBottom: 12 }} onSubmit={addLink}>
          <input className="input input-sm" name="url" type="url" required placeholder={t('YouTube, Google Drive, Instagram or TikTok link')} autoFocus />
          <button className="btn btn-primary btn-sm">{t('Add')}</button>
        </form>
      )}
      {media && shown.length === 0 && <p className="small muted">{t('No photos or videos yet.')}</p>}
      <div className="photo-grid">
        {shown.map(p => (
          <figure key={p.id} className={`photo ${p.cover ? 'is-cover' : ''}`}>
            <button className={`photo-img ${p.kind === 'VIDEO' ? 'is-video' : ''}`} onClick={() => setView(p)} aria-label={t('Open')}>
              {(p.kind === 'PHOTO' || !p.url) && <img src={photoUrl(p.id, true)} alt={p.caption || ''} loading="lazy" onError={e => { e.currentTarget.style.visibility = 'hidden'; }} />}
              {p.kind === 'VIDEO' && <span className="play">▶{p.duration ? ` ${duration(p.duration)}` : ''}{p.url ? ` · ${t('link')}` : ''}</span>}
            </button>
            <figcaption>
              {p.cover && <span className="tag-cover">{t('Cover')}</span>}
              <span className="tiny">{p.spaceId ? `${t('Room')} ${roomName(p.spaceId) || ''}` : t('Shared')}</span>
            </figcaption>
            {can.write && (
              <div className="photo-actions">
                {!p.cover && p.kind === 'PHOTO' && <button className="btn btn-sm" onClick={async () => { await api.patch(`/photos/${p.id}`, { cover: true }); changed(); }}>{t('Make cover')}</button>}
                {spaces.length > 0 && (
                  <select className="input input-sm" value={p.spaceId || ''} aria-label={t('Room')} onChange={async e => { await api.patch(`/photos/${p.id}`, { spaceId: e.target.value || null }); changed(); }}>
                    <option value="">{t('Shared')}</option>
                    {spaces.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                )}
                <button className="btn btn-sm btn-ghost" aria-label={t('Delete')} onClick={async () => { if (!confirm(t('Delete this file?'))) return; await api.del(`/photos/${p.id}`); changed(); }}>✕</button>
              </div>
            )}
          </figure>
        ))}
      </div>
      {view && (
        <Modal wide title={view.spaceId ? `${t('Room')} ${roomName(view.spaceId) || ''}` : `${t('Flat')} ${unit.number}`} onClose={() => setView(null)}
          footer={<>
            <button className="btn" onClick={() => copy(view)}>{t('Copy link')}</button>
            {view.url
              ? <a className="btn btn-primary" href={view.url} target="_blank" rel="noreferrer">{t('Open video')}</a>
              : <a className="btn btn-primary" href={downloadUrl(view.id, fileName(view))}>{t('Download')}</a>}
          </>}>
          {view.kind === 'VIDEO'
            ? (view.url
              ? <p className="small"><a href={view.url} target="_blank" rel="noreferrer">{view.url}</a></p>
              : <video src={photoUrl(view.id)} controls autoPlay playsInline poster={photoUrl(view.id, true)} style={{ width: '100%', maxHeight: '70vh', borderRadius: 10, background: '#000' }} />)
            : <img src={photoUrl(view.id)} alt="" style={{ width: '100%', borderRadius: 10 }} />}
        </Modal>
      )}
    </div>
  );
}

// A small counter for cards; opens the manager when clicked
export function PhotoCount({ photos = [], onClick }) {
  const videos = photos.filter(p => p.kind === 'VIDEO').length;
  return (
    <button className="photo-count" onClick={onClick} title={t('Photos')}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
      {photos.length - videos || (videos ? 0 : '+')}{videos ? ` · ▶ ${videos}` : ''}
    </button>
  );
}
