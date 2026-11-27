// frontend/src/components/PhotoManager.jsx — photos of one apartment and its rooms: upload, cover, room, delete
import { useState } from 'react';
import { t } from '../lib/i18n';
import { useApi } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { compressPhoto, photoUrl } from '../lib/photos';
import { Modal, useToast } from './ui';

export default function PhotoManager({ unit, spaces = [], onChanged, focusSpace }) {
  const { can } = useAuth();
  const toast = useToast();
  const { data: photos, refetch } = useApi(`/photos?unitId=${unit.id}`);
  const [busy, setBusy] = useState(null); // "3 / 8"
  const [view, setView] = useState(null);
  const [room, setRoom] = useState(focusSpace || '');
  const changed = () => { refetch(); onChanged?.(); };

  const upload = async files => {
    const list = [...files].filter(f => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
    if (!list.length) return;
    let done = 0, failed = 0;
    for (const f of list) {
      setBusy(`${done + 1} / ${list.length}`);
      try {
        const p = await compressPhoto(f);
        await api.post('/photos', { unitId: unit.id, spaceId: room || null, ...p });
      } catch (e) { failed++; if (failed === 1) toast(`${f.name}: ${e.message}`, 'error'); }
      done++;
    }
    setBusy(null);
    toast(t('{0} photos uploaded', [done - failed]));
    changed();
  };

  const shown = (photos || []).filter(p => !focusSpace || p.spaceId === focusSpace || !p.spaceId);
  const roomName = id => spaces.find(s => s.id === id)?.code;

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
            {busy ? t('Uploading {0}…', [busy]) : t('+ Add photos')}
            <input type="file" accept="image/*" multiple hidden disabled={!!busy} onChange={e => { upload(e.target.files); e.target.value = ''; }} />
          </label>
          <span className="tiny faint">{t('Pick many at once. Photos are resized automatically.')}</span>
        </div>
      )}
      {photos && shown.length === 0 && <p className="small muted">{t('No photos yet.')}</p>}
      <div className="photo-grid">
        {shown.map(p => (
          <figure key={p.id} className={`photo ${p.cover ? 'is-cover' : ''}`}>
            <button className="photo-img" onClick={() => setView(p)} aria-label={t('Open photo')}>
              <img src={photoUrl(p.id, true)} alt={p.caption || ''} loading="lazy" />
            </button>
            <figcaption>
              {p.cover && <span className="tag-cover">{t('Cover')}</span>}
              <span className="tiny">{p.spaceId ? `${t('Room')} ${roomName(p.spaceId) || ''}` : t('Shared')}</span>
            </figcaption>
            {can.write && (
              <div className="photo-actions">
                {!p.cover && <button className="btn btn-sm" onClick={async () => { await api.patch(`/photos/${p.id}`, { cover: true }); changed(); }}>{t('Make cover')}</button>}
                {spaces.length > 0 && (
                  <select className="input input-sm" value={p.spaceId || ''} aria-label={t('Room')} onChange={async e => { await api.patch(`/photos/${p.id}`, { spaceId: e.target.value || null }); changed(); }}>
                    <option value="">{t('Shared')}</option>
                    {spaces.map(s => <option key={s.id} value={s.id}>{s.code}</option>)}
                  </select>
                )}
                <button className="btn btn-sm btn-ghost" aria-label={t('Delete')} onClick={async () => { if (!confirm(t('Delete this photo?'))) return; await api.del(`/photos/${p.id}`); changed(); }}>✕</button>
              </div>
            )}
          </figure>
        ))}
      </div>
      {view && (
        <Modal wide title={view.spaceId ? `${t('Room')} ${roomName(view.spaceId) || ''}` : `${t('Flat')} ${unit.number}`} onClose={() => setView(null)}
          footer={<a className="btn" href={photoUrl(view.id)} target="_blank" rel="noreferrer">{t('Open full size')}</a>}>
          <img src={photoUrl(view.id)} alt="" style={{ width: '100%', borderRadius: 10 }} />
        </Modal>
      )}
    </div>
  );
}

// A small photo strip for cards; opens the manager when clicked
export function PhotoCount({ photos = [], onClick }) {
  return (
    <button className="photo-count" onClick={onClick} title={t('Photos')}>
      <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>
      {photos.length || '+'}
    </button>
  );
}
