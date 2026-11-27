// frontend/src/pages/MarketingPage.jsx — media library for the marketing team: photos and videos of
// every apartment and partition, what is free to advertise, and which rooms still need shooting.
import { useMemo, useState } from 'react';
import { t } from '../lib/i18n';
import { useScope } from '../lib/scope';
import { useApi } from '../lib/hooks';
import { useAuth } from '../lib/auth';
import { money, date, L } from '../lib/format';
import { Spinner, ErrorBox, Empty, Badge, Tabs, Modal, Stat, useToast } from '../components/ui';
import PhotoManager from '../components/PhotoManager';
import { photoUrl, publicUrl, duration } from '../lib/photos';

const FREE = ['AVAILABLE', 'RESERVED'];

export default function MarketingPage() {
  const { scoped } = useScope();
  const { can } = useAuth();
  const toast = useToast();
  const { data, loading, error, refetch } = useApi(scoped('/marketing/library'));
  const [filter, setFilter] = useState('FREE');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null); // { unit, space }

  const rows = useMemo(() => {
    if (!data) return [];
    const needle = q.trim().toLowerCase();
    return data.units.map(u => {
      const shared = u.media.filter(m => !m.spaceId);
      const rooms = u.spaces.map(s => {
        const own = u.media.filter(m => m.spaceId === s.id);
        const all = [...own, ...shared];
        return { s, own, all, photos: all.filter(m => m.kind === 'PHOTO').length, videos: all.filter(m => m.kind === 'VIDEO').length };
      }).filter(r => {
        if (filter === 'FREE') return FREE.includes(r.s.status);
        if (filter === 'NO_PHOTOS') return FREE.includes(r.s.status) && !r.photos;
        if (filter === 'NO_VIDEO') return FREE.includes(r.s.status) && !r.videos;
        return true;
      });
      const whole = !u.spaces.length; // holiday homes and yearly flats: media of the whole flat
      const wholeOk = whole && (filter === 'ALL' || (filter === 'NO_PHOTOS' && !shared.some(m => m.kind === 'PHOTO')) || (filter === 'NO_VIDEO' && !shared.some(m => m.kind === 'VIDEO')) || filter === 'FREE');
      return { u, shared, rooms, whole: wholeOk };
    }).filter(r => (r.rooms.length || r.whole) && (!needle || `${r.u.number} ${r.u.building.name}`.toLowerCase().includes(needle)));
  }, [data, filter, q]);

  if (loading && !data) return <Spinner />;
  if (error) return <ErrorBox error={error} retry={refetch} />;
  const tot = data.totals;

  const copyRoom = async (u, s, media) => {
    const lines = [
      `${t('Flat')} ${u.number}${s ? ` · ${s.code}` : ''} — ${u.building.name}${u.building.area ? `, ${u.building.area}` : ''}`,
      s ? `${money(s.monthlyRate)} / ${t('month')} · ${L.occupancy[u.occupancy] || ''}${s.availableFrom ? ` · ${t('Available from')} ${date(s.availableFrom)}` : ''}` : '',
      media.length ? `${t('Photos & videos')}:` : '',
      ...media.map(m => m.url || publicUrl(m.id)),
    ].filter(Boolean).join('\n');
    try { await navigator.clipboard.writeText(lines); toast(t('Copied — paste it in WhatsApp or a post')); } catch { toast(lines); }
  };

  return (
    <>
      <div className="grid g5" style={{ marginBottom: 4 }}>
        <Stat label={t('Photos')} value={tot.photos} />
        <Stat label={t('Videos')} value={tot.videos} />
        <Stat label={t('Free to advertise')} value={tot.freeRooms} sub={`${t('of')} ${tot.rooms} ${t('rooms')}`} onClick={() => setFilter('FREE')} active={filter === 'FREE'} />
        <Stat label={t('Free rooms with no photos')} value={tot.freeNoPhotos} accent={!!tot.freeNoPhotos} onClick={() => setFilter('NO_PHOTOS')} active={filter === 'NO_PHOTOS'} />
        <Stat label={t('Free rooms with no video')} value={tot.freeNoVideo} onClick={() => setFilter('NO_VIDEO')} active={filter === 'NO_VIDEO'} />
      </div>

      <div className="toolbar" style={{ margin: '12px 0 16px' }}>
        <Tabs value={filter} onChange={setFilter} items={[['FREE', t('Free to advertise')], ['NO_PHOTOS', t('Needs photos')], ['NO_VIDEO', t('Needs video')], ['ALL', t('All rooms')]]} />
        <input className="input input-sm" style={{ maxWidth: 220 }} placeholder={t('Search flat or building')} value={q} onChange={e => setQ(e.target.value)} />
      </div>

      {!rows.length && <Empty icon="▶" title={t('Nothing here with this filter')} />}

      {rows.map(({ u, shared, rooms, whole }) => (
        <section key={u.id} className="card media-unit">
          <div className="row-between wrap" style={{ gap: 8 }}>
            <div>
              <b>{t('Flat')} {u.number}</b> <span className="small muted">· {u.building.name}</span>{' '}
              {u.spaces.length > 0 && <Badge tone={u.occupancy === 'LADIES' ? 'violet' : ''}>{L.occupancy[u.occupancy]}</Badge>}
              {!u.spaces.length && <Badge>{L.mode[u.mode] || u.mode}</Badge>}
            </div>
            <div className="row" style={{ gap: 6 }}>
              <button className="btn btn-sm" onClick={() => copyRoom(u, null, u.media)}>{t('Copy all links')}</button>
              <button className="btn btn-sm btn-primary" onClick={() => setOpen({ unit: u })}>{can.write ? t('Manage media') : t('View media')}</button>
            </div>
          </div>

          <MediaRow label={t('Shared areas')} sub={t('kitchen, hall, building, view')} media={shared} onOpen={() => setOpen({ unit: u })} />
          {whole && null}
          {rooms.map(({ s, own, all, photos, videos }) => (
            <MediaRow key={s.id}
              label={s.code}
              badge={<Badge value={s.status} map={L.spaceStatus} />}
              sub={`${money(s.monthlyRate)} / ${t('month')}${s.availableFrom && FREE.includes(s.status) ? ` · ${t('from')} ${date(s.availableFrom)}` : ''}`}
              media={own} extra={!own.length && shared.length ? t('only shared photos') : null}
              missing={[!photos && t('no photos'), !videos && t('no video')].filter(Boolean)}
              onOpen={() => setOpen({ unit: u, space: s })}
              onCopy={() => copyRoom(u, s, all)} />
          ))}
        </section>
      ))}

      {open && (
        <Modal wide title={`${t('Media')} · ${t('Flat')} ${open.unit.number}${open.space ? ` · ${open.space.code}` : ''}`} onClose={() => setOpen(null)}>
          <PhotoManager unit={open.unit} spaces={open.unit.spaces} focusSpace={open.space?.id} onChanged={refetch} />
        </Modal>
      )}
    </>
  );
}

function MediaRow({ label, badge, sub, media, extra, missing = [], onOpen, onCopy }) {
  return (
    <div className="media-row">
      <div className="media-row-head">
        <div><b>{label}</b> {badge}</div>
        {sub && <div className="tiny muted">{sub}</div>}
        {missing.length > 0 && <div className="tiny" style={{ color: 'var(--red, #c0392b)' }}>{missing.join(' · ')}</div>}
      </div>
      <div className="media-strip">
        {media.slice(0, 6).map(m => (
          <button key={m.id} className={`media-thumb ${m.kind === 'VIDEO' ? 'is-video' : ''}`} onClick={onOpen} title={m.kind === 'VIDEO' ? t('Video') : t('Photo')}
            style={!m.url ? { backgroundImage: `url(${photoUrl(m.id, true)})` } : undefined}>
            {m.kind === 'VIDEO' && <span>▶{m.duration ? ` ${duration(m.duration)}` : ''}</span>}
          </button>
        ))}
        {media.length > 6 && <button className="media-thumb more" onClick={onOpen}>+{media.length - 6}</button>}
        {!media.length && <button className="media-thumb empty" onClick={onOpen}>{extra || t('+ Add')}</button>}
      </div>
      {onCopy && <button className="btn btn-sm btn-ghost" onClick={onCopy} title={t('Copy details and links for WhatsApp')}>{t('Copy')}</button>}
    </div>
  );
}
