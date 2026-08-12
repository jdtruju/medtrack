import { vi } from 'vitest';

export function createSupabaseMock() {
  const unsubscribe = vi.fn();
  const channel = {
    on: vi.fn().mockReturnThis(),
    subscribe: vi.fn().mockReturnThis(),
  };

  return {
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
    __unsubscribe: unsubscribe,
  };
}

export type SupabaseMock = ReturnType<typeof createSupabaseMock>;
