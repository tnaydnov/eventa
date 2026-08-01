import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock react-easy-crop ──
const mockCropperProps: Record<string, unknown> = {};
vi.mock('react-easy-crop', () => ({
  __esModule: true,
  default: (props: Record<string, unknown>) => {
    Object.assign(mockCropperProps, props);
    return <div data-testid="cropper" />;
  },
}));

import ImageCropper from '@/components/ImageCropper';

describe('ImageCropper', () => {
  const onCropDone = vi.fn();
  const onCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-CMP-23: renders crop area with cropper component', () => {
    render(
      <ImageCropper
        imageSrc="data:image/png;base64,test"
        onCropDone={onCropDone}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByTestId('cropper')).toBeInTheDocument();
    // Zoom slider
    expect(screen.getByRole('slider')).toBeInTheDocument();
    // Buttons
    expect(screen.getByText('ביטול')).toBeInTheDocument();
    expect(screen.getByText('אישור')).toBeInTheDocument();
  });

  it('U-CMP-24: cancel button calls onCancel', () => {
    render(
      <ImageCropper
        imageSrc="data:image/png;base64,test"
        onCropDone={onCropDone}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText('ביטול'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('renders with custom aspect ratio and crop shape', () => {
    render(
      <ImageCropper
        imageSrc="data:image/png;base64,test"
        aspect={16 / 9}
        cropShape="round"
        onCropDone={onCropDone}
        onCancel={onCancel}
      />,
    );
    expect(mockCropperProps.aspect).toBeCloseTo(16 / 9);
    expect(mockCropperProps.cropShape).toBe('round');
  });

  it('zoom slider changes zoom value', () => {
    render(
      <ImageCropper
        imageSrc="data:image/png;base64,test"
        onCropDone={onCropDone}
        onCancel={onCancel}
      />,
    );
    const slider = screen.getByRole('slider');
    fireEvent.change(slider, { target: { value: '2.5' } });
    // The cropper should receive the new zoom
    expect(mockCropperProps.zoom).toBe(2.5);
  });
});
