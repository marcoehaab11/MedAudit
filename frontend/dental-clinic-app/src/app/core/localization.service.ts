import { Injectable, computed, signal } from '@angular/core';

export type Language = 'en' | 'ar';

@Injectable({ providedIn: 'root' })
export class LocalizationService {
  readonly language = signal<Language>('ar');
  readonly direction = computed(() => (this.language() === 'ar' ? 'rtl' : 'ltr'));

  constructor() {
    let saved: string | null = null;
    try { saved = window.localStorage.getItem('medaudit.language'); } catch {}
    this.set(saved === 'en' ? 'en' : 'ar');
  }

  toggle(): void {
    this.set(this.language() === 'en' ? 'ar' : 'en');
  }

  set(language: Language): void {
    this.language.set(language);
    try { window.localStorage.setItem('medaudit.language', language); } catch {}
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }
}

