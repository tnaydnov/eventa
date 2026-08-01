import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@/lib/api', () => ({
  getPhotoUrl: (path: string) => `https://test.supabase.co/storage/${path}`,
}));

vi.mock('@/components/Icons', () => ({
  UserIcon: ({ size }: { size: number }) => <span data-testid="user-icon" />,
}));

import ChatHeader from '@/app/[eventSlug]/chat/[conversationId]/_components/ChatHeader';

describe('ChatHeader', () => {
  const otherUser = {
    id: 'p2',
    display_name: 'Dana',
    gender: 'female' as const,
    age: 25,
    photos: [{ id: 'ph1', storage_path: 'photos/ph1.jpg', participant_id: 'p2', event_id: 'e1', order_index: 0, created_at: '' }],
  };

  it('U-DAT-13: shows other participant name + photo', () => {
    const { container } = render(
      <ChatHeader otherUser={otherUser as any} onBack={vi.fn()} onUserClick={vi.fn()} onMenuToggle={vi.fn()} />
    );
    expect(screen.getByText('Dana')).toBeInTheDocument();
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('ph1'));
  });

  it('shows UserIcon when no photos', () => {
    const noPhotos = { ...otherUser, photos: [] };
    render(
      <ChatHeader otherUser={noPhotos as any} onBack={vi.fn()} onUserClick={vi.fn()} onMenuToggle={vi.fn()} />
    );
    expect(screen.getByTestId('user-icon')).toBeInTheDocument();
  });

  it('back button calls onBack', () => {
    const onBack = vi.fn();
    render(
      <ChatHeader otherUser={otherUser as any} onBack={onBack} onUserClick={vi.fn()} onMenuToggle={vi.fn()} />
    );
    fireEvent.click(screen.getByText('←'));
    expect(onBack).toHaveBeenCalled();
  });

  it('menu button calls onMenuToggle', () => {
    const onMenu = vi.fn();
    render(
      <ChatHeader otherUser={otherUser as any} onBack={vi.fn()} onUserClick={vi.fn()} onMenuToggle={onMenu} />
    );
    fireEvent.click(screen.getByText('⋮'));
    expect(onMenu).toHaveBeenCalled();
  });

  it('name click calls onUserClick', () => {
    const onUser = vi.fn();
    render(
      <ChatHeader otherUser={otherUser as any} onBack={vi.fn()} onUserClick={onUser} onMenuToggle={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Dana'));
    expect(onUser).toHaveBeenCalled();
  });
});
