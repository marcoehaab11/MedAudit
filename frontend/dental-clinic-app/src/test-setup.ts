import { beforeEach } from 'vitest';

if (typeof globalThis.localStorage?.getItem !== 'function') {
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: storage });
}

// Language changes in one feature test must not change the next test's defaults.
beforeEach(() => {
  localStorage.removeItem('medaudit.language');
  document.documentElement.lang = 'ar';
  document.documentElement.dir = 'rtl';
});
