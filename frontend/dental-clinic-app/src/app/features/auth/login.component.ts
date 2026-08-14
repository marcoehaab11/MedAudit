import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-card">
      <p class="eyebrow">{{ i18n.language() === 'en' ? 'Clinic access' : 'دخول العيادة' }}</p>
      <h1>{{ i18n.language() === 'en' ? 'Welcome back' : 'مرحباً بعودتك' }}</h1>
      <p>{{ i18n.language() === 'en' ? 'Use your activated clinic account.' : 'استخدم حساب العيادة المُفعّل.' }}</p>
      @if (error()) { <div class="alert error" role="alert">{{ error() }}</div> }
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Email<input type="email" formControlName="email" autocomplete="email"></label>
        <label>{{ i18n.language() === 'en' ? 'Password' : 'كلمة المرور' }}
          <input type="password" formControlName="password" autocomplete="current-password">
        </label>
        <button class="primary" type="submit" [disabled]="loading() || form.invalid">
          {{ loading() ? (i18n.language() === 'en' ? 'Signing in…' : 'جارٍ الدخول…') : (i18n.language() === 'en' ? 'Sign in' : 'تسجيل الدخول') }}
        </button>
      </form>
      <a routerLink="/accept-invitation">{{ i18n.language() === 'en' ? 'Accept an invitation' : 'قبول دعوة' }}</a>
    </section>
  `,
  styleUrl: './auth.scss'
})
export class LoginComponent {
  readonly i18n = inject(LocalizationService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading.set(true);
    this.error.set('');
    this.auth.login(this.form.controls.email.value, this.form.controls.password.value).subscribe({
      next: () => void this.router.navigate(['/users']),
      error: () => {
        this.loading.set(false);
        this.error.set(this.i18n.language() === 'en' ? 'Invalid email or password.' : 'البريد الإلكتروني أو كلمة المرور غير صحيحة.');
      }
    });
  }
}
