import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LocalizationService } from '../../core/localization.service';

@Component({
  selector: 'app-password-recovery',
  imports: [ReactiveFormsModule, RouterLink],
  styles: [`
    :host { display: grid; min-height: 100dvh; place-items: center; padding: 24px; box-sizing: border-box; background: #f3f8f5; }
    section { max-width: 430px; width: 100%; padding: 30px; background: white; border: 1px solid #dbe7df; border-radius: 22px; box-sizing: border-box; }
    img { width: 64px; height: 64px; object-fit: contain; border-radius: 12px; }
    label { display: flex; flex-direction: column; gap: 8px; margin-block: 18px; }
    input { padding: 12px; border: 1px solid #b9cfc3; border-radius: 10px; font: inherit; }
    button { width: 100%; padding: 13px; border: 0; border-radius: 10px; background: #17664e; color: white; font: inherit; cursor: pointer; }
    button:disabled { opacity: .5; }
    a { display: block; margin-top: 20px; color: #17664e; }
    .error { color: #a33333; } .success { color: #17664e; line-height: 1.8; }
  `],
  template: `
    <section [dir]="i18n.language() === 'ar' ? 'rtl' : 'ltr'">
      <img src="/planora-logo.jpg" alt="Planora" />
      <h1>{{ resetMode ? t('Choose a new password', 'كلمة سر جديدة') : t('Forgot password?', 'نسيت كلمة السر؟') }}</h1>
      @if (error()) { <p class="error" role="alert">{{ error() }}</p> }
      @if (done()) {
        <p class="success" role="status">{{ resetMode ? t('Password changed. Sign in using your new password.', 'تم تغيير كلمة السر. سجّل الدخول بالكلمة الجديدة.') : t('If this email has an account, reset instructions will be sent. Check your spam folder too.', 'لو الإيميل له حساب، هيوصلك رابط لتغيير كلمة السر. راجع البريد غير المرغوب فيه أيضًا.') }}</p>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()">
          <label>{{ t('Email', 'الإيميل') }}<input type="email" formControlName="email" autocomplete="email" dir="ltr" /></label>
          @if (resetMode) {
            <label>{{ t('New password', 'كلمة السر الجديدة') }}<input type="password" formControlName="password" autocomplete="new-password" minlength="8" maxlength="128" /></label>
            <label>{{ t('Confirm password', 'تأكيد كلمة السر') }}<input type="password" formControlName="confirmPassword" autocomplete="new-password" maxlength="128" /></label>
            <p>{{ t('At least 8 characters. Reset links expire after one hour.', '8 أحرف على الأقل. رابط الاسترجاع صالح لمدة ساعة.') }}</p>
          }
          <button [disabled]="busy() || form.invalid">{{ busy() ? t('Please wait…', 'جارٍ التنفيذ…') : resetMode ? t('Save password', 'حفظ كلمة السر') : t('Send reset link', 'إرسال رابط الاسترجاع') }}</button>
        </form>
      }
      <a routerLink="/login">{{ t('Back to sign in', 'العودة لتسجيل الدخول') }}</a>
      @if (resetMode && !done()) { <a routerLink="/forgot-password">{{ t('Request a new link', 'طلب رابط جديد') }}</a> }
    </section>
  `,
})
export class PasswordRecoveryComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  readonly i18n = inject(LocalizationService);
  private readonly fb = inject(FormBuilder);
  readonly resetMode = this.route.snapshot.routeConfig?.path === 'reset-password';
  readonly done = signal(false);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly form = this.fb.nonNullable.group({ email: [this.route.snapshot.queryParamMap.get('email') ?? '', [Validators.required, Validators.email]], password: '', confirmPassword: '' });
  constructor() {
    if (this.resetMode) this.form.controls.password.setValidators([Validators.required, Validators.minLength(8), Validators.maxLength(128)]);
  }
  t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
  submit() {
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    const token = this.route.snapshot.queryParamMap.get('token');
    if (this.resetMode && (!token || value.password !== value.confirmPassword)) { this.error.set(this.t('Check the link and ensure the passwords match.', 'راجع رابط الاسترجاع وتأكد إن كلمتي السر متطابقين.')); return; }
    this.busy.set(true); this.error.set('');
    this.http.post('/api/auth/' + (this.resetMode ? 'reset-password' : 'forgot-password'), this.resetMode ? { ...value, token } : { email: value.email }).subscribe({
      next: () => { this.busy.set(false); this.done.set(true); this.form.controls.password.reset(); this.form.controls.confirmPassword.reset(); if (this.resetMode) history.replaceState({}, '', '/reset-password'); },
      error: (error: HttpErrorResponse) => { this.busy.set(false); this.error.set(error.status === 429 ? this.t(error.error?.message || 'Too many attempts. Please try again later.', error.error?.messageAr || 'طلبات كثيرة. انتظر ثم حاول مرة أخرى.') : error.error?.detail || this.t('The request failed. Try again or request a new link.', 'تعذر تنفيذ الطلب. حاول تاني أو اطلب رابط جديد.')); },
    });
  }
}
