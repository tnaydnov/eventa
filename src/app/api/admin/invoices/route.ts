import { NextRequest, NextResponse } from 'next/server';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { getServiceClient } from '@/lib/supabase';
import { adminGuard, jsonError } from '../_helpers';
import { logger } from '@/lib/logger';
import { adminAuditLog } from '@/lib/admin-auth';
import {
  createDocument,
  createCreditNote,
  getDocuments,
  getOrCreateCustomer,
  isAuthenticated,
  isConfigured,
  getConfigStatus,
  DocumentType,
  DOCUMENT_TYPE_LABELS,
  type CreateDocumentParams,
  type Invoice4UCustomer,
} from '@/lib/invoice4u';

/**
 * GET /api/admin/invoices
 * 
 * Query parameters:
 *   ?action=status       - Check Invoice4U configuration status
 *   ?action=documents    - Fetch documents from Invoice4U (requires fromDate, toDate)
 *   ?action=local        - Fetch locally stored invoices from DB
 *   ?action=summary      - Get payment summary stats
 */
export async function GET(req: NextRequest) {
  const denied = adminGuard(req, 'admin-invoices-get', RATE_LIMITS.standard);
  if (denied) return denied;

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'summary';

  try {
    switch (action) {
      case 'status':
        return handleGetStatus();
      case 'documents':
        return handleGetDocuments(url);
      case 'local':
        return handleGetLocalInvoices(url);
      case 'summary':
        return handleGetSummary();
      default:
        return jsonError('Invalid action', 400);
    }
  } catch (err) {
    logger.error('[ADMIN_INVOICES_GET] error:', err);
    return jsonError('Internal server error', 500);
  }
}

/**
 * POST /api/admin/invoices
 * 
 * Body:
 *   { action: 'create_document', ... }  - Create a new Invoice4U document
 *   { action: 'credit_note', ... }      - Create a credit note for an existing document
 *   { action: 'verify_auth' }           - Verify Invoice4U API token
 */
export async function POST(req: NextRequest) {
  const denied = adminGuard(req, 'admin-invoices-post', RATE_LIMITS.standard);
  if (denied) return denied;

  try {
    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'create_document':
        return handleCreateDocument(body, req);
      case 'credit_note':
        return handleCreditNote(body, req);
      case 'verify_auth':
        return handleVerifyAuth();
      default:
        return jsonError('Invalid action', 400);
    }
  } catch (err) {
    logger.error('[ADMIN_INVOICES_POST] error:', err);
    return jsonError('Internal server error', 500);
  }
}

/* ────────────────────────────────
   GET Handlers
   ──────────────────────────────── */

async function handleGetStatus() {
  const config = getConfigStatus();
  return NextResponse.json({
    configured: config.configured,
    environment: config.environment,
    endpoint: config.endpoint,
  });
}

async function handleGetDocuments(url: URL) {
  if (!isConfigured()) {
    return jsonError('Invoice4U is not configured', 400);
  }

  const fromDate = url.searchParams.get('fromDate');
  const toDate = url.searchParams.get('toDate');
  const docTypeParam = url.searchParams.get('docType');
  const page = parseInt(url.searchParams.get('page') || '1', 10);

  if (!fromDate || !toDate) {
    return jsonError('fromDate and toDate are required', 400);
  }

  const result = await getDocuments({
    fromDate,
    toDate,
    docType: docTypeParam ? parseInt(docTypeParam, 10) : undefined,
    page,
    pageSize: 50,
  });

  if (!result.success) {
    return jsonError(result.error || 'Failed to fetch documents', 500);
  }

  return NextResponse.json({ documents: result.data || [] });
}

async function handleGetLocalInvoices(url: URL) {
  const supabase = getServiceClient();
  const requestId = url.searchParams.get('requestId');
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);

  let query = supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (requestId) {
    query = query.eq('event_request_id', requestId);
  }

  const { data, error } = await query;
  if (error) {
    logger.error('[ADMIN_INVOICES] local query failed:', error.message);
    return jsonError('Failed to load invoices', 500);
  }

  return NextResponse.json({ invoices: data || [] });
}

async function handleGetSummary() {
  const supabase = getServiceClient();

  // Get payment stats from event_requests
  const { data: requests, error } = await supabase
    .from('event_requests')
    .select('id, status, payment_status, payment_method, total_price, paid_at, created_at');

  if (error) {
    logger.error('[ADMIN_INVOICES] summary query failed:', error.message);
    return jsonError('Failed to load summary', 500);
  }

  const rows = requests || [];

  // Calculate summary
  const totalRevenue = rows
    .filter(r => r.payment_status === 'paid')
    .reduce((sum, r) => sum + (r.total_price || 0), 0);

  const pendingRevenue = rows
    .filter(r => ['pending_payment', 'payment_link_sent'].includes(r.payment_status))
    .reduce((sum, r) => sum + (r.total_price || 0), 0);

  const statusCounts: Record<string, number> = {};
  for (const r of rows) {
    statusCounts[r.payment_status] = (statusCounts[r.payment_status] || 0) + 1;
  }

  const methodCounts: Record<string, number> = {};
  for (const r of rows) {
    if (r.payment_method) {
      methodCounts[r.payment_method] = (methodCounts[r.payment_method] || 0) + 1;
    }
  }

  // Get invoice count from local invoices table
  const { count: invoiceCount } = await supabase
    .from('invoices')
    .select('id', { count: 'exact', head: true });

  // Get recent invoices
  const { data: recentInvoices } = await supabase
    .from('invoices')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  return NextResponse.json({
    summary: {
      totalRevenue,
      pendingRevenue,
      totalRequests: rows.length,
      statusCounts,
      methodCounts,
      invoiceCount: invoiceCount || 0,
      recentInvoices: recentInvoices || [],
      invoice4uConfigured: isConfigured(),
    },
  });
}

/* ────────────────────────────────
   POST Handlers
   ──────────────────────────────── */

async function handleCreateDocument(body: Record<string, unknown>, req: NextRequest) {
  if (!isConfigured()) {
    return jsonError('Invoice4U is not configured. Set INVOICE4U_API_TOKEN.', 400);
  }

  const {
    requestId,
    docType,
    customerName,
    customerEmail,
    customerPhone,
    customerVATId,
    items,
    payments,
    subject,
    comments,
    sendByEmail,
    discountPercent,
    discountAmount,
  } = body as {
    requestId?: string;
    docType: number;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    customerVATId?: string;
    items: Array<{ name: string; price: number; quantity: number; description?: string }>;
    payments?: Array<{ type: number; amount: number; date?: string }>;
    subject?: string;
    comments?: string;
    sendByEmail?: boolean;
    discountPercent?: number;
    discountAmount?: number;
  };

  if (!docType || !customerName || !items?.length) {
    return jsonError('Missing required fields: docType, customerName, items', 400);
  }

  // Validate doc type
  if (!DOCUMENT_TYPE_LABELS[docType]) {
    return jsonError('Invalid document type', 400);
  }

  // Build customer - try to find/create in Invoice4U
  const customer: Invoice4UCustomer = {
    Name: customerName,
    Email: customerEmail,
    Phone: customerPhone,
    VATId: customerVATId,
  };

  const customerResult = await getOrCreateCustomer(customer);
  if (customerResult.success && customerResult.data) {
    customer.ID = customerResult.data;
  }

  // Build document params
  const params: CreateDocumentParams = {
    docType: docType as DocumentType,
    customer,
    items: items.map(i => ({
      Name: i.name,
      Price: i.price,
      Quantity: i.quantity,
      Description: i.description,
    })),
    subject,
    comments,
    sendByEmail: sendByEmail ?? true,
    discountPercent,
    discountAmount,
  };

  // Add payments if provided (required for receipts)
  if (payments?.length) {
    params.payments = payments.map(p => ({
      PaymentType: p.type,
      Amount: p.amount,
      Date: p.date,
    }));
  }

  // Create document in Invoice4U
  const result = await createDocument(params);
  if (!result.success || !result.data) {
    return jsonError(result.error || 'Failed to create document in Invoice4U', 500);
  }

  const doc = result.data;
  const supabase = getServiceClient();

  // Save to local invoices table
  const totalAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const { error: insertErr } = await supabase.from('invoices').insert({
    event_request_id: requestId || null,
    invoice4u_doc_id: doc.DocumentID,
    invoice4u_doc_number: doc.DocumentNumber,
    invoice4u_doc_type: docType,
    invoice4u_customer_id: customer.ID || null,
    invoice4u_doc_url: doc.DocumentURL || null,
    doc_type_label: DOCUMENT_TYPE_LABELS[docType],
    customer_name: customerName,
    customer_email: customerEmail || null,
    total_amount: totalAmount,
    vat_amount: doc.VATAmount || 0,
    issued_at: new Date().toISOString(),
  });

  if (insertErr) {
    logger.error('[ADMIN_INVOICES] Failed to save invoice locally:', insertErr.message);
    // Don't fail - document was created in Invoice4U successfully
  }

  // If linked to a request, update the request's invoice fields
  if (requestId) {
    await supabase
      .from('event_requests')
      .update({
        invoice4u_doc_id: doc.DocumentID,
        invoice4u_doc_number: doc.DocumentNumber,
        invoice4u_doc_type: docType,
        invoice4u_customer_id: customer.ID || null,
      })
      .eq('id', requestId);
  }

  adminAuditLog('invoice_created', {
    docType,
    docId: doc.DocumentID,
    docNumber: doc.DocumentNumber,
    customerName,
    total: totalAmount,
    requestId,
  }, req);

  return NextResponse.json({
    success: true,
    document: {
      id: doc.DocumentID,
      number: doc.DocumentNumber,
      type: docType,
      typeLabel: DOCUMENT_TYPE_LABELS[docType],
      total: doc.Total,
      vatAmount: doc.VATAmount,
      url: doc.DocumentURL,
      customerName,
    },
  });
}

async function handleCreditNote(body: Record<string, unknown>, req: NextRequest) {
  if (!isConfigured()) {
    return jsonError('Invoice4U is not configured', 400);
  }

  const {
    originalDocId,
    originalInvoiceId,
    customerName,
    customerEmail,
    customerPhone,
    items,
    reason,
    sendByEmail,
  } = body as {
    originalDocId: string;
    originalInvoiceId?: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    items: Array<{ name: string; price: number; quantity: number }>;
    reason?: string;
    sendByEmail?: boolean;
  };

  if (!originalDocId || !customerName || !items?.length) {
    return jsonError('Missing required fields: originalDocId, customerName, items', 400);
  }

  const customer: Invoice4UCustomer = {
    Name: customerName,
    Email: customerEmail,
    Phone: customerPhone,
  };

  const result = await createCreditNote({
    originalDocId,
    customer,
    items: items.map(i => ({
      Name: i.name,
      Price: i.price,
      Quantity: i.quantity,
    })),
    reason,
    sendByEmail: sendByEmail ?? true,
  });

  if (!result.success || !result.data) {
    return jsonError(result.error || 'Failed to create credit note', 500);
  }

  const doc = result.data;
  const supabase = getServiceClient();

  // Save credit note locally
  const totalAmount = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);
  const { error: insertErr } = await supabase.from('invoices').insert({
    invoice4u_doc_id: doc.DocumentID,
    invoice4u_doc_number: doc.DocumentNumber,
    invoice4u_doc_type: DocumentType.InvoiceCredit,
    invoice4u_doc_url: doc.DocumentURL || null,
    doc_type_label: DOCUMENT_TYPE_LABELS[DocumentType.InvoiceCredit],
    customer_name: customerName,
    customer_email: customerEmail || null,
    total_amount: -totalAmount,  // negative for credit notes
    vat_amount: -(doc.VATAmount || 0),
    original_invoice_id: originalInvoiceId || null,
    status: 'active',
    issued_at: new Date().toISOString(),
  });

  if (insertErr) {
    logger.error('[ADMIN_INVOICES] Failed to save credit note locally:', insertErr.message);
  }

  // Mark original invoice as cancelled
  if (originalInvoiceId) {
    await supabase
      .from('invoices')
      .update({ status: 'cancelled' })
      .eq('id', originalInvoiceId);
  }

  adminAuditLog('credit_note_created', {
    docId: doc.DocumentID,
    docNumber: doc.DocumentNumber,
    originalDocId,
    customerName,
    total: -totalAmount,
  }, req);

  return NextResponse.json({
    success: true,
    document: {
      id: doc.DocumentID,
      number: doc.DocumentNumber,
      type: DocumentType.InvoiceCredit,
      typeLabel: DOCUMENT_TYPE_LABELS[DocumentType.InvoiceCredit],
      total: -totalAmount,
      url: doc.DocumentURL,
      customerName,
    },
  });
}

async function handleVerifyAuth() {
  if (!isConfigured()) {
    return NextResponse.json({
      authenticated: false,
      configured: false,
      message: 'INVOICE4U_API_TOKEN is not set',
    });
  }

  const authed = await isAuthenticated();
  return NextResponse.json({
    authenticated: authed,
    configured: true,
    message: authed ? 'Invoice4U API token is valid' : 'Invoice4U API token is invalid',
  });
}
