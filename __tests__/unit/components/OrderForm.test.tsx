import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';

// Mock fetch
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import OrderForm from '@/app/dating/_components/OrderForm';

describe('OrderForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-DAT-02: renders all form fields', () => {
    render(<OrderForm />);
    expect(screen.getByText('סוג האירוע *')).toBeInTheDocument();
    expect(screen.getByText('תאריך האירוע *')).toBeInTheDocument();
    expect(screen.getByText('שם מלא *')).toBeInTheDocument();
    expect(screen.getByText('טלפון *')).toBeInTheDocument();
    expect(screen.getByText('אימייל')).toBeInTheDocument();
    expect(screen.getByText(/שלחו פרטים/)).toBeInTheDocument();
  });

  it('U-DAT-03: valid submission sends fetch call with form data', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    // Fill event type
    await user.selectOptions(screen.getByRole('combobox'), 'wedding');
    // Fill date
    const dateInput = container.querySelector('input[type="date"]')!;
    fireEvent.change(dateInput, { target: { value: '2026-06-15' } });
    // Fill name
    await user.type(screen.getByPlaceholderText('השם שלכם'), 'Test User');
    // Fill phone
    await user.type(screen.getByPlaceholderText('050-0000000'), '0501234567');

    // Submit form
    const form = container.querySelector('form')!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/order', expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }));
    });
  });

  it('shows success message after successful submission', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true });
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    // Fill required fields
    await user.selectOptions(screen.getByRole('combobox'), 'wedding');
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-06-15' } });
    await user.type(screen.getByPlaceholderText('השם שלכם'), 'Test User');
    await user.type(screen.getByPlaceholderText('050-0000000'), '0501234567');

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/הבקשה נשלחה בהצלחה/)).toBeInTheDocument();
    });
  });

  it('shows error message on failed submission', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false });
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    // Fill required fields
    await user.selectOptions(screen.getByRole('combobox'), 'wedding');
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-06-15' } });
    await user.type(screen.getByPlaceholderText('השם שלכם'), 'Test User');
    await user.type(screen.getByPlaceholderText('050-0000000'), '0501234567');

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה בשליחה/)).toBeInTheDocument();
    });
  });

  it('shows error on network failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));
    const user = userEvent.setup();
    const { container } = render(<OrderForm />);

    // Fill required fields
    await user.selectOptions(screen.getByRole('combobox'), 'wedding');
    fireEvent.change(container.querySelector('input[type="date"]')!, { target: { value: '2026-06-15' } });
    await user.type(screen.getByPlaceholderText('השם שלכם'), 'Test User');
    await user.type(screen.getByPlaceholderText('050-0000000'), '0501234567');

    fireEvent.submit(container.querySelector('form')!);

    await waitFor(() => {
      expect(screen.getByText(/שגיאה בשליחה/)).toBeInTheDocument();
    });
  });

  it('event type select has all options', () => {
    render(<OrderForm />);
    const select = screen.getByRole('combobox');
    expect(select).toBeInTheDocument();
    expect(screen.getByText('חתונה')).toBeInTheDocument();
    expect(screen.getByText('אירוע חברה / כנס')).toBeInTheDocument();
    expect(screen.getByText('יום הולדת')).toBeInTheDocument();
    expect(screen.getByText('מסיבה פרטית')).toBeInTheDocument();
  });
});
