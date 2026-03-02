'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  adminFetch,
  type EventRequest,
  type PaymentSummaryData,
  type LocalInvoice,
} from '../shared';
import PaymentSummary from './PaymentSummary';
import PaymentTable from './PaymentTable';
import DocumentGenerator from './DocumentGenerator';
import DocumentHistory from './DocumentHistory';

type PaymentsTab = 'summary' | 'payments' | 'documents';

interface PaymentsViewProps {
  requests: EventRequest[];
  onMarkAsPaid: (requestId: string, method: string) => Promise<{ ok: boolean; error?: string }>;
  onWaivePayment: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
  onResendPaymentLink: (requestId: string) => Promise<{ ok: boolean; error?: string }>;
}

export default function PaymentsView({
  requests, onMarkAsPaid, onWaivePayment, onResendPaymentLink,
}: PaymentsViewProps) {
  const [activeTab, setActiveTab] = useState<PaymentsTab>('summary');
  const [summaryData, setSummaryData] = useState<PaymentSummaryData | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [invoices, setInvoices] = useState<LocalInvoice[]>([]);
  const [invoicesLoading, setInvoicesLoading] = useState(false);

  // Doc generator dialog
  const [docGenOpen, setDocGenOpen] = useState(false);
  const [docGenRequest, setDocGenRequest] = useState<EventRequest | null>(null);

  // Invoice4U status
  const [invoice4uStatus, setInvoice4uStatus] = useState<{
    configured: boolean;
    authenticated?: boolean;
  } | null>(null);

  /* ─── Load summary ─── */
  const loadSummary = useCallback(async () => {
    setSummaryLoading(true);
    try {
      const res = await adminFetch('/api/admin/invoices?action=summary');
      if (res.ok) {
        const data = await res.json();
        setSummaryData(data.summary);
      }
    } catch (err) {
      console.warn('[PaymentsView] loadSummary failed:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  /* ─── Load local invoices ─── */
  const loadInvoices = useCallback(async () => {
    setInvoicesLoading(true);
    try {
      const res = await adminFetch('/api/admin/invoices?action=local');
      if (res.ok) {
        const data = await res.json();
        setInvoices(data.invoices || []);
      }
    } catch (err) {
      console.warn('[PaymentsView] loadInvoices failed:', err);
    } finally {
      setInvoicesLoading(false);
    }
  }, []);

  /* ─── Check Invoice4U status ─── */
  const checkInvoice4uStatus = useCallback(async () => {
    try {
      const res = await adminFetch('/api/admin/invoices?action=status');
      if (res.ok) {
        const data = await res.json();
        setInvoice4uStatus(data);
      }
    } catch {
      // silent
    }
  }, []);

  /* ─── Initial load ─── */
  useEffect(() => {
    loadSummary();
    checkInvoice4uStatus();
  }, [loadSummary, checkInvoice4uStatus]);

  // Load invoices when switching to documents tab
  useEffect(() => {
    if (activeTab === 'documents' && invoices.length === 0) {
      loadInvoices();
    }
  }, [activeTab, invoices.length, loadInvoices]);

  /* ─── Document generation ─── */
  const handleGenerateDoc = (request: EventRequest) => {
    setDocGenRequest(request);
    setDocGenOpen(true);
  };

  const handleNewDocument = () => {
    setDocGenRequest(null);
    setDocGenOpen(true);
  };

  const handleDocCreated = () => {
    loadSummary();
    loadInvoices();
  };

  /* ─── Verify Invoice4U auth ─── */
  const handleVerifyAuth = async () => {
    try {
      const res = await adminFetch('/api/admin/invoices', {
        method: 'POST',
        body: JSON.stringify({ action: 'verify_auth' }),
      });
      const data = await res.json();
      setInvoice4uStatus({
        configured: data.configured,
        authenticated: data.authenticated,
      });
      alert(data.message);
    } catch {
      alert('שגיאת תקשורת');
    }
  };

  const TABS: { key: PaymentsTab; label: string; emoji: string }[] = [
    { key: 'summary', label: 'סיכום', emoji: '📊' },
    { key: 'payments', label: 'תשלומים', emoji: '💳' },
    { key: 'documents', label: 'מסמכים', emoji: '🧾' },
  ];

  return (
    <div className="pay-view">
      {/* Page header */}
      <div className="admin-topbar">
        <div>
          <h1 className="admin-topbar__title">💰 תשלומים וחשבוניות</h1>
          <p className="admin-topbar__subtitle">ניהול תשלומים, הפקת חשבוניות ומסמכים</p>
        </div>
        <div className="pay-view__header-actions">
          {/* Invoice4U status indicator */}
          <div className="pay-view__i4u-status">
            <span
              className={`pay-view__i4u-dot ${invoice4uStatus?.configured ? 'pay-view__i4u-dot--ok' : 'pay-view__i4u-dot--off'}`}
            />
            <span className="pay-view__i4u-label">
              {invoice4uStatus?.configured ? 'Invoice4U מחובר' : 'Invoice4U לא מוגדר'}
            </span>
            {invoice4uStatus?.configured && (
              <button
                className="admin-btn admin-btn--ghost admin-btn--sm"
                onClick={handleVerifyAuth}
              >
                בדוק חיבור
              </button>
            )}
          </div>
          <button
            className="admin-btn admin-btn--primary"
            onClick={handleNewDocument}
            disabled={!invoice4uStatus?.configured}
            title={!invoice4uStatus?.configured ? 'יש להגדיר INVOICE4U_API_TOKEN' : ''}
          >
            🧾 הפק מסמך חדש
          </button>
        </div>
      </div>

      {/* Tab navigation */}
      <div className="admin-tabs">
        {TABS.map(t => (
          <button
            key={t.key}
            className={`admin-tab ${activeTab === t.key ? 'admin-tab--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.emoji} {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="pay-view__content">
        {activeTab === 'summary' && (
          <PaymentSummary data={summaryData} loading={summaryLoading} />
        )}

        {activeTab === 'payments' && (
          <PaymentTable
            requests={requests}
            onMarkAsPaid={onMarkAsPaid}
            onWaivePayment={onWaivePayment}
            onResendPaymentLink={onResendPaymentLink}
            onGenerateDocument={handleGenerateDoc}
          />
        )}

        {activeTab === 'documents' && (
          <DocumentHistory
            invoices={invoices}
            loading={invoicesLoading}
            onReload={loadInvoices}
          />
        )}
      </div>

      {/* Document Generator Dialog */}
      {docGenOpen && (
        <DocumentGenerator
          request={docGenRequest}
          onClose={() => { setDocGenOpen(false); setDocGenRequest(null); }}
          onCreated={handleDocCreated}
        />
      )}
    </div>
  );
}
