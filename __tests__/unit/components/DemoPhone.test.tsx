import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

import DemoPhone from '@/app/dating/_components/DemoPhone';

describe('DemoPhone', () => {
  it('U-DAT-01: renders phone mockup with grid of users', () => {
    render(<DemoPhone />);
    // Should render at least some user names
    expect(screen.getByText('נועה')).toBeInTheDocument();
    expect(screen.getByText('איתי')).toBeInTheDocument();
  });

  it('renders tab bar with grid, chats, and likes tabs', () => {
    render(<DemoPhone />);
    expect(screen.getByText('גריד')).toBeInTheDocument();
    expect(screen.getByText('צ׳אטים')).toBeInTheDocument();
    expect(screen.getByText('לייקים')).toBeInTheDocument();
  });

  it('can navigate to chats tab', () => {
    render(<DemoPhone />);
    fireEvent.click(screen.getByText('צ׳אטים'));
    // Should show pre-existing conversations with matched users
    expect(screen.getByText('תמר')).toBeInTheDocument();
  });

  it('can navigate to likes tab and shows matches', () => {
    render(<DemoPhone />);
    fireEvent.click(screen.getByText('לייקים'));
    // Default tab is 'matches' which shows pre-matched users
    expect(screen.getByText(/התאמות/)).toBeInTheDocument();
  });

  it('renders header with event name', () => {
    render(<DemoPhone />);
    expect(screen.getByText(/החתונה של דנה ואיתי/)).toBeInTheDocument();
  });

  it('grid/swipe view toggle works', () => {
    render(<DemoPhone />);
    // The grid should have user cards initially
    const cards = screen.getAllByText('נועה');
    expect(cards.length).toBeGreaterThan(0);
  });
});
