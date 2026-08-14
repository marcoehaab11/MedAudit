import { TestBed } from '@angular/core/testing';
import { LocalizationService } from './localization.service';

describe('LocalizationService', () => {
  it('switches Arabic to RTL and English to LTR', () => {
    const service = TestBed.inject(LocalizationService);
    service.set('ar');
    expect(document.documentElement.dir).toBe('rtl');
    service.set('en');
    expect(document.documentElement.dir).toBe('ltr');
  });
});
