const publicPreview = import.meta.env.VITE_PUBLIC_PREVIEW === 'true';
const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://127.0.0.1:8000';
let accessToken: string | null = null;

export function setAccessToken(token: string | null) { accessToken = token; }

export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  if (publicPreview) throw new Error('Public demo only: no API request was sent. العرض العام للقراءة فقط ولا يرسل طلبات API.');
  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.detail ?? `Request failed (${response.status})`);
  return payload as T;
}

export interface ZatcaPublicConfig {
  configured: boolean;
  environment: 'sandbox' | 'production';
  company_name: string;
  vat_number: string;
  egs_unit: string;
  certificate_path: string;
  private_key_path: string;
  secret_present: boolean;
  certificate_present: boolean;
  private_key_present: boolean;
  adapter_ready: boolean;
  last_validation: string | null;
}

export interface AuthResult { access_token: string; token_type: 'bearer'; display_name: string; role: string }
export async function getAuthStatus() {
  return apiRequest<{ initialized: boolean; setup_required: boolean }>('/api/v1/auth/status');
}
export async function createOwner(input: { username: string; password: string; display_name: string }) {
  return apiRequest<AuthResult>('/api/v1/auth/setup', { method: 'POST', body: JSON.stringify(input) });
}
export async function login(input: { username: string; password: string }) {
  return apiRequest<AuthResult>('/api/v1/auth/login', { method: 'POST', body: JSON.stringify(input) });
}

export async function getZatcaConfig(environment: 'sandbox' | 'production' = 'sandbox') {
  return apiRequest<ZatcaPublicConfig>(`/api/v1/zatca/config?environment=${environment}`);
}
export async function saveZatcaConfig(input: {
  environment: 'sandbox' | 'production'; company_name: string; vat_number: string; egs_unit: string;
  certificate_path?: string; private_key_path?: string; api_credential?: string;
}) {
  return apiRequest<ZatcaPublicConfig>('/api/v1/zatca/config', { method: 'PUT', body: JSON.stringify(input) });
}
export async function getHealth() {
  return apiRequest<{ status: string; database: string; integration_mode: string }>('/api/health');
}

export interface CatalogProduct {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: string;
  vat_rate: string;
  quantity: string;
  price_includes_vat: boolean;
  active: boolean;
}

export async function getProducts() {
  return apiRequest<CatalogProduct[]>('/api/v1/products');
}

export type CreateProductInput = Omit<CatalogProduct, 'id' | 'active'>;

export async function createProduct(input: CreateProductInput) {
  return apiRequest<CatalogProduct>('/api/v1/products', { method: 'POST', body: JSON.stringify(input) });
}

export interface CreateInvoiceInput {
  invoice_number: string;
  customer_name: string;
  invoice_type: 'simplified';
  lines: { product_id: string; quantity: string; discount_percent: string }[];
  payments: { method: 'cash' | 'card'; amount: string }[];
}

export interface SavedInvoice {
  id: string;
  invoice_number: string;
  status: string;
  subtotal: string;
  discount_total: string;
  taxable_subtotal: string;
  vat_total: string;
  total: string;
  amount_paid: string;
  change_due: string;
  currency: string;
  created_at: string;
}

export async function createInvoice(input: CreateInvoiceInput) {
  return apiRequest<SavedInvoice>('/api/v1/invoices', { method: 'POST', body: JSON.stringify(input) });
}

export async function getInvoices() {
  return apiRequest<SavedInvoice[]>('/api/v1/invoices');
}

export type ModuleName = 'restaurant' | 'crm' | 'hr';
export interface ModuleRecord {
  id: string;
  module: ModuleName;
  data: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export async function getModuleRecords(module: ModuleName) {
  return apiRequest<ModuleRecord[]>(`/api/v1/modules/${module}/records`);
}

export async function createModuleRecord(module: ModuleName, data: Record<string, unknown>) {
  return apiRequest<ModuleRecord>(`/api/v1/modules/${module}/records`, {
    method: 'POST', body: JSON.stringify({ data }),
  });
}

export async function updateModuleRecord(module: ModuleName, id: string, data: Record<string, unknown>) {
  return apiRequest<ModuleRecord>(`/api/v1/modules/${module}/records/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify({ data }),
  });
}
