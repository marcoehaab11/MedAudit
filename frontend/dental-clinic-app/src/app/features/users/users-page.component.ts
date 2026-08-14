import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { DatePipe } from '@angular/common';
import { LocalizationService } from '../../core/localization.service';
import { PagedUsers, RoleSummary, UserApiService } from './user-api.service';

@Component({
  selector: 'app-users-page',
  imports: [ReactiveFormsModule, RouterLink, DatePipe],
  template: `
    <section class="page-head">
      <div><p class="eyebrow">{{ text('Clinic team', 'فريق العيادة') }}</p><h1>{{ text('Users', 'المستخدمون') }}</h1></div>
      <button class="primary" type="button" (click)="showInvite.set(!showInvite())">{{ text('Invite user', 'دعوة مستخدم') }}</button>
    </section>
    @if (success()) { <div class="alert success" role="status">{{ success() }}</div> }
    @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
    @if (showInvite()) {
      <section class="panel invite-panel">
        <h2>{{ text('Invite a team member', 'دعوة عضو للفريق') }}</h2>
        <form [formGroup]="inviteForm" (ngSubmit)="invite()" class="form-grid">
          <label>{{ text('Display name', 'الاسم') }}<input formControlName="displayName"></label>
          <label>Email<input type="email" formControlName="email"></label>
          <label>{{ text('Phone', 'الهاتف') }}<input formControlName="phone"></label>
          <label>{{ text('Role', 'الدور') }}
            <select formControlName="roleId"><option value="">{{ text('Choose role', 'اختر الدور') }}</option>
              @for (role of roles(); track role.id) { <option [value]="role.id">{{ role.name }}</option> }
            </select>
          </label>
          <div class="form-actions"><button class="primary" [disabled]="inviteForm.invalid || saving()">{{ saving() ? text('Sending…', 'جارٍ الإرسال…') : text('Send invitation', 'إرسال الدعوة') }}</button></div>
        </form>
      </section>
    }
    <form [formGroup]="filters" (ngSubmit)="load(1)" class="filters panel">
      <input formControlName="search" [placeholder]="text('Search name or email', 'ابحث بالاسم أو البريد')">
      <select formControlName="roleId"><option value="">{{ text('All roles', 'كل الأدوار') }}</option>
        @for (role of roles(); track role.id) { <option [value]="role.id">{{ role.name }}</option> }
      </select>
      <select formControlName="status"><option value="">{{ text('All statuses', 'كل الحالات') }}</option>
        <option value="1">{{ text('Invited', 'مدعو') }}</option><option value="2">{{ text('Active', 'نشط') }}</option><option value="3">{{ text('Inactive', 'غير نشط') }}</option>
      </select>
      <button type="submit">{{ text('Apply', 'تطبيق') }}</button>
    </form>
    <section class="panel table-panel">
      @if (loading()) { <div class="loading" role="status">{{ text('Loading users…', 'جارٍ تحميل المستخدمين…') }}</div> }
      @else if (!result()?.items?.length) { <div class="empty"><strong>{{ text('No users found', 'لا يوجد مستخدمون') }}</strong><p>{{ text('Invite a team member or adjust the filters.', 'ادعُ عضواً أو عدّل عوامل التصفية.') }}</p></div> }
      @else {
        <div class="table-scroll"><table><thead><tr><th>{{ text('User', 'المستخدم') }}</th><th>{{ text('Role', 'الدور') }}</th><th>{{ text('Status', 'الحالة') }}</th><th>{{ text('Created', 'تاريخ الإنشاء') }}</th><th><span class="sr-only">{{ text('Actions', 'الإجراءات') }}</span></th></tr></thead>
          <tbody>@for (user of result()!.items; track user.id) {<tr>
            <td><strong>{{ user.displayName }}</strong><small>{{ user.email }}</small></td>
            <td>{{ user.roles.join(', ') }}</td><td><span class="badge status-{{ user.status }}">{{ statusLabel(user.status) }}</span></td>
            <td>{{ user.createdAt | date:'mediumDate' }}</td><td><a [routerLink]="['/users', user.id]">{{ text('Manage', 'إدارة') }}</a></td>
          </tr>}</tbody></table></div>
        <nav class="pagination" aria-label="Pagination"><button type="button" [disabled]="result()!.page <= 1" (click)="load(result()!.page - 1)">{{ text('Previous', 'السابق') }}</button><span>{{ result()!.page }} / {{ result()!.totalPages || 1 }}</span><button type="button" [disabled]="result()!.page >= result()!.totalPages" (click)="load(result()!.page + 1)">{{ text('Next', 'التالي') }}</button></nav>
      }
    </section>
  `,
  styleUrl: './users.scss'
})
export class UsersPageComponent {
  private readonly api = inject(UserApiService);
  readonly i18n = inject(LocalizationService);
  readonly result = signal<PagedUsers | null>(null);
  readonly roles = signal<RoleSummary[]>([]);
  readonly loading = signal(true); readonly saving = signal(false);
  readonly showInvite = signal(false); readonly error = signal(''); readonly success = signal('');
  readonly filters = inject(FormBuilder).nonNullable.group({ search: '', roleId: '', status: '' });
  readonly inviteForm = inject(FormBuilder).nonNullable.group({
    displayName: ['', Validators.required], email: ['', [Validators.required, Validators.email]], phone: '', roleId: ['', Validators.required]
  });
  constructor() { this.api.roles().subscribe(value => this.roles.set(value)); this.load(1); }
  load(page: number): void {
    this.loading.set(true); const value = this.filters.getRawValue();
    this.api.users(value.search, value.roleId, value.status, page).subscribe({ next: result => { this.result.set(result); this.loading.set(false); }, error: () => { this.error.set(this.text('Could not load users.', 'تعذر تحميل المستخدمين.')); this.loading.set(false); } });
  }
  invite(): void {
    if (this.inviteForm.invalid) return; this.saving.set(true); this.error.set(''); const value = this.inviteForm.getRawValue();
    this.api.invite({ displayName: value.displayName, email: value.email, phone: value.phone || undefined, roleIds: [value.roleId] }).subscribe({
      next: () => { this.saving.set(false); this.showInvite.set(false); this.inviteForm.reset(); this.success.set(this.text('Invitation sent.', 'تم إرسال الدعوة.')); this.load(1); },
      error: () => { this.saving.set(false); this.error.set(this.text('Invitation could not be sent. Check the form and permissions.', 'تعذر إرسال الدعوة. تحقق من البيانات والصلاحيات.')); }
    });
  }
  statusLabel(status: number): string { return status === 1 ? this.text('Invited', 'مدعو') : status === 2 ? this.text('Active', 'نشط') : this.text('Inactive', 'غير نشط'); }
  text(en: string, ar: string): string { return this.i18n.language() === 'en' ? en : ar; }
}
