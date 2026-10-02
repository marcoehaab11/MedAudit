import { Component, inject, signal } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  public readonly router = inject(Router);
  public readonly language = signal<'en' | 'ar'>('ar');

  protected toggleLanguage(): void {
    const language = this.language() === 'en' ? 'ar' : 'en';
    this.language.set(language);
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
  }

  public getLoginUrl(): string {
    if (typeof window === 'undefined') return '/login';
    let host = window.location.host;
    if (host.startsWith('app.')) return `${window.location.protocol}//${host}/login`;
    if (host.startsWith('book.')) host = host.substring(5);
    else if (host.startsWith('rx.')) host = host.substring(3);
    else if (host.startsWith('www.')) host = host.substring(4);
    
    return `${window.location.protocol}//app.${host}/login`;
  }
}
