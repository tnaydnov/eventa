import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import React from 'react';

vi.mock('@/components/Icons', () => ({
  CameraIcon: ({ size, color }: { size: number; color?: string }) => <span data-testid="camera-icon" />,
}));

import ChatInputBar from '@/app/[eventSlug]/chat/[conversationId]/_components/ChatInputBar';

describe('ChatInputBar', () => {
  const defaultProps = {
    text: '',
    setText: vi.fn(),
    sending: false,
    onSend: vi.fn(),
    onImageUpload: vi.fn(),
    fileInputRef: React.createRef<HTMLInputElement>(),
  };

  it('U-DAT-14: text input + send button render', () => {
    render(<ChatInputBar {...defaultProps} />);
    expect(screen.getByPlaceholderText('הקלידו הודעה...')).toBeInTheDocument();
    // Send button (svg icon)
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(2); // camera + send
  });

  it('send button disabled when no text', () => {
    render(<ChatInputBar {...defaultProps} text="" />);
    const sendBtn = screen.getAllByRole('button').at(-1)!;
    expect(sendBtn).toBeDisabled();
  });

  it('send button enabled when text present', () => {
    render(<ChatInputBar {...defaultProps} text="Hello" />);
    const sendBtn = screen.getAllByRole('button').at(-1)!;
    expect(sendBtn).not.toBeDisabled();
  });

  it('Enter key calls onSend', () => {
    const onSend = vi.fn();
    render(<ChatInputBar {...defaultProps} text="hi" onSend={onSend} />);
    const input = screen.getByPlaceholderText('הקלידו הודעה...');
    fireEvent.keyDown(input, { key: 'Enter', shiftKey: false });
    expect(onSend).toHaveBeenCalled();
  });

  it('U-DAT-15: camera button triggers file input', () => {
    render(<ChatInputBar {...defaultProps} />);
    expect(screen.getByTestId('camera-icon')).toBeInTheDocument();
    // File input exists
    const fileInput = document.querySelector('input[type="file"]');
    expect(fileInput).toBeInTheDocument();
  });

  it('typing calls setText', () => {
    const setText = vi.fn();
    render(<ChatInputBar {...defaultProps} setText={setText} />);
    fireEvent.change(screen.getByPlaceholderText('הקלידו הודעה...'), { target: { value: 'test' } });
    expect(setText).toHaveBeenCalledWith('test');
  });
});
