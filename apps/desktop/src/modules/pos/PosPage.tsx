import { useEffect, useMemo, useState } from 'react';
import { BadgePercent, Banknote, Check, CreditCard, Minus, Plus, Search, ShoppingBag, Trash2, Utensils, WalletCards } from 'lucide-react';
import type { AppLanguage } from '../../app/types';
import { createInvoice, getProducts, type CatalogProduct } from '../../app/api';

type Product = CatalogProduct & { tint?: string; symbol?: string };
type Cart = Record<string, number>;

const previewProducts: Product[] = [
  { id: 'preview-burger', sku: 'FD-001', name: 'برجر لحم', category: 'وجبات', price: '32.00', vat_rate: '15.00', quantity: '80', price_includes_vat: false, active: true, tint: 'rose', symbol: '🍔' },
  { id: 'preview-pizza', sku: 'FD-002', name: 'بيتزا مارغريتا', category: 'وجبات', price: '38.00', vat_rate: '15.00', quantity: '60', price_includes_vat: false, active: true, tint: 'amber', symbol: '🍕' },
  { id: 'preview-coffee', sku: 'CF-001', name: 'قهوة مختصة', category: 'مشروبات', price: '18.00', vat_rate: '15.00', quantity: '120', price_includes_vat: false, active: true, tint: 'coffee', symbol: '☕' },
  { id: 'preview-water', sku: 'DR-001', name: 'مياه معدنية', category: 'مشروبات', price: '3.00', vat_rate: '15.00', quantity: '300', price_includes_vat: true, active: true, tint: 'blue', symbol: '💧' },
  { id: 'preview-fries', sku: 'FD-003', name: 'بطاطس مقلية', category: 'إضافات', price: '12.00', vat_rate: '15.00', quantity: '100', price_includes_vat: false, active: true, tint: 'gold', symbol: '🍟' },
  { id: 'preview-cake', sku: 'DS-001', name: 'كيك الشوكولاتة', category: 'حلويات', price: '22.00', vat_rate: '15.00', quantity: '25', price_includes_vat: false, active: true, tint: 'violet', symbol: '🍰' },
  { id: 'preview-tea', sku: 'CF-002', name: 'شاي أحمر', category: 'مشروبات', price: '8.00', vat_rate: '15.00', quantity: '90', price_includes_vat: false, active: true, tint: 'green', symbol: '🫖' },
  { id: 'preview-salad', sku: 'FD-004', name: 'سلطة طازجة', category: 'إضافات', price: '16.00', vat_rate: '15.00', quantity: '45', price_includes_vat: false, active: true, tint: 'green', symbol: '🥗' },
];

const categoriesEn = ['All', 'Meals', 'Drinks', 'Sides', 'Desserts'];
const categoryFor = (value: string, ar: boolean) => {
  if (ar) return value;
  return ({ وجبات: 'Meals', مشروبات: 'Drinks', إضافات: 'Sides', حلويات: 'Desserts' } as Record<string, string>)[value] ?? value;
};

function scaled(value: string | number, digits = 2): bigint {
  const [whole = '0', fraction = ''] = String(value).trim().split('.');
  if (!/^[+-]?\d*(\.\d*)?$/.test(String(value).trim())) return 0n;
  const negative = whole.startsWith('-');
  const magnitude = negative ? whole.slice(1) : whole;
  const factor = 10n ** BigInt(digits);
  const fractionValue = BigInt((fraction + '0'.repeat(digits)).slice(0, digits) || '0');
  const result = BigInt(magnitude || '0') * factor + fractionValue;
  return negative ? -result : result;
}

function roundDivide(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

function minorText(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const absolute = value < 0n ? -value : value;
  return `${sign}${absolute / 100n}.${String(absolute % 100n).padStart(2, '0')}`;
}

function formatMoney(value: bigint, ar: boolean): string {
  const sign = value < 0n ? '−' : '';
  const absolute = value < 0n ? -value : value;
  const whole = new Intl.NumberFormat('en-US').format(absolute / 100n);
  return `${sign}${whole}.${String(absolute % 100n).padStart(2, '0')} ${ar ? 'ر.س' : 'SAR'}`;
}

function calculateCart(products: Product[], cart: Cart, discountPercent: string) {
  const requestedRate = scaled(discountPercent || '0');
  const rate = requestedRate < 0n ? 0n : requestedRate > 10000n ? 10000n : requestedRate;
  return Object.entries(cart).reduce((sum, [id, quantity]) => {
    const product = products.find((item) => item.id === id);
    if (!product) return sum;
    const gross = scaled(product.price) * BigInt(quantity);
    const discount = roundDivide(gross * rate, 10000n);
    const afterDiscount = gross - discount;
    const vatRate = scaled(product.vat_rate);
    let taxable = afterDiscount;
    let vat = 0n;
    let total = afterDiscount;
    if (product.price_includes_vat && vatRate > 0n) {
      taxable = roundDivide(afterDiscount * 10000n, 10000n + vatRate);
      vat = afterDiscount - taxable;
    } else if (!product.price_includes_vat) {
      vat = roundDivide(taxable * vatRate, 10000n);
      total += vat;
    }
    sum.subtotal += gross;
    sum.discount += discount;
    sum.taxable += taxable;
    sum.vat += vat;
    sum.total += total;
    sum.lines.push({ product, quantity, gross, discount, taxable, vat, total });
    return sum;
  }, { subtotal: 0n, discount: 0n, taxable: 0n, vat: 0n, total: 0n, lines: [] as { product: Product; quantity: number; gross: bigint; discount: bigint; taxable: bigint; vat: bigint; total: bigint }[] });
}

export default function PosPage({ lang, demoMode }: { lang: AppLanguage; demoMode: boolean }) {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => ar ? a : e;
  const [products, setProducts] = useState<Product[]>(demoMode ? previewProducts : []);
  const [cart, setCart] = useState<Cart>({});
  const [category, setCategory] = useState('الكل');
  const [query, setQuery] = useState('');
  const [discount, setDiscount] = useState('0');
  const [cashAmount, setCashAmount] = useState('0');
  const [cardAmount, setCardAmount] = useState('0');
  const [loading, setLoading] = useState(!demoMode);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    if (demoMode) { setProducts(previewProducts); setLoading(false); return () => { active = false; }; }
    getProducts().then((items) => { if (active) setProducts(items); })
      .catch((e: unknown) => { if (active) setError(e instanceof Error ? e.message : t('تعذر تحميل الأصناف','Could not load products')); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [demoMode]);

  const categoriesToShow = useMemo(() => ['الكل', ...new Set(products.map((product) => product.category))], [products]);
  const visibleProducts = useMemo(() => products.filter((product) => {
    const matchesCategory = category === 'الكل' || product.category === category;
    const matchesQuery = `${product.name} ${product.sku}`.toLowerCase().includes(query.trim().toLowerCase());
    return matchesCategory && matchesQuery;
  }), [products, category, query]);
  const totals = useMemo(() => calculateCart(products, cart, discount), [products, cart, discount]);
  const cashMinor = scaled(cashAmount || '0');
  const cardMinor = scaled(cardAmount || '0');
  const tendered = cashMinor + cardMinor;
  const discountMinor = scaled(discount || '0');
  const invalidDiscount = discountMinor < 0n || discountMinor > 10000n;
  const due = totals.total > tendered ? totals.total - tendered : 0n;
  const change = tendered > totals.total ? tendered - totals.total : 0n;
  const invalidPayment = change > 0n && cardMinor > 0n;

  const changeQuantity = (product: Product, delta: number) => {
    setNotice('');
    setCart((current) => {
      const next = Math.max(0, Math.min(Number(product.quantity), (current[product.id] ?? 0) + delta));
      const result = { ...current };
      if (next === 0) delete result[product.id];
      else result[product.id] = next;
      return result;
    });
  };

  const checkout = async () => {
    if (demoMode) {
      setNotice(t('عرض تجريبي فقط: لم يتم حفظ البيع أو خصم المخزون.','Preview only: no sale was saved and stock was not changed.'));
      return;
    }
    if (totals.lines.length === 0 || tendered === 0n || invalidPayment || invalidDiscount) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const payments = [
        ...(cashMinor > 0n ? [{ method: 'cash' as const, amount: minorText(cashMinor) }] : []),
        ...(cardMinor > 0n ? [{ method: 'card' as const, amount: minorText(cardMinor) }] : []),
      ];
      const saved = await createInvoice({
        invoice_number: `POS-${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
        customer_name: ar ? 'عميل نقدي' : 'Walk-in customer',
        invoice_type: 'simplified',
        lines: totals.lines.map(({ product, quantity }) => ({ product_id: product.id, quantity: String(quantity), discount_percent: discount || '0' })),
        payments,
      });
      setNotice(`${t('تم حفظ الفاتورة','Invoice saved')}: ${saved.invoice_number} · ${t('الإجمالي','Total')} ${formatMoney(scaled(saved.total), ar)}${change > 0n ? ` · ${t('الباقي','Change')} ${formatMoney(scaled(saved.change_due), ar)}` : ''}`);
      setCart({}); setDiscount('0'); setCashAmount('0'); setCardAmount('0');
      const freshProducts = await getProducts();
      setProducts(freshProducts);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('تعذر حفظ الفاتورة','Could not save the invoice'));
    } finally { setSaving(false); }
  };

  const useCashForRemaining = () => { setCashAmount(minorText(totals.total > cardMinor ? totals.total - cardMinor : 0n)); };
  const useCardForRemaining = () => { setCardAmount(minorText(totals.total > cashMinor ? totals.total - cashMinor : 0n)); };

  return <section className="pos-page">
    <header className="pos-heading">
      <div><div className="eyebrow"><span className="eyebrow-star">✦</span>{t('التشغيل · نقطة البيع','OPERATIONS · CASHIER')}</div><h1>{t('نقطة البيع','Point of sale')}<span className="heading-period">.</span></h1><p>{t('أضف الأصناف، راجع الضريبة، وسجّل المدفوعات في تدفق واحد.','Build the basket, verify tax, and record tender in one fast flow.')}</p></div>
      <div className="pos-session"><span className={`status-pulse ${demoMode ? 'pulse-amber' : ''}`}/><div><b>{t('الكاشير · الرياض','Cashier · Riyadh')}</b><small>{demoMode ? t('وضع معاينة غير محفوظ','Preview · not saved') : t('جلسة محلية','Local session')}</small></div></div>
    </header>
    {demoMode && <div className="pos-notice preview"><ShoppingBag size={16}/><span>{t('أصناف توضيحية للتجربة. لا تُحفظ المبيعات في وضع المعاينة.','Sample products for preview. Sales are not persisted in preview mode.')}</span></div>}
    {notice && <div className="pos-notice success"><Check size={16}/><span>{notice}</span></div>}
    {error && <div className="pos-notice error"><span>{error}</span></div>}
    <div className="pos-layout">
      <section className="pos-catalog panel">
        <div className="pos-catalog-heading"><div><span className="eyebrow">{t('كتالوج الأصناف','PRODUCT CATALOG')}</span><h2>{t('اختَر الأصناف','Choose items')}</h2></div><span className="pos-catalog-count">{visibleProducts.length} {t('صنف','items')}</span></div>
        <label className="pos-search"><Search size={17}/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t('ابحث بالاسم أو رمز الصنف…','Search name or SKU…')} autoComplete="off"/><kbd>⌘ K</kbd></label>
        <div className="pos-categories" role="tablist">{categoriesToShow.map((item, index) => <button key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item === 'الكل' ? (ar ? item : categoriesEn[0]) : categoryFor(item, ar)}{index === 0 && <span>{products.length}</span>}</button>)}</div>
        {loading ? <div className="pos-empty">{t('جارٍ تحميل كتالوج الأصناف…','Loading product catalog…')}</div> : visibleProducts.length === 0 ? <div className="pos-empty">{products.length ? t('لا توجد أصناف مطابقة للبحث.','No products match this search.') : t('لا توجد أصناف في الكتالوج. أضف منتجات من وحدة المخزون أولًا.','Catalog is empty. Add products in Inventory before opening sales.')}</div> : <div className="pos-product-grid">{visibleProducts.map((product) => <button className="pos-product-card" key={product.id} onClick={() => changeQuantity(product, 1)} disabled={Number(product.quantity) <= 0}>
          <span className={`pos-product-art ${product.tint ?? 'teal'}`}><span>{product.symbol ?? '◈'}</span><i>{product.category}</i></span>
          <span className="pos-product-name">{product.name}</span><span className="pos-product-meta">{product.sku} · {t('متوفر','stock')} {product.quantity}</span>
          <span className="pos-product-price">{formatMoney(scaled(product.price), ar)}{product.price_includes_vat && <small>{t('شامل الضريبة','incl. VAT')}</small>}</span>
          <span className="pos-add-mark"><Plus size={15}/></span>
        </button>)}</div>}
      </section>

      <aside className="pos-checkout panel">
        <div className="pos-checkout-heading"><div><span className="eyebrow">{t('معاملة جديدة','NEW TRANSACTION')}</span><h2>{t('سلة البيع','Sale basket')}</h2></div><button className="icon-button" aria-label={t('مسح السلة','Clear basket')} onClick={() => { setCart({}); setCashAmount('0'); setCardAmount('0'); setNotice(''); }} disabled={!totals.lines.length}><Trash2 size={16}/></button></div>
        <div className="pos-cart-list">{totals.lines.length === 0 ? <div className="pos-cart-empty"><span className="pos-cart-icon"><ShoppingBag size={21}/></span><b>{t('السلة فارغة','Basket is empty')}</b><small>{t('أضف صنفًا من الكتالوج لبدء البيع.','Add an item from the catalog to start a sale.')}</small></div> : totals.lines.map((line) => <div className="pos-cart-row" key={line.product.id}>
          <div className="pos-cart-symbol">{line.product.symbol ?? <Utensils size={16}/>}</div><div className="pos-cart-description"><b>{line.product.name}</b><small>{formatMoney(scaled(line.product.price), ar)} · {line.product.vat_rate}% {t('ضريبة','VAT')}</small><div className="pos-quantity-control"><button onClick={() => changeQuantity(line.product, -1)} aria-label={t('تقليل الكمية','Decrease quantity')}><Minus size={12}/></button><span>{line.quantity}</span><button onClick={() => changeQuantity(line.product, 1)} aria-label={t('زيادة الكمية','Increase quantity')}><Plus size={12}/></button></div></div><strong>{formatMoney(line.total, ar)}</strong>
        </div>)}</div>
        <div className="pos-discount-field"><label htmlFor="pos-discount"><BadgePercent size={15}/>{t('خصم على السلة','Basket discount')}</label><div><input id="pos-discount" type="number" min="0" max="100" step="0.01" value={discount} onChange={(event) => setDiscount(event.target.value)} disabled={!totals.lines.length}/><span>%</span></div></div>
        <div className="pos-total-lines"><div><span>{t('المجموع قبل الخصم','Gross subtotal')}</span><b>{formatMoney(totals.subtotal, ar)}</b></div><div><span>{t('الخصم','Discount')}</span><b className="discount-value">−{formatMoney(totals.discount, ar)}</b></div><div><span>{t('الضريبة','VAT')}</span><b>{formatMoney(totals.vat, ar)}</b></div><div className="pos-grand-total"><span>{t('الإجمالي المستحق','Amount due')}</span><b>{formatMoney(totals.total, ar)}</b></div></div>
        <div className="pos-payment-heading"><span className="eyebrow">{t('توزيع الدفع','PAYMENT SPLIT')}</span><span>{t('ريال سعودي','SAR')}</span></div>
        <div className="pos-payment-row"><label><Banknote size={15}/>{t('نقدًا','Cash')}</label><input type="number" min="0" step="0.01" inputMode="decimal" aria-label={t('المبلغ النقدي','Cash amount')} value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} onFocus={(event) => event.currentTarget.select()}/><button className="pos-fill-button" onClick={useCashForRemaining}>{t('الباقي','Fill')}</button></div>
        <div className="pos-payment-row"><label><CreditCard size={15}/>{t('بطاقة','Card')}</label><input type="number" min="0" step="0.01" inputMode="decimal" aria-label={t('مبلغ البطاقة','Card amount')} value={cardAmount} onChange={(event) => setCardAmount(event.target.value)} onFocus={(event) => event.currentTarget.select()}/><button className="pos-fill-button" onClick={useCardForRemaining}>{t('الباقي','Fill')}</button></div>
        <div className={`pos-payment-balance ${invalidPayment || invalidDiscount ? 'has-error' : ''}`}><span>{invalidDiscount ? t('الخصم الأقصى ١٠٠٪','Discount limit is 100%') : invalidPayment ? t('الزيادة تكون نقدًا فقط','Change is cash-only') : due > 0n ? t('متبقي غير محصّل','Balance remaining') : t('الباقي للعميل','Change due')}</span><b>{formatMoney(invalidPayment ? 0n : due > 0n ? due : change, ar)}</b></div>
        <button className="button button-primary pos-complete" onClick={checkout} disabled={!totals.lines.length || tendered === 0n || invalidPayment || invalidDiscount || saving}><WalletCards size={17}/>{saving ? t('جارٍ تسجيل البيع…','Recording sale…') : demoMode ? t('معاينة الدفع','Preview checkout') : t('تسجيل البيع','Record sale')}</button>
        <small className="pos-server-note">{demoMode ? t('المعاينة لا تنشئ معاملة فعلية.','Preview does not create a real transaction.') : t('يعيد الخادم احتساب السعر والضريبة من سجل الصنف قبل الحفظ.','Server rechecks catalog prices and tax before commit.')}</small>
      </aside>
    </div>
  </section>;
}
