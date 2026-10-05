import { useMemo, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Clock3, Minus, Plus, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import type { AppLanguage } from '../../app/types';

const menu = [
  { id: 'burger', ar: 'برجر لحم كلاسيكي', en: 'Classic beef burger', descriptionAr: 'لحم مشوي، جبنة شيدر، خس وصلصة البيت', descriptionEn: 'Grilled beef, cheddar, lettuce and house sauce', price: 32, category: 'وجبات', categoryEn: 'Mains', symbol: '🍔', color: 'rose', prep: '١٢–١٥ دقيقة' },
  { id: 'pizza', ar: 'بيتزا مارغريتا', en: 'Margherita pizza', descriptionAr: 'طماطم طازجة، موزاريلا وريحان', descriptionEn: 'Fresh tomato, mozzarella and basil', price: 38, category: 'وجبات', categoryEn: 'Mains', symbol: '🍕', color: 'amber', prep: '١٥–٢٠ دقيقة' },
  { id: 'coffee', ar: 'قهوة اليوم', en: 'Coffee of the day', descriptionAr: 'قهوة محمصة بعناية، تحضير طازج', descriptionEn: 'Carefully roasted, freshly prepared', price: 18, category: 'مشروبات', categoryEn: 'Drinks', symbol: '☕', color: 'coffee', prep: '٤–٦ دقائق' },
  { id: 'fries', ar: 'بطاطس مقرمشة', en: 'Crispy fries', descriptionAr: 'بطاطس ذهبية مع بهارات خاصة', descriptionEn: 'Golden fries with house seasoning', price: 12, category: 'إضافات', categoryEn: 'Sides', symbol: '🍟', color: 'gold', prep: '٦–٨ دقائق' },
  { id: 'cake', ar: 'كيك الشوكولاتة', en: 'Chocolate cake', descriptionAr: 'كاكاو غني وكريمة مخفوقة', descriptionEn: 'Rich cocoa with whipped cream', price: 22, category: 'حلويات', categoryEn: 'Desserts', symbol: '🍰', color: 'violet', prep: 'جاهز للتقديم' },
  { id: 'salad', ar: 'سلطة الحديقة', en: 'Garden salad', descriptionAr: 'خضروات طازجة وصلصة ليمون', descriptionEn: 'Fresh greens with lemon dressing', price: 16, category: 'إضافات', categoryEn: 'Sides', symbol: '🥗', color: 'green', prep: '٥–٧ دقائق' },
];

type Basket = Record<string, number>;

export default function GuestPage({ lang }: { lang: AppLanguage }) {
  const ar = lang === 'ar';
  const t = (a: string, e: string) => ar ? a : e;
  const [category, setCategory] = useState('الكل');
  const [basket, setBasket] = useState<Basket>({});
  const [submitted, setSubmitted] = useState(false);
  const [table] = useState('T-08');
  const categories = [
    { ar: 'الكل', en: 'All' }, { ar: 'وجبات', en: 'Mains' }, { ar: 'مشروبات', en: 'Drinks' }, { ar: 'إضافات', en: 'Sides' }, { ar: 'حلويات', en: 'Desserts' },
  ];
  const visible = category === 'الكل' ? menu : menu.filter((item) => item.category === category);
  const count = Object.values(basket).reduce((sum, quantity) => sum + quantity, 0);
  const subtotal = useMemo(() => menu.reduce((sum, item) => sum + item.price * (basket[item.id] ?? 0), 0), [basket]);
  const update = (id: string, delta: number) => {
    setSubmitted(false);
    setBasket((current) => {
      const next = Math.max(0, (current[id] ?? 0) + delta);
      const result = { ...current };
      if (next === 0) delete result[id]; else result[id] = next;
      return result;
    });
  };

  return <section className="guest-page">
    <header className="guest-header"><div className="guest-brand"><span className="guest-brand-symbol"><UtensilsCrossed size={20}/></span><div><strong>SHOPNEX <span>TABLE</span></strong><small>{t('مطعم المدار · الرياض','ORBIT RESTAURANT · RIYADH')}</small></div></div><div className="guest-table"><span>{t('طاولتك','YOUR TABLE')}</span><b>{table}</b><i/></div></header>
    <div className="guest-welcome"><div><span className="eyebrow">{t('أهلًا بك في مطعم المدار','WELCOME TO ORBIT')}</span><h1>{t('نكهات تستحق','Good food,')}<br/><em>{t('التجربة.','worth sharing.')}</em></h1><p>{t('اختر من قائمتنا وسيصل طلبك مباشرة إلى فريقنا.','Browse the menu and send your order to our team.')}</p></div><div className="guest-welcome-art"><span>✦</span><span>☕</span><i/></div></div>
    <div className="guest-categories" role="tablist">{categories.map((item) => <button key={item.ar} className={category === item.ar ? 'active' : ''} onClick={() => setCategory(item.ar)}>{ar ? item.ar : item.en}</button>)}</div>
    <div className="guest-body"><div className="guest-menu-grid">{visible.map((item) => <article className="guest-menu-card" key={item.id}><div className={`guest-dish-art ${item.color}`}><span>{item.symbol}</span><i>{t('مُحضّر طازجًا','FRESHLY MADE')}</i></div><div className="guest-dish-copy"><div><span className="guest-category-label">{ar ? item.category : item.categoryEn}</span><h2>{ar ? item.ar : item.en}</h2><p>{ar ? item.descriptionAr : item.descriptionEn}</p></div><div className="guest-dish-bottom"><b>{item.price.toFixed(2)} <small>{t('ر.س','SAR')}</small></b>{basket[item.id] ? <div className="guest-quantity"><button onClick={() => update(item.id, -1)} aria-label={t('تقليل','Decrease')}><Minus size={15}/></button><strong>{basket[item.id]}</strong><button onClick={() => update(item.id, 1)} aria-label={t('زيادة','Increase')}><Plus size={15}/></button></div> : <button className="guest-add" onClick={() => update(item.id, 1)}><Plus size={15}/>{t('أضف للطلب','Add')}</button>}</div></div></article>)}</div>
      <aside className="guest-order-card"><div className="guest-order-heading"><div><span className="eyebrow">{t('طلبك','YOUR ORDER')}</span><h2>{t('السلة','Basket')}</h2></div><span className="guest-count">{count}</span></div><div className="guest-order-lines">{count === 0 ? <div className="guest-order-empty"><ShoppingBag size={21}/><span>{t('أضف أول صنف إلى طلبك','Add your first menu item')}</span></div> : menu.filter((item) => basket[item.id]).map((item) => <div className="guest-order-line" key={item.id}><span className="guest-order-emoji">{item.symbol}</span><div><b>{ar ? item.ar : item.en}</b><small><Clock3 size={11}/>{item.prep}</small></div><div className="guest-line-price"><strong>{(item.price * basket[item.id]).toFixed(2)}</strong><span>×{basket[item.id]}</span></div></div>)}</div><div className="guest-order-total"><span>{t('المجموع','Subtotal')}</span><b>{subtotal.toFixed(2)} <small>{t('ر.س','SAR')}</small></b></div><div className="guest-tax-note">{t('تُضاف ضريبة القيمة المضافة حسب الإعدادات.','VAT is applied according to restaurant settings.')}</div><button className="guest-submit" disabled={!count} onClick={() => setSubmitted(true)}>{submitted ? <><Check size={17}/>{t('تم تجهيز معاينة الطلب','Preview ready')}</> : <>{t('إرسال الطلب','Place order')} {ar ? <ArrowLeft size={17}/> : <ArrowRight size={17}/>}</>}</button>{submitted && <p className="guest-preview-note">{t('هذه شاشة معاينة. الإرسال الفعلي يتطلب ربط رقم الطاولة ورمز QR بخدمة الطلبات.','Preview only. Live submission requires a table-bound QR and an order service.')}</p>}</aside></div>
    <footer className="guest-footer"><span>SHOPNEX <i>·</i> {t('قائمة رقمية','DIGITAL MENU')}</span><span>{t('أخبرنا إن كان لديك أي حساسية غذائية.','Please let us know about any food allergies.')}</span></footer>
  </section>;
}
