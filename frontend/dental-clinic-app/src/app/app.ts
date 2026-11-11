import {
  afterNextRender,
  Component,
  computed,
  effect,
  ElementRef,
  HostListener,
  inject,
  Injector,
  OnDestroy,
  signal,
} from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { AuthService } from './core/auth.service';
import { LocalizationService } from './core/localization.service';
import { ClinicThemeService } from './core/clinic-theme.service';

import { NAVIGATION_GROUPS, NavigationGroup, NavigationItem } from './core/navigation';

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
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);
  private readonly navSub: Subscription;
  private drawerTrigger: HTMLElement | null = null;
  private focusFrame: number | null = null;
  private previousOverflow: string | null = null;
  private readonly groupOverrides = signal<Record<string, boolean>>({});
  protected readonly currentPath = signal(this.router.url.split('?')[0].split('#')[0]);
  protected readonly isMobile = signal(window.matchMedia('(max-width: 768px)').matches);
  protected readonly navTooltip = signal<{
    item: NavigationItem;
    top: number;
    left: number;
  } | null>(null);
  protected readonly navigationGroups = computed(() =>
    NAVIGATION_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) => !item.permission || this.auth.hasPermission(item.permission),
      ),
    })).filter((group) => group.items.length),
  );
  protected readonly mobileNavigation = computed(() => {
    const items = this.navigationGroups().flatMap((group) => group.items);
    return ['/dashboard', '/patients', '/appointments', '/treatment-plans']
      .map((path) => items.find((item) => item.path === path))
      .filter((item): item is NavigationItem => !!item);
  });
  private readonly authSub: Subscription;

  protected readonly sidebarCollapsed = signal(false);
  protected readonly mobileSidebarOpen = signal(false);
  protected readonly standaloneClinical = signal(
    /^\/treatments\/[^/]+\/clinical(?:[/?]|$)/.test(this.router.url),
  );
  protected readonly displayName = this.auth.displayName;
  protected readonly switchingClinic = signal(false);
  protected readonly clinicSwitchError = signal('');

  constructor() {
    // Scope preferences to the signed-in account. Storage failure must not affect navigation.
    effect(() => {
      const userId = this.auth.userId();
      let collapsed = false;
      try {
        collapsed = !!userId && localStorage.getItem('planora.sidebar.' + userId) === 'collapsed';
      } catch {}
      this.sidebarCollapsed.set(collapsed);
    });
    this.authSub = this.auth.onAuthReset$.subscribe(() => {
      if (this.auth.authenticated())
        this.clinicTheme.load().subscribe({ error: () => this.clinicTheme.reset() });
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
        this.standaloneClinical.set(
          /^\/treatments\/[^/]+\/clinical(?:[/?]|$)/.test(this.router.url),
        );
        this.currentPath.set(this.router.url.split('?')[0].split('#')[0]);
        this.groupOverrides.set({});
        this.navTooltip.set(null);
        this.closeMobileSidebar();
      });
  }

  ngOnDestroy(): void {
    this.navSub.unsubscribe();
    this.authSub.unsubscribe();
    this.restorePageScroll();
    if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
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

  @HostListener('window:resize')
  protected onViewportChange(): void {
    this.isMobile.set(window.matchMedia('(max-width: 768px)').matches);
    this.navTooltip.set(null);
    if (!this.isMobile()) this.closeMobileSidebar(false);
  }

  @HostListener('document:keydown', ['$event'])
  protected containDrawerFocus(event: KeyboardEvent): void {
    if (!this.mobileSidebarOpen() || event.key !== 'Tab') return;
    const sidebar = this.host.nativeElement.querySelector<HTMLElement>('#app-sidebar');
    const controls = Array.from(
      sidebar?.querySelectorAll<HTMLElement>('a[href], button:not(:disabled), [tabindex="0"]') ??
        [],
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (!first || !last) return;
    if (
      event.shiftKey &&
      (document.activeElement === first || !sidebar?.contains(document.activeElement))
    ) {
      event.preventDefault();
      last.focus();
    } else if (
      !event.shiftKey &&
      (document.activeElement === last || !sidebar?.contains(document.activeElement))
    ) {
      event.preventDefault();
      first.focus();
    }
  }

  protected isGroupOpen(group: NavigationGroup): boolean {
    const override = this.groupOverrides()[group.id];
    if (override !== undefined) return override;
    return (
      group.defaultOpen ||
      group.items.some(
        (item) =>
          this.currentPath() === item.path ||
          (!item.exact && this.currentPath().startsWith(item.path + '/')),
      )
    );
  }

  protected toggleGroup(group: NavigationGroup): void {
    this.groupOverrides.update((value) => ({ ...value, [group.id]: !this.isGroupOpen(group) }));
  }

  protected toggleSidebar(): void {
    this.sidebarCollapsed.update((value) => !value);
    this.navTooltip.set(null);
    try {
      const userId = this.auth.userId();
      if (userId)
        localStorage.setItem(
          'planora.sidebar.' + userId,
          this.sidebarCollapsed() ? 'collapsed' : 'expanded',
        );
    } catch {}
  }

  protected onBrandClick(): void {
    this.closeMobileSidebar();
  }

  protected showNavTooltip(event: Event, item: NavigationItem): void {
    if (!this.sidebarCollapsed() || this.isMobile()) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    this.navTooltip.set({
      item,
      top: rect.top + rect.height / 2,
      left: this.i18n.direction() === 'rtl' ? rect.left - 16 : rect.right + 16,
    });
  }

  protected toggleMobileSidebar(): void {
    if (this.mobileSidebarOpen()) {
      this.closeMobileSidebar();
      return;
    }
    if (!this.isMobile()) return;
    this.drawerTrigger =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    this.previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    this.mobileSidebarOpen.set(true);
    afterNextRender(
      () => {
        // Let inert/visibility changes reach the browser before moving native focus.
        this.focusFrame = requestAnimationFrame(() => {
          this.focusFrame = null;
          if (this.mobileSidebarOpen() && this.host.nativeElement.isConnected) {
            this.host.nativeElement.querySelector<HTMLElement>('.mobile-close-btn')?.focus();
          }
        });
      },
      { injector: this.injector },
    );
  }

  protected closeMobileSidebar(restoreFocus = true): void {
    if (!this.mobileSidebarOpen()) return;
    this.mobileSidebarOpen.set(false);
    this.restorePageScroll();
    if (this.focusFrame !== null) cancelAnimationFrame(this.focusFrame);
    this.focusFrame = null;
    const trigger = this.drawerTrigger;
    this.drawerTrigger = null;
    if (restoreFocus)
      afterNextRender(
        () => {
          this.focusFrame = requestAnimationFrame(() => {
            this.focusFrame = null;
            if (!this.mobileSidebarOpen() && trigger?.isConnected) trigger.focus();
          });
        },
        { injector: this.injector },
      );
  }

  private restorePageScroll(): void {
    if (this.previousOverflow !== null) document.body.style.overflow = this.previousOverflow;
    this.previousOverflow = null;
  }

  protected focusContent(event: Event): void {
    event.preventDefault();
    this.host.nativeElement.querySelector<HTMLElement>('#main-content')?.focus();
  }

  protected logout(): void {
    this.auth.logout().subscribe({
      next: () => {
        this.clinicTheme.reset();
        this.mobileSidebarOpen.set(false);
        window.location.assign('/login');
      },
      error: () =>
        this.clinicSwitchError.set(
          this.t(
            'Sign out could not be completed. Please try again.',
            'تعذر إكمال تسجيل الخروج. حاول مرة أخرى.',
          ),
        ),
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
    if (path.startsWith('/doctors') || path.startsWith('/settings') || path.startsWith('/users'))
      return 'settings';
    if (path.startsWith('/reports') || path.startsWith('/finance')) return 'reports';
    if (path.startsWith('/lab') || path.startsWith('/insurance')) return 'reports';
    if (path.startsWith('/treatment') || path.startsWith('/prescriptions')) return 'clinical';
    return 'start';
  }
}
