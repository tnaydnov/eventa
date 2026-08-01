/**
 * Unit tests for components/Icons.tsx
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  CameraIcon,
  EditIcon,
  HeartIcon,
  HeartFilledIcon,
  TrashIcon,
  SearchIcon,
  ChatBubbleIcon,
  UserIcon,
  RingIcon,
  SparklesIcon,
} from '@/components/Icons';

const icons = [
  { Component: CameraIcon, name: 'CameraIcon' },
  { Component: EditIcon, name: 'EditIcon' },
  { Component: HeartIcon, name: 'HeartIcon' },
  { Component: HeartFilledIcon, name: 'HeartFilledIcon' },
  { Component: TrashIcon, name: 'TrashIcon' },
  { Component: SearchIcon, name: 'SearchIcon' },
  { Component: ChatBubbleIcon, name: 'ChatBubbleIcon' },
  { Component: UserIcon, name: 'UserIcon' },
  { Component: RingIcon, name: 'RingIcon' },
  { Component: SparklesIcon, name: 'SparklesIcon' },
];

describe('Icons', () => {
  icons.forEach(({ Component, name }) => {
    describe(name, () => {
      it('renders an SVG element', () => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg');
        expect(svg).toBeTruthy();
      });

      it('applies default size 18', () => {
        const { container } = render(<Component />);
        const svg = container.querySelector('svg')!;
        expect(svg.getAttribute('width')).toBe('18');
        expect(svg.getAttribute('height')).toBe('18');
      });

      it('applies custom size', () => {
        const { container } = render(<Component size={32} />);
        const svg = container.querySelector('svg')!;
        expect(svg.getAttribute('width')).toBe('32');
        expect(svg.getAttribute('height')).toBe('32');
      });

      it('applies custom color', () => {
        const { container } = render(<Component color="red" />);
        const svg = container.querySelector('svg')!;
        expect(svg.getAttribute('stroke')).toBe('red');
      });

      it('applies className', () => {
        const { container } = render(<Component className="test-class" />);
        const svg = container.querySelector('svg')!;
        expect(svg.classList.contains('test-class')).toBe(true);
      });
    });
  });
});
