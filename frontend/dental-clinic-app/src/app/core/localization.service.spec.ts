import { TestBed } from '@angular/core/testing';
import { LocalizationService } from './localization.service';

describe('LocalizationService', () => {
  afterEach(() => { try { window.localStorage.removeItem('medaudit.language'); } catch {} });
  it('switches Arabic to RTL and English to LTR', () => {
    const service = TestBed.inject(LocalizationService);
    service.set('ar');
    expect(document.documentElement.dir).toBe('rtl');
    service.set('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});



describe('LocalizationService persistence', () => {
  let original: PropertyDescriptor | undefined;
  let values: Map<string, string>;
  let blocked: boolean;
  beforeEach(() => {
    original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    values = new Map(); blocked = false;
    Object.defineProperty(window, 'localStorage', { configurable: true, value: {
      getItem: (key: string) => { if (blocked) throw new Error('Storage blocked'); return values.get(key) ?? null; },
      setItem: (key: string, value: string) => { if (blocked) throw new Error('Storage blocked'); values.set(key, value); },
    }});
  });
  afterEach(() => {
    if (original) Object.defineProperty(window, 'localStorage', original);
    else Reflect.deleteProperty(window, 'localStorage');
    document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl';
  });
  it('defaults to Arabic and restores the chosen language in a fresh instance', () => {
    const first = new LocalizationService();
    expect(first.language()).toBe('ar'); expect(document.documentElement.dir).toBe('rtl');
    first.toggle();
    const refreshed = new LocalizationService();
    expect(refreshed.language()).toBe('en'); expect(document.documentElement.dir).toBe('ltr');
    refreshed.toggle();
    expect(new LocalizationService().language()).toBe('ar');
  });
  it('keeps Arabic usable when browser storage is unavailable', () => {
    blocked = true;
    const service = new LocalizationService();
    expect(service.language()).toBe('ar'); service.toggle(); expect(service.language()).toBe('en');
  });
});
