import { useEffect, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AlertTriangle, BarChart3, Download, RefreshCw, TrendingUp, Wallet } from 'lucide-react';
import type { AppLanguage } from '../../app/types';
import { getFinanceReport, type FinanceReport } from '../../app/api';
import { formatValue, parseMinor } from '../../app/finance';

type Props = { lang: AppLanguage; demoMode: boolean };
const today = () => new Date().toISOString().slice(0, 10);
const daysAgo = (days: number) => { const day = new Date(); day.setDate(day.getDate() - days); return day.toISOString().slice(0, 10); };
const preview: FinanceReport = {
  period: { start_date: daysAgo(30), end_date: today(), timezone: 'UTC' }, currency: 'SAR',
  sales: { count: 184, total: '68420.50', net: '59496.09', vat: '8924.41', paid: '61100.00', receivables: '7320.50' },
  purchases: { count: 36, total: '28115.00', net: '24447.83', vat: '3667.17', paid: '23400.00', payables: '4715.00' },
  tax: { output_vat: '8924.41', input_vat: '3667.17', net_vat_due_estimate: '5257.24', filing_status: 'report_only_not_filed' },
  profitability: { net_sales_before_vat: '59496.09', cost_of_goods_sold: '31900.00', gross_profit_estimate: '27596.09', inventory_value_at_average_cost: '118420.00', items_with_missing_cost: 2 },
  payments_by_method: [{ method: 'cash', amount: '25200.00' }, { method: 'card', amount: '32700.00' }],
  sales_trend: Array.from({ length: 10 }, (_, index) => ({ date: new Date(Date.now() - (9 - index) * 86400000).toISOString().slice(0, 10), sales: String(4000 + ((index * 739) % 2700)) })),
  top_products: [{ sku: 'SKU-101', name: 'قهوة مختصة', quantity: '342.000', net_sales: '14364.00', vat: '2154.60', cost: '7866.00', gross_profit: '6498.00' }, { sku: 'SKU-102', name: 'أكواب ورقية', quantity: '308.000', net_sales: '3696.00', vat: '554.40', cost: '1540.00', gross_profit: '2156.00' }],
  supplier_performance: [{ supplier: 'شركة الإمداد التجاري', count: 16, purchases: '12800.00', paid: '10400.00', balance: '2400.00' }, { supplier: 'مؤسسة مخازن الرياض', count: 9, purchases: '7200.00', paid: '6100.00', balance: '1100.00' }],
  data_scope: 'preview_only',
};

function downloadCsv(report: FinanceReport) {
  const rows: (string | number)[][] = [['section', 'metric', 'value', 'currency']];
  for (const section of ['sales', 'purchases', 'tax', 'profitability'] as const) {
    Object.entries(report[section]).forEach(([key, value]) => rows.push([section, key, String(value), typeof value === 'number' || typeof value === 'string' && /^-?\d+(?:\.\d+)?$/.test(value) ? 'SAR' : '']));
  }
  report.top_products.forEach((product) => rows.push(['product', product.sku, product.net_sales, 'SAR']));
  report.supplier_performance.forEach((supplier) => rows.push(['supplier', supplier.supplier, supplier.purchases, 'SAR']));
  const csv = '\ufeff' + rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'shopnex-finance-report.csv'; anchor.click(); URL.revokeObjectURL(url);
}

export default function ReportsPage({ lang, demoMode }: Props) {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => ar ? a : e;
  const [startDate, setStartDate] = useState(daysAgo(30));
  const [endDate, setEndDate] = useState(today());
  const [report, setReport] = useState<FinanceReport | null>(demoMode ? preview : null);
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState('');
  const load = async (from = startDate, to = endDate) => {
    if (demoMode) { setReport({ ...preview, period: { ...preview.period, start_date: from, end_date: to } }); return; }
    if (from && to && from > to) { setError(t('تاريخ البداية يجب ألا يتجاوز تاريخ النهاية.','Start date must be on or before end date.')); return; }
    setLoading(true); setError('');
    try { setReport(await getFinanceReport(from || undefined, to || undefined)); }
    catch (e) { setError(e instanceof Error ? e.message : t('تعذر تحميل التقرير.','Could not load report.')); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, [demoMode]);
  const amount = (value: string | number | bigint) => formatValue(value, ar);
  const chartRows = report?.sales_trend.map((row) => ({ ...row, plottedSales: Number(parseMinor(row.sales)) / 100 })) ?? [];
  const products = report?.top_products.map((row) => ({ ...row, plottedSales: Number(parseMinor(row.net_sales)) / 100 })) ?? [];

  return <section className="finance-page reports-page">
    <div className="page-heading-row"><div><div className="eyebrow"><span className="eyebrow-star">✦</span>{t('مساحة العمل · تحليل الأعمال','WORKSPACE · BUSINESS ANALYSIS')}</div><h1>{t('التقارير والتحليلات','Reports & analytics')}<span className="heading-period">.</span></h1><p>{t('حلّل الإيرادات والمشتريات والضريبة والربحية من القيود والوثائق المحفوظة.','Analyze revenue, purchases, VAT and profitability from saved documents and journals.')}</p></div><div className="heading-actions"><span className={`demo-pill ${demoMode ? '' : 'module-live-pill'}`}><i/>{demoMode ? t('أرقام توضيحية','ILLUSTRATIVE DATA') : t('بيانات فعلية محلية','LOCAL RECORDS')}</span><button className="button button-outline" onClick={() => report && downloadCsv(report)} disabled={!report}><Download size={14}/>{t('تصدير CSV','Export CSV')}</button></div></div>
    {demoMode && <div className="finance-alert preview"><AlertTriangle size={17}/><span>{t('قيم هذا الموقع للمعاينة فقط. التصفية والتصدير تعمل على بيانات توضيحية؛ لا تُرسل أو تُحفظ سجلات جديدة هنا.','Public preview values only. Filters and export use illustrative data; no records are written here.')}</span></div>}
    {error && <div className="finance-alert error"><AlertTriangle size={17}/><span>{error}</span></div>}
    <article className="panel report-filter-panel"><div className="report-range"><div><small>{t('الفترة المحاسبية','REPORTING PERIOD')}</small><b>{t('حدد نطاق التاريخ','Choose a date range')}</b></div><label><span>{t('من','From')}</span><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}/></label><label><span>{t('إلى','To')}</span><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}/></label><button className="button button-primary" onClick={() => void load()} disabled={loading}><RefreshCw size={14}/>{loading ? t('جارٍ التحميل…','Loading…') : t('تطبيق الفترة','Apply dates')}</button></div></article>
    {report && <>
      <div className="finance-kpi-grid report-kpis"><article className="panel finance-kpi"><span className="metric-icon teal"><TrendingUp size={17}/></span><small>{t('إجمالي المبيعات','GROSS SALES')}</small><b>{amount(report.sales.total)}</b><span>{report.sales.count} {t('فاتورة','invoices')}</span></article><article className="panel finance-kpi"><span className="metric-icon blue"><Wallet size={17}/></span><small>{t('المشتريات المسجلة','PURCHASES')}</small><b>{amount(report.purchases.total)}</b><span>{report.purchases.count} {t('فاتورة مورد','supplier bills')}</span></article><article className="panel finance-kpi"><span className="metric-icon amber"><BarChart3 size={17}/></span><small>{t('صافي VAT التقديري','ESTIMATED NET VAT')}</small><b>{amount(report.tax.net_vat_due_estimate)}</b><span>{t('مخرجات ناقص مدخلات','output minus input')}</span></article><article className="panel finance-kpi"><span className="metric-icon violet"><TrendingUp size={17}/></span><small>{t('مجمل الربح التقديري','ESTIMATED GROSS PROFIT')}</small><b>{amount(report.profitability.gross_profit_estimate)}</b><span>{t('صافي البيع ناقص تكلفة البضاعة','net sales less recorded COGS')}</span></article><article className="panel finance-kpi"><span className="metric-icon teal"><Wallet size={17}/></span><small>{t('قيمة المخزون بالتكلفة','INVENTORY AT COST')}</small><b>{amount(report.profitability.inventory_value_at_average_cost)}</b><span>{t('حسب متوسط التكلفة المسجل','based on recorded average costs')}</span></article></div>
      <div className="finance-alert info"><AlertTriangle size={16}/><span>{t(`صافي VAT للعرض فقط وليس نموذج إقرار. تكلفة الربح تعتمد على تكلفة المنتج المسجلة؛ أصناف بلا تكلفة: ${report.profitability.items_with_missing_cost}. لا يوجد توقع أو ربح صافٍ قبل تحميل جميع المصروفات.`,`VAT is a report estimate, not a return. Margin depends on recorded product costs; products missing cost: ${report.profitability.items_with_missing_cost}. No forecast or net profit is shown without all expenses.`)}</span></div>
      <div className="reports-chart-grid"><article className="panel report-chart-card"><div className="panel-heading"><div><span className="eyebrow">{t('اتجاه الإيرادات','REVENUE TREND')}</span><h2>{t('المبيعات الإجمالية يوميًا','Daily gross sales')}</h2></div></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={chartRows} margin={{ top: 12, right: 10, left: 0, bottom: 0 }}><defs><linearGradient id="financeSalesGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#00a88f" stopOpacity={0.24}/><stop offset="95%" stopColor="#00a88f" stopOpacity={0.01}/></linearGradient></defs><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis dataKey="date" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false}/><Tooltip formatter={(value: number) => amount(Math.round(value * 100))}/><Area type="monotone" dataKey="plottedSales" name={t('المبيعات','Sales')} stroke="#00a88f" strokeWidth={2} fill="url(#financeSalesGradient)"/></AreaChart></ResponsiveContainer>{!chartRows.length && <div className="chart-empty">{t('لا توجد مبيعات ضمن الفترة المحددة.','No sales in the selected period.')}</div>}</div></article><article className="panel report-chart-card"><div className="panel-heading"><div><span className="eyebrow">{t('أداء الأصناف','PRODUCT PERFORMANCE')}</span><h2>{t('أفضل المنتجات بالمبيعات','Top products by net sales')}</h2></div></div><div className="report-chart"><ResponsiveContainer width="100%" height="100%"><BarChart data={products} layout="vertical" margin={{ top: 5, right: 10, left: 12, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/><XAxis type="number" tick={{ fill: 'var(--muted)', fontSize: 10 }} tickLine={false} axisLine={false}/><YAxis type="category" dataKey="name" width={95} tick={{ fill: 'var(--muted)', fontSize: 9 }} tickLine={false} axisLine={false}/><Tooltip formatter={(value: number) => amount(Math.round(value * 100))}/><Bar dataKey="plottedSales" name={t('صافي المبيعات','Net sales')} fill="#6a72cf" radius={[0, 5, 5, 0]}/></BarChart></ResponsiveContainer>{!products.length && <div className="chart-empty">{t('لا توجد بيانات أصناف للفترة.','No product sales in this period.')}</div>}</div></article></div>
      <div className="finance-two-column report-tables"><article className="panel finance-record-panel"><div className="panel-heading"><div><span className="eyebrow">{t('أعلى أداء','TOP PERFORMERS')}</span><h2>{t('تحليل المنتجات','Product profitability')}</h2></div></div><div className="invoice-table-wrap"><table className="data-table finance-table"><thead><tr><th>{t('الصنف','Product')}</th><th>{t('الكمية','Qty')}</th><th>{t('صافي المبيعات','Net sales')}</th><th>{t('التكلفة','COGS')}</th><th>{t('مجمل الربح','Gross profit')}</th></tr></thead><tbody>{report.top_products.map((row) => <tr key={row.sku}><td><b>{row.name}</b><small className="finance-subcell">{row.sku}</small></td><td>{row.quantity}</td><td>{amount(row.net_sales)}</td><td>{amount(row.cost)}</td><td className="amount-cell">{amount(row.gross_profit)}</td></tr>)}</tbody></table>{!report.top_products.length && <div className="module-empty">{t('لا توجد أصناف في الفترة.','No products found.')}</div>}</div></article><article className="panel finance-record-panel"><div className="panel-heading"><div><span className="eyebrow">{t('التوريد','SUPPLY BASE')}</span><h2>{t('تحليل الموردين','Supplier performance')}</h2></div></div><div className="invoice-table-wrap"><table className="data-table finance-table"><thead><tr><th>{t('المورد','Supplier')}</th><th>{t('الفواتير','Bills')}</th><th>{t('المشتريات','Purchases')}</th><th>{t('المتبقي','Balance')}</th></tr></thead><tbody>{report.supplier_performance.map((row) => <tr key={row.supplier}><td><b>{row.supplier}</b></td><td>{row.count}</td><td>{amount(row.purchases)}</td><td className="amount-cell">{amount(row.balance)}</td></tr>)}</tbody></table>{!report.supplier_performance.length && <div className="module-empty">{t('لا توجد مشتريات للموردين في الفترة.','No supplier purchases in this period.')}</div>}</div></article></div>
    </>}
    <div className="finance-footnote"><BarChart3 size={14}/>{t('مصدر الأرقام: الفواتير والدفعات والقيود المحلية ضمن الفترة المحددة. تقتصر هذه النسخة على التقارير الوصفية ولا تعدل السجلات أو تتنبأ بها.','Metrics are derived from local invoices, payments and journals in the selected date range. This release is descriptive; it does not modify records or forecast results.')}</div>
  </section>;
}
