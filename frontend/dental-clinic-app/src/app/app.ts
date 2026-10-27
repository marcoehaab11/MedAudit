import { Component, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from './core/auth.service';
import { LocalizationService } from './core/localization.service';
import { ClinicThemeService } from './core/clinic-theme.service';

import { ConfirmModalComponent } from './shared/confirm-modal.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, ConfirmModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App implements OnDestroy {
  protected readonly i18n = inject(LocalizationService);
  protected readonly auth = inject(AuthService);
  private readonly clinicTheme = inject(ClinicThemeService);
  private readonly router = inject(Router);
  private readonly navSub: Subscription;
  private readonly authSub: Subscription;

  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileSidebarOpen = signal(false);
  protected readonly displayName = this.auth.displayName;
  protected readonly switchingClinic = signal(false);
  protected readonly clinicSwitchError = signal('');

  constructor() {
    this.authSub = this.auth.onAuthReset$.subscribe(() => {
      if (this.auth.authenticated()) this.clinicTheme.load().subscribe({ error: () => this.clinicTheme.reset() });
      else this.clinicTheme.reset();
    });
    if (this.auth.authenticated()) {
      this.clinicTheme.load().subscribe({ error: () => this.clinicTheme.reset() });
      this.auth.refreshPermissions().subscribe({ error: () => {} });
      this.auth.refreshClinics().subscribe({ error: () => {} });
    }
    this.navSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMobileSidebar();
      });
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
    this.authSub.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  protected onEscapePress(): void {
    if (this.mobileSidebarOpen()) {
      this.closeMobileSidebar();
    }
  }

  @HostListener('window:storage', ['$event'])
  protected onSessionChangedInAnotherTab(event: StorageEvent): void {
    if (event.key === 'session_changed') window.location.reload();
  }

  protected onSidebarKeydown(event: KeyboardEvent): void {
    const nav = event.currentTarget as HTMLElement;
    const offsets: Record<string, number> = { ArrowDown: 48, ArrowUp: -48, PageDown: nav.clientHeight * .8, PageUp: -nav.clientHeight * .8 };
    if (event.key in offsets) {
      event.preventDefault();
      nav.scrollBy({ top: offsets[event.key] });
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      nav.scrollTo({ top: event.key === 'Home' ? 0 : nav.scrollHeight });
    }
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((v) => !v);
  }

  protected onBrandClick(): void {
    if (this.sidebarCollapsed()) {
      this.sidebarCollapsed.set(false);
    }
    this.closeMobileSidebar();
  }

  protected toggleMobileSidebar(): void {
    this.mobileSidebarOpen.update((v) => !v);
  }

  protected closeMobileSidebar(): void {
    this.mobileSidebarOpen.set(false);
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => { this.clinicTheme.reset(); this.mobileSidebarOpen.set(false); window.location.assign('/login'); },
      error: () => this.clinicSwitchError.set(this.t('Sign out could not be completed. Please try again.', 'تعذر إكمال تسجيل الخروج. حاول مرة أخرى.')),
    });
  }

  protected switchClinic(event: Event): void {
    const tenantId = (event.target as HTMLSelectElement).value;
    if (!tenantId || tenantId === this.auth.tenantId()) return;
    this.switchingClinic.set(true);
    this.clinicSwitchError.set('');
    this.auth.switchClinic(tenantId).subscribe({
      next: () => window.location.assign('/dashboard'),
      error: () => {
        this.switchingClinic.set(false);
        this.clinicSwitchError.set(this.t('Could not open this clinic.', 'تعذر فتح العيادة.'));
        (event.target as HTMLSelectElement).value = this.auth.tenantId();
      },
    });
  }

  protected initials(): string {
    const name = this.displayName();
    return name
      .split(' ')
      .map((w) => w[0] ?? '')
      .join('')
      .slice(0, 2)
      .toUpperCase();
  }

  protected t(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }

  protected guideTopic(): string {
    const path = this.router.url.split('?')[0];
    if (path.startsWith('/online-booking')) return 'booking';
    if (path.startsWith('/patients')) return 'patients';
    if (path.startsWith('/appointments')) return 'appointments';
    if (path.startsWith('/doctors') || path.startsWith('/settings') || path.startsWith('/users')) return 'settings';
    if (path.startsWith('/reports') || path.startsWith('/finance')) return 'reports';
    if (path.startsWith('/lab') || path.startsWith('/insurance')) return 'reports';
    if (path.startsWith('/treatment') || path.startsWith('/prescriptions')) return 'clinical';
    return 'start';
  }
}

