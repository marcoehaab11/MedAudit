import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';

@Component({
  styleUrl: './auth.scss',

  selector: 'app-login',
  imports: [ReactiveFormsModule],
  template: `
    <div class="auth-wrapper">
      <div class="auth-layout">
        <!-- Clinic Branding & Value Showcase Banner -->
        <aside class="auth-banner" aria-hidden="true">
          <div class="banner-overlay"></div>
          <div class="banner-content">
            <div class="banner-brand">
              <img src="/planora-logo.jpg" alt="" class="banner-logo-img" />
              <span class="banner-brand-name">Planora</span>
            </div>

            <div class="banner-hero">
              <h2>
                {{
                  i18n.language() === 'en'
                    ? 'Clinical excellence meets modern practice management.'
                    : 'التميز الإكلينيكي يلتقي مع الإدارة الحديثة للعيادات.'
                }}
              </h2>
              <p>
                {{
                  i18n.language() === 'en'
                    ? 'Seamless patient charting, real-time appointments, automated prescriptions, and multi-tenant security.'
                    : 'سجلات المرضى والمخطط السني المتكامل، جدولة مواعيد ذكية، إدارة الروشتات، وحماية متقدمة للبيانات.'
                }}
              </p>
            </div>

            <div class="banner-features">
              <div class="feature-item">
                <div class="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
                    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
                  </svg>
                </div>
                <div>
                  <strong>{{ i18n.language() === 'en' ? 'Smart Patient Records' : 'ملفات طبية شاملة' }}</strong>
                  <span>{{ i18n.language() === 'en' ? 'Complete dental charting & history' : 'مخطط تفاعلي وسجل علاجي فوري' }}</span>
                </div>
              </div>

              <div class="feature-item">
                <div class="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
                    <line x1="16" y1="2" x2="16" y2="6"/>
                    <line x1="8" y1="2" x2="8" y2="6"/>
                    <line x1="3" y1="10" x2="21" y2="10"/>
                  </svg>
                </div>
                <div>
                  <strong>{{ i18n.language() === 'en' ? 'Real-Time Appointments' : 'جدولة المواعيد الذكية' }}</strong>
                  <span>{{ i18n.language() === 'en' ? 'Instant calendar sync & doctor queues' : 'مزامنة فورية وتنظيم طابور العيادة' }}</span>
                </div>
              </div>

              <div class="feature-item">
                <div class="feature-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                  </svg>
                </div>
                <div>
                  <strong>{{ i18n.language() === 'en' ? 'Secure & Compliant' : 'حماية وأمان عالي' }}</strong>
                  <span>{{ i18n.language() === 'en' ? 'Multi-tenant role-based access' : 'تشفير كامل وصلاحيات دقيقة' }}</span>
                </div>
              </div>
            </div>

            <div class="banner-footer">
              <span class="pulse-indicator"></span>
              <span>{{ i18n.language() === 'en' ? 'Dental Clinic Core · v2.4 Active' : 'نظام العيادة متصل ومحدث · v2.4' }}</span>
            </div>
          </div>
        </aside>

        <!-- Main Authentication Form Card -->
        <main class="auth-card-wrapper">
          <section class="auth-card">
            <div class="card-header">
              <div class="card-brand"><img src="/planora-logo.jpg" alt="" class="card-logo-img" /><span>Planora</span></div>
              <div class="clinic-badge">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span>{{ i18n.language() === 'en' ? 'Planora' : 'منظومة Planora' }}</span>
              </div>
              <h1>{{ i18n.language() === 'en' ? 'Welcome back' : 'مرحباً بعودتك' }}</h1>
              <p class="subtitle">
                {{
                  i18n.language() === 'en'
                    ? 'Enter your clinic credentials to access your workspace.'
                    : 'أدخل بيانات حسابك للمتابعة إلى لوحة التحكم.'
                }}
              </p>
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

            <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
              <div class="form-field">
                <label for="login-email">
                  {{ i18n.language() === 'en' ? 'Email address' : 'البريد الإلكتروني' }}
                </label>
                <div class="input-with-icon">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                  <input
                    id="login-email"
                    type="email"
                    formControlName="email"
                    autocomplete="email"
                    [placeholder]="i18n.language() === 'en' ? 'name@dentalclinic.com' : 'name@dentalclinic.com'"
                    [class.invalid]="form.controls.email.touched && form.controls.email.invalid"
                  />
                </div>
                @if (form.controls.email.touched && form.controls.email.hasError('required')) {
                  <span class="field-error">
                    {{ i18n.language() === 'en' ? 'Email is required' : 'البريد الإلكتروني مطلوب' }}
                  </span>
                } @else if (form.controls.email.touched && form.controls.email.hasError('email')) {
                  <span class="field-error">
                    {{ i18n.language() === 'en' ? 'Please enter a valid email' : 'يرجى إدخال بريد إلكتروني صحيح' }}
                  </span>
                }
              </div>

              <div class="form-field">
                <div class="label-row">
                  <label for="login-password">
                    {{ i18n.language() === 'en' ? 'Password' : 'كلمة المرور' }}
                  </label>
                </div>
                <div class="input-with-icon">
                  <svg class="field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                  <input
                    id="login-password"
                    [type]="showPassword() ? 'text' : 'password'"
                    formControlName="password"
                    autocomplete="current-password"
                    [placeholder]="i18n.language() === 'en' ? 'Enter your password' : 'أدخل كلمة المرور'"
                    [class.invalid]="form.controls.password.touched && form.controls.password.invalid"
                  />
                  <button
                    type="button"
                    class="toggle-password"
                    (click)="togglePassword()"
                    [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
                  >
                    @if (showPassword()) {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
                        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
                        <line x1="2" y1="2" x2="22" y2="22"/>
                      </svg>
                    } @else {
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/>
                        <circle cx="12" cy="12" r="3"/>
                      </svg>
                    }
                  </button>
                </div>
                @if (form.controls.password.touched && form.controls.password.hasError('required')) {
                  <span class="field-error">
                    {{ i18n.language() === 'en' ? 'Password is required' : 'كلمة المرور مطلوبة' }}
                  </span>
                }
              </div>

              <div class="options-row">
                <label class="checkbox-label">
                  <input type="checkbox" formControlName="rememberMe" />
                  <span>{{ i18n.language() === 'en' ? 'Remember this device' : 'تذكر هذا الجهاز' }}</span>
                </label>
              </div>

              <button class="primary submit-btn" type="submit" [disabled]="loading() || form.invalid">
                @if (loading()) {
                  <span class="spinner" aria-hidden="true"></span>
                  <span>{{ i18n.language() === 'en' ? 'Signing in…' : 'جارٍ تسجيل الدخول…' }}</span>
                } @else {
                  <span>{{ i18n.language() === 'en' ? 'Sign in to workspace' : 'دخول إلى مساحة العمل' }}</span>
                  <svg class="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M5 12h14"/>
                    <path d="m12 5 7 7-7 7"/>
                  </svg>
                }
              </button>
            </form>

            <footer class="security-note">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <span>{{ i18n.language() === 'en' ? '256-bit encrypted healthcare connection' : 'اتصال آمن ومشفر بأعلى معايير الحماية الطبية' }}</span>
            </footer>
          </section>
        </main>
      </div>
    </div>
  `,

})
export class LoginComponent {
  readonly i18n = inject(LocalizationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly showPassword = signal(false);

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
    rememberMe: [true],
  });

  togglePassword(): void {
    this.showPassword.update((val) => !val);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.controls.email.value, this.form.controls.password.value).subscribe({
      next: () => void this.router.navigate(['/dashboard']),
      error: () => {
        this.loading.set(false);
        this.error.set(
          this.i18n.language() === 'en'
            ? 'Invalid email or password. Please verify your credentials and try again.'
            : 'البريد الإلكتروني أو كلمة المرور غير صحيحة. يرجى التحقق وإعادة المحاولة.',
        );
      },
    });
  }
}


