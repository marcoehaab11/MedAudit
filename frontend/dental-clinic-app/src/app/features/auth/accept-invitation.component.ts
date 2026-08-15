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
}

@Component({
  selector: 'app-accept-invitation',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-card">
      <p class="eyebrow">{{ i18n.language() === 'en' ? 'Account invitation' : 'دعوة حساب' }}</p>
      <h1>{{ i18n.language() === 'en' ? 'Activate your account' : 'فعّل حسابك' }}</h1>
      @if (loading()) {
        <div class="loading" role="status">
          {{ text('Validating invitation…', 'جارٍ التحقق من الدعوة…') }}
        </div>
      } @else if (success()) {
        <div class="alert success" role="status">
          {{
            text(
              'Account activated. Redirecting to login…',
              'تم تفعيل الحساب. جارٍ الانتقال لتسجيل الدخول…'
            )
          }}
        </div>
        <a routerLink="/login">{{ text('Continue to login', 'المتابعة لتسجيل الدخول') }}</a>
      } @else if (preview()?.status === 1) {
        <p>{{ preview()?.email }} · {{ preview()?.role }}</p>
        @if (error()) {
          <div class="alert error" role="alert">{{ error() }}</div>
        }
        <form [formGroup]="form" (ngSubmit)="accept()">
          <label
            >{{ text('Password', 'كلمة المرور') }}
            <input type="password" formControlName="password" autocomplete="new-password" />
            <small>{{ text('At least 12 characters.', '12 حرفاً على الأقل.') }}</small>
          </label>
          <label
            >{{ text('Confirm password', 'تأكيد كلمة المرور') }}
            <input type="password" formControlName="confirmPassword" autocomplete="new-password" />
          </label>
          <button class="primary" type="submit" [disabled]="submitting() || form.invalid">
            {{
              submitting()
                ? text('Activating…', 'جارٍ التفعيل…')
                : text('Activate account', 'تفعيل الحساب')
            }}
          </button>
        </form>
      } @else {
        <div class="alert error" role="alert">{{ stateMessage() }}</div>
        <a routerLink="/login">{{ text('Return to login', 'العودة لتسجيل الدخول') }}</a>
      }
    </section>
  `,
  styleUrl: './auth.scss',
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
