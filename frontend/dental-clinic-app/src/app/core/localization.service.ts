import { Injectable, computed, signal } from '@angular/core';

export type Language = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  readonly language = signal<Language>('en');
  readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  toggle(): void {
    this.set(this.language() === 'en' ? 'ar' : 'en');
  }

  set(language: Language): void {
    this.language.set(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
}
