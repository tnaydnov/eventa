/**
 * Invoice4U API Client (JSON REST)
 * 
 * Communicates with Invoice4U's WCF service via JSON webHttpBinding endpoints
 * for creating and managing Israeli tax documents (invoices, receipts, etc.).
 * 
 * All methods POST JSON to https://api.invoice4u.co.il/Services/ApiService.svc/{method}
 * 
 * Environment variables:
 *   INVOICE4U_API_TOKEN  - GUID token from Invoice4U Settings → API
 *   INVOICE4U_API_URL    - (optional) override for staging/testing
 */

import { logger } from './logger';
import { INVOICE4U_API_URL, INVOICE4U_API_TOKEN } from './config';

/* ════════════════════════════════════════════════════════
   Constants & Enums
   ════════════════════════════════════════════════════════ */

const PRODUCTION_URL = 'https://api.invoice4u.co.il/Services/ApiService.svc';
const STAGING_URL    = 'https://apiqa.invoice4u.co.il/Services/ApiService.svc';

const API_URL = INVOICE4U_API_URL;
const API_TOKEN = INVOICE4U_API_TOKEN;

/** Invoice4U DocumentType enum */
export enum DocumentType {
  Invoice        = 1,
  Receipt        = 2,
  InvoiceReceipt = 3,   // חשבונית מס / קבלה (most common for small biz)
  InvoiceCredit  = 4,   // חשבונית זיכוי (credit note)
  ProformaInvoice = 5,  // חשבונית עסקה
  InvoiceOrder   = 6,   // הזמנת עבודה
  InvoiceQuote   = 7,   // הצעת מחיר
  InvoiceShip    = 8,   // תעודת משלוח
  Deposits       = 9,   // קבלה על חשבון
}

/** Hebrew labels for document types */
export const DOCUMENT_TYPE_LABELS: Record<number, string> = {
  [DocumentType.Invoice]:        'חשבונית',
  [DocumentType.Receipt]:        'קבלה',
  [DocumentType.InvoiceReceipt]: 'חשבונית מס / קבלה',
  [DocumentType.InvoiceCredit]:  'חשבונית זיכוי',
  [DocumentType.ProformaInvoice]: 'חשבונית עסקה',
  [DocumentType.InvoiceOrder]:   'הזמנת עבודה',
  [DocumentType.InvoiceQuote]:   'הצעת מחיר',
  [DocumentType.InvoiceShip]:    'תעודת משלוח',
  [DocumentType.Deposits]:       'קבלה על חשבון',
};

/** Invoice4U PaymentType enum (for receipts) */
export enum PaymentType {
  CreditCard     = 1,
  Check          = 2,
  MoneyTransfer  = 3,
  Cash           = 4,
  Credit         = 5,
  Other          = 7,
  Bit            = 8,
  PayBox         = 9,
}

/** Map our PaymentMethod types to Invoice4U PaymentType */
export const PAYMENT_METHOD_TO_INVOICE4U: Record<string, PaymentType> = {
  bit:            PaymentType.Bit,
  paybox:         PaymentType.PayBox,
  cash:           PaymentType.Cash,
  bank_transfer:  PaymentType.MoneyTransfer,
  other:          PaymentType.Other,
};

/** Israeli VAT rate (18% from Jan 1, 2025) */
export const VAT_RATE = 0.18;

/* ════════════════════════════════════════════════════════
   Types
   ════════════════════════════════════════════════════════ */

export interface Invoice4UCustomer {
  ID?: number;
  Name: string;
  Phone?: string;
  Email?: string;
  City?: string;
  VATId?: string;         // ע.מ / ח.פ
}

export interface Invoice4UDocumentItem {
  Name: string;
  Price: number;           // unit price INCLUDING VAT
  Quantity: number;
  Description?: string;
  CurrencyCode?: string;   // default ILS
}

export interface Invoice4UPayment {
  PaymentType: PaymentType;
  Amount: number;
  Date?: string;           // ISO date
}

export interface CreateDocumentParams {
  docType: DocumentType;
  customer: Invoice4UCustomer;
  items: Invoice4UDocumentItem[];
  payments?: Invoice4UPayment[];       // required for receipts
  subject?: string;
  comments?: string;
  sendByEmail?: boolean;               // send copy to customer email
  discountPercent?: number;            // 0-100
  discountAmount?: number;             // flat discount in ILS
  originalDocId?: string;             // for credit notes - ref to original doc
}

export interface Invoice4UDocument {
  DocumentID: string;
  DocumentNumber: string;
  DocumentType: DocumentType;
  Total: number;
  VATAmount: number;
  CreatedDate: string;
  CustomerName: string;
  CustomerEmail: string;
  Subject: string;
  DocumentURL: string;
  Status: string;
}

export interface Invoice4UResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/* ════════════════════════════════════════════════════════
   JSON API Call Helper
   ──────────────────────────────────────────────────────
   All Invoice4U methods use the same WCF webHttpBinding
   JSON endpoint: POST ${baseUrl}/${methodName} with JSON body.
   Responses are wrapped in { d: {...} } by WCF.
   ════════════════════════════════════════════════════════ */

/** WCF DataContractJsonSerializer date format: /Date(ms)/ */
function wcfDate(d?: Date | string): string {
  const ms = d ? new Date(d).getTime() : Date.now();
  return `/Date(${ms})/`;
}

async function apiJsonCall<T>(method: string, body: Record<string, unknown>): Promise<T> {
  if (!API_TOKEN) {
    throw new Error('INVOICE4U_API_TOKEN environment variable is not set');
  }

  const url = `${API_URL}/${method}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    logger.error(`[Invoice4U] ${method} HTTP ${res.status}`, { body: text.slice(0, 500) });
    throw new Error(`Invoice4U API error: ${res.status} – ${text.slice(0, 300)}`);
  }

  const json = await res.json();
  // WCF JSON responses are wrapped in {"d": {...}} — unwrap automatically
  return (json.d ?? json) as T;
}

/* ════════════════════════════════════════════════════════
   API Methods
   ════════════════════════════════════════════════════════ */

/**
 * Check if the API token is valid.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const data = await apiJsonCall<Record<string, unknown>>('IsAuthenticated', {
      token: API_TOKEN,
    });
    // WCF returns the full User object when authenticated (not a boolean).
    // Check for a valid user ID or ApiActive flag.
    const id = Number(data.ID) || 0;
    const apiActive = data.ApiActive === true;
    return id > 0 || apiActive;
  } catch (err) {
    logger.error('[Invoice4U] IsAuthenticated failed', err);
    return false;
  }
}

/**
 * Create a customer in Invoice4U.
 */
export async function createCustomer(customer: Invoice4UCustomer): Promise<Invoice4UResult<number>> {
  try {
    const cu: Record<string, unknown> = {
      Name: customer.Name,
      Active: true,
    };
    if (customer.Phone) cu.Phone = customer.Phone;
    if (customer.Email) cu.Email = customer.Email;
    if (customer.City) cu.City = customer.City;
    if (customer.VATId) cu.UniqueID = customer.VATId;

    const data = await apiJsonCall<Record<string, unknown>>('CreateCustomer', {
      cu,
      token: API_TOKEN,
    });

    // Response: { CreateCustomerResult: { Response: { ID: ... }, Errors: [] } } or direct
    const result = (data.CreateCustomerResult ?? data) as Record<string, unknown>;
    const errors = result.Errors as Array<Record<string, string>> | null;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map(e => JSON.stringify(e)).join('; ') };
    }

    // Extract customer ID from response
    const response = result.Response as Record<string, unknown> | undefined;
    const id = (response?.ID as number) || (result.ID as number) || (data.ID as number);
    if (id && id > 0) {
      return { success: true, data: id };
    }
    return { success: false, error: 'Failed to create customer - no ID in response' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Search for existing customers by name.
 */
export async function getCustomers(searchTerm: string): Promise<Invoice4UResult<Invoice4UCustomer[]>> {
  try {
    const data = await apiJsonCall<Record<string, unknown>>('GetCustomers', {
      cust: { Name: searchTerm, Active: true },
      token: API_TOKEN,
    });

    // Response: { GetCustomersResult: { Response: [...], Errors: [] } } or direct
    const result = (data.GetCustomersResult ?? data) as Record<string, unknown>;
    const errors = result.Errors as Array<Record<string, string>> | null;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map(e => JSON.stringify(e)).join('; ') };
    }

    const response = result.Response as Array<Record<string, unknown>> | Record<string, unknown> | null;
    if (!response) return { success: true, data: [] };

    // Response could be array or object with Customer property
    let customerList: Array<Record<string, unknown>>;
    if (Array.isArray(response)) {
      customerList = response;
    } else {
      const inner = response.Customer;
      customerList = Array.isArray(inner) ? inner as Array<Record<string, unknown>> : inner ? [inner as Record<string, unknown>] : [];
    }

    const customers: Invoice4UCustomer[] = customerList.map(c => ({
      ID: (c.ID as number) || undefined,
      Name: String(c.Name || ''),
      Phone: c.Phone ? String(c.Phone) : undefined,
      Email: c.Email ? String(c.Email) : undefined,
      City: c.City ? String(c.City) : undefined,
      VATId: c.UniqueID ? String(c.UniqueID) : undefined,
    }));
    return { success: true, data: customers };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Get or create a customer by name + email.
 * Searches first, creates only if not found.
 */
export async function getOrCreateCustomer(customer: Invoice4UCustomer): Promise<Invoice4UResult<number>> {
  // Try searching by name first
  const search = await getCustomers(customer.Name);
  if (search.success && search.data?.length) {
    const match = search.data.find(c =>
      c.Name === customer.Name ||
      (customer.Email && c.Email === customer.Email)
    );
    if (match?.ID) return { success: true, data: match.ID };
  }
  // Not found - create new
  return createCustomer(customer);
}

/**
 * Create a document (invoice, receipt, credit note, etc.) in Invoice4U.
 */
export async function createDocument(params: CreateDocumentParams): Promise<Invoice4UResult<Invoice4UDocument>> {
  try {
    // Build items array
    const items = params.items.map(item => ({
      Name: item.Name,
      Price: item.Price,
      Quantity: item.Quantity,
      Code: '',
    }));

    // Build doc object matching official API structure
    const doc: Record<string, unknown> = {
      DocumentType: params.docType,
      Currency: 'ILS',
      TaxIncluded: true,
      TaxPercentage: VAT_RATE * 100,
      RoundAmount: 0,
      Items: items,
      ApiIdentifier: crypto.randomUUID(),
    };

    // Customer: use ClientID if available, otherwise GeneralCustomer
    if (params.customer.ID) {
      doc.ClientID = params.customer.ID;
    } else {
      doc.GeneralCustomer = {
        Name: params.customer.Name,
        Identifier: params.customer.VATId || params.customer.Phone || '000000000',
      };
    }

    // Payments (required for Receipt, InvoiceReceipt)
    if (params.payments?.length) {
      doc.Payments = params.payments.map(p => ({
        Amount: p.Amount,
        PaymentType: p.PaymentType,
        Date: wcfDate(p.Date),
      }));
    }

    if (params.subject) doc.Subject = params.subject;
    if (params.comments) doc.Comments = params.comments;

    // Only attach customer email when sendByEmail is explicitly true;
    // otherwise Invoice4U auto-sends its own receipt email.
    if (params.sendByEmail && params.customer.Email) {
      doc.AssociatedEmails = [{ Mail: params.customer.Email, IsUserMail: false }];
    }

    if (params.originalDocId) doc.OriginalDocumentID = params.originalDocId;

    const data = await apiJsonCall<Record<string, unknown>>('CreateDocument', {
      doc,
      token: API_TOKEN,
    });

    // Response: { CreateDocumentResult: { ID, DocumentNumber, Total, ... } } or direct
    const result = (data.CreateDocumentResult ?? data) as Record<string, unknown>;

    // Check for errors
    const errors = result.Errors as Array<Record<string, string>> | null;
    if (errors && errors.length > 0) {
      const errMsg = errors.map(e => JSON.stringify(e)).join('; ');
      return { success: false, error: errMsg };
    }

    const docId = String(result.ID || result.DocumentID || '');
    const docNumber = String(result.DocumentNumber || result.Number || '');

    if (!docId) {
      logger.warn('[Invoice4U] CreateDocument: no ID in response', { data: JSON.stringify(data).slice(0, 1000) });
      return { success: false, error: 'No document ID in Invoice4U response' };
    }

    return {
      success: true,
      data: {
        DocumentID: docId,
        DocumentNumber: docNumber,
        DocumentType: params.docType,
        Total: Number(result.Total) || 0,
        VATAmount: Number(result.TotalTaxAmount || result.VATAmount) || 0,
        CreatedDate: new Date().toISOString(),
        CustomerName: params.customer.Name,
        CustomerEmail: params.customer.Email || '',
        Subject: params.subject || '',
        DocumentURL: String(result.PrintOriginalPDFLink || result.DocumentURL || result.URL || ''),
        Status: 'active',
      },
    };
  } catch (err) {
    logger.error('[Invoice4U] CreateDocument failed', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get a specific document by its Invoice4U ID.
 */
export async function getDocument(docId: string): Promise<Invoice4UResult<Invoice4UDocument>> {
  try {
    const data = await apiJsonCall<Record<string, unknown>>('GetDocument', {
      docId,
      token: API_TOKEN,
    });

    const result = (data.GetDocumentResult ?? data) as Record<string, unknown>;
    const errors = result.Errors as Array<Record<string, string>> | null;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map(e => JSON.stringify(e)).join('; ') };
    }

    const id = String(result.ID || result.DocumentID || docId);
    const number = String(result.DocumentNumber || result.Number || '');
    const docType = Number(result.DocumentType) || 0;

    if (!number && !docType) {
      return { success: false, error: 'Document not found' };
    }

    return {
      success: true,
      data: {
        DocumentID: id,
        DocumentNumber: number,
        DocumentType: docType,
        Total: Number(result.Total) || 0,
        VATAmount: Number(result.TotalTaxAmount || result.VATAmount) || 0,
        CreatedDate: String(result.CreatedDate || result.IssueDate || ''),
        CustomerName: String(result.ClientName || result.CustomerName || ''),
        CustomerEmail: String(result.CustomerEmail || ''),
        Subject: String(result.Subject || ''),
        DocumentURL: String(result.PrintOriginalPDFLink || result.DocumentURL || result.URL || ''),
        Status: 'active',
      },
    };
  } catch (err) {
    logger.error('[Invoice4U] GetDocument failed', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get documents within a date range, optionally filtered by type.
 */
/**
 * Get documents, optionally filtered by type.
 */
export async function getDocuments(params: {
  fromDate: string;
  toDate: string;
  docType?: DocumentType;
  page?: number;
  pageSize?: number;
}): Promise<Invoice4UResult<Invoice4UDocument[]>> {
  try {
    const dr: Record<string, unknown> = {
      ReportType: 'Document',
    };
    if (params.docType != null) {
      dr.Type = params.docType;
    }

    const data = await apiJsonCall<Record<string, unknown>>('GetDocuments', {
      dr,
      token: API_TOKEN,
    });

    const result = (data.GetDocumentsResult ?? data) as Record<string, unknown>;
    const errors = result.Errors as Array<Record<string, string>> | null;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map(e => JSON.stringify(e)).join('; ') };
    }

    const response = result.Response as Array<Record<string, unknown>> | Record<string, unknown> | null;
    if (!response) return { success: true, data: [] };

    let docList: Array<Record<string, unknown>>;
    if (Array.isArray(response)) {
      docList = response;
    } else {
      const inner = response.Document;
      docList = Array.isArray(inner) ? inner as Array<Record<string, unknown>> : inner ? [inner as Record<string, unknown>] : [];
    }

    const docs: Invoice4UDocument[] = docList.map(dx => ({
      DocumentID: String(dx.ID || dx.DocumentID || ''),
      DocumentNumber: String(dx.DocumentNumber || dx.Number || ''),
      DocumentType: Number(dx.DocumentType) || 0,
      Total: Number(dx.Total) || 0,
      VATAmount: Number(dx.TotalTaxAmount || dx.VATAmount) || 0,
      CreatedDate: String(dx.CreatedDate || dx.IssueDate || ''),
      CustomerName: String(dx.ClientName || dx.CustomerName || ''),
      CustomerEmail: String(dx.CustomerEmail || ''),
      Subject: String(dx.Subject || ''),
      DocumentURL: String(dx.DocumentURL || dx.URL || ''),
      Status: 'active',
    }));

    return { success: true, data: docs };
  } catch (err) {
    logger.error('[Invoice4U] GetDocuments failed', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Create a credit note (חשבונית זיכוי) for an existing document.
 * This is how cancellations work in Invoice4U - you don't delete documents.
 */
export async function createCreditNote(params: {
  originalDocId: string;
  customer: Invoice4UCustomer;
  items: Invoice4UDocumentItem[];
  reason?: string;
  sendByEmail?: boolean;
}): Promise<Invoice4UResult<Invoice4UDocument>> {
  return createDocument({
    docType: DocumentType.InvoiceCredit,
    customer: params.customer,
    items: params.items,
    subject: params.reason || 'זיכוי',
    sendByEmail: params.sendByEmail ?? true,
    originalDocId: params.originalDocId,
  });
}

/**
 * Helper: Calculate prices with Israeli VAT.
 * @param priceBeforeVat - price before VAT
 * @returns { priceIncVat, vatAmount }
 */
export function calculateVAT(priceBeforeVat: number): { priceIncVat: number; vatAmount: number } {
  const vatAmount = Math.round(priceBeforeVat * VAT_RATE * 100) / 100;
  return {
    priceIncVat: Math.round((priceBeforeVat + vatAmount) * 100) / 100,
    vatAmount,
  };
}

/**
 * Helper: Extract price before VAT from a VAT-inclusive price.
 */
export function priceBeforeVAT(priceIncVat: number): { priceBeforeVat: number; vatAmount: number } {
  const priceBeforeVat = Math.round((priceIncVat / (1 + VAT_RATE)) * 100) / 100;
  const vatAmount = Math.round((priceIncVat - priceBeforeVat) * 100) / 100;
  return { priceBeforeVat, vatAmount };
}

/**
 * Check if Invoice4U integration is configured.
 */
export function isConfigured(): boolean {
  return !!API_TOKEN;
}

/**
 * Get display-friendly status about Invoice4U configuration.
 */
export function getConfigStatus(): {
  configured: boolean;
  environment: 'production' | 'staging' | 'custom';
  endpoint: string;
} {
  let environment: 'production' | 'staging' | 'custom' = 'production';
  if (API_URL === STAGING_URL) environment = 'staging';
  else if (API_URL !== PRODUCTION_URL) environment = 'custom';

  return {
    configured: !!API_TOKEN,
    environment,
    endpoint: API_URL,
  };
}

/* ════════════════════════════════════════════════════════
   Invoice4U Clearing API  (Payment Processing)
   ──────────────────────────────────────────────────────
   REST/JSON endpoints on the same WCF service.
   Used for card tokenisation (AddToken) and deferred
   charging (ChargeWithToken).
   ════════════════════════════════════════════════════════ */

/** Clearing type enum. */
export enum ClearingType {
  Regular        = 1,
  Payments       = 2,
  CreditPayments = 3,
  Refund         = 4,
}

/** Known Israeli clearing companies. */
export enum ClearingCompany {
  UPay       = 6,
  Meshulam   = 7,
  YaadSarig  = 12,
  Cardcom    = 15,
}

export interface ClearingSessionParams {
  /** Customer display name. */
  fullName: string;
  /** Customer phone. */
  phone: string;
  /** Customer email. */
  email: string;
  /** Amount in ILS (e.g. 250). */
  sum: number;
  /** Short description shown on the payment page. */
  description: string;
  /** Our internal order reference (stored with the clearing log). */
  orderId?: string;
  /** URL the iframe redirects to after completion. */
  returnUrl: string;
  /** URL to redirect on cancel/back (optional). */
  cancelUrl?: string;
  /** Whether to tokenise only (true) or tokenise + charge immediately. */
  tokenOnly?: boolean;
  /** Clearing company override (leave undefined to use account default). */
  clearingCompany?: ClearingCompany;
  /** Document language - 'he' (default) or 'en'. */
  language?: 'he' | 'en';
  /** Skip auto-document creation (we'll create it manually in the callback). */
  skipDocument?: boolean;
  /** Manual item breakdown - names separated by |. */
  docItemNames?: string;
  /** Manual item breakdown - quantities separated by |. */
  docItemQuantities?: string;
  /** Manual item breakdown - prices separated by |. */
  docItemPrices?: string;
  /** Document headline / subject. */
  docHeadline?: string;
}

export interface ClearingSessionResult {
  /** URL to load inside an iframe for the customer to enter card details. */
  clearingRedirectUrl: string;
  /** Invoice4U customer ID (auto-created if needed). */
  customerId: number | null;
  /** Payment ID assigned by Invoice4U. */
  paymentId: string | null;
  /** Clearing log ID. */
  clearingLogId: string | null;
  /** Clearing trace ID. */
  clearingTraceId: string | null;
}

export interface ChargeTokenParams {
  /** Invoice4U customer ID (from the tokenisation response). */
  customerId: number;
  /** Amount to charge in ILS. */
  sum: number;
  /** Short description. */
  description: string;
  /** Our internal order reference. */
  orderId?: string;
  /** Whether to also create an Invoice4U document (receipt). */
  createDocument?: boolean;
  /** Document headline / subject. */
  docHeadline?: string;
  /** Document comments. */
  docComments?: string;
  /** Manual item breakdown - names separated by |. */
  docItemNames?: string;
  /** Manual item breakdown - quantities separated by |. */
  docItemQuantities?: string;
  /** Manual item breakdown - prices separated by |. */
  docItemPrices?: string;
  /** Manual item breakdown - tax rates separated by |. */
  docItemTaxRates?: string;
  /** Document language - 'he' (default) or 'en'. */
  language?: 'he' | 'en';
}

export interface ChargeTokenResult {
  /** Whether the charge was successful. */
  success: boolean;
  /** Payment ID. */
  paymentId: string | null;
  /** Clearing log ID. */
  clearingLogId: string | null;
  /** Clearing trace ID. */
  clearingTraceId: string | null;
  /** Error message if failed. */
  error?: string;
}

export interface ClearingLog {
  id: number;
  amount: number;
  isSuccess: boolean;
  paymentId: string;
  clearingTraceId: string;
  clearingConfirmationNumber: string;
  clientName: string;
  clearingCompanyName: string;
  errorMessage: string;
  isToken: boolean;
  isDocumentCreated: boolean;
  docId: string | null;
  date: string;
}

/* ── Generic JSON call helper ─────────────────────────── */

// Reuses apiJsonCall — identical WCF webHttpBinding JSON pattern
const clearingJsonCall = apiJsonCall;

/* ── Helper: extract values from OpenInfo array ───────── */

function openInfoValue(
  arr: Array<{ Key: string; Value: string }> | null | undefined,
  key: string,
): string | null {
  if (!arr) return null;
  const entry = arr.find(e => e.Key === key);
  return entry?.Value ?? null;
}

/**
 * Create a clearing session.
 *
 * Two modes:
 *   tokenOnly=true  → card is saved, no charge (call chargeWithToken later)
 *   tokenOnly=false → card is charged immediately during the session
 *
 * Returns a URL to embed in an iframe; the customer fills in card details.
 */
export async function createClearingSession(
  params: ClearingSessionParams,
): Promise<Invoice4UResult<ClearingSessionResult>> {
  try {
    const tokenOnly = params.tokenOnly ?? false;
    const isManual = !!(params.docItemNames && params.docItemPrices);

    const request: Record<string, unknown> = {
      Invoice4UUserApiKey: API_TOKEN,
      Type: String(ClearingType.Regular),
      FullName: params.fullName,
      Phone: params.phone,
      Email: params.email,
      Sum: String(params.sum),
      Description: params.description,
      PaymentsNum: '1',
      Currency: 'ILS',
      OrderIdClientUsage: params.orderId || '',
      IsDocCreate: (tokenOnly || params.skipDocument) ? 'false' : 'true',
      IsGeneralClient: 'false',
      IsAutoCreateCustomer: 'true',
      ReturnUrl: params.returnUrl,
      AddToken: tokenOnly ? 'true' : 'false',
      AddTokenAndCharge: 'false',
      ChargeWithToken: 'false',
      Refund: 'false',
      IsStandingOrderClearance: 'false',
      StandingOrderDuration: '0',
      DocLanguage: params.language || 'he',
      IsManualDocCreationsWithParams: isManual ? 'true' : 'false',
    };

    if (params.cancelUrl) {
      request.CancelUrl = params.cancelUrl;
    }

    if (params.docHeadline) {
      request.DocHeadline = params.docHeadline;
    }

    if (isManual) {
      request.DocItemName = params.docItemNames;
      request.DocItemQuantity = params.docItemQuantities || '1';
      request.DocItemPrice = params.docItemPrices;
      request.DocItemTaxRate = String(VAT_RATE * 100);
      request.IsItemsBase64Encoded = 'false';
    }

    if (params.clearingCompany) {
      request.CreditCardCompanyType = String(params.clearingCompany);
    }

    const data = await clearingJsonCall<Record<string, unknown>>(
      'ProcessApiRequestV2',
      { request },
    );

    // Check for errors
    const errors = data.Errors as Array<{ Key: string; Value: string }> | null;
    if (errors && errors.length > 0) {
      const errMsg = errors.map(e => `${e.Key}: ${e.Value}`).join('; ');
      logger.error('[Invoice4U Clearing] session errors', { errors: errMsg });
      return { success: false, error: errMsg };
    }

    const redirectUrl = data.ClearingRedirectUrl as string | undefined;
    if (!redirectUrl) {
      return { success: false, error: 'No ClearingRedirectUrl in response' };
    }

    const openInfo = data.OpenInfo as Array<{ Key: string; Value: string }> | undefined;

    return {
      success: true,
      data: {
        clearingRedirectUrl: redirectUrl,
        customerId: (data.CustomerId as number) || null,
        paymentId: openInfoValue(openInfo, 'PaymentId'),
        clearingLogId: openInfoValue(openInfo, 'I4UClearingLogId'),
        clearingTraceId: openInfoValue(openInfo, 'ClearingTraceId'),
      },
    };
  } catch (err) {
    logger.error('[Invoice4U Clearing] createClearingSession failed', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Charge a previously tokenised card.
 * Call this when the admin approves an order whose card was captured.
 *
 * Optionally creates an Invoice4U document (receipt) in the same call.
 */
export async function chargeWithToken(
  params: ChargeTokenParams,
): Promise<Invoice4UResult<ChargeTokenResult>> {
  try {
    const isManual = !!(params.docItemNames && params.docItemPrices);

    const request: Record<string, unknown> = {
      Invoice4UUserApiKey: API_TOKEN,
      Type: String(ClearingType.Regular),
      CustomerId: String(params.customerId),
      Sum: String(params.sum),
      Description: params.description,
      PaymentsNum: '1',
      Currency: 'ILS',
      OrderIdClientUsage: params.orderId || '',
      IsDocCreate: params.createDocument ? 'true' : 'false',
      DocHeadline: params.docHeadline || params.description,
      DocComments: params.docComments || '',
      IsGeneralClient: 'false',
      IsAutoCreateCustomer: 'false',
      ReturnUrl: '',
      AddToken: 'false',
      AddTokenAndCharge: 'false',
      ChargeWithToken: 'true',
      Refund: 'false',
      IsStandingOrderClearance: 'false',
      StandingOrderDuration: '0',
      DocLanguage: params.language || 'he',
      IsManualDocCreationsWithParams: isManual ? 'true' : 'false',
    };

    if (isManual) {
      request.DocItemName = params.docItemNames;
      request.DocItemQuantity = params.docItemQuantities || '1';
      request.DocItemPrice = params.docItemPrices;
      request.DocItemTaxRate = params.docItemTaxRates || String(VAT_RATE * 100);
      request.IsItemsBase64Encoded = 'false';
    }

    const data = await clearingJsonCall<Record<string, unknown>>(
      'ProcessApiRequestV2',
      { request },
    );

    // Check for errors
    const errors = data.Errors as Array<{ Key: string; Value: string }> | null;
    if (errors && errors.length > 0) {
      const errMsg = errors.map(e => `${e.Key}: ${e.Value}`).join('; ');
      logger.error('[Invoice4U Clearing] chargeWithToken errors', { errors: errMsg });
      return {
        success: true,
        data: { success: false, paymentId: null, clearingLogId: null, clearingTraceId: null, error: errMsg },
      };
    }

    const openInfo = data.OpenInfo as Array<{ Key: string; Value: string }> | undefined;

    return {
      success: true,
      data: {
        success: true,
        paymentId: openInfoValue(openInfo, 'PaymentId'),
        clearingLogId: openInfoValue(openInfo, 'I4UClearingLogId'),
        clearingTraceId: openInfoValue(openInfo, 'ClearingTraceId'),
      },
    };
  } catch (err) {
    logger.error('[Invoice4U Clearing] chargeWithToken failed', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get clearing log details by log ID.
 * Used to verify card tokenisation / charge status.
 */
export async function getClearingLogById(
  clearingLogId: string,
): Promise<Invoice4UResult<ClearingLog>> {
  try {
    const data = await clearingJsonCall<Record<string, unknown>>(
      'GetClearingLogById',
      { clearingLogId, token: API_TOKEN },
    );

    const errors = data.Errors as Array<{ Key: string; Value: string }> | null;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map(e => `${e.Key}: ${e.Value}`).join('; ') };
    }

    return {
      success: true,
      data: {
        id: (data.Id as number) || 0,
        amount: (data.Amount as number) || 0,
        isSuccess: (data.IsSuccess as boolean) ?? false,
        paymentId: String(data.PaymentId || ''),
        clearingTraceId: String(data.ClearingTraceId || ''),
        clearingConfirmationNumber: String(data.ClearingConfirmationNumber || ''),
        clientName: String(data.ClientName || ''),
        clearingCompanyName: String(data.ClearingCompanyName || ''),
        errorMessage: String(data.ErrorMessage || ''),
        isToken: (data.IsToken as boolean) ?? false,
        isDocumentCreated: (data.IsDocumentCreated as boolean) ?? false,
        docId: data.DocId ? String(data.DocId) : null,
        date: String(data.Date || ''),
      },
    };
  } catch (err) {
    logger.error('[Invoice4U Clearing] getClearingLogById failed', err);
    return { success: false, error: String(err) };
  }
}

/**
 * Get clearing log details by search parameters.
 */
export async function getClearingLogByParams(params: {
  paymentId?: string;
  fromAmount?: number;
  toAmount?: number;
  isSuccess?: boolean;
}): Promise<Invoice4UResult<ClearingLog>> {
  try {
    const searchParams: Record<string, unknown> = {};
    if (params.paymentId) searchParams.PaymentId = params.paymentId;
    if (params.fromAmount != null) searchParams.FromAmount = params.fromAmount;
    if (params.toAmount != null) searchParams.ToAmount = params.toAmount;
    if (params.isSuccess != null) searchParams.IsSuccess = params.isSuccess;

    const data = await clearingJsonCall<Record<string, unknown>>(
      'GetClearingLogByParams',
      { searchParams, token: API_TOKEN },
    );

    const errors = data.Errors as Array<{ Key: string; Value: string }> | null;
    if (errors && errors.length > 0) {
      return { success: false, error: errors.map(e => `${e.Key}: ${e.Value}`).join('; ') };
    }

    return {
      success: true,
      data: {
        id: (data.Id as number) || 0,
        amount: (data.Amount as number) || 0,
        isSuccess: (data.IsSuccess as boolean) ?? false,
        paymentId: String(data.PaymentId || ''),
        clearingTraceId: String(data.ClearingTraceId || ''),
        clearingConfirmationNumber: String(data.ClearingConfirmationNumber || ''),
        clientName: String(data.ClientName || ''),
        clearingCompanyName: String(data.ClearingCompanyName || ''),
        errorMessage: String(data.ErrorMessage || ''),
        isToken: (data.IsToken as boolean) ?? false,
        isDocumentCreated: (data.IsDocumentCreated as boolean) ?? false,
        docId: data.DocId ? String(data.DocId) : null,
        date: String(data.Date || ''),
      },
    };
  } catch (err) {
    logger.error('[Invoice4U Clearing] getClearingLogByParams failed', err);
    return { success: false, error: String(err) };
  }
}
