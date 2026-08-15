import { DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { Prescription, PrescriptionApiService } from './prescription-api.service';
import { medicationForm, prescriptionActions, prescriptionStatus } from './prescription-labels';
@Component({
  selector: 'app-prescription-details',
  imports: [DatePipe, RouterLink],
  template: `<a class="back" routerLink="/prescriptions"
      >← {{ t('Back to prescriptions', 'العودة للوصفات') }}</a
    >
    @if (message()) {
      <div class="alert success">{{ message() }}</div>
    }
    @if (error()) {
      <div class="alert error">{{ error() }}</div>
    }
    @if (loading()) {
      <div class="state">{{ t('Loading prescription…', 'جارٍ تحميل الوصفة…') }}</div>
    } @else if (item()) {
      <section class="page-head">
        <div>
          <p class="eyebrow">{{ status(item()!.status) }}</p>
          <h1>{{ item()!.prescriptionNumber }}</h1>
          <p>
            {{ item()!.patientName }} · {{ item()!.doctorName }} ·
            {{ item()!.issuedAt || item()!.createdAt | date: 'mediumDate' }}
          </p>
        </div>
        <div class="head-actions">
          @if (item()!.status === 1 && auth.hasPermission('Prescriptions.Edit')) {
            <a class="button" [routerLink]="['/prescriptions', id, 'edit']">{{
              t('Edit draft', 'تعديل المسودة')
            }}</a>
          }
          @for (a of actions(); track a) {
            <button [class.danger]="a === 'cancel'" (click)="action(a)">
              {{ a === 'issue' ? t('Issue', 'إصدار') : t('Cancel', 'إلغاء') }}
            </button>
          }
          @if (item()!.issuedAt) {
            @if (auth.hasPermission('Prescriptions.Download')) {
              <button (click)="document(false)">{{ t('Download PDF', 'تنزيل PDF') }}</button>
            }
            @if (auth.hasPermission('Prescriptions.Print')) {
              <button (click)="document(true)">{{ t('Print', 'طباعة') }}</button>
            }
          }
        </div>
      </section>
      <section class="panel prescription-sheet">
        <div class="readonly">
          {{
            item()!.status === 1
              ? t('Draft — editable', 'مسودة — قابلة للتعديل')
              : t('Issued clinical document — read only', 'مستند سريري صادر — للقراءة فقط')
          }}
        </div>
        @for (x of item()!.items; track x.id) {
          <article class="rx-item">
            <strong>Rx · {{ x.medicationName }} {{ x.strength || '' }}</strong
            ><span
              >{{ formLabel(x.form) }} · {{ x.dose }} · {{ x.frequency }} · {{ x.duration }}</span
            >
            <p>
              {{ x.route || '—' }} · {{ x.instructions }}
              @if (x.quantity) {
                · {{ t('Quantity', 'الكمية') }}: {{ x.quantity }}
              }
            </p>
          </article>
        }
        <h2>{{ t('Notes', 'ملاحظات') }}</h2>
        <p>{{ item()!.notes || '—' }}</p>
        @if (qrData()) {
          <div class="qr">
            <img
              [src]="qrData()"
              [alt]="t('Secure prescription QR', 'رمز QR آمن للوصفة')"
            /><small>{{
              t('Contains only an opaque verification reference.', 'يحتوي فقط على مرجع تحقق مبهم.')
            }}</small>
          </div>
        }
      </section>
    }`,
  styleUrl: './prescriptions.scss',
})
export class PrescriptionDetailsComponent {
  private readonly api = inject(PrescriptionApiService);
  readonly auth = inject(AuthService);
  readonly i18n = inject(LocalizationService);
  readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  readonly item = signal<Prescription | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly message = signal(history.state.message ?? '');
  readonly qrData = signal('');
  constructor() {
    this.load();
  }
  load() {
    this.api.prescription(this.id).subscribe({
      next: (x) => {
        this.item.set(x);
        this.loading.set(false);
        if (x.issuedAt)
          this.api
            .qr(this.id)
            .subscribe((svg) => this.qrData.set(`data:image/svg+xml;base64,${btoa(svg)}`));
      },
      error: () => {
        this.error.set(
          this.t('Prescription not found or access denied.', 'الوصفة غير موجودة أو الوصول مرفوض.'),
        );
        this.loading.set(false);
      },
    });
  }
  actions() {
    return prescriptionActions(this.item()?.status ?? 0).filter((x) =>
      this.auth.hasPermission(x === 'issue' ? 'Prescriptions.Issue' : 'Prescriptions.Cancel'),
    );
  }
  action(value: string) {
    if (
      value === 'issue' &&
      !confirm(
        this.t(
          'Issue this prescription? It will become immutable.',
          'إصدار هذه الوصفة؟ ستصبح غير قابلة للتعديل.',
        ),
      )
    )
      return;
    if (value === 'cancel' && !confirm(this.t('Cancel this prescription?', 'إلغاء هذه الوصفة؟')))
      return;
    this.api.action(this.id, value as 'issue' | 'cancel', this.item()!.version).subscribe({
      next: () => {
        this.message.set(this.t('Prescription status updated.', 'تم تحديث حالة الوصفة.'));
        this.load();
      },
      error: (e) =>
        this.error.set(
          e.status === 409
            ? this.t(
                'The prescription changed or is no longer editable.',
                'تغيرت الوصفة أو لم تعد قابلة للتعديل.',
              )
            : this.t('Status change failed.', 'فشل تغيير الحالة.'),
        ),
    });
  }
  document(print: boolean) {
    this.api.document(this.id, print).subscribe((blob) => {
      const url = URL.createObjectURL(blob);
      if (print) {
        const opened = window.open(url, '_blank');
        opened?.addEventListener('load', () => opened.print());
      } else {
        const link = document.createElement('a');
        link.href = url;
        link.download = `${this.item()!.prescriptionNumber}.pdf`;
        link.click();
      }
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    });
  }
  status(x: number) {
    return prescriptionStatus(x, this.i18n.language() === 'ar');
  }
  formLabel(x?: number) {
    return medicationForm(x, this.i18n.language() === 'ar');
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
