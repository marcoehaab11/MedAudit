import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { LocalizationService } from '../../core/localization.service';
import { PagedUsers, RoleSummary, UserApiService, UserListItem } from './user-api.service';
import { PhoneInputComponent } from '../../shared/phone-input/phone-input.component';
import { PermissionMatrixComponent } from './permission-matrix.component';
import { AuthService } from '../../core/auth.service';

@Component({
  styleUrl: './users.scss',
  selector: 'app-users-page',
  imports: [FormsModule, ReactiveFormsModule, RouterLink, DatePipe, PhoneInputComponent, PermissionMatrixComponent],
  template: `
    <section class="page-head">
      <div class="head-info">
        <p class="eyebrow">{{ text('Clinic Team & Access', 'فريق العيادة والصلاحيات') }}</p>
        <h1>{{ text('Staff & Users', 'المستخدمون وفريق العمل') }}</h1>
        <p class="subtitle">
          {{
            text(
              'Manage clinic doctors, receptionists, administrators, and account permissions.',
              'إدارة أطباء العيادة وموظفي الاستقبال والإدارة وتعيين الصلاحيات.'
            )
          }}
        </p>
      </div>
      @if (auth.hasPermission('Users.Create') && auth.hasPermission('Users.ManageRoles')) { <button class="button primary add-user-btn" type="button" (click)="openAddModal()">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <line x1="19" y1="8" x2="19" y2="14"/>
          <line x1="22" y1="11" x2="16" y2="11"/>
        </svg>
        <span>+ {{ text('Add user', 'إضافة مستخدم') }}</span>
      </button> }
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

    @if (error()) {
      <div class="alert error" role="alert">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="alert-icon">
          <circle cx="12" cy="12" r="10"/>
          <line x1="12" y1="8" x2="12" y2="12"/>
          <line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
        <span>{{ error() }}</span>
      </div>
    }

    <!-- Quick Stats Grid -->
    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-icon total-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
        </div>
        <div class="stat-info">
          <strong>{{ result()?.totalCount || 0 }}</strong>
          <span>{{ text('Total members', 'إجمالي الفريق') }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon doctor-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 2C6.5 2 4 6.5 4 10c0 4 2 7 3.5 10 .8 1.6 1.8 2 2.5 2 .8 0 1.2-.5 2-2 .8 1.5 1.2 2 2 2 .7 0 1.7-.4 2.5-2 1.5-3 3.5-6 3.5-10 0-3.5-2.5-8-8-8z"/>
          </svg>
        </div>
        <div class="stat-info">
          <strong>{{ doctorCount() }}</strong>
          <span>{{ text('Doctors', 'الأطباء') }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon active-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="stat-info">
          <strong>{{ activeCount() }}</strong>
          <span>{{ text('Active accounts', 'حسابات نشطة') }}</span>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon admin-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          </svg>
        </div>
        <div class="stat-info">
          <strong>{{ adminCount() }}</strong>
          <span>{{ text('Admins & staff', 'الإدارة والمساعدون') }}</span>
        </div>
      </div>
    </div>

    <!-- Filters & Search Toolbar -->
    <form [formGroup]="filters" (ngSubmit)="load(1)" class="filters-toolbar panel">
      <div class="search-box">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="search-icon">
          <circle cx="11" cy="11" r="8"/>
          <line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          formControlName="search"
          [placeholder]="text('Search by name, email, or phone…', 'ابحث بالاسم، البريد، أو الهاتف…')"
        />
      </div>

      <div class="select-group">
        <select formControlName="roleId">
          <option value="">{{ text('All roles', 'كل الأدوار والصلاحيات') }}</option>
          @for (role of roles(); track role.id) {
            <option [value]="role.id">{{ role.name }}</option>
          }
        </select>

        <select formControlName="status">
          <option value="">{{ text('All statuses', 'كل الحالات') }}</option>
          <option value="2">{{ text('Active', 'نشط') }}</option>
          <option value="1">{{ text('Invited', 'مدعو') }}</option>
          <option value="3">{{ text('Inactive', 'غير نشط') }}</option>
        </select>

        <button type="submit" class="button search-submit">
          <span>{{ text('Search', 'بحث') }}</span>
        </button>

        @if (hasActiveFilters()) {
          <button type="button" class="button clear-btn" (click)="clearFilters()">
            {{ text('Reset', 'إلغاء التصفية') }}
          </button>
        }
      </div>
    </form>

    <!-- Users Table Panel -->
    <section class="panel table-panel">
      @if (loading()) {
        <div class="loading-box" role="status">
          <div class="spinner"></div>
          <p>{{ text('Loading users…', 'جارٍ تحميل قائمة المستخدمين…') }}</p>
        </div>
      } @else if (!result()?.items?.length) {
        <div class="empty-box">
          <div class="empty-icon">👥</div>
          <strong>{{ text('No users found', 'لا يوجد مستخدمون مطابقون') }}</strong>
          <p>
            {{
              text(
                'Try adjusting your search criteria or add a new team member.',
                'جرّب تغيير معايير البحث أو أضف عضواً جديداً إلى الفريق.'
              )
            }}
          </p>
          @if (auth.hasPermission('Users.Create') && auth.hasPermission('Users.ManageRoles')) { <button type="button" class="button primary" (click)="openAddModal()">
            + {{ text('Add user', 'إضافة مستخدم') }}
          </button> }
        </div>
      } @else {
        <div class="table-scroll">
          <div class="table-responsive"><table class="users-table">
            <thead>
              <tr>
                <th>{{ text('Team Member', 'العضو') }}</th>
                <th>{{ text('Role & Permissions', 'الدور والصلاحيات') }}</th>
                <th>{{ text('Phone', 'الهاتف') }}</th>
                <th>{{ text('Status', 'الحالة') }}</th>
                <th>{{ text('Joined Date', 'تاريخ الانضمام') }}</th>
                <th class="text-end">{{ text('Action', 'الإجراء') }}</th>
              </tr>
            </thead>
            <tbody>
              @for (user of result()!.items; track user.id) {
                <tr>
                  <td>
                    <div class="user-identity">
                      <div class="avatar" [class.doctor-avatar]="isDoctorUser(user)" [class.admin-avatar]="isAdminUser(user)">
                        {{ getInitials(user.displayName) }}
                      </div>
                      <div class="name-box">
                        <strong>{{ user.displayName }}</strong>
                        <small>{{ user.email }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div class="roles-wrap">
                      @for (r of user.roles; track r) {
                        <span class="role-pill" [class.role-doctor]="r.toLowerCase().includes('doctor')" [class.role-admin]="r.toLowerCase().includes('admin')">
                          @if (r.toLowerCase().includes('doctor')) { 🩺 }
                          @if (r.toLowerCase().includes('admin')) { 🛡️ }
                          {{ r }}
                        </span>
                      }
                    </div>
                  </td>
                  <td>
                    <span class="phone-text">{{ user.phone || '—' }}</span>
                  </td>
                  <td>
                    <span class="status-indicator status-{{ user.status }}">
                      <span class="status-dot"></span>
                      {{ statusLabel(user.status) }}
                    </span>
                  </td>
                  <td>
                    <span class="date-text">{{ user.createdAt | date: 'dd/MM/yyyy' }}</span>
                  </td>
                  <td class="text-end">
                    <a class="manage-btn" [routerLink]="['/users', user.id]">
                      <span>{{ text('Manage', 'إدارة') }}</span>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="arrow-icon">
                        <polyline points="9 18 15 12 9 6"/>
                      </svg>
                    </a>
                  </td>
                </tr>
              }
            </tbody>
          </table></div>
        </div>

        <nav class="pagination" aria-label="Pagination">
          <button type="button" class="button" [disabled]="result()!.page <= 1" (click)="load(result()!.page - 1)">
            {{ text('Previous', 'السابق') }}
          </button>
          <span class="page-indicator">
            {{ text('Page', 'صفحة') }} {{ result()!.page }} {{ text('of', 'من') }} {{ result()!.totalPages || 1 }}
          </span>
          <button
            type="button"
            class="button"
            [disabled]="result()!.page >= result()!.totalPages"
            (click)="load(result()!.page + 1)"
          >
            {{ text('Next', 'التالي') }}
          </button>
        </nav>
      }
    </section>

    <!-- Professional Fixed POPUP Modal -->
    @if (showAddUser()) {
      <div class="modal-backdrop" (click)="closeAddModal()">
        <div class="modal-card user-modal" (click)="$event.stopPropagation()">
          <div class="modal-header">
            <div class="modal-title-wrap">
              <div class="title-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <line x1="19" y1="8" x2="19" y2="14"/>
                  <line x1="22" y1="11" x2="16" y2="11"/>
                </svg>
              </div>
              <div>
                <h3>{{ text('Add Team Member', 'إضافة مستخدم جديد') }}</h3>
                <small>{{ inviteMode() ? text('An invitation links an existing Planora account or creates a new one.', 'الدعوة تربط حساب Planora موجود أو تنشئ حساباً جديداً.') : text('A new account is created active and ready for login.', 'يتم إنشاء حساب جديد مفعلاً وجاهزاً للدخول.') }}</small>
              </div>
            </div>
            <button type="button" class="close-btn" (click)="closeAddModal()" aria-label="Close">✕</button>
          </div>

          <form [formGroup]="userForm" (ngSubmit)="createUser()">
            <div class="modal-body compact-modal-body">
              <div class="d-flex gap-2 mb-3">
                <button type="button" class="button" [class.primary]="!inviteMode()" (click)="setInviteMode(false)">{{ text('Create new account', 'إنشاء حساب جديد') }}</button>
                <button type="button" class="button" [class.primary]="inviteMode()" (click)="setInviteMode(true)">{{ text('Invite existing or new account', 'دعوة حساب موجود أو جديد') }}</button>
              </div>
              @if (modalError()) {
                <div class="alert error" style="margin: 0;">{{ modalError() }}</div>
              }

              <div class="form-grid">
                <label>
                  <span>{{ text('Full Name', 'الاسم بالكامل') }} <strong class="req">*</strong></span>
                  <input
                    formControlName="displayName"
                    [placeholder]="text('e.g. Dr. Sarah Ahmed', 'مثال: د. سارة أحمد')"
                    [class.invalid]="userForm.controls.displayName.touched && userForm.controls.displayName.invalid"
                  />
                  @if (userForm.controls.displayName.touched && userForm.controls.displayName.invalid) {
                    <span class="field-error">{{ text('Name is required.', 'الاسم مطلوب.') }}</span>
                  }
                </label>

                <label>
                  <span>{{ text('Role & Access', 'الدور ومستوى الصلاحيات') }} <strong class="req">*</strong></span>
                  <select
                    formControlName="roleId"
                    (change)="onRoleChanged()"
                    [class.invalid]="userForm.controls.roleId.touched && userForm.controls.roleId.invalid"
                  >
                    <option value="">{{ text('Choose role…', 'اختر الدور…') }}</option>
                    @for (role of roles(); track role.id) {
                      <option [value]="role.id">{{ role.name }}</option>
                    }
                  </select>
                  @if (userForm.controls.roleId.touched && userForm.controls.roleId.invalid) {
                    <span class="field-error">{{ text('Please select a role.', 'يرجى اختيار دور للمستخدم.') }}</span>
                  }
                </label>

                <label>
                  <span>{{ text('Email Address', 'البريد الإلكتروني') }} <strong class="req">*</strong></span>
                  <input
                    type="email"
                    formControlName="email"
                    [placeholder]="text('user@clinic.com', 'user@clinic.com')"
                    [class.invalid]="userForm.controls.email.touched && userForm.controls.email.invalid"
                  />
                  @if (userForm.controls.email.touched && userForm.controls.email.invalid) {
                    <span class="field-error">{{ text('A valid email is required.', 'يرجى إدخال بريد إلكتروني صحيح.') }}</span>
                  }
                </label>

                <label>
                  <span>{{ text('Phone Number', 'رقم الهاتف') }}</span>
                  <app-phone-input
                    formControlName="phone"
                    [placeholder]="text('e.g. 01012345678', 'مثال: 01012345678')"
                    [class.invalid]="userForm.controls.phone.touched && userForm.controls.phone.invalid"
                  ></app-phone-input>
                  @if (userForm.controls.phone.touched && userForm.controls.phone.errors?.['invalidPhone']) {
                    <span class="field-error" style="color: #dc2626; display: block; font-size: 0.8rem; margin-top: 0.25rem;">
                      {{ text('Phone number must have at least 10 digits.', 'رقم الهاتف يجب أن يحتوي على 10 أرقام على الأقل.') }}
                    </span>
                  }
                </label>

                @if (!inviteMode()) { <label style="grid-column: 1 / -1;">
                  <span>{{ text('Password', 'كلمة المرور') }} <strong class="req">*</strong></span>
                  <div class="password-wrapper">
                    <input
                      [type]="showPassword() ? 'text' : 'password'"
                      formControlName="password"
                      [placeholder]="text('At least 6 characters', '6 أحرف أو أرقام على الأقل')"
                      [class.invalid]="userForm.controls.password.touched && userForm.controls.password.invalid"
                    />
                    <button type="button" class="toggle-pwd-btn" (click)="showPassword.set(!showPassword())" tabindex="-1">
                      {{ showPassword() ? '👁️' : '👁️‍🗨️' }}
                    </button>
                  </div>
                  @if (userForm.controls.password.touched && userForm.controls.password.invalid) {
                    <span class="field-error">{{ text('Password must be at least 6 characters.', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل.') }}</span>
                  }
                </label> }
              </div>

              <label class="permission-mode"><input type="checkbox" [checked]="customizePermissions()" (change)="toggleCustomization()" />{{ text('Customize access to each module for this user', 'تخصيص صلاحيات كل موديول لهذا المستخدم') }}</label>
              @if (customizePermissions()) {
                <p>{{ text('The choices below replace the role access for this user. Select view, edit and sensitive actions as needed.', 'الاختيارات دي هتبقى صلاحيات المستخدم الفعلية بدل صلاحيات الدور. حدد العرض والتعديل والعمليات الحساسة حسب الحاجة.') }}</p>
                <app-permission-matrix [catalog]="permissionCatalog()" [selected]="selectedPermissions()" [arabic]="i18n.language() === 'ar'" (selectedChange)="selectedPermissions.set($event)" />
              }

              <div class="doctor-note-strip">
                <span class="note-icon">✨</span>
                <span>{{ text('If "Doctor" is selected, their doctor profile & scheduling will be activated automatically.', 'عند اختيار دور "طبيب"، يتم تلقائياً إنشاء ملف الطبيب وتفعيله في المواعيد والمخطط السني.') }}</span>
              </div>
            </div>

            <div class="modal-footer">
              <button type="button" class="button" (click)="closeAddModal()">{{ text('Cancel', 'إلغاء') }}</button>
              <button type="submit" class="button primary submit-btn" [disabled]="userForm.invalid || saving()">
                {{ saving() ? text('Saving…', 'جارٍ الحفظ…') : inviteMode() ? text('Send clinic invitation', 'إرسال دعوة العيادة') : text('Create & Activate User', 'إضافة وتفعيل الحساب فوراً') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
})
export class UsersPageComponent {
  private readonly api = inject(UserApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly result = signal<PagedUsers | null>(null);
  readonly roles = signal<RoleSummary[]>([]);
  readonly permissionCatalog = signal<string[]>([]);
  readonly customizePermissions = signal(false);
  readonly selectedPermissions = signal<string[]>([]);
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showAddUser = signal(false);
  readonly showPassword = signal(false);
  readonly inviteMode = signal(false);
  readonly error = signal('');
  readonly modalError = signal('');
  readonly success = signal('');

  readonly filters = inject(FormBuilder).nonNullable.group({
    search: '',
    roleId: '',
    status: '',
  });

  readonly userForm = inject(FormBuilder).nonNullable.group({
    displayName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    phone: '',
    roleId: ['', Validators.required],
  });

  readonly doctorCount = computed(() => {
    return this.result()?.items?.filter((u: UserListItem) => u.roles.some((r: string) => r.toLowerCase().includes('doctor'))).length ?? 0;
  });

  readonly activeCount = computed(() => {
    return this.result()?.items?.filter((u: UserListItem) => u.status === 2).length ?? 0;
  });

  readonly adminCount = computed(() => {
    return this.result()?.items?.filter((u: UserListItem) => u.roles.some((r: string) => r.toLowerCase().includes('admin'))).length ?? 0;
  });

  constructor() {
    this.api.roles().subscribe((value) => {
      this.roles.set(value);
    });
    this.api.permissionCatalog().subscribe({ next: value => this.permissionCatalog.set(value) });
    this.load(1);
  }

  load(page: number): void {
    this.loading.set(true);
    const value = this.filters.getRawValue();
    this.api.users(value.search, value.roleId, value.status, page).subscribe({
      next: (result) => {
        this.result.set(result);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(this.text('Could not load users.', 'تعذر تحميل المستخدمين.'));
        this.loading.set(false);
      },
    });
  }

  hasActiveFilters(): boolean {
    const v = this.filters.getRawValue();
    return !!(v.search || v.roleId || v.status);
  }

  clearFilters(): void {
    this.filters.reset({ search: '', roleId: '', status: '' });
    this.load(1);
  }

  openAddModal(): void {
    this.modalError.set('');
    this.userForm.reset({
      displayName: '',
      email: '',
      password: '',
      phone: '',
      roleId: this.roles().length ? this.roles()[0].id : '',
    });
    this.showPassword.set(false);
    this.setInviteMode(false);
    this.customizePermissions.set(false);
    this.selectedPermissions.set([]);
    this.showAddUser.set(true);
  }

  closeAddModal(): void {
    this.showAddUser.set(false);
  }

  setInviteMode(invite: boolean): void {
    this.inviteMode.set(invite);
    this.userForm.controls.password.setValidators(invite ? [] : [Validators.required, Validators.minLength(6)]);
    this.userForm.controls.password.updateValueAndValidity();
  }

  toggleCustomization(): void {
    this.customizePermissions.set(!this.customizePermissions());
    if (this.customizePermissions()) this.onRoleChanged();
  }

  onRoleChanged(): void {
    if (!this.customizePermissions()) return;
    const roleId = this.userForm.controls.roleId.value;
    if (roleId) this.api.role(roleId).subscribe({ next: role => this.selectedPermissions.set(role.permissions), error: () => this.modalError.set(this.text('Could not load role permissions.', 'تعذر تحميل صلاحيات الدور.')) });
  }

  createUser(): void {
    this.userForm.markAllAsTouched();
    if (this.userForm.invalid) return;

    this.saving.set(true);
    this.error.set('');
    this.modalError.set('');
    this.success.set('');
    const value = this.userForm.getRawValue();

    const request = {
        displayName: value.displayName,
        email: value.email,
        phone: value.phone || undefined,
        roleIds: [value.roleId],
        permissions: this.customizePermissions() ? this.selectedPermissions() : null,
    };
    (this.inviteMode() ? this.api.invite(request) : this.api.createUser({ ...request, password: value.password }))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.showAddUser.set(false);
          this.userForm.reset();
          this.success.set(this.inviteMode()
            ? this.text(`Invitation sent to ${value.email}.`, `تم إرسال الدعوة إلى ${value.email}.`)
            : this.text(
              `User "${value.displayName}" was added and activated successfully!`,
              `تم إضافة وتفعيل حساب "${value.displayName}" بنجاح، ويمكنه تسجيل الدخول الآن.`,
            ),
          );
          this.load(1);
        },
        error: (err) => {
          this.saving.set(false);
          const msg =
            err?.error?.message ||
            (err?.error?.errors && Object.values(err.error.errors).flat().join(', ')) ||
            this.text(
              'User could not be created. Please verify the entered data.',
              'تعذر إنشاء المستخدم. يرجى التحقق من صحة البيانات المدخلة.',
            );
          this.modalError.set(msg);
        },
      });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }

  isDoctorUser(user: UserListItem): boolean {
    return user.roles.some((r: string) => r.toLowerCase().includes('doctor'));
  }

  isAdminUser(user: UserListItem): boolean {
    return user.roles.some((r: string) => r.toLowerCase().includes('admin'));
  }

  statusLabel(status: number): string {
    return status === 1
      ? this.text('Invited', 'مدعو')
      : status === 2
        ? this.text('Active', 'نشط')
        : this.text('Inactive', 'غير نشط');
  }

  text(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}


