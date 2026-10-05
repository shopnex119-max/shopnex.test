import { useState, type FormEvent } from 'react';
import { AlertTriangle, ArrowUpLeft, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { isPublicPreview, login, setAccessToken } from './api';
import type { AppLanguage, PageKey } from './types';

export type ProtectedPage = Extract<PageKey, 'sales' | 'invoices' | 'zatca'>;

export default function SensitiveAccessGate({
  lang, page, onUnlock, onCancel,
}: {
  lang: AppLanguage;
  page: ProtectedPage;
  onUnlock: (user: { display_name: string; role: string }) => void;
  onCancel: () => void;
}) {
  const ar = lang === 'ar';
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const t = (a: string, e: string) => ar ? a : e;
  const moduleName = page === 'zatca'
    ? t('زاتكا والفوترة الإلكترونية', 'ZATCA & e-invoicing')
    : page === 'sales'
      ? t('الكاشير والفواتير', 'Cashier & invoicing')
      : t('سجل الفواتير', 'Invoice register');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setBusy(true);
    try {
      const result = await login({ username: username.trim(), password });
      setAccessToken(result.access_token);
      setPassword('');
      onUnlock({ display_name: result.display_name, role: result.role });
    } catch (e) {
      setError(e instanceof Error ? e.message : t('تعذر التحقق من الحساب.', 'Could not verify the account.'));
    } finally {
      setBusy(false);
    }
  };

  return <section className="sensitive-access-page" dir={ar ? 'rtl' : 'ltr'} lang={lang}>
    <article className="sensitive-access-card panel">
      <span className="sensitive-access-icon"><LockKeyhole size={24}/></span>
      <span className="eyebrow">{t('وحدة محمية بكلمة المرور', 'PASSWORD-PROTECTED MODULE')}</span>
      <h1>{moduleName}<span className="heading-period">.</span></h1>
      {isPublicPreview ? <>
        <p>{t('هذه النسخة العامة للمعاينة فقط ولا تحتوي خادم مصادقة أو قاعدة بيانات آمنة. قُفلت هذه الشاشة هنا؛ لا تُدخل اسم المستخدم أو كلمة المرور في الموقع العام.', 'This public site is a static preview with no secure authentication server or database. This module is locked here; do not enter a username or password on the public site.')}</p>
        <div className="sensitive-access-warning"><ShieldCheck size={17}/><span>{t('للوصول الآمن، شغّل نسخة SHOPNEX المحلية المتصلة بخدمة API وسجّل الدخول بحسابك. بيانات المعاينة ليست سجلات منشأتك.', 'For protected access, run SHOPNEX locally with its API and sign in to your account. Preview data is not your business data.')}</span></div>
      </> : <>
        <p>{t('أعد إدخال بيانات حساب SHOPNEX المحلي للتحقق من هويتك قبل فتح هذه الشاشة. لا تُحفظ كلمة المرور بعد التحقق.', 'Re-enter your local SHOPNEX account credentials to verify your identity before opening this screen. The password is not stored after verification.')}</p>
        <form className="sensitive-access-form" onSubmit={submit}>
          <label className="form-field"><span>{t('اسم المستخدم', 'Username')}</span><input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" minLength={3} maxLength={120} required/></label>
          <label className="form-field"><span>{t('كلمة مرور الحساب', 'Account password')}</span><div className="sensitive-password-input"><KeyRound size={15}/><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" minLength={12} maxLength={256} required/></div></label>
          {error && <div className="auth-error"><AlertTriangle size={15}/><span>{error}</span></div>}
          <button className="button button-primary" disabled={busy}>{busy ? t('جارٍ التحقق…', 'Verifying…') : t('تحقق وافتح الشاشة', 'Verify and open')}<ArrowUpLeft size={15}/></button>
        </form>
      </>}
      <div className="sensitive-access-actions"><button className="button button-ghost" onClick={onCancel}>{t('العودة للرئيسية', 'Back to overview')}</button></div>
    </article>
  </section>;
}
