import { useEffect, useState } from 'react';
import { ArrowUpLeft, Database, Globe2, HardDrive, Languages, LockKeyhole, MonitorCog, Moon, ShieldCheck, Wifi, WifiOff } from 'lucide-react';
import { getHealth } from '../../app/api';
import './settings-integrations.css';
import type { AppLanguage } from '../../app/types';

export default function SettingsPage({ lang, onNavigateToZatca }: { lang: AppLanguage; onNavigateToZatca: () => void }) {
  const ar = lang === 'ar';
  const [health, setHealth] = useState<{ status: string; database: string; integration_mode: string } | null>(null);
  const t = (a: string, e: string) => ar ? a : e;
  useEffect(() => { getHealth().then(setHealth).catch(() => setHealth(null)); }, []);

  return <section className="settings-page">
    <div className="page-heading-row"><div><div className="eyebrow"><span className="eyebrow-star">✦</span>{t('مركز الإدارة', 'ADMINISTRATION')}</div><h1>{t('إعدادات النظام', 'System settings')}<span className="heading-period">.</span></h1><p>{t('تحكم في بيئة العمل المحلية والتكاملات الخارجية.', 'Manage your local workspace and external integrations.')}</p></div></div>
    <div className="settings-grid">
      <article className="panel setting-panel">
        <div className="panel-heading"><div><span className="eyebrow">{t('بيئة التشغيل', 'RUNTIME')}</span><h2>{t('الخدمات المحلية', 'Local services')}</h2></div><MonitorCog size={18}/></div>
        <SettingRow icon={Database} label={t('قاعدة البيانات', 'Database')} value={health?.database ?? t('غير متاحة — شغّل API', 'Unavailable — start API')} ok={health?.database === 'connected'}/>
        <SettingRow icon={Wifi} label={t('واجهة API', 'API service')} value={health?.status === 'ok' ? '127.0.0.1:8000' : t('غير متصلة', 'Disconnected')} ok={health?.status === 'ok'}/>
        <SettingRow icon={Globe2} label={t('وضع التكامل', 'Integration mode')} value={health?.integration_mode ?? 'offline-first'} ok/>
      </article>
      <article className="panel setting-panel">
        <div className="panel-heading"><div><span className="eyebrow">{t('الحماية والخصوصية', 'SECURITY & PRIVACY')}</span><h2>{t('بياناتك على جهازك', 'Your data stays local')}</h2></div><LockKeyhole size={18}/></div>
        <div className="privacy-card"><span className="privacy-icon"><ShieldCheck size={20}/></span><b>{t('لا توجد قاعدة بيانات سحابية', 'No cloud database')}</b><p>{t('يعمل SHOPNEX محليًا. يتصل بالإنترنت فقط عند إعداد تكامل خارجي مثل زاتكا.', 'SHOPNEX operates locally. Internet is used only when configuring an external integration such as ZATCA.')}</p></div>
        <SettingRow icon={HardDrive} label={t('النسخ الاحتياطي', 'Backups')} value={t('إعداد محلي — قيد الإعداد', 'Local setup — in progress')}/>
        <SettingRow icon={LockKeyhole} label={t('خزنة الأسرار', 'Credential vault')} value={t('مخزن نظام التشغيل', 'OS key store')}/>
      </article>
      <article className="panel setting-panel zatca-settings-card">
        <div className="panel-heading"><div><span className="eyebrow">{t('التكاملات الخارجية', 'EXTERNAL INTEGRATIONS')}</span><h2>{t('زاتكا والفوترة الإلكترونية', 'ZATCA e-invoicing')}</h2></div><ShieldCheck size={18}/></div>
        <div className="integration-status-line"><span className="status-chip amber"><i/>{t('غير متصل — إعداد محلي فقط', 'Not connected — local setup only')}</span></div>
        <p>{t('أدر اسم المنشأة والرقم الضريبي وبيانات EGS وبيئة الاختبار/الإنتاج من لوحة زاتكا. إرسال الفواتير للهيئة لا يُفعّل قبل اعتماد إعدادات المكلف والتحقق الرسمي في Sandbox.', 'Manage the legal seller name, VAT number, EGS details and environment in the ZATCA panel. Authority submission stays unavailable until taxpayer onboarding and official Sandbox validation are complete.')}</p>
        <div className="setting-footnote"><LockKeyhole size={14}/>{t('لا تضع أي اعتماد أو مفتاح خاص في موقع المعاينة أو المستودع العام.', 'Never place credentials or private keys in the public preview or repository.')}</div>
        <button className="button button-outline" onClick={onNavigateToZatca}><ShieldCheck size={15}/>{t('فتح إعدادات الربط', 'Open integration settings')}<ArrowUpLeft size={13}/></button>
      </article>
      <article className="panel setting-panel appearance-panel">
        <div className="panel-heading"><div><span className="eyebrow">{t('تفضيلات العرض', 'DISPLAY PREFERENCES')}</span><h2>{t('المظهر واللغة', 'Appearance & language')}</h2></div><MonitorCog size={18}/></div>
        <SettingRow icon={Moon} label={t('المظهر الافتراضي', 'Default theme')} value={t('داكن فضائي', 'Cosmic dark')}/>
        <SettingRow icon={Languages} label={t('اللغة الافتراضية', 'Default language')} value={t('العربية (RTL)', 'Arabic (RTL)')}/>
        <div className="setting-footnote"><WifiOff size={14}/>{t('تفضيلات العرض التفاعلية متاحة من الشريط العلوي.', 'Interactive display preferences are available in the top bar.')}</div>
      </article>
    </div>
  </section>;
}

function SettingRow({ icon: Icon, label, value, ok }: { icon: typeof Database; label: string; value: string; ok?: boolean }) {
  return <div className="setting-row"><span className="setting-row-icon"><Icon size={15}/></span><span>{label}</span><b className={ok ? 'setting-ok' : ''}>{ok && <i/>}{value}</b></div>;
}
