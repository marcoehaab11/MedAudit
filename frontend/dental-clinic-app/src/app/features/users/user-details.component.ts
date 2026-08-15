import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';
import { RoleSummary, UserApiService, UserDetails } from './user-api.service';

@Component({
  selector: 'app-user-details',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <a class="back" routerLink="/users">← {{ text('Back to users', 'العودة للمستخدمين') }}</a>
    @if (loading()) {
      <div class="loading" role="status">{{ text('Loading user…', 'جارٍ تحميل المستخدم…') }}</div>
    } @else if (error()) {
      <div class="alert error" role="alert">{{ error() }}</div>
    } @else if (user()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ text('User details', 'تفاصيل المستخدم') }}</p>
          <h1>{{ user()!.displayName }}</h1>
          <p>{{ user()!.email }}</p>
        </div>
        <span class="badge status-{{ user()!.status }}">{{ statusLabel() }}</span>
      </section>
      @if (success()) {
        <div class="alert success" role="status">{{ success() }}</div>
      }
      <div class="detail-grid">
        <section class="panel">
          <h2>{{ text('Profile', 'الملف الشخصي') }}</h2>
          <form [formGroup]="profile" (ngSubmit)="saveProfile()" class="form-grid">
            <label>{{ text('Display name', 'الاسم') }}<input formControlName="displayName" /></label
            ><label>{{ text('Phone', 'الهاتف') }}<input formControlName="phone" /></label>
            <div class="form-actions">
              <button class="primary" [disabled]="profile.invalid || saving()">
                {{ text('Save profile', 'حفظ الملف') }}
              </button>
            </div>
          </form>
        </section>
        <section class="panel">
          <h2>{{ text('Roles and permissions', 'الأدوار والصلاحيات') }}</h2>
          <p>
            {{
              text(
                'Select one or more tenant roles. Platform roles are never available here.',
                'اختر دوراً أو أكثر داخل العيادة. أدوار المنصة غير متاحة هنا.'
              )
            }}
          </p>
          <div class="role-list">
            @for (role of roles(); track role.id) {
              <label
                ><input
                  type="checkbox"
                  [checked]="selectedRoles().has(role.id)"
                  (change)="toggleRole(role.id)"
                /><span
                  ><strong>{{ role.name }}</strong
                  ><small>{{ role.description }}</small></span
                ></label
              >
            }
          </div>
          <button
            class="primary"
            type="button"
            [disabled]="selectedRoles().size === 0 || saving()"
            (click)="saveRoles()"
          >
            {{ text('Save roles', 'حفظ الأدوار') }}
          </button>
        </section>
        <section class="panel danger-zone">
          <h2>{{ text('Account status', 'حالة الحساب') }}</h2>
          @if (user()!.status === 2) {
            <button type="button" class="danger" (click)="changeStatus(false)">
              {{ text('Deactivate user', 'إلغاء تنشيط المستخدم') }}
            </button>
          } @else if (user()!.status === 3) {
            <button type="button" class="primary" (click)="changeStatus(true)">
              {{ text('Activate user', 'تنشيط المستخدم') }}
            </button>
          } @else {
            <button type="button" class="danger" (click)="changeStatus(false)">
              {{ text('Cancel invitation', 'إلغاء الدعوة') }}
            </button>
          }
        </section>
      </div>
    }
  `,
  styleUrl: './users.scss',
})
export class UserDetailsComponent {
  private readonly api = inject(UserApiService);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly i18n = inject(LocalizationService);
  readonly user = signal<UserDetails | null>(null);
  readonly roles = signal<RoleSummary[]>([]);
  readonly selectedRoles = signal(new Set<string>());
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly success = signal('');
  readonly profile = inject(FormBuilder).nonNullable.group({
    displayName: ['', Validators.required],
    phone: '',
  });
  constructor() {
    this.api.roles().subscribe((value) => this.roles.set(value));
    this.load();
  }
  load(): void {
    this.api.user(this.id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.profile.setValue({ displayName: user.displayName, phone: user.phone ?? '' });
        this.selectedRoles.set(new Set(user.roles.map((x) => x.id)));
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.text('User not found or access denied.', 'المستخدم غير موجود أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }
  toggleRole(id: string): void {
    const roles = new Set(this.selectedRoles());
    roles.has(id) ? roles.delete(id) : roles.add(id);
    this.selectedRoles.set(roles);
  }
  saveProfile(): void {
    if (this.profile.invalid) return;
    this.saving.set(true);
    const value = this.profile.getRawValue();
    this.api
      .update(this.id, { displayName: value.displayName, phone: value.phone || undefined })
      .subscribe({
        next: () => this.done(this.text('Profile updated.', 'تم تحديث الملف.')),
        error: () => this.failed(),
      });
  }
  saveRoles(): void {
    this.saving.set(true);
    this.api
      .assignRoles(this.id, [...this.selectedRoles()])
      .subscribe({
        next: () => this.done(this.text('Roles updated.', 'تم تحديث الأدوار.')),
        error: () => this.failed(),
      });
  }
  changeStatus(active: boolean): void {
    if (
      !confirm(
        this.text(
          active ? 'Activate this user?' : 'Deactivate this user?',
          active ? 'تنشيط هذا المستخدم؟' : 'إلغاء تنشيط هذا المستخدم؟',
        ),
      )
    )
      return;
    this.saving.set(true);
    this.api.setActive(this.id, active).subscribe({
      next: () => {
        this.done(this.text('Account status updated.', 'تم تحديث حالة الحساب.'));
        this.load();
      },
      error: () => this.failed(),
    });
  }
  statusLabel = computed(() =>
    this.user()?.status === 1
      ? this.text('Invited', 'مدعو')
      : this.user()?.status === 2
        ? this.text('Active', 'نشط')
        : this.text('Inactive', 'غير نشط'),
  );
  private done(message: string): void {
    this.saving.set(false);
    this.error.set('');
    this.success.set(message);
  }
  private failed(): void {
    this.saving.set(false);
    this.error.set(this.text('The change was rejected.', 'تم رفض التغيير.'));
  }
  text(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
