// frontend/src/pages/SettingsPage.jsx — team accounts and password
import { t } from '../lib/i18n';
import LangSwitch from '../components/LangSwitch';
import { useState } from 'react';
import { useApi } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { L, options } from '../lib/format';
import { FormModal, Modal, Badge, Spinner, useToast } from '../components/ui';
import { SECTIONS, SECTION_LABEL, PRESETS } from '../lib/access';

export default function SettingsPage() {
  const { user, can } = useAuth();
  const toast = useToast();
  const users = useApi('/auth/users');
  const [modal, setModal] = useState(null);

  return (
    <div className="grid g2" style={{ alignItems: 'start' }}>
      <div className="card">
        <div className="card-head"><div className="card-title">{t("Team")}</div>{can.admin && <button className="btn btn-sm btn-primary" onClick={() => setModal({ kind: 'user' })}>{t("+ Person")}</button>}</div>
        {!users.data ? <Spinner /> : users.data.map(u => (
          <div key={u.id} className="list-item">
            <div><div className="bold">{u.name}{u.id === user.id && <span className="faint small"> {t("(you)")}</span>}</div><div className="tiny faint">{u.email}</div>
              {u.role !== 'ADMIN' && <div className="tiny faint">{accessSummary(u.access)}</div>}</div>
            <div className="row"><Badge tone={u.role === 'ADMIN' ? 'navy' : u.role === 'VIEWER' ? '' : 'sand'}>{L.role[u.role]}</Badge>
              {can.admin && <button className="btn btn-sm btn-ghost" onClick={() => setModal({ kind: 'user', user: u })}>{t("Edit")}</button>}</div>
          </div>
        ))}
        <p className="tiny faint" style={{ marginTop: 10 }}>{t("Super admins control the whole system and the team. For everyone else, choose for each section whether it is hidden, view only or editable.")}</p>
      </div>
      <div className="card">
        <div className="card-title" style={{ marginBottom: 10 }}>{t("Your account")}</div>
        <dl className="kv"><dt>{t("Name")}</dt><dd>{user.name}</dd><dt>{t("Email")}</dt><dd>{user.email}</dd><dt>{t("Role")}</dt><dd>{L.role[user.role]}</dd><dt>{t("Company")}</dt><dd>{user.org?.name === 'Sakanly Real Estate' ? t('Sakanly Real Estate') : user.org?.name}</dd></dl>
        <div className="row-between" style={{ marginTop: 14 }}>
          <button className="btn" onClick={() => setModal({ kind: 'password' })}>{t("Change password")}</button>
          <div className="row"><span className="small muted">{t('Language')}</span><LangSwitch /></div>
        </div>
      </div>

      {modal?.kind === 'password' && (
        <FormModal title={t("Change password")} onClose={() => setModal(null)} submitLabel={t("Change")}
          fields={[{ name: 'current', label: t("Current password"), type: 'password', required: true, full: true }, { name: 'next', label: t("New password (8+ characters)"), type: 'password', required: true, full: true }]}
          onSubmit={async v => { await api.post('/auth/password', v); toast(t("Password changed")); setModal(null); }} />
      )}
      {modal?.kind === 'user' && <UserModal person={modal.user} me={user} onClose={() => setModal(null)} onSaved={() => { setModal(null); users.refetch(); }} />}
    </div>
  );
}

function accessSummary(access = {}) {
  const hidden = SECTIONS.filter(s => access[s] === 'none').length;
  const view = SECTIONS.filter(s => access[s] === 'view').length;
  const edit = SECTIONS.length - hidden - view;
  return t('{0} editable · {1} view only · {2} hidden', [edit, view, hidden]);
}

// Add or edit a team member: details, role, and access per section
function UserModal({ person, me, onClose, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState({ name: person?.name || '', email: person?.email || '', role: person?.role || 'MANAGER', password: '' });
  const [perms, setPerms] = useState(() => ({ ...PRESETS.full, ...(person?.access || {}) }));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const isAdmin = v.role === 'ADMIN';
  const readOnly = v.role === 'VIEWER';
  const levels = readOnly ? ['none', 'view'] : ['none', 'view', 'edit'];

  const submit = async e => {
    e.preventDefault(); setBusy(true); setError(null);
    try {
      const body = { name: v.name, role: v.role, permissions: isAdmin ? null : perms };
      if (v.password) body.password = v.password;
      if (person) { if (v.email !== person.email) body.email = v.email; await api.patch(`/auth/users/${person.id}`, body); }
      else await api.post('/auth/users', { ...body, email: v.email });
      toast(t('Saved')); onSaved();
    } catch (err) { setError(err.message); setBusy(false); }
  };
  const remove = async () => {
    if (!confirm(t('Remove {0} from the team?', [person.name]))) return;
    await api.del(`/auth/users/${person.id}`); toast(t('Removed')); onSaved();
  };

  return (
    <Modal wide title={person ? t('Edit {0}', [person.name]) : t('Add a team member')} onClose={onClose}
      footer={<>
        {person && person.id !== me.id && <button type="button" className="btn btn-danger" style={{ marginInlineEnd: 'auto' }} onClick={remove}>{t('Remove')}</button>}
        <button type="button" className="btn" onClick={onClose}>{t('Cancel')}</button>
        <button type="submit" form="user-form" className="btn btn-primary" disabled={busy}>{busy ? t('Saving…') : t('Save')}</button>
      </>}>
      {error && <div className="alert alert-error">{error}</div>}
      <form id="user-form" onSubmit={submit}>
        <div className="field-grid">
          <div className="field"><label>{t('Name')} *</label><input className="input" value={v.name} onChange={e => set('name', e.target.value)} required /></div>
          <div className="field"><label>{t('Email')} *</label><input className="input" type="email" value={v.email} onChange={e => set('email', e.target.value)} required /></div>
          <div className="field"><label>{t('Role')} *</label>
            <select className="input" value={v.role} onChange={e => set('role', e.target.value)} disabled={person?.id === me.id}>
              {Object.entries(L.role).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
            </select>
            <div className="hint">{isAdmin ? t('Full control of everything, including the team and permissions.') : readOnly ? t('Can only look; never changes anything.') : t('Sees and edits only what you allow below.')}</div>
          </div>
          <div className="field"><label>{person ? t('New password (leave empty to keep)') : t('Temporary password (8+ characters)')}{!person && ' *'}</label>
            <input className="input" type="password" value={v.password} onChange={e => set('password', e.target.value)} required={!person} minLength={8} autoComplete="new-password" /></div>
        </div>

        {isAdmin ? <div className="alert alert-info">{t('Super admins see every section and can edit everything.')}</div> : (
          <>
            <div className="row-between wrap" style={{ margin: '6px 0 10px' }}>
              <div className="section-title" style={{ margin: 0 }}>{t('What this person can see and do')}</div>
              <div className="row wrap">
                <span className="small muted">{t('Start from:')}</span>
                {[['full', t('Everything')], ['operations', t('Operations')], ['leasing', t('Leasing agent')], ['accounts', t('Accounts')], ['readonly', t('View only')]].map(([k, label]) => (
                  <button type="button" key={k} className="btn btn-sm" onClick={() => setPerms(readOnly ? Object.fromEntries(Object.entries(PRESETS[k]).map(([s, l]) => [s, l === 'edit' ? 'view' : l])) : { ...PRESETS[k] })}>{label}</button>
                ))}
              </div>
            </div>
            <div className="perm-grid">
              <div className="perm-row perm-head" style={{ "--cols": levels.length }}><span>{t('Section')}</span>{levels.map(l => <span key={l}>{L.access[l]}</span>)}</div>
              {SECTIONS.map(sec => (
                <div key={sec} className="perm-row" style={{ "--cols": levels.length }}>
                  <span className="bold">{t(SECTION_LABEL[sec])}</span>
                  {levels.map(l => (
                    <label key={l} className={`perm-cell lvl-${l} ${perms[sec] === l ? 'on' : ''}`}>
                      <input type="radio" name={`p-${sec}`} checked={perms[sec] === l || (readOnly && l === 'view' && perms[sec] === 'edit')} onChange={() => setPerms(p => ({ ...p, [sec]: l }))} />
                      <span>{L.access[l]}</span>
                    </label>
                  ))}
                </div>
              ))}
            </div>
            <p className="tiny faint" style={{ marginTop: 8 }}>{t('Hidden sections disappear from their menu. Changes apply within a few seconds; they may need to refresh the page.')}</p>
          </>
        )}
      </form>
    </Modal>
  );
}
