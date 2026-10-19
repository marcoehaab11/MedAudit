import { Component, DestroyRef, HostListener, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, exhaustMap, merge, of, Subject, timer } from 'rxjs';
import { AppointmentApiService, AppointmentItem } from '../appointments/appointment-api.service';
import { LocalizationService } from '../../core/localization.service';

@Component({
  selector: 'app-doctor-visit-queue',
  imports: [RouterLink],
  template: `<section class="visit-queue" aria-label="Patients ready for the doctor">
    <header><div><h2>🦷 {{ t('Patients ready for your visit', 'مرضى جاهزون للكشف') }} <span class="count">{{ items().length }}</span></h2>
      <p>{{ t('Reception has checked them in or started their session. Open the visit directly.', 'الريسبشن سجل حضورهم أو بدأ جلستهم. افتح الزيارة مباشرة.') }}</p></div>
      <button type="button" (click)="refresh()">{{ t('Refresh', 'تحديث') }}</button></header>
    @if (error()) { <p role="alert">{{ error() }}</p> }
    <div class="visit-list" aria-live="polite">
      @for (item of items(); track item.id) {
        <article><div><strong>{{ item.patientName }}</strong><p>{{ item.doctorName }} · <span>{{ item.status === 4 ? t('Session started', 'الجلسة بدأت') : t('Patient arrived', 'المريض حضر') }}</span></p></div>
          <a [routerLink]="['/appointments', item.id, 'visit']">{{ item.status === 4 ? t('Continue visit', 'متابعة الجلسة') : t('Open visit', 'فتح الجلسة') }} ←</a>
        </article>
      } @empty { <p class="empty">{{ loading() ? t('Loading…', 'جارٍ التحميل…') : t('No patients waiting for you yet.', 'لا يوجد مرضى جاهزون للكشف حاليًا.') }}</p> }
    </div>
  </section>`,
  styles: [`.visit-queue{margin:0 0 20px;padding:18px 20px;border:1px solid #c6e4da;border-radius:14px;background:#f2faf6;color:#23483f}header{display:flex;align-items:center;justify-content:space-between;gap:12px}h2{margin:0;font-size:1.05rem;line-height:1.7}.count{display:inline-grid;place-items:center;min-width:24px;padding:0 5px;background:#d8eee4;border-radius:8px;font-size:.8rem}p{margin:5px 0;color:#617b74;font-size:.82rem;line-height:1.7}button{height:auto;padding:7px 12px;border:1px solid #c4ddd3;border-radius:8px;color:#26725d;background:white;cursor:pointer}.visit-list{display:grid;gap:8px;margin-top:12px;max-height:310px;overflow:auto}article{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px;background:white;border:1px solid #d9e9e1;border-radius:10px}strong{font-size:.95rem}a{flex-shrink:0;display:inline-flex;align-items:center;min-height:38px;padding:8px 14px;border-radius:8px;background:#16816b;color:white;font-size:.85rem;font-weight:700;text-decoration:none}a:focus-visible,button:focus-visible{outline:3px solid #70bea9;outline-offset:3px}.empty{margin:0;padding:8px 0}@media(max-width:480px){.visit-queue{padding:14px}article{align-items:start;flex-wrap:wrap}article a{width:100%;justify-content:center}}`],
})
export class DoctorVisitQueueComponent {
  private readonly api = inject(AppointmentApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly refreshRequests = new Subject<void>();
  readonly items = signal<AppointmentItem[]>([]);
  readonly error = signal('');
  readonly loading = signal(true);
  constructor() {
    merge(timer(0,10000),this.refreshRequests).pipe(
      exhaustMap(() => {
        const now=new Date(),today=[now.getFullYear(),String(now.getMonth()+1).padStart(2,'0'),String(now.getDate()).padStart(2,'0')].join('-');
        return this.api.appointments({from:today,to:today}).pipe(catchError(() => {this.error.set(this.t('Could not update waiting patients. Try Refresh.', 'تعذر تحديث المرضى الجاهزين. اضغط تحديث لإعادة المحاولة.'));return of(null);}));
      }),takeUntilDestroyed(inject(DestroyRef)),
    ).subscribe(result => {
      this.loading.set(false);
      if(result){this.items.set(result.page.items.filter(item=>[3,4].includes(item.status)).sort((a,b)=>a.startAt.localeCompare(b.startAt)));this.error.set('');}
    });
  }
  @HostListener('window:focus') refresh(){this.refreshRequests.next();}
  t(en:string,ar:string){return this.i18n.language()==='ar'?ar:en;}
}
