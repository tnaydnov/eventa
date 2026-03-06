import { NextRequest, NextResponse } from 'next/server';
import {
  isAuthenticated,
  getOrCreateCustomer,
  createDocument,
  DocumentType,
  PaymentType,
  soapCallRaw,
} from '@/lib/invoice4u';
import { BASE_PRICE, MSG_ADDON } from '@/lib/config';

/**
 * GET /api/payment/test-receipt?secret=eventa-debug-2026
 *
 * Diagnostic endpoint — tests each step of receipt creation and returns
 * detailed results. REMOVE AFTER DEBUGGING.
 */
export async function GET(req: NextRequest) {
  // Simple secret to prevent casual access
  if (req.nextUrl.searchParams.get('secret') !== 'eventa-debug-2026') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const steps: Record<string, unknown> = {};

  // ── Step 1: Auth check ──
  try {
    const auth = await isAuthenticated();
    steps.step1_auth = { success: auth };
  } catch (err) {
    steps.step1_auth = { success: false, error: String(err) };
  }

  // ── Step 2: Get or create customer ──
  let customerId: number | undefined;
  try {
    const custResult = await getOrCreateCustomer({
      Name: 'Test Eventa Customer',
      Phone: '0500000000',
      Email: 'test@eventa.productions',
    });
    customerId = custResult.success ? custResult.data : undefined;
    steps.step2_customer = custResult;
  } catch (err) {
    steps.step2_customer = { success: false, error: String(err) };
  }

  // ── Step 3: Create document (capture raw XML) ──
  try {
    const docResult = await createDocument({
      docType: DocumentType.InvoiceReceipt,
      customer: {
        ID: customerId,
        Name: 'Test Eventa Customer',
        Phone: '0500000000',
        Email: 'test@eventa.productions',
      },
      items: [
        { Name: 'חבילת אירוע Eventa (טסט)', Price: BASE_PRICE, Quantity: 1 },
        { Name: 'שירות הודעות מוקדמות לאורחים (טסט)', Price: MSG_ADDON, Quantity: 1 },
      ],
      payments: [{
        PaymentType: PaymentType.CreditCard,
        Amount: BASE_PRICE + MSG_ADDON,
      }],
      subject: 'טסט אירוע - בדיקת מערכת',
      sendByEmail: false,
    });

    steps.step3_createDocument = {
      success: docResult.success,
      error: docResult.error,
      documentId: docResult.data?.DocumentID,
      documentNumber: docResult.data?.DocumentNumber,
      documentUrl: docResult.data?.DocumentURL,
      total: docResult.data?.Total,
    };

    // ── Step 4: Fetch PDF ──
    if (docResult.success && docResult.data?.DocumentURL) {
      // Wait a bit for PDF generation
      await new Promise(r => setTimeout(r, 3000));

      try {
        const pdfRes = await fetch(docResult.data.DocumentURL, {
          signal: AbortSignal.timeout(15_000),
        });
        steps.step4_pdfFetch = {
          status: pdfRes.status,
          contentType: pdfRes.headers.get('content-type'),
          contentLength: pdfRes.headers.get('content-length'),
          ok: pdfRes.ok,
        };

        if (pdfRes.ok) {
          const buf = await pdfRes.arrayBuffer();
          steps.step4_pdfFetch = {
            ...steps.step4_pdfFetch as object,
            bufferSize: buf.byteLength,
            startsWithPdf: new Uint8Array(buf.slice(0, 4)).toString() === '37,80,68,70', // %PDF
          };
        }
      } catch (pdfErr) {
        steps.step4_pdfFetch = { error: String(pdfErr) };
      }
    } else {
      steps.step4_pdfFetch = { skipped: true, reason: 'No DocumentURL from step 3' };
    }
  } catch (err) {
    steps.step3_createDocument = { success: false, error: String(err) };
  }

  // ── Step 5: Raw SOAP call to see full XML response ──
  try {
    const rawResult = await soapCallRaw('CreateDocument', `<CreateDocument xmlns="http://tempuri.org/">
      <token>${process.env.INVOICE4U_API_TOKEN || ''}</token>
      <doc xmlns:a="http://schemas.datacontract.org/2004/07/InvoiceAPI">
        <a:DocumentType>3</a:DocumentType>
        <a:Customer>
          ${customerId ? `<a:ID>${customerId}</a:ID>` : ''}
          <a:Name>Raw SOAP Test</a:Name>
          <a:Phone>0500000000</a:Phone>
          <a:Email>test@eventa.productions</a:Email>
        </a:Customer>
        <a:Items>
          <a:DocumentItem>
            <a:Name>Test Item</a:Name>
            <a:Price>1</a:Price>
            <a:Quantity>1</a:Quantity>
            <a:CurrencyCode>ILS</a:CurrencyCode>
          </a:DocumentItem>
        </a:Items>
        <a:PaymentInfoList>
          <a:PaymentInfo>
            <a:PaymentType>1</a:PaymentType>
            <a:Amount>1</a:Amount>
            <a:Date>${new Date().toISOString()}</a:Date>
          </a:PaymentInfo>
        </a:PaymentInfoList>
        <a:Subject>Raw SOAP Test</a:Subject>
        <a:SendByEmail>false</a:SendByEmail>
      </doc>
    </CreateDocument>`);

    steps.step5_rawSoap = {
      httpStatus: rawResult.status,
      responseXml: rawResult.xml.slice(0, 2000),
      sentEnvelope: rawResult.envelope.slice(0, 2000),
    };
  } catch (err) {
    steps.step5_rawSoap = { error: String(err) };
  }

  return NextResponse.json(steps, { status: 200 });
}
