import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';

interface InvitationPreview {
  status: number;
  email?: string;
  role?: string;
  expiresAt?: string;
  usesExistingAccount?: boolean;
}

@Component({
  styleUrl: './auth.scss',

  selector: 'app-accept-invitation',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <div class="auth-wrapper">
      <div class="auth-layout single-card-layout">
        <main class="auth-card-wrapper">
          <section class="auth-card">
            <div class="card-header">
              <div class="clinic-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                  <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                </svg>
                <span>{{ text('Account Invitation', 'دعوة انضمام للعيادة') }}</span>
              </div>
              <h1>{{ preview()?.usesExistingAccount ? text('Join another clinic', 'الانضمام لعيادة أخرى') : text('Activate your account', 'تفعيل حسابك في العيادة') }}</h1>
              <p class="subtitle">
                {{
                  preview()?.usesExistingAccount ? text('Enter your current account password to activate access to this clinic. Your password will stay the same.', 'اكتب كلمة مرور حسابك الحالية لتفعيل دخول العيادة دي. كلمة المرور مش هتتغير.') : text(
                    'Set your password to activate your clinic account and access patient records.',
                    'قم بتعيين كلمة المرور لتفعيل حسابك والبدء في استخدام النظام.'
                  )
                }}
              </p>
            </div>

            @if (loading()) {
              <div class="loading-state" role="status">
                <span class="spinner brand-spinner" aria-hidden="true"></span>
                <span>{{ text('Validating invitation…', 'جارٍ التحقق من صلاحية الدعوة…') }}</span>
              </div>
            } @else if (success()) {
              <div class="alert success" role="status">
                <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                  <polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                <span>
                  {{
                    text(
                      'Account activated successfully! Redirecting to login…',
                      'تم تفعيل الحساب بنجاح! جارٍ الانتقال لصفحة تسجيل الدخول…'
                    )
                  }}
                </span>
              </div>
              <a class="primary submit-btn" routerLink="/login">{{ text('Continue to login', 'المتابعة لتسجيل الدخول') }}</a>
            } @else if (preview()?.status === 1) {
              <div class="invitation-summary-badge">
                <div class="user-avatar">
                  {{ preview()?.email?.charAt(0)?.toUpperCase() || 'U' }}
                </div>
                <div>
                  <strong>{{ preview()?.email }}</strong>
                  <span>{{ text('Role: ', 'الدور: ') }}{{ preview()?.role }}</span>
                </div>
              </div>

              @if (error()) {
                <div class="alert error" role="alert">
                  <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>{{ error() }}</span>
                </div>
              }

              <form [formGroup]="form" (ngSubmit)="accept()" novalidate>
                <div class="form-field">
                  <label for="inv-password">{{ preview()?.usesExistingAccount ? text('Current password', 'كلمة المرور الحالية') : text('New password', 'كلمة المرور الجديدة') }}</label>
                  <div class="input-with-icon">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input
                      id="inv-password"
                      type="password"
                      formControlName="password"
                      [attr.autocomplete]="preview()?.usesExistingAccount ? 'current-password' : 'new-password'"
                      [placeholder]="preview()?.usesExistingAccount ? text('Your current password', 'كلمة المرور الحالية') : text('At least 12 characters', '12 حرفاً أو رقماً على الأقل')"
                    />
                  </div>
                  @if (!preview()?.usesExistingAccount) { <small class="helper-text">{{ text('Must be at least 12 characters.', 'يجب أن تتكون من 12 حرفاً على الأقل.') }}</small> }
                </div>

                <div class="form-field">
                  <label for="inv-confirm">{{ text('Confirm password', 'تأكيد كلمة المرور') }}</label>
                  <div class="input-with-icon">
                    <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <input
                      id="inv-confirm"
                      type="password"
                      formControlName="confirmPassword"
                      autocomplete="new-password"
                      [placeholder]="text('Re-enter password', 'أعد إدخال كلمة المرور')"
                    />
                  </div>
                </div>

                <button class="primary submit-btn" type="submit" [disabled]="submitting() || form.invalid">
                  @if (submitting()) {
                    <span class="spinner" aria-hidden="true"></span>
                    <span>{{ text('Activating account…', 'جارٍ التفعيل…') }}</span>
                  } @else {
                    <span>{{ text('Activate Account', 'تفعيل الحساب والبدء') }}</span>
                  }
                </button>
              </form>
            } @else {
              <div class="alert error" role="alert">
                <svg class="alert-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <circle cx="12" cy="12" r="10"/>
                  <line x1="12" y1="8" x2="12" y2="12"/>
                  <line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                <span>{{ stateMessage() }}</span>
              </div>
              <a class="primary submit-btn" routerLink="/login">{{ text('Return to login', 'العودة لتسجيل الدخول') }}</a>
            }
          </section>
        </main>
      </div>
    </div>
  `,

})
export class AcceptInvitationComponent {
  readonly i18n = inject(LocalizationService);
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  readonly token = inject(ActivatedRoute).snapshot.queryParamMap.get('token') ?? '';
  readonly preview = signal<InvitationPreview | null>(null);
  readonly loading = signal(true);
  readonly submitting = signal(false);
  readonly success = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    password: ['', [Validators.required, Validators.minLength(12)]],
    confirmPassword: ['', Validators.required],
  });

  constructor() {
    this.http
      .post<InvitationPreview>('/api/auth/invitations/inspect', { token: this.token })
      .subscribe({
        next: (value) => {
          this.preview.set(value);
          if (value.usesExistingAccount) {
            this.form.controls.password.setValidators([Validators.required]);
            this.form.controls.password.updateValueAndValidity();
          }
          this.loading.set(false);
        },
        error: () => {
          this.preview.set({ status: 0 });
          this.loading.set(false);
        },
      });
  }

  accept(): void {
    const { password, confirmPassword } = this.form.getRawValue();
    if (password !== confirmPassword) {
      this.error.set(this.text('Passwords do not match.', 'كلمتا المرور غير متطابقتين.'));
      return;
    }
    this.submitting.set(true);
    this.http
      .post('/api/auth/invitations/accept', { token: this.token, password, confirmPassword })
      .subscribe({
        next: () => {
          this.success.set(true);
          setTimeout(() => void this.router.navigate(['/login']), 1500);
        },
        error: () => {
          this.submitting.set(false);
          this.error.set(this.text('The invitation could not be accepted.', 'تعذر قبول الدعوة.'));
        },
      });
  }

  stateMessage(): string {
    const messages: Record<number, [string, string]> = {
      0: ['This invitation is invalid.', 'هذه الدعوة غير صالحة.'],
      2: ['This invitation has already been accepted.', 'تم قبول هذه الدعوة من قبل.'],
      3: ['This invitation has expired.', 'انتهت صلاحية هذه الدعوة.'],
      4: ['This invitation was cancelled.', 'تم إلغاء هذه الدعوة.'],
    };
    const message = messages[this.preview()?.status ?? 0] ?? messages[0];
    return this.text(message[0], message[1]);
  }

  text(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}

