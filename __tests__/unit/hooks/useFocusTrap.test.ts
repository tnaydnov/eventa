/**
 * Unit tests for hooks/useFocusTrap.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/** Helper: create a container with focusable children and attach the ref */
function setupContainer(
  ref: React.RefObject<HTMLDivElement | null>,
  focusableHTML = '<button id="first">A</button><button id="last">B</button>',
) {
  const div = document.createElement('div');
  div.innerHTML = focusableHTML;
  document.body.appendChild(div);
  // Manually assign the ref (matches how React attaches)
  Object.defineProperty(ref, 'current', { value: div, writable: true });
  return div;
}

beforeEach(() => {
  document.body.innerHTML = '';
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('useFocusTrap', () => {
  it('returns a ref object', () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toHaveProperty('current');
  });

  it('adds keydown listener when open', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const { result } = renderHook(() => useFocusTrap(true));
    setupContainer(result.current);

    // The effect runs synchronously in test, listener should be added
    expect(addSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('does not add keydown listener when closed', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    renderHook(() => useFocusTrap(false));
    expect(addSpy).not.toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('removes keydown listener on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { result, unmount } = renderHook(() => useFocusTrap(true));
    setupContainer(result.current);

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('keydown', expect.any(Function));
  });

  it('focuses first focusable element after open', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    const container = setupContainer(result.current);
    const firstBtn = container.querySelector('#first') as HTMLButtonElement;
    const focusSpy = vi.spyOn(firstBtn, 'focus');

    act(() => { vi.advanceTimersByTime(60); });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('focuses container itself when no focusable children', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    const container = setupContainer(result.current, '<p>No focusable elements</p>');
    const focusSpy = vi.spyOn(container, 'focus');

    act(() => { vi.advanceTimersByTime(60); });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn();
    const { result } = renderHook(() => useFocusTrap(true, onClose));
    setupContainer(result.current);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not call onClose on Escape when onClose is undefined', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    setupContainer(result.current);

    // Should not throw
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
  });

  it('wraps focus forward: Tab on last element focuses first', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    const container = setupContainer(result.current);
    const firstBtn = container.querySelector('#first') as HTMLButtonElement;
    const lastBtn = container.querySelector('#last') as HTMLButtonElement;

    // Simulate focus on last button
    lastBtn.focus();
    const focusSpy = vi.spyOn(firstBtn, 'focus');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      // We need preventDefault to be trackable
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('wraps focus backward: Shift+Tab on first element focuses last', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    const container = setupContainer(result.current);
    const firstBtn = container.querySelector('#first') as HTMLButtonElement;
    const lastBtn = container.querySelector('#last') as HTMLButtonElement;

    // Simulate focus on first button
    firstBtn.focus();
    const focusSpy = vi.spyOn(lastBtn, 'focus');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true });
      document.dispatchEvent(event);
    });

    expect(focusSpy).toHaveBeenCalled();
  });

  it('prevents Tab when no focusable elements exist', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    setupContainer(result.current, '<p>Nothing focusable</p>');

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      const preventSpy = vi.spyOn(event, 'preventDefault');
      document.dispatchEvent(event);
      expect(preventSpy).toHaveBeenCalled();
    });
  });

  it('restores focus to previously focused element on unmount', () => {
    // Create an element that was focused before the trap opened
    const trigger = document.createElement('button');
    trigger.id = 'trigger';
    document.body.appendChild(trigger);
    trigger.focus();

    const { result, unmount } = renderHook(() => useFocusTrap(true));
    setupContainer(result.current);

    const restoreSpy = vi.spyOn(trigger, 'focus');
    unmount();

    expect(restoreSpy).toHaveBeenCalled();
  });

  it('does not restore focus if previouslyFocused has no focus method', () => {
    // Edge case: activeElement might be null or lack focus
    Object.defineProperty(document, 'activeElement', { value: null, configurable: true });

    const { result, unmount } = renderHook(() => useFocusTrap(true));
    setupContainer(result.current);

    // Should not throw
    unmount();
  });

  it('skips disabled buttons in focusable query', () => {
    const { result } = renderHook(() => useFocusTrap(true));
    const container = setupContainer(
      result.current,
      '<button id="a">A</button><button disabled id="disabled">Nope</button><button id="b">B</button>',
    );

    const btnA = container.querySelector('#a') as HTMLButtonElement;
    const btnB = container.querySelector('#b') as HTMLButtonElement;
    const focusSpyA = vi.spyOn(btnA, 'focus');

    act(() => { vi.advanceTimersByTime(60); });

    // First focusable should be button A (disabled one excluded)
    expect(focusSpyA).toHaveBeenCalled();

    // Tab on last enabled (B) should wrap to first enabled (A), skipping disabled
    btnB.focus();
    Object.defineProperty(document, 'activeElement', { value: btnB, configurable: true });
    focusSpyA.mockClear();

    act(() => {
      const event = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true });
      document.dispatchEvent(event);
    });

    expect(focusSpyA).toHaveBeenCalled();
  });

  it('re-subscribes listener when onClose changes', () => {
    const onClose1 = vi.fn();
    const onClose2 = vi.fn();

    const { result, rerender } = renderHook(
      ({ close }) => useFocusTrap(true, close),
      { initialProps: { close: onClose1 } },
    );
    setupContainer(result.current);

    rerender({ close: onClose2 });

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });

    expect(onClose1).not.toHaveBeenCalled();
    expect(onClose2).toHaveBeenCalledTimes(1);
  });
});
