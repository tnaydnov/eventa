import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import OrderForm from '@/app/_components/OrderForm';

/**
 * OrderForm is a simplified lead-capture form: name, phone, optional email.
 * (The earlier event-type/date version was replaced by the multi-step wizard;
 * this landing-page form only collects contact details and POSTs to /api/order.)
 */
describe('OrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /** Fill the three lead fields. */
  async function fillLeadFields(user: ReturnType<typeof userEvent.setup>) {
    await user.type(screen.getByPlaceholderText('השם שלכם'), 'Test User');
    await user.type(screen.getByPlaceholderText('050-0000000'), '0501234567');
    await user.type(screen.getByPlaceholderText('you@example.com'), 'test@example.com');
  }

  it('U-DAT-02: renders all lead form fields', () => {
    render(<OrderForm />);
    expect(screen.getByText('שם מלא *')).toBeInTheDocument();
    expect(screen.getByText('טלפון *')).toBeInTheDocument();
    expect(screen.getByText('אימייל')).toBeInTheDocument();
    expect(screen.getByText(/שלחו פרטים/)).toBeInTheDocument();
  });

  it('U-DAT-03: valid submission sends fetch call with form data', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    await fillLeadFields(user);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/order', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });
    // Body carries the contact fields
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body).toMatchObject({
      contactName: 'Test User',
      contactPhone: '0501234567',
      contactEmail: 'test@example.com',
    });
  });

  it('shows success message after successful submission', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    await fillLeadFields(user);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/הפרטים נשלחו בהצלחה/)).toBeInTheDocument();
    });
  });

  it('shows error message on failed submission', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    await fillLeadFields(user);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה בשליחה/)).toBeInTheDocument();
    });
  });

  it('shows error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    await fillLeadFields(user);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה בשליחה/)).toBeInTheDocument();
    });
  });

  it('disables the submit button while sending', async () => {
    // Keep the request pending so we can observe the in-flight state.
    let resolveFetch: (v: { ok: boolean }) => void;
    mockFetch.mockReturnValueOnce(new Promise((r) => { resolveFetch = r; }));
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    await fillLeadFields(user);
    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText('שולח...')).toBeInTheDocument();
    });
    expect(screen.getByRole('button')).toBeDisabled();

    resolveFetch!({ ok: true });
    await waitFor(() => {
      expect(screen.getByText(/הפרטים נשלחו בהצלחה/)).toBeInTheDocument();
    });
  });
});
