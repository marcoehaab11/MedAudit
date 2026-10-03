import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { DoctorApiService } from '../doctors/doctor-api.service';
import { RoleSummary, UserApiService, UserDetails } from './user-api.service';
import { PhoneInputComponent } from '../../shared/phone-input/phone-input.component';
import { PermissionMatrixComponent } from './permission-matrix.component';

@Component({
  styleUrl: './users.scss',
  selector: 'app-user-details',
  imports: [ReactiveFormsModule, RouterLink, DatePipe, PhoneInputComponent, PermissionMatrixComponent],
  template: `
    <a class="back" routerLink="/users">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="inline-size: 1rem; block-size: 1rem;">
        <line x1="19" y1="12" x2="5" y2="12"/>
        <polyline points="12 19 5 12 12 5"/>
      </svg>
      <span>{{ text('Back to users list', 'العودة لقائمة المستخدمين') }}</span>
    </a>

    @if (loading()) {
      <div class="loading-box" role="status">
        <div class="spinner"></div>
        <p>{{ text('Loading user details…', 'جارٍ تحميل بيانات المستخدم…') }}</p>
      </div>
    } @else if (error()) {
      <div class="alert error" role="alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-icon">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ error() }}</span>
      </div>
    } @else if (user()) {
      <section class="user-hero-card panel">
        <div class="hero-main">
          <div class="avatar hero-avatar" [class.doctor-avatar]="isDoctor()" [class.admin-avatar]="isAdmin()">
            {{ getInitials(user()!.displayName) }}
          </div>
          <div class="hero-details">
            <div class="hero-title-row">
              <h1>{{ user()!.displayName }}</h1>
              <span class="status-indicator status-{{ user()!.status }}">
                <span class="status-dot"></span>
                {{ statusLabel() }}
              </span>
            </div>
            <p class="hero-email">{{ user()!.email }}</p>
            <div class="hero-meta">
              <span>📅 {{ text('Joined', 'تاريخ الانضمام') }}: {{ user()!.createdAt | date: 'dd/MM/yyyy' }}</span>
              <span>🕒 {{ text('Updated', 'آخر تعديل') }}: {{ user()!.updatedAt | date: 'dd/MM/yyyy HH:mm' }}</span>
            </div>
          </div>
        </div>
      </section>

      @if (success()) {
        <div class="alert success" role="status">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-icon">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          <span>{{ success() }}</span>
        </div>
      }

      <div class="detail-grid">
        <!-- Profile Info Form -->
        <section class="panel">
          <div class="panel-head-icon">
            <div class="icon-circle">👤</div>
            <div>
              <h2>{{ text('Profile Information', 'البيانات الشخصية') }}</h2>
              <p class="panel-desc">{{ text('Update staff display name and contact phone.', 'تعديل اسم العضو ورقم الهاتف المسجل.') }}</p>
            </div>
          </div>

          <form [formGroup]="profile" (ngSubmit)="saveProfile()" class="form-vertical">
            <label>
              <span>{{ text('Full Name', 'الاسم الكامل') }} <strong class="req">*</strong></span>
              <input formControlName="displayName" [readonly]="!auth.hasPermission('Users.Edit')" [class.invalid]="profile.controls.displayName.invalid && profile.controls.displayName.touched" />
              @if (profile.controls.displayName.invalid && profile.controls.displayName.touched) {
                <span class="field-error">{{ text('Name is required.', 'الاسم مطلوب.') }}</span>
              }
            </label>

            <label>
              <span>{{ text('Phone Number', 'رقم الهاتف') }}</span>
              <app-phone-input
                formControlName="phone"
                [disabled]="!auth.hasPermission('Users.Edit')"
                [class.invalid]="profile.controls.phone.touched && profile.controls.phone.invalid"
              ></app-phone-input>
              @if (profile.controls.phone.touched && profile.controls.phone.errors?.['invalidPhone']) {
                <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                  {{ text('Phone number must have at least 10 digits.', 'رقم الهاتف يجب أن يحتوي على 10 أرقام على الأقل.') }}
                </span>
              }
            </label>

            <label>
              <span>{{ text('Email Address (Fixed)', 'البريد الإلكتروني (غير قابل للتعديل)') }}</span>
              <input [value]="user()!.email" disabled style="background: var(--surface); color: var(--muted); cursor: not-allowed;" />
            </label>

            @if (auth.hasPermission('Users.Edit')) { <div class="form-actions-inline">
              <button class="button primary" [disabled]="profile.invalid || saving()">
                {{ saving() ? text('Saving…', 'جارٍ الحفظ…') : text('Save Profile', 'حفظ التعديلات') }}
              </button>
            </div> }
          </form>
        </section>

        <!-- Roles and Permissions -->
        @if (auth.hasPermission('Users.ManageRoles') && id !== auth.userId()) { <section class="panel">
          <div class="panel-head-icon">
            <div class="icon-circle">🛡️</div>
            <div>
              <h2>{{ text('Roles & Permissions', 'الأدوار والصلاحيات') }}</h2>
              <p class="panel-desc">{{ text('Select assigned clinic roles for this member.', 'حدد الأدوار المسندة لهذا العضو في العيادة.') }}</p>
            </div>
          </div>

          <div class="role-list">
            @for (role of roles(); track role.id) {
              <label class="role-checkbox-card" [class.checked]="selectedRoles().has(role.id)">
                <input
                  type="checkbox"
                  [checked]="selectedRoles().has(role.id)"
                  (change)="toggleRole(role.id)"
                />
                <div class="role-card-text">
                  <div class="role-title">
                    @if (role.name.toLowerCase().includes('doctor')) { 🩺 }
                    @if (role.name.toLowerCase().includes('admin')) { 🛡️ }
                    @if (role.name.toLowerCase().includes('reception')) { 📋 }
                    @if (role.name.toLowerCase().includes('assistant')) { 🦷 }
                    <strong>{{ role.name }}</strong>
                  </div>
                  <small>{{ role.description || text('Clinic member role', 'صلاحيات طاقم العيادة') }}</small>
                </div>
              </label>
            }
          </div>

          <div class="form-actions-inline">
            <button
              class="button primary"
              type="button"
              [disabled]="selectedRoles().size === 0 || saving()"
              (click)="saveRoles()"
            >
              {{ saving() ? text('Updating…', 'جارٍ التحديث…') : text('Update Roles', 'تحديث الأدوار والصلاحيات') }}
            </button>
          </div>
        </section> }

        @if (auth.hasPermission('Users.ManageRoles') && id !== auth.userId()) {
          <section class="panel">
            <div class="panel-head-icon"><div class="icon-circle">🔐</div><div><h2>{{ text('Access by module', 'صلاحيات كل موديول') }}</h2><p class="panel-desc">{{ text('Customize this user’s effective permissions, or use the assigned roles.', 'خصص الصلاحيات الفعلية لهذا المستخدم أو استخدم صلاحيات الأدوار المسندة.') }}</p></div></div>
            <label class="permission-mode"><input type="checkbox" [checked]="customPermissions() !== null" (change)="toggleCustomPermissions()" />{{ text('Custom permissions', 'صلاحيات مخصصة') }}</label>
            @if (customPermissions() !== null) { <app-permission-matrix [catalog]="permissionCatalog()" [selected]="customPermissions()!" [arabic]="i18n.language() === 'ar'" (selectedChange)="customPermissions.set($event)" /> }
            <div class="form-actions-inline"><button class="button primary" type="button" [disabled]="saving()" (click)="savePermissions()">{{ text('Save permissions', 'حفظ الصلاحيات') }}</button></div>
          </section>
        }

        <!-- Danger / Account Status Zone -->
        @if (id !== auth.userId() && (auth.hasPermission('Users.Activate') || auth.hasPermission('Users.Deactivate'))) { <section class="panel danger-zone">
          <div class="danger-head">
            <div class="danger-icon">⚠️</div>
            <div>
              <h2>{{ text('Account Status & Access Control', 'التحكم في حالة الحساب') }}</h2>
              <p class="danger-desc">
                {{
                  text(
                    'Deactivating a user revokes login access immediately. Their existing records and audit history remain intact.',
                    'إلغاء تنشيط الحساب يمنع المستخدم من تسجيل الدخول فوراً مع بقاء سجلاته التاريخية سليمة.'
                  )
                }}
              </p>
            </div>
          </div>

          <div class="danger-actions">
            @if (user()!.status === 2 && auth.hasPermission('Users.Deactivate')) {
              <button type="button" class="button danger" (click)="changeStatus(false)">
                {{ text('Deactivate Account', 'إلغاء تنشيط الحساب') }}
              </button>
            } @else if (user()!.status === 3 && auth.hasPermission('Users.Activate')) {
              <button type="button" class="button primary" (click)="changeStatus(true)">
                {{ text('Activate Account', 'إعادة تنشيط الحساب') }}
              </button>
            } @else if (auth.hasPermission('Users.Deactivate')) {
              <button type="button" class="button danger" (click)="changeStatus(false)">
                {{ text('Cancel Invitation', 'إلغاء الدعوة') }}
              </button>
            }
          </div>
        </section> }
      </div>
    }
  `,
})
export class UserDetailsComponent {
  private readonly api = inject(UserApiService);
  private readonly doctorApi = inject(DoctorApiService);
  readonly auth = inject(AuthService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly i18n = inject(LocalizationService);
  readonly user = signal<UserDetails | null>(null);
  readonly roles = signal<RoleSummary[]>([]);
  readonly selectedRoles = signal(new Set<string>());
  readonly permissionCatalog = signal<string[]>([]);
  readonly customPermissions = signal<string[] | null>(null);
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
    if (this.auth.hasPermission('Users.ManageRoles')) this.api.permissionCatalog().subscribe({ next: value => this.permissionCatalog.set(value) });
    this.load();
  }

  load(): void {
    this.api.user(this.id).subscribe({
      next: (user) => {
        this.user.set(user);
        this.profile.setValue({ displayName: user.displayName, phone: user.phone ?? '' });
        this.selectedRoles.set(new Set(user.roles.map((x) => x.id)));
        this.customPermissions.set(user.customPermissions);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(
          this.text('User not found or access denied.', 'المستخدم غير موجود أو تم رفض الوصول.'),
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
        next: () => {
          if (this.id === this.auth.userId()) {
            this.auth.setDisplayName(value.displayName);
          }
          this.doctorApi.invalidateCache();
          this.done(this.text('User profile updated successfully.', 'تم تحديث بيانات الملف الشخصي بنجاح.'));
          this.load();
        },
        error: () => this.failed(),
      });
  }

  saveRoles(): void {
    this.saving.set(true);
    this.api
      .assignRoles(this.id, [...this.selectedRoles()])
      .subscribe({
        next: () => {
          this.done(this.text('Assigned roles updated successfully.', 'تم تحديث الأدوار والصلاحيات المسندة بنجاح.'));
          this.load();
        },
        error: () => this.failed(),
      });
  }

  toggleCustomPermissions(): void {
    this.customPermissions.set(this.customPermissions() === null ? [...(this.user()?.effectivePermissions || [])] : null);
  }

  savePermissions(): void {
    this.saving.set(true);
    this.api.setPermissions(this.id, this.customPermissions()).subscribe({
      next: () => { this.done(this.text('Permissions updated.', 'تم تحديث الصلاحيات.')); this.load(); },
      error: () => this.failed(),
    });
  }

  changeStatus(active: boolean): void {
    if (
      !confirm(
        this.text(
          active ? 'Are you sure you want to activate this user account?' : 'Are you sure you want to deactivate this user account?',
          active ? 'هل أنت متأكد من رغبتك في تنشيط حساب هذا المستخدم؟' : 'هل أنت متأكد من رغبتك في إلغاء تنشيط حساب هذا المستخدم؟',
        ),
      )
    )
      return;
    this.saving.set(true);
    this.api.setActive(this.id, active).subscribe({
      next: () => {
        this.done(
          this.text(
            active ? 'User account activated successfully.' : 'User account deactivated.',
            active ? 'تم تنشيط حساب المستخدم بنجاح.' : 'تم إلغاء تنشيط حساب المستخدم.',
          ),
        );
        this.load();
      },
      error: () => this.failed(),
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  isDoctor(): boolean {
    return this.user()?.roles.some((r) => r.name.toLowerCase().includes('doctor')) ?? false;
  }

  isAdmin(): boolean {
    return this.user()?.roles.some((r) => r.name.toLowerCase().includes('admin')) ?? false;
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
    this.error.set(this.text('The change could not be completed.', 'تعذر إتمام التغيير.'));
  }

  text(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

