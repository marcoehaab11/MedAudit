import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-clinic-registration',
  imports: [ReactiveFormsModule, RouterLink],
  styleUrl: './clinic-registration.scss',
  template: `
    <section class="signup" dir="rtl">
      <aside class="signup-intro">
        <p class="eyebrow">عيادتك على Planora</p>
        <h1>{{ confirming ? 'خطوة واحدة وعيادتك جاهزة' : 'ابدأ فصل جديد لعيادتك' }}</h1>
        <p>المواعيد، ملفات المرضى، خطط العلاج والحسابات في مكان واحد.</p>
        <div class="trial-badge"><strong>15 يوم</strong><span>تجربة مجانية تبدأ بعد تأكيد الإيميل<br>بدون بطاقة بنكية</span></div>
        <ul><li>حساب خاص لعيادتك وفريقك</li><li>بياناتك ولوجو عيادتك</li><li>إدارة يومك من أول حجز لآخر سداد</li></ul>
        <a routerLink="/">العودة للرئيسية ←</a>
      </aside>
      <div class="signup-card">
        @if (error()) { <p class="notice error" role="alert">{{ error() }}</p> }
        @if (confirming) {
          <h2>تأكيد بريد العيادة</h2>
          @if (confirmed()) {
            <p class="notice" role="status">تم تفعيل عيادتك! بدأت تجربة الـ15 يوم، ورسالة الترحيب في طريقها لإيميلك.</p>
            <a class="primary" [href]="loginUrl()">دخول العيادة</a>
          } @else {
            <p>اضغط لتأكيد بريدك وبدء التجربة المجانية. لو الرابط انتهى، اطلب رسالة جديدة من صفحة التسجيل.</p>
            <button class="primary" [disabled]="busy()" (click)="confirm()">{{ busy() ? 'جارٍ التفعيل…' : 'تأكيد الإيميل وتفعيل العيادة' }}</button>
            <a routerLink="/register">إعادة إرسال رسالة التأكيد</a>
          }
        } @else if (submitted()) {
          <h2>راجع إيميلك</h2>
          <p class="notice" role="status">لو الإيميل متاح للتسجيل، هيوصلك رابط التأكيد على {{ form.controls.email.value }}. راجع البريد غير المرغوب فيه أيضًا.</p>
          <p>التجربة تبدأ بعد التأكيد. لو عندك حساب بالفعل، سجّل الدخول أو استخدم نسيت كلمة السر.</p>
          <button class="secondary" [disabled]="busy()" (click)="resend()">إعادة إرسال التأكيد</button>
          @if (resent()) { <p role="status">تم طلب إعادة الإرسال، لو الحساب ينتظر التأكيد هتصلك رسالة جديدة.</p> }
          <a [href]="loginUrl()">دخول الحساب</a>
        } @else {
          <h2>سجّل عيادتك</h2><p>كل التفاصيل تقدر تعدّلها لاحقًا من إعدادات العيادة.</p>
          <form [formGroup]="form" (ngSubmit)="submit()">
            <div class="fields">
              <label>اسم العيادة<input formControlName="clinicName" autocomplete="organization" maxlength="200" /></label>
              <label>اسم المسؤول<input formControlName="ownerName" autocomplete="name" maxlength="200" /></label>
              <label>الإيميل<input formControlName="email" type="email" autocomplete="email" maxlength="256" dir="ltr" /></label>
              <label>رقم الموبايل<input formControlName="phone" type="tel" autocomplete="tel" maxlength="50" dir="ltr" /></label>
              <label class="wide">عنوان العيادة<input formControlName="address" autocomplete="street-address" maxlength="500" /></label>
              <label>المدينة<input formControlName="city" autocomplete="address-level2" maxlength="100" /></label>
              <label>الدولة<input formControlName="country" autocomplete="country-name" maxlength="100" /></label>
              <label>كلمة السر<input formControlName="password" type="password" autocomplete="new-password" minlength="8" maxlength="128" /><small>8 أحرف على الأقل</small></label>
              <label>تأكيد كلمة السر<input formControlName="confirmPassword" type="password" autocomplete="new-password" maxlength="128" /></label>
              <label class="wide logo-field">لوجو العيادة · اختياري<input type="file" accept="image/png,image/jpeg" (change)="chooseLogo($event)" /><small>PNG أو JPEG، بحد أقصى 1 ميجابايت</small>@if (logoPreview()) { <img [src]="logoPreview()" alt="معاينة لوجو العيادة" /> }</label>
            </div>
            <label class="consent"><input type="checkbox" formControlName="showcaseConsent" /><span>أوافق على عرض اسم ولوجو العيادة في قسم عملاء Planora بعد اعتماد الإدارة. اختياري، ولا يؤثر على التجربة.</span></label>
            <button type="submit" class="primary" [disabled]="busy() || form.invalid">{{ busy() ? 'جارٍ التسجيل…' : 'إنشاء الحساب وإرسال التأكيد' }}</button>
          </form>
          <details><summary>عندك تسجيل سابق ولم يصلك التأكيد؟</summary><label>الإيميل<input [value]="form.controls.email.value" (input)="form.controls.email.setValue($any($event.target).value)" type="email" /></label><button class="secondary" [disabled]="busy() || form.controls.email.invalid" (click)="resend()">إعادة إرسال التأكيد</button>@if (resent()) { <p role="status">تم طلب إعادة الإرسال.</p> }</details>
        }
      </div>
    </section>
  `,
})
export class ClinicRegistrationComponent {
  private readonly http = inject(HttpClient);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  readonly confirming = this.route.snapshot.routeConfig?.path === 'confirm-email';
  readonly busy = signal(false);
  readonly submitted = signal(false);
  readonly confirmed = signal(false);
  readonly resent = signal(false);
  readonly error = signal('');
  readonly logoPreview = signal('');
  private logoBase64 = '';
  readonly loginUrl = signal(`${location.protocol}//app.${location.host.replace(/^(www|book)\./, '')}/login`);
  readonly form = this.fb.nonNullable.group({
    clinicName: ['', Validators.required], ownerName: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]], phone: ['', Validators.required],
    address: ['', Validators.required], city: ['', Validators.required], country: ['مصر', Validators.required],
    password: ['', [Validators.required, Validators.minLength(8), Validators.maxLength(128)]],
    confirmPassword: ['', Validators.required], showcaseConsent: false,
  });

  chooseLogo(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    this.logoBase64 = ''; this.logoPreview.set(''); this.error.set('');
    if (!file) return;
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > 1048576) { this.error.set('اختار صورة PNG أو JPEG أصغر من 1 ميجابايت.'); return; }
    const reader = new FileReader();
    reader.onload = () => { const result = String(reader.result); this.logoBase64 = result.split(',')[1]; this.logoPreview.set(result); };
    reader.readAsDataURL(file);
  }

  submit() {
    if (this.form.invalid || this.busy()) return;
    const value = this.form.getRawValue();
    if (value.password !== value.confirmPassword) { this.error.set('كلمتا السر غير متطابقتين.'); return; }
    this.busy.set(true); this.error.set('');
    this.http.post('/api/public/clinics/register', { ...value, logoBase64: this.logoBase64 || null }).subscribe({
      next: () => { this.busy.set(false); this.submitted.set(true); this.form.controls.password.reset(); this.form.controls.confirmPassword.reset(); },
      error: (error: HttpErrorResponse) => this.fail(error, 'تعذر التسجيل. راجع البيانات وحاول تاني.'),
    });
  }

  confirm() {
    if (this.busy()) return;
    const id = this.route.snapshot.queryParamMap.get('id'); const token = this.route.snapshot.queryParamMap.get('token');
    if (!id || !token) { this.error.set('رابط التأكيد غير مكتمل. اطلب رسالة جديدة.'); return; }
    this.busy.set(true); this.error.set('');
    this.http.post<{ loginUrl: string }>('/api/public/clinics/confirm', { id, token }).subscribe({
      next: (result) => { this.loginUrl.set(result.loginUrl); this.busy.set(false); this.confirmed.set(true); history.replaceState({}, '', '/confirm-email'); },
      error: (error: HttpErrorResponse) => this.fail(error, 'الرابط غير صالح أو انتهت مدته. اطلب رسالة تأكيد جديدة.'),
    });
  }

  resend() {
    if (this.busy() || this.form.controls.email.invalid) return;
    this.busy.set(true); this.error.set('');
    this.http.post('/api/public/clinics/resend', { email: this.form.controls.email.value }).subscribe({
      next: () => { this.busy.set(false); this.resent.set(true); },
      error: (error: HttpErrorResponse) => this.fail(error, 'تعذر طلب إعادة الإرسال.'),
    });
  }
  private fail(error: HttpErrorResponse, fallback: string) { this.busy.set(false); this.error.set(error.status === 429 ? error.error?.messageAr || 'طلبات كثيرة. انتظر ثم حاول مرة أخرى.' : error.error?.detail || fallback); }
}
