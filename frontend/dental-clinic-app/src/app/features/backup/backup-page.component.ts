import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { LocalizationService } from '../../core/localization.service';

interface BackupModule { id: string; name: string }

@Component({
  selector: 'app-backup-page',
  imports: [CommonModule, FormsModule],
  template: `
    <main class="backup-page">
      <header><p class="eyebrow">CLINIC DATA</p><h1>{{ t('Clinic backup', 'النسخ الاحتياطي للعيادة') }}</h1><p>{{ t('Choose modules and download an encrypted copy. Only the platform administrator can restore it.', 'اختار الموديولات وحمّل نسخة مشفرة. الاسترجاع متاح لأدمن المنصة فقط.') }}</p></header>
      <section class="backup-card">
        <div class="quick-actions"><button type="button" (click)="selectCore()">{{ t('Core modules', 'كل الأساسيات') }}</button><button type="button" (click)="selectAll()">{{ t('Everything', 'كل بيانات العيادة') }}</button><button type="button" (click)="selected.clear()">{{ t('Clear', 'مسح الاختيار') }}</button></div>
        <div class="module-grid">@for (module of modules; track module.id) { <label><input type="checkbox" [checked]="selected.has(module.id)" (change)="toggle(module.id)" /><span>{{ name(module) }}</span></label> }</div>
        <label class="password-label">{{ t('Backup password (at least 12 characters)', 'كلمة مرور النسخة (12 حرف أو أكثر)') }}<input type="password" autocomplete="new-password" [(ngModel)]="password" /></label>
        <p class="notice">{{ t('Keep the file and its password outside the server. If the file or password is lost, it cannot be restored. Automatic off-server storage is not configured yet.', 'احتفظ بالملف وكلمة المرور خارج السيرفر. فقدان أي منهما يمنع الاسترجاع. التخزين التلقائي خارج السيرفر لم يتم إعداده بعد.') }}</p>
        @if (error) { <p class="error" role="alert">{{ error }}</p> }
        <button class="download" type="button" [disabled]="busy || selected.size === 0 || password.length < 12" (click)="download()">{{ busy ? t('Preparing backup…', 'جارٍ تجهيز النسخة…') : t('Download encrypted backup', 'تحميل النسخة المشفرة') }}</button>
      </section>
    </main>
  `,
  styles: [`
    .backup-page{max-width:920px;margin:0 auto;padding:2rem;color:#17344a}.backup-page header{margin-bottom:1.5rem}.eyebrow{font-size:.75rem;letter-spacing:.12em;color:#0f766e;font-weight:700}.backup-page h1{font-size:2rem}.backup-page header p{color:#64748b}.backup-card{background:#fff;border:1px solid #dce5ec;border-radius:18px;padding:1.5rem;box-shadow:0 8px 30px #1530430a}.quick-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:1rem}.quick-actions button{border:1px solid #b9cbd7;background:#f4f9fb;border-radius:8px;padding:.55rem .8rem;cursor:pointer}.module-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:.65rem}.module-grid label{border:1px solid #dce5ec;border-radius:10px;padding:.8rem;display:flex;gap:.7rem;align-items:center}.password-label{display:grid;gap:.4rem;margin-top:1.4rem;font-weight:600}.password-label input{max-width:380px;border:1px solid #b9cbd7;border-radius:8px;padding:.7rem}.notice{padding:.9rem;background:#eff8f7;border-radius:8px;color:#375c5b}.error{color:#b91c1c}.download{background:#0f766e;color:white;border:0;border-radius:9px;padding:.8rem 1.2rem;cursor:pointer}.download:disabled{opacity:.5;cursor:not-allowed}
  `],
})
export class BackupPageComponent implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly i18n = inject(LocalizationService);
  modules: BackupModule[] = [];
  selected = new Set<string>();
  password = '';
  busy = false;
  error = '';
  ngOnInit() { this.http.get<BackupModule[]>('/api/backups/modules').subscribe({ next: x => this.modules = x, error: () => this.error = this.t('Could not load backup modules.', 'تعذر تحميل الموديولات.') }); }
  t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
  name(module: BackupModule) { return this.i18n.language() !== 'ar' ? module.name : ({ patients: 'المرضى وتاريخهم الطبي', appointments: 'المواعيد والحجز الإلكتروني', clinical: 'الأسنان والعلاجات والروشتات', finance: 'المالية', operations: 'المخزون والصيدلية والمعامل والتأمينات', communications: 'المتابعة والإشعارات', settings: 'إعدادات العيادة', accounts: 'المستخدمون والصلاحيات' } as Record<string,string>)[module.id] || module.name; }
  toggle(id: string) { this.selected.has(id) ? this.selected.delete(id) : this.selected.add(id); }
  selectCore() { this.selected = new Set(['patients', 'appointments', 'clinical', 'finance', 'settings', 'accounts']); }
  selectAll() { this.selected = new Set(this.modules.map(x => x.id)); }
  download() {
    this.busy = true; this.error = '';
    this.http.post('/api/backups/export', { modules: [...this.selected], password: this.password }, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob); const link = document.createElement('a');
        link.href = url; link.download = `planora-backup-${new Date().toISOString().slice(0,10)}.plnbak`; link.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000); this.busy = false;
      },
      error: () => { this.error = this.t('Backup failed. Try again.', 'فشل تجهيز النسخة. حاول مرة أخرى.'); this.busy = false; },
    });
  }
}
