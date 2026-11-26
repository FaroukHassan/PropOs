// frontend/src/pages/SettingsPage.jsx — team accounts and password
import { t } from '../lib/i18n';
import LangSwitch from '../components/LangSwitch';
import { useState } from 'react';
import { useApi } from '../lib/hooks';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { L, options } from '../lib/format';
import { FormModal, Badge, Spinner, useToast } from '../components/ui';

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
            <div><div className="bold">{u.name}{u.id === user.id && <span className="faint small"> {t("(you)")}</span>}</div><div className="tiny faint">{u.email}</div></div>
            <div className="row"><Badge tone={u.role === 'ADMIN' ? 'navy' : u.role === 'VIEWER' ? '' : 'sand'}>{L.role[u.role]}</Badge>
              {can.admin && <button className="btn btn-sm btn-ghost" onClick={() => setModal({ kind: 'user', user: u })}>{t("Edit")}</button>}</div>
          </div>
        ))}
        <p className="tiny faint" style={{ marginTop: 10 }}>{t("Admins manage the team. Managers can add and edit everything else. Read-only accounts can only look.")}</p>
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
      {modal?.kind === 'user' && (
        <FormModal title={modal.user ? t("Edit {0}", [modal.user.name]) : t("Add a team member")} onClose={() => setModal(null)} initial={modal.user}
          fields={[
            { name: 'name', label: t("Name"), required: true },
            ...(modal.user ? [] : [{ name: 'email', label: t("Email"), type: 'email', required: true }]),
            { name: 'role', label: t("Access"), type: 'select', required: true, options: options(L.role), default: 'MANAGER' },
            { name: 'password', label: modal.user ? t("New password (leave empty to keep)") : t("Temporary password (8+ characters)"), type: 'password', required: !modal.user },
          ]}
          onDelete={modal.user && modal.user.id !== user.id ? async () => { await api.del(`/auth/users/${modal.user.id}`); toast(t("Removed")); setModal(null); users.refetch(); } : undefined}
          onSubmit={async v => {
            if (!v.password) delete v.password;
            if (modal.user) await api.patch(`/auth/users/${modal.user.id}`, v); else await api.post('/auth/users', v);
            toast(t("Saved")); setModal(null); users.refetch();
          }} />
      )}
    </div>
  );
}
