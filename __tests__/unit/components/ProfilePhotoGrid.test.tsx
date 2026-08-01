import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// Mocks
const mockUploadPhoto = vi.fn();
const mockDeletePhoto = vi.fn();
const mockReorderPhotos = vi.fn();
const mockGetPhotoUrl = vi.fn((path: string) => `https://test.supabase.co/storage/${path}`);
const mockValidateImageFile = vi.fn();

vi.mock('@/lib/api', () => ({
  uploadPhoto: (...args: unknown[]) => mockUploadPhoto(...args),
  deletePhoto: (...args: unknown[]) => mockDeletePhoto(...args),
  reorderPhotos: (...args: unknown[]) => mockReorderPhotos(...args),
  getPhotoUrl: (path: string) => mockGetPhotoUrl(path),
}));

vi.mock('@/lib/validations', () => ({
  validateImageFile: (file: File) => mockValidateImageFile(file),
}));

vi.mock('@/lib/constants', () => ({
  MAX_PHOTOS: 10,
}));

vi.mock('next/dynamic', () => ({
  default: () => () => null, // ImageCropper mock
}));

vi.mock('@/components/Icons', () => ({
  CameraIcon: ({ size }: { size: number }) => <span data-testid="camera-icon" data-size={size} />,
}));

import ProfilePhotoGrid from '@/app/[eventSlug]/profile/_components/ProfilePhotoGrid';

const makePhoto = (id: string, idx: number) => ({
  id,
  participant_id: 'p1',
  event_id: 'e1',
  storage_path: `photos/${id}.jpg`,
  order_index: idx,
  created_at: new Date().toISOString(),
});

describe('ProfilePhotoGrid', () => {
  const defaultProps = {
    eventId: 'e1',
    participantId: 'p1',
    photos: [makePhoto('ph1', 0), makePhoto('ph2', 1)],
    onPhotosChange: vi.fn(),
    toast: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateImageFile.mockReturnValue(null);
  });

  it('U-DAT-09: renders photos in grid', () => {
    const { container } = render(<ProfilePhotoGrid {...defaultProps} />);
    const images = container.querySelectorAll('img');
    expect(images).toHaveLength(2);
    expect(images[0]).toHaveAttribute('src', expect.stringContaining('ph1'));
  });

  it('U-DAT-10: shows add button when < MAX_PHOTOS', () => {
    render(<ProfilePhotoGrid {...defaultProps} />);
    expect(screen.getByText('הוספה')).toBeInTheDocument();
  });

  it('hides add button when at MAX_PHOTOS', () => {
    const photos = Array.from({ length: 10 }, (_, i) => makePhoto(`p${i}`, i));
    render(<ProfilePhotoGrid {...defaultProps} photos={photos} />);
    expect(screen.queryByText('הוספה')).not.toBeInTheDocument();
  });

  it('shows photo count', () => {
    render(<ProfilePhotoGrid {...defaultProps} />);
    expect(screen.getByText('2/10')).toBeInTheDocument();
  });

  it('shows "ראשית" badge on first photo', () => {
    render(<ProfilePhotoGrid {...defaultProps} />);
    expect(screen.getByText('ראשית')).toBeInTheDocument();
  });

  it('delete button calls deletePhoto', async () => {
    mockDeletePhoto.mockResolvedValue(true);
    render(<ProfilePhotoGrid {...defaultProps} />);
    // Each photo has a remove button ✕
    const removeButtons = screen.getAllByText('✕');
    fireEvent.click(removeButtons[0]);
    expect(mockDeletePhoto).toHaveBeenCalledWith('ph1', 'photos/ph1.jpg');
  });

  it('validates file on add', async () => {
    mockValidateImageFile.mockReturnValue('File too large');
    render(<ProfilePhotoGrid {...defaultProps} />);
    const fileInput = document.querySelector('input[type="file"]')!;
    const file = new File(['x'], 'test.jpg', { type: 'image/jpeg' });
    fireEvent.change(fileInput, { target: { files: [file] } });
    expect(defaultProps.toast).toHaveBeenCalledWith('File too large');
  });
});
