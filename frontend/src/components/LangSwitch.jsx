// frontend/src/components/LangSwitch.jsx — English | العربية toggle
import { lang, setLang } from '../lib/i18n';

export default function LangSwitch({ dark = false }) {
  return (
    <div className={`lang-switch ${dark ? 'dark' : ''}`} role="group" aria-label="Language / اللغة">
      <button className={lang === 'en' ? 'on' : ''} onClick={() => lang !== 'en' && setLang('en')} lang="en">EN</button>
      <button className={lang === 'ar' ? 'on' : ''} onClick={() => lang !== 'ar' && setLang('ar')} lang="ar">ع</button>
    </div>
  );
}
