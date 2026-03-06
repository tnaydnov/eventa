/**
 * Invoice4U SOAP API Client
 * 
 * Communicates with Invoice4U's WCF/SOAP service for creating and managing
 * Israeli tax documents (invoices, receipts, credit notes, etc.).
 * 
 * Uses raw fetch + XML envelopes - no external SOAP library needed.
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
   SOAP Envelope Builder
   ════════════════════════════════════════════════════════ */

const SOAP_NS = 'http://schemas.xmlsoap.org/soap/envelope/';
const SERVICE_NS = 'http://tempuri.org/';
const TYPES_NS = 'http://schemas.datacontract.org/2004/07/InvoiceAPI';
const ARRAYS_NS = 'http://schemas.microsoft.com/2003/10/Serialization/Arrays';

function buildSoapEnvelope(action: string, bodyXml: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="${SOAP_NS}">
  <s:Header>
    <Action s:mustUnderstand="1" xmlns="http://schemas.microsoft.com/ws/2005/05/addressing/none">${SERVICE_NS}IApiService/${action}</Action>
  </s:Header>
  <s:Body>
    ${bodyXml}
  </s:Body>
</s:Envelope>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function formatDate(date?: string | Date): string {
  const d = date ? new Date(date) : new Date();
  return d.toISOString();
}

/* ════════════════════════════════════════════════════════
   Core SOAP Call
   ════════════════════════════════════════════════════════ */

async function soapCall(action: string, bodyXml: string): Promise<string> {
  if (!API_TOKEN) {
    throw new Error('INVOICE4U_API_TOKEN environment variable is not set');
  }

  const envelope = buildSoapEnvelope(action, bodyXml);

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${SERVICE_NS}IApiService/${action}`,
    },
    body: envelope,
  });

  if (!response.ok) {
    const text = await response.text();
    logger.error(`[Invoice4U] SOAP ${action} failed: ${response.status}`, { body: text.slice(0, 500) });
    throw new Error(`Invoice4U API error: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

/** Exposed for diagnostics — build + send a SOAP call and return raw XML. */
export async function soapCallRaw(action: string, bodyXml: string): Promise<{ status: number; xml: string; envelope: string }> {
  const envelope = buildSoapEnvelope(action, bodyXml);
  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'text/xml; charset=utf-8',
      'SOAPAction': `${SERVICE_NS}IApiService/${action}`,
    },
    body: envelope,
  });
  const xml = await response.text();
  return { status: response.status, xml, envelope };
}

/* ════════════════════════════════════════════════════════
   XML Parsing Helpers
   ════════════════════════════════════════════════════════ */

/** Extract text content from a simple XML tag */
function extractTag(xml: string, tag: string): string {
  // Handles both namespaced (a:Tag) and plain (Tag) tags
  const patterns = [
    new RegExp(`<(?:[a-z]:)?${tag}[^>]*>([^<]*)<\\/(?:[a-z]:)?${tag}>`, 'i'),
    new RegExp(`<${tag}[^>]*>([^<]*)<\\/${tag}>`, 'i'),
  ];
  for (const re of patterns) {
    const m = xml.match(re);
    if (m) return m[1];
  }
  return '';
}

/** Extract boolean value from XML tag */
function extractBool(xml: string, tag: string): boolean {
  return extractTag(xml, tag).toLowerCase() === 'true';
}

/** Extract all occurrences of a repeating element */
function extractAll(xml: string, tag: string): string[] {
  const re = new RegExp(`<(?:[a-z]:)?${tag}[^>]*>([\\s\\S]*?)<\\/(?:[a-z]:)?${tag}>`, 'gi');
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/* ════════════════════════════════════════════════════════
   API Methods
   ════════════════════════════════════════════════════════ */

/**
 * Check if the API token is valid.
 */
export async function isAuthenticated(): Promise<boolean> {
  try {
    const body = `<IsAuthenticated xmlns="${SERVICE_NS}">
      <token>${escapeXml(API_TOKEN)}</token>
    </IsAuthenticated>`;
    const xml = await soapCall('IsAuthenticated', body);
    return extractBool(xml, 'IsAuthenticatedResult');
  } catch (err) {
    logger.error('[Invoice4U] IsAuthenticated failed', err);
    return false;
  }
}

/**
 * Create or update a customer in Invoice4U.
 */
export async function createCustomer(customer: Invoice4UCustomer): Promise<Invoice4UResult<number>> {
  try {
    const body = `<CreateOrUpdateCustomer xmlns="${SERVICE_NS}">
      <token>${escapeXml(API_TOKEN)}</token>
      <customer xmlns:a="${TYPES_NS}">
        ${customer.ID ? `<a:ID>${customer.ID}</a:ID>` : ''}
        <a:Name>${escapeXml(customer.Name)}</a:Name>
        ${customer.Phone ? `<a:Phone>${escapeXml(customer.Phone)}</a:Phone>` : ''}
        ${customer.Email ? `<a:Email>${escapeXml(customer.Email)}</a:Email>` : ''}
        ${customer.City ? `<a:City>${escapeXml(customer.City)}</a:City>` : ''}
        ${customer.VATId ? `<a:VATId>${escapeXml(customer.VATId)}</a:VATId>` : ''}
      </customer>
    </CreateOrUpdateCustomer>`;
    const xml = await soapCall('CreateOrUpdateCustomer', body);
    const id = parseInt(extractTag(xml, 'CreateOrUpdateCustomerResult'), 10);
    if (id > 0) {
      return { success: true, data: id };
    }
    return { success: false, error: 'Failed to create customer - invalid response' };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Search for an existing customer by name or email.
 */
export async function getCustomers(searchTerm: string): Promise<Invoice4UResult<Invoice4UCustomer[]>> {
  try {
    const body = `<GetCustomers xmlns="${SERVICE_NS}">
      <token>${escapeXml(API_TOKEN)}</token>
      <searchText>${escapeXml(searchTerm)}</searchText>
    </GetCustomers>`;
    const xml = await soapCall('GetCustomers', body);
    const customerElements = extractAll(xml, 'Customer');
    const customers: Invoice4UCustomer[] = customerElements.map(cx => ({
      ID: parseInt(extractTag(cx, 'ID'), 10) || undefined,
      Name: extractTag(cx, 'Name'),
      Phone: extractTag(cx, 'Phone') || undefined,
      Email: extractTag(cx, 'Email') || undefined,
      City: extractTag(cx, 'City') || undefined,
      VATId: extractTag(cx, 'VATId') || undefined,
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
    // Build items XML
    const itemsXml = params.items.map(item => `
      <a:DocumentItem>
        <a:Name>${escapeXml(item.Name)}</a:Name>
        <a:Price>${item.Price}</a:Price>
        <a:Quantity>${item.Quantity}</a:Quantity>
        ${item.Description ? `<a:Description>${escapeXml(item.Description)}</a:Description>` : ''}
        <a:CurrencyCode>${item.CurrencyCode || 'ILS'}</a:CurrencyCode>
      </a:DocumentItem>
    `).join('');

    // Build payments XML (required for receipts, InvoiceReceipt)
    let paymentsXml = '';
    if (params.payments?.length) {
      paymentsXml = `<a:PaymentInfoList>
        ${params.payments.map(p => `
          <a:PaymentInfo>
            <a:PaymentType>${p.PaymentType}</a:PaymentType>
            <a:Amount>${p.Amount}</a:Amount>
            <a:Date>${formatDate(p.Date)}</a:Date>
          </a:PaymentInfo>
        `).join('')}
      </a:PaymentInfoList>`;
    }

    // Build customer XML
    const custXml = `<a:Customer>
      ${params.customer.ID ? `<a:ID>${params.customer.ID}</a:ID>` : ''}
      <a:Name>${escapeXml(params.customer.Name)}</a:Name>
      ${params.customer.Phone ? `<a:Phone>${escapeXml(params.customer.Phone)}</a:Phone>` : ''}
      ${params.customer.Email ? `<a:Email>${escapeXml(params.customer.Email)}</a:Email>` : ''}
      ${params.customer.VATId ? `<a:VATId>${escapeXml(params.customer.VATId)}</a:VATId>` : ''}
    </a:Customer>`;

    const body = `<CreateDocument xmlns="${SERVICE_NS}">
      <token>${escapeXml(API_TOKEN)}</token>
      <doc xmlns:a="${TYPES_NS}">
        <a:DocumentType>${params.docType}</a:DocumentType>
        ${custXml}
        <a:Items>${itemsXml}</a:Items>
        ${paymentsXml}
        ${params.subject ? `<a:Subject>${escapeXml(params.subject)}</a:Subject>` : ''}
        ${params.comments ? `<a:Comments>${escapeXml(params.comments)}</a:Comments>` : ''}
        <a:SendByEmail>${params.sendByEmail ? 'true' : 'false'}</a:SendByEmail>
        ${params.discountPercent ? `<a:DiscountPercent>${params.discountPercent}</a:DiscountPercent>` : ''}
        ${params.discountAmount ? `<a:DiscountAmount>${params.discountAmount}</a:DiscountAmount>` : ''}
        ${params.originalDocId ? `<a:OriginalDocumentID>${escapeXml(params.originalDocId)}</a:OriginalDocumentID>` : ''}
      </doc>
    </CreateDocument>`;

    const xml = await soapCall('CreateDocument', body);

    // Parse response
    const docId = extractTag(xml, 'DocumentID') || extractTag(xml, 'ID');
    const docNumber = extractTag(xml, 'DocumentNumber') || extractTag(xml, 'Number');
    const totalStr = extractTag(xml, 'Total');
    const vatStr = extractTag(xml, 'VATAmount');
    const docUrl = extractTag(xml, 'DocumentURL') || extractTag(xml, 'URL');
    const error = extractTag(xml, 'Error') || extractTag(xml, 'ErrorMessage');

    if (error) {
      return { success: false, error };
    }

    if (!docId) {
      // Try alternate response structure
      const resultXml = extractTag(xml, 'CreateDocumentResult');
      if (resultXml) {
        const innerDocId = extractTag(resultXml, 'DocumentID') || extractTag(resultXml, 'ID');
        if (innerDocId) {
          return {
            success: true,
            data: {
              DocumentID: innerDocId,
              DocumentNumber: extractTag(resultXml, 'DocumentNumber') || '',
              DocumentType: params.docType,
              Total: parseFloat(extractTag(resultXml, 'Total')) || 0,
              VATAmount: parseFloat(extractTag(resultXml, 'VATAmount')) || 0,
              CreatedDate: new Date().toISOString(),
              CustomerName: params.customer.Name,
              CustomerEmail: params.customer.Email || '',
              Subject: params.subject || '',
              DocumentURL: extractTag(resultXml, 'DocumentURL') || '',
              Status: 'active',
            },
          };
        }
      }
      return { success: false, error: 'No document ID in Invoice4U response' };
    }

    return {
      success: true,
      data: {
        DocumentID: docId,
        DocumentNumber: docNumber,
        DocumentType: params.docType,
        Total: parseFloat(totalStr) || 0,
        VATAmount: parseFloat(vatStr) || 0,
        CreatedDate: new Date().toISOString(),
        CustomerName: params.customer.Name,
        CustomerEmail: params.customer.Email || '',
        Subject: params.subject || '',
        DocumentURL: docUrl,
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
    const body = `<GetDocumentByID xmlns="${SERVICE_NS}">
      <token>${escapeXml(API_TOKEN)}</token>
      <documentID>${escapeXml(docId)}</documentID>
    </GetDocumentByID>`;
    const xml = await soapCall('GetDocumentByID', body);

    const number = extractTag(xml, 'DocumentNumber') || extractTag(xml, 'Number');
    const docType = parseInt(extractTag(xml, 'DocumentType'), 10);

    if (!number && !docType) {
      return { success: false, error: 'Document not found' };
    }

    return {
      success: true,
      data: {
        DocumentID: docId,
        DocumentNumber: number,
        DocumentType: docType || 0,
        Total: parseFloat(extractTag(xml, 'Total')) || 0,
        VATAmount: parseFloat(extractTag(xml, 'VATAmount')) || 0,
        CreatedDate: extractTag(xml, 'CreatedDate') || '',
        CustomerName: extractTag(xml, 'CustomerName') || extractTag(xml, 'Name') || '',
        CustomerEmail: extractTag(xml, 'CustomerEmail') || extractTag(xml, 'Email') || '',
        Subject: extractTag(xml, 'Subject') || '',
        DocumentURL: extractTag(xml, 'DocumentURL') || extractTag(xml, 'URL') || '',
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
export async function getDocuments(params: {
  fromDate: string;
  toDate: string;
  docType?: DocumentType;
  page?: number;
  pageSize?: number;
}): Promise<Invoice4UResult<Invoice4UDocument[]>> {
  try {
    const body = `<GetDocuments xmlns="${SERVICE_NS}">
      <token>${escapeXml(API_TOKEN)}</token>
      <fromDate>${formatDate(params.fromDate)}</fromDate>
      <toDate>${formatDate(params.toDate)}</toDate>
      ${params.docType != null ? `<documentType>${params.docType}</documentType>` : ''}
      <pageNumber>${params.page ?? 1}</pageNumber>
      <numOfRecordsInAPage>${params.pageSize ?? 50}</numOfRecordsInAPage>
    </GetDocuments>`;
    const xml = await soapCall('GetDocuments', body);

    const docElements = extractAll(xml, 'Document');
    if (!docElements.length) {
      // Try alternate structure
      const resultElements = extractAll(xml, 'DocumentInfo');
      if (resultElements.length) {
        const docs: Invoice4UDocument[] = resultElements.map(dx => ({
          DocumentID: extractTag(dx, 'DocumentID') || extractTag(dx, 'ID') || '',
          DocumentNumber: extractTag(dx, 'DocumentNumber') || extractTag(dx, 'Number') || '',
          DocumentType: parseInt(extractTag(dx, 'DocumentType'), 10) || 0,
          Total: parseFloat(extractTag(dx, 'Total')) || 0,
          VATAmount: parseFloat(extractTag(dx, 'VATAmount')) || 0,
          CreatedDate: extractTag(dx, 'CreatedDate') || '',
          CustomerName: extractTag(dx, 'CustomerName') || extractTag(dx, 'Name') || '',
          CustomerEmail: extractTag(dx, 'CustomerEmail') || extractTag(dx, 'Email') || '',
          Subject: extractTag(dx, 'Subject') || '',
          DocumentURL: extractTag(dx, 'DocumentURL') || extractTag(dx, 'URL') || '',
          Status: 'active',
        }));
        return { success: true, data: docs };
      }
      return { success: true, data: [] };
    }

    const docs: Invoice4UDocument[] = docElements.map(dx => ({
      DocumentID: extractTag(dx, 'DocumentID') || extractTag(dx, 'ID') || '',
      DocumentNumber: extractTag(dx, 'DocumentNumber') || extractTag(dx, 'Number') || '',
      DocumentType: parseInt(extractTag(dx, 'DocumentType'), 10) || 0,
      Total: parseFloat(extractTag(dx, 'Total')) || 0,
      VATAmount: parseFloat(extractTag(dx, 'VATAmount')) || 0,
      CreatedDate: extractTag(dx, 'CreatedDate') || '',
      CustomerName: extractTag(dx, 'CustomerName') || extractTag(dx, 'Name') || '',
      CustomerEmail: extractTag(dx, 'CustomerEmail') || extractTag(dx, 'Email') || '',
      Subject: extractTag(dx, 'Subject') || '',
      DocumentURL: extractTag(dx, 'DocumentURL') || extractTag(dx, 'URL') || '',
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

async function clearingJsonCall<T>(method: string, body: Record<string, unknown>): Promise<T> {
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
    logger.error(`[Invoice4U Clearing] ${method} HTTP ${res.status}`, { body: text.slice(0, 500) });
    throw new Error(`Invoice4U Clearing API error: ${res.status}`);
  }

  const json = await res.json();
  // WCF JSON responses are wrapped in {"d": {...}} — unwrap automatically
  return (json.d ?? json) as T;
}

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
