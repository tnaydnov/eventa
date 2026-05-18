import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

vi.mock('@/lib/api', () => ({
  getPhotoUrl: (path: string) => `https://test.supabase.co/storage/${path}`,
}));

import MessageBubble from '@/app/[eventSlug]/chat/[conversationId]/_components/MessageBubble';

const baseMsg = {
  id: 'msg1',
  conversation_id: 'c1',
  sender_id: 'p1',
  text: 'Hello world',
  type: 'text' as const,
  is_deleted: false,
  media_path: null,
  created_at: new Date().toISOString(),
};

const defaultProps = {
  deleteMenuMsgId: null,
  onDelete: vi.fn(),
  onTouchStart: vi.fn(),
  onTouchEnd: vi.fn(),
  onShowDeleteMenu: vi.fn(),
};

describe('MessageBubble', () => {
  it('U-DAT-16: own message → sent class', () => {
    const { container } = render(
      <MessageBubble msg={baseMsg as any} isMine={true} {...defaultProps} />
    );
    const bubble = container.querySelector('.message-bubble.sent');
    expect(bubble).toBeInTheDocument();
  });

  it('U-DAT-17: other message → received class', () => {
    const { container } = render(
      <MessageBubble msg={baseMsg as any} isMine={false} {...defaultProps} />
    );
    const bubble = container.querySelector('.message-bubble.received');
    expect(bubble).toBeInTheDocument();
  });

  it('U-DAT-18: deleted message → placeholder', () => {
    const deletedMsg = { ...baseMsg, is_deleted: true };
    render(
      <MessageBubble msg={deletedMsg as any} isMine={true} {...defaultProps} />
    );
    expect(screen.getByText(/ההודעה נמחקה/)).toBeInTheDocument();
  });

  it('U-DAT-19: image message → shows img', () => {
    const imageMsg = { ...baseMsg, type: 'image', text: null, media_path: 'chat/img1.jpg' };
    render(
      <MessageBubble msg={imageMsg as any} isMine={true} {...defaultProps} />
    );
    const img = screen.getByAltText('תמונה');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', expect.stringContaining('img1'));
  });

  it('renders text content', () => {
    render(
      <MessageBubble msg={baseMsg as any} isMine={true} {...defaultProps} />
    );
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('delete menu shows when active', () => {
    render(
      <MessageBubble msg={baseMsg as any} isMine={true} {...defaultProps} deleteMenuMsgId="msg1" />
    );
    expect(screen.getByText(/מחק הודעה/)).toBeInTheDocument();
  });

  it('delete button calls onDelete', () => {
    const onDelete = vi.fn();
    render(
      <MessageBubble msg={baseMsg as any} isMine={true} {...defaultProps} onDelete={onDelete} deleteMenuMsgId="msg1" />
    );
    fireEvent.click(screen.getByText(/מחק הודעה/));
    expect(onDelete).toHaveBeenCalledWith('msg1');
  });

  it('system message renders centered', () => {
    const sysMsg = { ...baseMsg, type: 'system', text: 'User joined' };
    render(
      <MessageBubble msg={sysMsg as any} isMine={false} {...defaultProps} />
    );
    expect(screen.getByText('User joined')).toBeInTheDocument();
  });
});
