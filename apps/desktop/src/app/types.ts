export type PageKey = 'overview' | 'zatca' | 'invoices' | 'sales' | 'inventory' | 'products' | 'purchasing' | 'accounting' | 'customers' | 'reports' | 'restaurant' | 'crm' | 'hr' | 'settings' | 'coming-soon';

export type AppLanguage = 'ar' | 'en';
export type ThemeMode = 'dark' | 'light';

export interface AppPage {
  key: PageKey;
  label: string;
  labelEn: string;
  icon: string;
  group?: string;
  groupEn?: string;
  ready?: boolean;
}
