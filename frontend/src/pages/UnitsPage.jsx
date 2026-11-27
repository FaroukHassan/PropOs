// frontend/src/pages/UnitsPage.jsx — all apartments across modes
import { t } from '../lib/i18n';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useScope } from '../lib/scope';
import { useApi, useSticky } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { money, L } from '../lib/format';
import { unitFields, buildingFields } from '../lib/forms';
import { Spinner, ErrorBox, Empty, FormModal, Badge, Tabs, useToast } from '../components/ui';

export default function UnitsPage() {
  const nav = useNavigate();
  const { can } = useAuth();
  const toast = useToast();
  const [mode, setMode] = useSticky('units_mode', '');
  const { scoped, refetchUnits } = useScope();
  const { data, loading, error, refetch } = useApi(scoped('/units', { mode }));
  const buildings = useApi('/buildings');
  const landlords = useApi('/landlords');
  const [modal, setModal] = useState(null);

  if (error) return <ErrorBox error={error} retry={refetch} />;
  const rows = data || [];
  const totals = rows.reduce((a, u) => ({ potential: a.potential + u.monthlyPotential, contracted: a.contracted + u.monthlyContracted, landlord: a.landlord + (u.landlordRent || 0) / 12 }), { potential: 0, contracted: 0, landlord: 0 });

  return (
    <>
      <div className="toolbar">
        <Tabs value={mode} onChange={setMode} items={[['', t("All")], ['PARTITIONS', t("Rooms")], ['HOLIDAY', t("Holiday homes")], ['LONG_TERM', t("Long-term")]]} />
        <div className="grow" />
        {can.write && <>
          <button className="btn" onClick={() => setModal('building')}>{t("+ Building")}</button>
          <button className="btn btn-primary" onClick={() => setModal('unit')} disabled={!buildings.data?.length} title={!buildings.data?.length ? t("Add a building first") : ''}>{t("+ Apartment")}</button>
        </>}
      </div>

      {loading && !data ? <Spinner /> : rows.length === 0 ? (
        <Empty icon="⌂" title={t("No apartments yet")} action={can.write && <button className="btn btn-primary" onClick={() => setModal(buildings.data?.length ? 'unit' : 'building')}>{buildings.data?.length ? t("+ Apartment") : t("+ Building first")}</button>}>
          {t("Add each apartment Sakanly runs: rooms, holiday homes and long-term lets.")}
        </Empty>
      ) : (
        <div className="card card-flush">
          <div className="table-wrap">
            <table className="table">
              <thead><tr>
                <th>{t("Apartment")}</th><th>{t("Type")}</th><th>{t("Arrangement")}</th><th>{t("Landlord / owner")}</th><th>{t("Occupancy")}</th>
                <th className="num">{t("Monthly income (contracted)")}</th><th className="num">{t("Landlord rent / month")}</th>
              </tr></thead>
              <tbody>
                {rows.map(u => (
                  <tr key={u.id} className="clickable" onClick={() => nav(`/units/${u.id}`)}>
                    <td><div className="bold">{u.building.name} · {u.number}</div>{!u.active && <Badge tone="red">{t("Inactive")}</Badge>}</td>
                    <td><Badge tone={u.mode === 'HOLIDAY' ? 'blue' : u.mode === 'LONG_TERM' ? 'violet' : 'sand'}>{L.mode[u.mode]}</Badge></td>
                    <td className="small">{L.arrangement[u.arrangement]}{u.arrangement === 'MANAGEMENT' && u.managementFee ? ` · ${u.managementFee}%` : ''}</td>
                    <td className="small">{u.landlord?.name || '—'}</td>
                    <td className="small">{u.mode === 'PARTITIONS' ? t("{0}/{1} occupied", [u.occupiedSpaces, u.totalSpaces]) : u.mode === 'LONG_TERM' ? (u.leases[0] ? u.leases[0].tenant.name : t("Vacant")) : u.nightlyRate ? t("{0} / night", [money(u.nightlyRate)]) : '—'}</td>
                    <td className="num">{u.mode === 'HOLIDAY' ? <span className="faint">{t("see bookings")}</span> : money(u.monthlyContracted)}</td>
                    <td className="num">{u.landlordRent ? money(u.landlordRent / 12) : '—'}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5}>{rows.length} {t("apartments")}</td><td className="num">{money(totals.contracted)}</td><td className="num">{money(totals.landlord)}</td></tr></tfoot>
            </table>
          </div>
        </div>
      )}

      {modal === 'building' && (
        <FormModal title={t("Add building")} fields={buildingFields} onClose={() => setModal(null)}
          onSubmit={async v => { await api.post('/buildings', v); toast(t("Building added")); buildings.refetch(); setModal('unit'); }} />
      )}
      {modal === 'unit' && (
        <FormModal title={t("Add apartment")} wide fields={unitFields(buildings.data, landlords.data)} initial={{ mode: mode || 'PARTITIONS' }} onClose={() => setModal(null)}
          onSubmit={async v => { const u = await api.post('/units', v); toast(t("Apartment added")); refetchUnits(); nav(`/units/${u.id}`); }} />
      )}
    </>
  );
}
