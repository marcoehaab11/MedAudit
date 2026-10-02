import { Component, HostListener, inject, OnDestroy, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from './core/auth.service';
import { LocalizationService } from './core/localization.service';

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
  private readonly router = inject(Router);
  private readonly navSub: Subscription;

  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileSidebarOpen = signal(false);
  protected readonly displayName = this.auth.displayName;

  constructor() {
    this.navSub = this.router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe(() => {
        this.closeMobileSidebar();
      });
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
  }

  @HostListener('document:keydown.escape')
  protected onEscapePress(): void {
    if (this.mobileSidebarOpen()) {
      this.closeMobileSidebar();
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
    this.auth.logout();
    this.mobileSidebarOpen.set(false);
    void this.router.navigate(['/login']);
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
    if (path.startsWith('/treatment') || path.startsWith('/prescriptions')) return 'clinical';
    return 'start';
  }
}

