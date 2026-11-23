import { Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { FINANCE_TABS } from '../../core/navigation';

@Component({
  selector: 'app-finance-nav',
  imports: [RouterLink, RouterLinkActive],
  styleUrl: './finance-nav.component.scss',
  template: `
    <nav [attr.aria-label]="isArabic() ? 'أقسام المالية' : 'Finance sections'">
      @for (tab of tabs(); track tab.path) {
        <a [routerLink]="tab.path" routerLinkActive="active" ariaCurrentWhenActive="page"
          [routerLinkActiveOptions]="tab.path === '/finance' ? dashboardMatch : sectionMatch">
          {{ isArabic() ? tab.ar : tab.en }}
        </a>
      }
    </nav>
  `,
})
export class FinanceNavComponent {
  private readonly auth = inject(AuthService);
  private readonly i18n = inject(LocalizationService);
  protected readonly isArabic = computed(() => this.i18n.language() === 'ar');
  protected readonly tabs = computed(() =>
    FINANCE_TABS.filter((tab) => tab.permissions.every((permission) => this.auth.hasPermission(permission))),
  );
  protected readonly dashboardMatch = {
    paths: 'exact', queryParams: 'ignored', matrixParams: 'ignored', fragment: 'ignored',
  } as const;
  protected readonly sectionMatch = { ...this.dashboardMatch, paths: 'subset' } as const;
}
