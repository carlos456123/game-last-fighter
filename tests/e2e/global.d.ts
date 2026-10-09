import type { TestHookApi } from '../../src/systems/TestHook';

declare global {
  interface Window {
    __LF__?: TestHookApi;
  }
}

export {};
