import { useEffect, useState } from 'react';
import { AlertTriangle, ArrowUpLeft, CheckCircle2, CircleHelp, Cloud, Code2, FileCheck2, FileKey2, FileText, Fingerprint, Globe2, History, KeyRound, LockKeyhole, RefreshCw, Save, Shield, ShieldCheck, Upload, XCircle } from 'lucide-react';
import { getZatcaConfig, saveZatcaConfig, type ZatcaPublicConfig } from '../../app/api';
import type { AppLanguage } from '../../app/types';

type Tab = 'overview' | 'documents' | 'logs';
const sampleDocs = [
  { id: 'INV-2047', uuid: 'a8f70c…4d21', kind: 'فاتورة ضريبية', state: 'draft', date: '02 أكتوبر 2026 · 10:18', note: 'لم تبدأ عملية الإرسال' },
  { id: 'INV-2046', uuid: '1c035b…8f72', kind: 'فاتورة مبسطة', state: 'pending', date: '02 أكتوبر 2026 · 09:56', note: 'تنتظر إعداد بيئة الربط' },
  { id: 'CN-0012', uuid: '7b1b0d…a621', kind: 'إشعار دائن', state: 'error', date: '01 أكتوبر 2026 · 16:24', note: 'مثال توضيحي — غير مرسل' },
];

export default function ZatcaPage({ lang, demoMode }: { lang: AppLanguage; demoMode: boolean }) {
  const isAr = lang === 'ar';
  const t = (ar: string, en: string) => isAr ? ar : en;
  const [tab, setTab] = useState<Tab>('overview');
  const [environment, setEnvironment] = useState<'sandbox' | 'production'>('sandbox');
  const [companyName, setCompanyName] = useState('');
  const [vatNumber, setVatNumber] = useState('');
  const [egsUnit, setEgsUnit] = useState('');
  const [apiCredential, setApiCredential] = useState('');
  const [certificatePath, setCertificatePath] = useState('');
  const [privateKeyPath, setPrivateKeyPath] = useState('');
  const [config, setConfig] = useState<ZatcaPublicConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'success' | 'warning' | 'error'; text: string } | null>(null);

  useEffect(() => {
    let active = true;
    getZatcaConfig(environment).then((current) => {
      if (!active) return;
      setConfig(current); setCompanyName(current.company_name);
      setVatNumber(current.vat_number); setEgsUnit(current.egs_unit);
      setCertificatePath(current.certificate_path); setPrivateKeyPath(current.private_key_path);
    }).catch(() => { if (active) setConfig(null); });
    return () => { active = false; };
  }, [environment]);

  const save = async () => {
    setMessage(null); setBusy(true);
    try {
      const updated = await saveZatcaConfig({
        environment, company_name: companyName, vat_number: vatNumber, egs_unit: egsUnit,
        certificate_path: certificatePath, private_key_path: privateKeyPath,
        api_credential: apiCredential || undefined,
      });
      setConfig(updated); setApiCredential('');
      setMessage({ kind: 'success', text: t('حُفظت بيانات المنشأة محليًا. لم يتم إجراء اتصال رسمي بزاتكا.','Company details saved locally. No official ZATCA connection was made.') });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '';
      setMessage({ kind: 'error', text: detail || t('تعذر الحفظ. شغّل خدمة API المحلية وتأكد من توفر مخزن أسرار نظام التشغيل.','Could not save. Start the local API and ensure the OS key store is available.') });
    } finally { setBusy(false); }
  };

  const validate = () => {
    setLoading(true); setMessage(null);
    window.setTimeout(() => {
      setLoading(false);
      if (!companyName.trim() || !vatNumber.trim() || !egsUnit.trim()) {
        setMessage({ kind: 'warning', text: t('أكمل اسم المنشأة والرقم الضريبي ووحدة EGS للتحقق المحلي من الإعدادات. لم يتم الاتصال بزاتكا.','Enter the company name, VAT number and EGS unit for local configuration validation. No ZATCA request was made.') });
      } else {
        setMessage({ kind: 'warning', text: t('اكتمل فحص الحقول محليًا فقط. لم يُنفذ اختبار اتصال رسمي لأن محول ZATCA المعتمد والاعتمادات الرسمية غير مهيأة.','Local fields checked only. No official connection test ran because the documented ZATCA adapter and taxpayer credentials are not configured.') });
      }
    }, 450);
  };

  return <section className="zatca-page">
    <div className="page-heading-row zatca-heading"><div><div className="eyebrow"><span className="eyebrow-star">✦</span>{t('الامتثال والتكاملات','COMPLIANCE & INTEGRATIONS')}</div><h1>{t('زاتكا والفوترة الإلكترونية','ZATCA & e-invoicing')}<span className="heading-period">.</span></h1><p>{t('إدارة إعداد المنشأة ودورة الفواتير الإلكترونية من مكان واحد.','Configure your business and manage the e-invoice lifecycle in one place.')}</p></div><div className="heading-actions"><a className="button button-ghost" href="https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/Pages/default.aspx" target="_blank" rel="noreferrer"><Globe2 size={15}/>{t('بوابة المطورين الرسمية','Official developer portal')}<ArrowUpLeft size={13}/></a></div></div>
    <div className="compliance-disclaimer"><ShieldCheck size={16}/><span>{t('مصمم لدعم متطلبات الفوترة الإلكترونية ذات الصلة. هذه النسخة غير متصلة بزاتكا ولا تدّعي الاعتماد الرسمي.','Designed to support applicable e-invoicing requirements. This build is not connected to ZATCA and does not claim official approval.')}</span><a href="https://zatca.gov.sa/en/E-Invoicing/Introduction/Guidelines/Documents/DEVELOPER-PORTAL-MANUAL.pdf" target="_blank" rel="noreferrer">{t('اقرأ دليل المطور','Read developer guide')} <ArrowUpLeft size={12}/></a></div>
    {demoMode && <div className="inline-alert warning"><span><ShieldCheck size={17}/></span>{t('هذه معاينة عامة ببيانات توضيحية فقط. لا تدخل بيانات منشأتك أو اعتمادًا حقيقيًا؛ الإدخال والحفظ والاتصال معطلون.','Public browser preview with sample data only. Do not enter real business details or credentials; editing, saving and API calls are disabled.')}</div>}
    <div className="zatca-status-row">
      <div className="zatca-status-main glass-card"><span className="large-status-icon"><Cloud size={21}/></span><div className="status-main-copy"><span className="eyebrow">{t('حالة الاتصال','CONNECTION STATUS')}</span><h2>{config?.configured ? t('الإعدادات محفوظة محليًا','Configuration saved locally') : t('غير موصول','Not connected')}</h2><p>{config?.configured ? t('لم يجرِ اختبار اتصال رسمي بعد','Official connection has not been tested') : t('لم تتم إضافة بيانات المنشأة بعد','Company credentials have not been added')}</p></div><span className={`status-chip ${config?.configured ? 'amber' : 'slate'}`}><i/>{config?.configured ? t('إعداد محفوظ','SAVED · NOT CONNECTED') : t('إعداد مطلوب','SETUP REQUIRED')}</span></div>
      <div className="environment-switch glass-card"><span className="eyebrow">{t('البيئة النشطة','ACTIVE ENVIRONMENT')}</span><div className="segmented-control"><button className={environment === 'sandbox' ? 'selected' : ''} onClick={() => setEnvironment('sandbox')}><Code2 size={14}/>{t('اختبار','Sandbox')}</button><button className={environment === 'production' ? 'selected production-selected' : ''} onClick={() => setEnvironment('production')}><Shield size={14}/>{t('إنتاج','Production')}</button></div><small>{environment === 'production' ? t('الإنتاج مقفل حتى إتمام التحقق الرسمي.','Production stays locked until official verification.') : t('ابدأ في بيئة الاختبار الرسمية.','Start with the official test environment.')}</small></div>
    </div>
    {message && <div className={`inline-alert ${message.kind}`}><span>{message.kind === 'success' ? <CheckCircle2 size={17}/> : <AlertTriangle size={17}/>}</span>{message.text}<button className="icon-button" aria-label="dismiss" onClick={() => setMessage(null)}><XCircle size={16}/></button></div>}
    <div className="zatca-tabs" role="tablist"><button className={tab === 'overview' ? 'active' : ''} onClick={() => setTab('overview')}><SettingsIcon/>{t('الإعدادات','Configuration')}</button><button className={tab === 'documents' ? 'active' : ''} onClick={() => setTab('documents')}><FileText size={16}/>{t('الفواتير والوثائق','Invoices & documents')}<span className="tab-count">3</span></button><button className={tab === 'logs' ? 'active' : ''} onClick={() => setTab('logs')}><History size={16}/>{t('سجل النشاط','Activity log')}</button></div>
    {tab === 'overview' && <div className="zatca-content-grid">
      <article className="panel config-panel"><div className="panel-heading"><div><span className="eyebrow">01 — {t('ملف المنشأة','BUSINESS PROFILE')}</span><h2>{t('بيانات المنشأة','Company details')}</h2><p>{t('تُحفظ هذه البيانات محليًا في قاعدة SHOPNEX.','These details are stored locally in SHOPNEX.')}</p></div><span className="panel-step">1 / 3</span></div>
        <div className="form-grid"><label className="form-field span-two"><span>{t('اسم المنشأة كما هو مسجل','Registered company name')} <em>*</em></span><input disabled={demoMode} value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t('مثال: شركة مدار للتجارة','e.g. Orbit Trading Co.')}/></label><label className="form-field"><span>{t('رقم التسجيل الضريبي (VAT)','VAT registration number')} <em>*</em><Help/></span><input disabled={demoMode} value={vatNumber} onChange={(e) => setVatNumber(e.target.value)} inputMode="numeric" placeholder="3XXXXXXXXXXXXXX" dir="ltr"/></label><label className="form-field"><span>{t('وحدة الحل التقني (EGS)','Electronic generation solution (EGS)')} <em>*</em><Help/></span><input disabled={demoMode} value={egsUnit} onChange={(e) => setEgsUnit(e.target.value)} placeholder={t('حسب الإعداد الرسمي','As provisioned by ZATCA')} dir="ltr"/></label></div>
        <div className="form-divider"/><div className="panel-heading credentials-heading"><div><span className="eyebrow">02 — {t('بيانات الربط الآمن','SECURE CREDENTIALS')}</span><h2>{t('بيانات الاعتماد والشهادة','Credentials & certificate')}</h2><p>{t('أدخل القيم التي صدرت لمنشأتك فقط. لا تضعها في محادثة أو ملف عام.','Enter only credentials issued for your business. Never put them in chat or public files.')}</p></div><LockKeyhole size={18}/></div>
        <div className="secure-field"><label className="form-field"><span>{t('مفتاح / اعتماد التكامل','API key / integration credential')}<Help/></span><div className="secure-input"><KeyRound size={15}/><input disabled={demoMode} type="password" autoComplete="new-password" value={apiCredential} onChange={(e) => setApiCredential(e.target.value)} placeholder={config?.secret_present ? t('مُخزّن بأمان — اتركه فارغًا للإبقاء عليه','Saved securely — leave blank to keep') : t('أدخل الاعتماد إذا كان مطلوبًا لمسار منشأتك','Enter if required for your onboarding flow')} dir="ltr"/><span className="secure-mark">••••••</span></div><small>{t('لن يُعاد المفتاح للواجهة بعد حفظه. يُخزّن في مخزن أسرار نظام التشغيل عند توافره.','The credential is never returned to the UI. Stored in the operating system key store when available.')}</small></label></div>
        <div className="form-grid path-grid"><label className="form-field"><span>{t('مسار شهادة الحل (اختياري)','Solution certificate path (optional)')}</span><div className="path-input"><FileKey2 size={15}/><input disabled={demoMode} value={certificatePath} onChange={(e) => setCertificatePath(e.target.value)} placeholder="/path/to/certificate.pem" dir="ltr"/><Upload size={14}/></div><small>{t('احتفظ بالشهادة في مجلد محلي محدود الصلاحية.','Keep the certificate in a restricted local folder.')}</small></label><label className="form-field"><span>{t('مسار المفتاح الخاص (اختياري)','Private key path (optional)')}<LockKeyhole size={13}/></span><div className="path-input"><Fingerprint size={15}/><input disabled={demoMode} value={privateKeyPath} onChange={(e) => setPrivateKeyPath(e.target.value)} placeholder="/secure/path/private-key.pem" dir="ltr"/><Upload size={14}/></div><small>{t('لا يُرفع المفتاح الخاص ولا يُعرض في الواجهة.','The private key is not uploaded or displayed in the UI.')}</small></label></div>
        <div className="secure-note"><ShieldCheck size={17}/><p><b>{t('تخزين آمن، لا أسرار في المتصفح','Secure storage — no browser secrets')}</b><span>{t('لا يتم الحفظ في LocalStorage أو ملفات الواجهة. يتطلب حفظ الاعتماد توفر خدمة أسرار نظام التشغيل.','Credentials are not stored in LocalStorage or frontend files. Saving requires the operating system key store.')}</span></p></div>
        <div className="form-actions"><button className="button button-primary" onClick={save} disabled={busy || demoMode}><Save size={15}/>{busy ? t('جارٍ الحفظ…','Saving…') : t('حفظ الإعدادات محليًا','Save local settings')}</button><button className="button button-outline" onClick={validate} disabled={loading}>{loading ? <RefreshCw className="spin" size={15}/> : <CheckCircle2 size={15}/ >}{t('تحقق من الحقول','Validate fields')}</button></div>
      </article>
      <aside className="zatca-side-column"><article className="panel workflow-panel"><div className="panel-heading"><div><span className="eyebrow">{t('مسار الإعداد','ONBOARDING FLOW')}</span><h2>{t('خطوات الربط','Integration steps')}</h2></div><CircleHelp size={16}/></div><div className="workflow-list"><WorkflowStep n="01" title={t('بيانات المنشأة','Company details')} detail={t('أدخل الرقم الضريبي ووحدة EGS','Enter VAT number and EGS')} active/><WorkflowStep n="02" title={t('شهادة الربط الرسمية','Official onboarding certificate')} detail={t('حسب خطوات حسابك في فاتورة','Follow your Fatoora portal flow')}/><WorkflowStep n="03" title={t('تحقق Sandbox','Sandbox validation')} detail={t('تحقق بالـSDK الرسمي قبل الإنتاج','Validate with the official SDK')}/><WorkflowStep n="04" title={t('تفعيل الإنتاج','Enable production')} detail={t('بعد استكمال متطلبات الجهة','After authority requirements are met')}/></div><a className="official-link" href="https://zatca.gov.sa/en/E-Invoicing/SystemsDevelopers/ComplianceEnablementToolbox/Pages/DownloadSDK.aspx" target="_blank" rel="noreferrer"><Code2 size={14}/>{t('تنزيل أدوات التحقق الرسمية','Get official validation tools')}<ArrowUpLeft size={13}/></a></article>
        <article className="panel quick-stats-panel"><div className="panel-heading"><div><span className="eyebrow">{t('حالة المستندات','DOCUMENT STATUS')}</span><h2>{t('ملخص الإرسال','Submission summary')}</h2></div><FileCheck2 size={17}/></div><div className="status-stat-list"><StatusStat label={t('بانتظار التحقق','Awaiting validation')} count="—" kind="amber"/><StatusStat label={t('مقبولة / مسجلة','Accepted / reported')} count="—" kind="green"/><StatusStat label={t('مرفوضة / بها خطأ','Rejected / with errors')} count="—" kind="red"/></div><p className="stat-footnote">{t('لا توجد وثائق حقيقية مرسلة من هذا الإصدار.','No real documents have been submitted by this build.')}</p></article>
      </aside>
    </div>}
    {tab === 'documents' && <DocumentsTab lang={lang}/>}
    {tab === 'logs' && <LogsTab lang={lang}/>}
  </section>;
}

function WorkflowStep({ n, title, detail, active }: { n: string; title: string; detail: string; active?: boolean }) { return <div className={`workflow-step ${active ? 'workflow-active' : ''}`}><span className="step-number">{active ? <span className="step-pulse"/> : n}</span><div><b>{title}</b><small>{detail}</small></div>{active && <span className="step-current">الآن</span>}</div>; }
function StatusStat({ label, count, kind }: { label: string; count: string; kind: string }) { return <div className="status-stat"><span className={`stat-led ${kind}`}/><span>{label}</span><b>{count}</b></div>; }
function Help() { return <span className="help-tip" title="راجع مستندات زاتكا الرسمية"><CircleHelp size={13}/></span>; }
function SettingsIcon() { return <ShieldCheck size={16}/>; }

function DocumentsTab({ lang }: { lang: AppLanguage }) {
  const ar = lang === 'ar';
  return <article className="panel document-list-panel"><div className="panel-heading"><div><span className="eyebrow">{ar ? 'سجل الفواتير' : 'INVOICE REGISTER'}</span><h2>{ar ? 'الوثائق الإلكترونية' : 'Electronic documents'}</h2><p>{ar ? 'أمثلة توضيحية فقط — لم تُرسل إلى زاتكا.' : 'Illustrative records only — nothing has been sent to ZATCA.'}</p></div><button className="button button-outline" disabled><ArrowUpLeft size={14}/>{ar ? 'تصدير سجل' : 'Export register'}</button></div><div className="invoice-table-wrap"><table className="data-table zatca-doc-table"><thead><tr><th>{ar ? 'رقم المستند' : 'Document'}</th><th>UUID</th><th>{ar ? 'النوع' : 'Type'}</th><th>{ar ? 'التاريخ' : 'Date'}</th><th>{ar ? 'الحالة' : 'Status'}</th><th>{ar ? 'ملاحظة' : 'Note'}</th></tr></thead><tbody>{sampleDocs.map((doc) => <tr key={doc.id}><td><b className="mono-cell">{doc.id}</b></td><td><code>{doc.uuid}</code></td><td>{doc.kind}</td><td className="muted-cell">{doc.date}</td><td><span className={`status-chip ${doc.state === 'draft' ? 'slate' : doc.state === 'pending' ? 'amber' : 'red'}`}><i/>{doc.state === 'draft' ? (ar ? 'مسودة' : 'Draft') : doc.state === 'pending' ? (ar ? 'معلق' : 'Pending') : (ar ? 'خطأ' : 'Error')}</span></td><td className="muted-cell">{doc.note}</td></tr>)}</tbody></table></div><div className="safe-empty-note"><AlertTriangle size={15}/>{ar ? 'زر الإرسال الفعلي غير متاح قبل التحقق من مواصفات API الرسمية وربط منشأتك في Sandbox.' : 'Real submission stays unavailable until official API specifications are verified and your taxpayer is onboarded in the sandbox.'}</div></article>;
}
function LogsTab({ lang }: { lang: AppLanguage }) {
  const ar = lang === 'ar';
  return <article className="panel logs-panel"><div className="panel-heading"><div><span className="eyebrow">{ar ? 'سجل تدقيق محلي' : 'LOCAL AUDIT TRAIL'}</span><h2>{ar ? 'أحداث تكامل زاتكا' : 'ZATCA integration events'}</h2><p>{ar ? 'لا توجد أحداث ربط حقيقية بعد.' : 'No real integration events yet.'}</p></div><History size={19}/></div><div className="empty-state"><div className="empty-state-icon"><History size={23}/></div><b>{ar ? 'السجل في انتظار أول إعداد' : 'Waiting for first configuration'}</b><span>{ar ? 'سيظهر هنا التحقق من الإعدادات ومحاولات الإرسال والاستجابات مع إخفاء البيانات الحساسة.' : 'Configuration checks, submission attempts and responses will appear here with sensitive values redacted.'}</span></div></article>;
}
