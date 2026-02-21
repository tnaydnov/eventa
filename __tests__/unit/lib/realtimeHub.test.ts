import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock supabase ──────────────────────────────────────────────
const mockSubscribe = vi.fn((cb?: (status: string) => void) => {
  if (cb) setTimeout(() => cb('SUBSCRIBED'), 0);
  return { state: 'joined' };
});
const mockOn = vi.fn().mockReturnThis();

const mockChannel = vi.fn(() => {
  const self = { on: mockOn, subscribe: mockSubscribe, state: 'joined' };
  // .on() returns self so it's chainable
  mockOn.mockReturnValue(self);
  return self;
});
const mockRemoveChannel = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    channel: (...args: unknown[]) => mockChannel(...args),
    removeChannel: (...args: unknown[]) => mockRemoveChannel(...args),
  },
}));

// Must re-import each test to get fresh module state
async function freshImport() {
  vi.resetModules();
  const mod = await import('@/lib/realtimeHub');
  return mod;
}

describe('RealtimeHub', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('U-RTH-HUB-01: first subscriber creates channel + subscribes', async () => {
    const hub = await freshImport();
    const handler = vi.fn();

    hub.subscribe('test-ch', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler }],
    });

    expect(mockChannel).toHaveBeenCalledWith('test-ch');
    expect(mockOn).toHaveBeenCalled();
    expect(mockSubscribe).toHaveBeenCalled();
  });

  it('U-RTH-HUB-02: second subscriber to same channel reuses (refCount=2, no new channel)', async () => {
    const hub = await freshImport();
    const h1 = vi.fn();
    const h2 = vi.fn();

    hub.subscribe('shared', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: h1 }],
    });
    hub.subscribe('shared', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: h2 }],
    });

    // channel() should only be called once for the same key
    expect(mockChannel).toHaveBeenCalledTimes(1);
    const status = hub.getStatus();
    expect(status['shared'].refCount).toBe(2);
  });

  it('U-RTH-HUB-03: unsubscribe last ref removes channel', async () => {
    const hub = await freshImport();
    const handler = vi.fn();

    const sub = hub.subscribe('remove-me', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler }],
    });

    sub.unsubscribe();
    expect(mockRemoveChannel).toHaveBeenCalled();
    expect(hub.getStatus()['remove-me']).toBeUndefined();
  });

  it('U-RTH-HUB-04: unsubscribe one of two keeps channel (refCount=1)', async () => {
    const hub = await freshImport();

    const sub1 = hub.subscribe('keep', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: vi.fn() }],
    });
    hub.subscribe('keep', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: vi.fn() }],
    });

    sub1.unsubscribe();
    const status = hub.getStatus();
    expect(status['keep'].refCount).toBe(1);
    expect(mockRemoveChannel).not.toHaveBeenCalled();
  });

  it('U-RTH-HUB-05: isSubscribed returns false for unknown channel', async () => {
    const hub = await freshImport();
    expect(hub.isSubscribed('nonexistent')).toBe(false);
  });

  it('U-RTH-HUB-06: getStatus returns all channels with refCounts', async () => {
    const hub = await freshImport();

    hub.subscribe('ch-a', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: vi.fn() }],
    });
    hub.subscribe('ch-b', {
      postgres: [{ binding: { event: 'UPDATE', schema: 'public', table: 'events' }, handler: vi.fn() }],
    });

    const status = hub.getStatus();
    expect(Object.keys(status)).toContain('ch-a');
    expect(Object.keys(status)).toContain('ch-b');
    expect(status['ch-a'].refCount).toBe(1);
    expect(status['ch-b'].refCount).toBe(1);
  });

  it('U-RTH-HUB-07: double unsubscribe is safe (idempotent)', async () => {
    const hub = await freshImport();
    const sub = hub.subscribe('double', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: vi.fn() }],
    });

    sub.unsubscribe();
    sub.unsubscribe(); // should not throw
    expect(mockRemoveChannel).toHaveBeenCalledTimes(1);
  });

  it('U-RTH-HUB-08: warns when reusing channel with different bindings', async () => {
    const hub = await freshImport();
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    hub.subscribe('mixed', {
      postgres: [{ binding: { event: 'INSERT', schema: 'public', table: 'likes' }, handler: vi.fn() }],
    });
    hub.subscribe('mixed', {
      postgres: [{ binding: { event: 'DELETE', schema: 'public', table: 'messages' }, handler: vi.fn() }],
    });

    expect(spy).toHaveBeenCalledWith(expect.stringContaining('missing binding'));
    spy.mockRestore();
  });
});
