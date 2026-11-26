// frontend/src/lib/scope.jsx — the app-wide apartment filter in the top bar.
// Pick an apartment (or a whole building) once and every screen shows only that:
// dashboard, partitions, rent, income & expenses, cheques, bookings, tenants, maintenance and reports.
import { createContext, useContext, useMemo } from 'react';
import { useSticky, useApi } from './hooks';
import { qs } from './api';

const ScopeCtx = createContext(null);

// value: '' (everything) | 'b:<buildingId>' | 'u:<unitId>'
export function ScopeProvider({ children }) {
  const [value, setValue] = useSticky('scope', '');
  const units = useApi('/units');
  const ctx = useMemo(() => {
    const [kind, id] = value ? value.split(':') : [];
    const list = units.data || [];
    const unit = kind === 'u' ? list.find(u => u.id === id) : null;
    const building = kind === 'b' ? list.find(u => u.buildingId === id)?.building : unit?.building;
    const params = kind === 'u' ? { unitId: id } : kind === 'b' ? { buildingId: id } : {};
    return {
      value, set: setValue, clear: () => setValue(''),
      units: list, active: !!value,
      params,
      // add the filter to an API path: scoped('/cheques', { direction }) → /cheques?direction=OUT&unitId=…
      scoped: (path, extra = {}) => `${path}${qs({ ...extra, ...params })}`,
      inScope: u => !value || (kind === 'u' ? u.id === id : u.buildingId === id),
      label: unit ? `${unit.building?.name} · ${unit.number}` : building ? `${building.name} (all)` : 'All apartments',
      short: unit ? `Flat ${unit.number}` : building ? building.name : '',
      refetchUnits: units.refetch,
    };
  }, [value, setValue, units.data, units.refetch]);
  return <ScopeCtx.Provider value={ctx}>{children}</ScopeCtx.Provider>;
}

export const useScope = () => useContext(ScopeCtx);

// The picker shown in the top bar
export function ScopePicker() {
  const s = useScope();
  const byBuilding = {};
  for (const u of s.units) (byBuilding[u.buildingId] ||= { name: u.building?.name || 'Building', units: [] }).units.push(u);
  const groups = Object.entries(byBuilding).sort((a, b) => a[1].name.localeCompare(b[1].name));
  return (
    <div className={`scope-picker ${s.active ? 'on' : ''}`}>
      <span className="scope-icon" aria-hidden>⌂</span>
      <select value={s.value} onChange={e => s.set(e.target.value)} aria-label="Show apartment">
        <option value="">All apartments</option>
        {groups.map(([bid, g]) => (
          <optgroup key={bid} label={g.name}>
            <option value={`b:${bid}`}>All of {g.name}</option>
            {g.units.slice().sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }))
              .map(u => <option key={u.id} value={`u:${u.id}`}>Flat {u.number}</option>)}
          </optgroup>
        ))}
      </select>
      {s.active && <button className="scope-clear" onClick={s.clear} aria-label="Show all apartments">✕</button>}
    </div>
  );
}
