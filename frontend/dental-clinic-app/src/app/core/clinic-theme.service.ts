import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, tap } from 'rxjs';

export interface ClinicTheme {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  canManage: boolean;
}

export const DEFAULT_CLINIC_THEME = {
  primaryColor: '#087b68',
  secondaryColor: '#0d9488',
  accentColor: '#f59e0b',
};

@Injectable({ providedIn: 'root' })
export class ClinicThemeService {
  private readonly http = inject(HttpClient);

  load(): Observable<ClinicTheme> {
    return this.http.get<ClinicTheme>('/api/branches/theme').pipe(tap(theme => this.apply(theme)));
  }

  save(theme: Pick<ClinicTheme, 'primaryColor' | 'secondaryColor' | 'accentColor'>): Observable<ClinicTheme> {
    return this.http.put<ClinicTheme>('/api/branches/theme', theme).pipe(tap(saved => this.apply(saved)));
  }

  reset(): void { this.apply(DEFAULT_CLINIC_THEME); }

  apply(theme: Pick<ClinicTheme, 'primaryColor' | 'secondaryColor' | 'accentColor'>): void {
    const colors = [theme.primaryColor, theme.secondaryColor, theme.accentColor];
    if (!colors.every(color => /^#[0-9a-fA-F]{6}$/.test(color))) return;
    const root = document.documentElement.style;
    root.setProperty('--brand', theme.primaryColor);
    root.setProperty('--brand-hover', this.mix(theme.primaryColor, '#000000', .18));
    root.setProperty('--brand-dark', this.mix(theme.primaryColor, '#000000', .38));
    root.setProperty('--brand-light', this.mix(theme.primaryColor, '#ffffff', .89));
    root.setProperty('--brand-surface', this.mix(theme.primaryColor, '#ffffff', .94));
    root.setProperty('--brand-cyan', theme.secondaryColor);
    root.setProperty('--brand-navy', this.mix(theme.primaryColor, '#000000', .7));
    root.setProperty('--brand-gradient', `linear-gradient(135deg, ${theme.primaryColor} 0%, ${theme.secondaryColor} 100%)`);
    root.setProperty('--brand-gradient-hover', `linear-gradient(135deg, ${this.mix(theme.primaryColor, '#000000', .13)} 0%, ${this.mix(theme.secondaryColor, '#000000', .13)} 100%)`);
    root.setProperty('--border-focus', theme.primaryColor);
    root.setProperty('--clinic-accent', theme.accentColor);
    root.setProperty('--sidebar-start', this.mix(theme.primaryColor, '#071536', .83));
    root.setProperty('--sidebar-middle', this.mix(theme.secondaryColor, '#0a1b42', .86));
    root.setProperty('--sidebar-end', this.mix(theme.primaryColor, '#051026', .9));
  }

  private mix(first: string, second: string, secondWeight: number): string {
    const a = [1, 3, 5].map(index => parseInt(first.slice(index, index + 2), 16));
    const b = [1, 3, 5].map(index => parseInt(second.slice(index, index + 2), 16));
    return '#' + a.map((value, index) => Math.round(value * (1 - secondWeight) + b[index] * secondWeight).toString(16).padStart(2, '0')).join('');
  }
}
