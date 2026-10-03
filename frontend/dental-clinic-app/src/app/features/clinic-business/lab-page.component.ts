import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { forkJoin, Observable } from 'rxjs';
import { LocalizationService } from '../../core/localization.service';
import { AuthService } from '../../core/auth.service';
import { PatientApiService, PatientListItem } from '../patients/patient-api.service';
import { TreatmentApiService, Treatment } from '../treatments/treatment-api.service';
import { Activity, ClinicBusinessApi, ClinicDocument, LabCase, LabStatement, LabStatementDetail, LabVendor } from './clinic-business-api.service';

@Component({
  selector: 'app-lab-page',
  imports: [CommonModule, FormsModule],
  styleUrl: './clinic-business.scss',
  template: `
    <section class="business-page">
      <header class="business-head"><div><p class="eyebrow">CLINIC OPERATIONS</p><h1>{{ t('External dental labs', 'المعامل الخارجية') }}</h1><p>{{ t('Track every case and settle grouped laboratory statements.', 'تابع كل حالة وسوّي كشوف المعمل المجمعة بالتفصيل.') }}</p></div></header>
      @if (error) { <div class="business-alert error" role="alert">{{ error }}</div> }
      @if (notice) { <div class="business-alert success" role="status">{{ notice }}</div> }
      <div class="business-stats"><div><small>{{ t('Open cases', 'حالات مفتوحة') }}</small><strong>{{ openCount() }}</strong></div><div><small>{{ t('Overdue cases', 'حالات متأخرة') }}</small><strong>{{ overdueCount() }}</strong></div><div><small>{{ t('Unbilled cost', 'تكلفة لم تدخل كشف') }}</small><strong>{{ unbilledCost() | number:'1.2-2' }}</strong></div><div><small>{{ t('Statements', 'كشوف حساب') }}</small><strong>{{ statements.length }}</strong></div></div>
      <div class="business-card business-inline"><input [(ngModel)]="patientSearch" [placeholder]="t('Search patients by name or phone', 'ابحث عن مريض بالاسم أو الهاتف')" /><button class="business-primary" (click)="searchPatients()">{{ t('Search patients', 'بحث عن المرضى') }}</button></div>

      @if (auth.hasPermission('Lab.Manage')) { <div class="business-grid">
        <section class="business-card"><h2>{{ t('Add laboratory', 'إضافة معمل') }}</h2><div class="business-fields"><label>{{ t('Name', 'اسم المعمل') }}<input [(ngModel)]="vendorForm.name" /></label><label>{{ t('Phone', 'الهاتف') }}<input [(ngModel)]="vendorForm.phone" /></label><label class="wide">{{ t('Notes', 'ملاحظات') }}<input [(ngModel)]="vendorForm.notes" /></label></div><button class="business-primary" [disabled]="busy || !vendorForm.name.trim()" (click)="createVendor()">{{ t('Save laboratory', 'حفظ المعمل') }}</button></section>
        <section class="business-card"><h2>{{ t('New laboratory case', 'طلب معمل جديد') }}</h2><div class="business-fields">
          <label>{{ t('Laboratory', 'المعمل') }}<select [(ngModel)]="caseForm.vendorId"><option value="">{{ t('Select', 'اختر') }}</option>@for (v of vendors; track v.id) { <option [value]="v.id">{{ v.name }}</option> }</select></label>
          <label>{{ t('Patient', 'المريض') }}<select [(ngModel)]="caseForm.patientId" (change)="loadTreatments()"><option value="">{{ t('Select', 'اختر') }}</option>@for (p of patients; track p.id) { <option [value]="p.id">{{ p.fullName }}</option> }</select></label>
          <label>{{ t('Related treatment', 'العلاج المرتبط') }}<select [(ngModel)]="caseForm.treatmentId"><option value="">{{ t('Optional', 'اختياري') }}</option>@for (tr of treatments; track tr.id) { <option [value]="tr.id">{{ tr.treatmentName }}</option> }</select></label>
          <label>{{ t('Work type', 'نوع الشغل') }}<input [(ngModel)]="caseForm.workType" placeholder="Crown / Bridge" /></label>
          <label>{{ t('Teeth', 'الأسنان') }}<input [(ngModel)]="caseForm.teeth" /></label><label>{{ t('Material', 'الخامة') }}<input [(ngModel)]="caseForm.material" /></label>
          <label>{{ t('Shade', 'اللون') }}<input [(ngModel)]="caseForm.shade" /></label><label>{{ t('Due date', 'موعد التسليم') }}<input type="date" [(ngModel)]="caseForm.dueAt" /></label>
          <label>{{ t('Lab cost', 'تكلفة المعمل') }}<input type="number" min="0" step="0.01" [(ngModel)]="caseForm.cost" /></label><label class="wide">{{ t('Instructions', 'تعليمات الدكتور') }}<textarea rows="2" [(ngModel)]="caseForm.instructions"></textarea></label>
        </div><button class="business-primary" [disabled]="busy || !caseForm.vendorId || !caseForm.patientId || !caseForm.workType || !caseForm.dueAt" (click)="createCase()">{{ t('Create case', 'إنشاء الطلب') }}</button></section>
      </div> }

      <section class="business-card"><div class="business-row"><div><h2>{{ t('Laboratory cases', 'طلبات المعمل') }}</h2><p>{{ t('Select cases from one laboratory to create a grouped statement.', 'حدد حالات من نفس المعمل لعمل كشف حساب مجمع.') }}</p></div><div class="business-inline"><select [(ngModel)]="statementVendorId" (change)="selectedCases.clear()"><option value="">{{ t('All labs', 'كل المعامل') }}</option>@for (v of vendors; track v.id) { <option [value]="v.id">{{ v.name }}</option> }</select><button class="business-primary" [disabled]="busy || !auth.hasPermission('Lab.Manage') || selectedCases.size === 0" (click)="createStatement()">{{ t('Create statement', 'إنشاء كشف') }} ({{ selectedCases.size }})</button></div></div>
        <div class="business-table-wrap"><table><thead><tr><th></th><th>{{ t('Patient / work', 'المريض / الشغل') }}</th><th>{{ t('Lab', 'المعمل') }}</th><th>{{ t('Due', 'التسليم') }}</th><th>{{ t('Cost', 'التكلفة') }}</th><th>{{ t('Status', 'الحالة') }}</th><th>{{ t('Action', 'إجراء') }}</th></tr></thead><tbody>
          @for (item of visibleCases(); track item.id) { <tr><td><input type="checkbox" [checked]="selectedCases.has(item.id)" [disabled]="!auth.hasPermission('Lab.Manage') || !!item.statementId || ![5,6,7,8].includes(item.status)" (change)="toggleCase(item.id, $event)" /></td><td><strong>{{ patientName(item.patientId) }}</strong><small>{{ item.workType }} · {{ item.teeth || '—' }} · {{ item.material || '—' }} {{ item.shade || '' }}</small></td><td>{{ vendorName(item.vendorId) }}</td><td>{{ item.dueAt | date:'dd/MM/yyyy' }}</td><td>{{ item.cost | number:'1.2-2' }}</td><td><span class="business-chip">{{ statusName(item.status) }}</span>@if (item.statementId) { <small>{{ t('In statement', 'داخل كشف') }}</small> }</td><td><select [ngModel]="item.status" (ngModelChange)="setStatus(item, $event)" [disabled]="busy || !auth.hasPermission('Lab.Manage') || item.status === 9"><option [ngValue]="item.status">{{ statusName(item.status) }}</option>@for (s of statuses; track s.id) { @if (s.id !== item.status) { <option [ngValue]="s.id">{{ t(s.en, s.ar) }}</option> } }</select><button class="business-link" (click)="showHistory(item)">{{ t('History', 'السجل') }}</button></td></tr> }
          @if (visibleCases().length === 0) { <tr><td colspan="7" class="business-empty">{{ t('No cases yet.', 'لا توجد طلبات بعد.') }}</td></tr> }
        </tbody></table></div>
      </section>

      <section class="business-card"><h2>{{ t('Grouped statements', 'كشوف المعامل المجمعة') }}</h2><div class="business-inline statement-tabs">@for (s of statements; track s.id) { <button [class.active]="detail?.statement?.id === s.id" (click)="openStatement(s.id)">{{ s.reference }} · {{ vendorName(s.vendorId) }}</button> }</div>
        @if (detail) { <div class="business-summary"><span>{{ t('Total', 'الإجمالي') }}: <strong>{{ detail.total | number:'1.2-2' }}</strong></span><span>{{ t('Paid', 'المدفوع') }}: <strong>{{ detail.paid | number:'1.2-2' }}</strong></span><span>{{ t('Remaining', 'المتبقي') }}: <strong>{{ detail.total - detail.paid | number:'1.2-2' }}</strong></span></div><div class="business-table-wrap"><table><thead><tr><th>{{ t('Case', 'الحالة') }}</th><th>{{ t('Specifications / due', 'المواصفات / التسليم') }}</th><th>{{ t('Cost', 'التكلفة') }}</th><th>{{ t('Paid', 'المدفوع') }}</th><th>{{ t('Remaining', 'المتبقي') }}</th>@if (auth.hasPermission('Lab.Settle')) { <th>{{ t('Pay now', 'دفع الآن') }}</th> }</tr></thead><tbody>@for (row of detail.cases; track row.labCase.id) { <tr><td>{{ patientName(row.labCase.patientId) }} · {{ row.labCase.workType }}</td><td>{{ row.labCase.teeth || '—' }} · {{ row.labCase.material || '—' }} · {{ row.labCase.shade || '—' }}<small>{{ row.labCase.dueAt | date:'dd/MM/yyyy' }}</small></td><td>{{ row.labCase.cost | number:'1.2-2' }}</td><td>{{ row.paid | number:'1.2-2' }}</td><td>{{ row.outstanding | number:'1.2-2' }}</td>@if (auth.hasPermission('Lab.Settle')) { <td><input type="number" min="0" [max]="row.outstanding" step="0.01" [(ngModel)]="paymentAmounts[row.labCase.id]" /></td> }</tr> }</tbody></table></div>@if (auth.hasPermission('Lab.Settle')) { <div class="business-inline"><input [(ngModel)]="paymentReference" [placeholder]="t('Transfer reference', 'رقم التحويل أو الإيصال')" /><button class="business-primary" [disabled]="busy" (click)="settle()">{{ t('Record payment', 'تسجيل الدفع') }}</button></div> }
          @if (detail.payments.length) { <p class="business-foot">{{ t('Recorded payments', 'الدفعات المسجلة') }}: @for (p of detail.payments; track p.id) { <span>{{ p.amount | number:'1.2-2' }} ({{ p.reference || '—' }}) </span> }</p> }
        }
      </section>
      @if (historyItem) { <section class="business-card"><h2>{{ t('Case history and documents', 'سجل الحالة والمرفقات') }} · {{ historyItem.workType }}</h2><div class="business-inline">@if (auth.hasPermission('Lab.Manage')) { <input type="file" accept=".pdf,.jpg,.jpeg,.png" (change)="upload($event)" /> }<small>{{ t('PDF or image, up to 5 MB', 'PDF أو صورة، حتى 5 ميجابايت') }}</small></div><div class="business-inline">@for (doc of documents; track doc.id) { <button class="business-link" (click)="download(doc)">{{ doc.fileName }} ↓</button> }</div>@for (event of history; track event.id) { <p class="business-history"><strong>{{ event.action }}</strong> · {{ event.occurredAt | date:'dd/MM/yyyy HH:mm' }} · {{ event.actorName || '—' }} · {{ event.details || '' }}</p> }</section> }
    </section>
  `,
})
export class LabPageComponent implements OnInit {
  private readonly api = inject(ClinicBusinessApi);
  private readonly patientApi = inject(PatientApiService);
  private readonly treatmentApi = inject(TreatmentApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly route = inject(ActivatedRoute);
  readonly auth = inject(AuthService);
  vendors: LabVendor[] = []; cases: LabCase[] = []; statements: LabStatement[] = []; patients: PatientListItem[] = []; treatments: Treatment[] = [];
  detail: LabStatementDetail | null = null; historyItem: LabCase | null = null; history: Activity[] = []; documents: ClinicDocument[] = [];
  selectedCases = new Set<string>(); statementVendorId = ''; paymentAmounts: Record<string, number> = {}; paymentReference = '';
  vendorForm = { name: '', phone: '', notes: '' };
  caseForm = { vendorId: '', patientId: '', treatmentId: '', workType: '', teeth: '', material: '', shade: '', instructions: '', dueAt: '', cost: 0 };
  busy = false; error = ''; notice = '';
  filterPatientId = '';
  patientSearch = '';
  readonly statuses = [{ id: 2, en: 'Sent', ar: 'اترسل' }, { id: 3, en: 'Received by lab', ar: 'المعمل استلمه' }, { id: 4, en: 'In production', ar: 'تحت التصنيع' }, { id: 5, en: 'Ready', ar: 'جاهز' }, { id: 6, en: 'Delivered', ar: 'وصل العيادة' }, { id: 7, en: 'Fitted', ar: 'اتركب' }, { id: 8, en: 'Remake', ar: 'إعادة شغل' }, { id: 9, en: 'Cancelled', ar: 'ملغي' }];
  ngOnInit() { this.filterPatientId = this.route.snapshot.queryParamMap.get('patientId') || ''; this.caseForm.patientId = this.filterPatientId; this.refresh(); this.patientApi.listAll().subscribe({ next: x => { this.patients = x; this.ensureSelectedPatient(); } }); if (this.filterPatientId) this.loadTreatments(); }
  searchPatients() { this.patientApi.patients({ search: this.patientSearch, pageSize: 50 }).subscribe({ next: x => { this.patients = x.items; this.ensureSelectedPatient(); }, error: e => this.fail(e) }); }
  ensureSelectedPatient() { if (!this.filterPatientId || this.patients.some(x => x.id === this.filterPatientId)) return; this.patientApi.patient(this.filterPatientId).subscribe({ next: p => this.patients = [...this.patients, { id: p.id, patientNumber: p.patientNumber, fullName: [p.firstName, p.middleName, p.lastName].filter(Boolean).join(' '), gender: p.gender, phone: p.phone, email: p.email, status: p.status, createdAt: p.createdAt }] }); }
  t(en: string, ar: string) { return this.i18n.language() === 'ar' ? ar : en; }
  refresh() { forkJoin({ vendors: this.api.vendors(), cases: this.api.cases(this.filterPatientId || undefined), statements: this.api.statements() }).subscribe({ next: x => { this.vendors = x.vendors; this.cases = x.cases; this.statements = x.statements; }, error: e => this.fail(e) }); }
  patientName(id: string) { return this.patients.find(x => x.id === id)?.fullName || id.slice(0, 8); }
  vendorName(id: string) { return this.vendors.find(x => x.id === id)?.name || id.slice(0, 8); }
  statusName(id: number) { return id === 1 ? this.t('Draft', 'مسودة') : this.statuses.find(x => x.id === id)?.[this.i18n.language() === 'ar' ? 'ar' : 'en'] || String(id); }
  visibleCases() { return this.cases.filter(x => !this.statementVendorId || x.vendorId === this.statementVendorId); }
  openCount() { return this.cases.filter(x => x.status !== 7 && x.status !== 9).length; }
  overdueCount() { return this.cases.filter(x => x.status !== 7 && x.status !== 9 && new Date(x.dueAt).getTime() < Date.now()).length; }
  unbilledCost() { return this.cases.filter(x => !x.statementId && x.status !== 9).reduce((n, x) => n + x.cost, 0); }
  loadTreatments() { this.caseForm.treatmentId = ''; if (!this.caseForm.patientId) { this.treatments = []; return; } this.treatmentApi.treatments({ patientId: this.caseForm.patientId, pageSize: '100' }).subscribe({ next: x => this.treatments = x.items }); }
  toggleCase(id: string, event: Event) { const checked = (event.target as HTMLInputElement).checked; if (checked) { const row = this.cases.find(x => x.id === id); if (row && this.statementVendorId && row.vendorId === this.statementVendorId) this.selectedCases.add(id); else { (event.target as HTMLInputElement).checked = false; this.error = this.t('Choose a laboratory first.', 'اختار المعمل الأول.'); } } else this.selectedCases.delete(id); }
  private save(action: Observable<unknown>, message: string, after?: () => void) { this.busy = true; this.error = ''; this.notice = ''; action.subscribe({ next: () => { this.busy = false; this.notice = message; after?.(); this.refresh(); }, error: e => { this.busy = false; this.fail(e); } }); }
  private fail(e: { error?: { detail?: string } }) { this.error = e?.error?.detail || this.t('Could not save. Please review the details.', 'تعذر الحفظ، راجع البيانات وحاول تاني.'); }
  createVendor() { this.save(this.api.addVendor(this.vendorForm), this.t('Laboratory saved.', 'تم حفظ المعمل.'), () => this.vendorForm = { name: '', phone: '', notes: '' }); }
  createCase() { const dueAt = new Date(this.caseForm.dueAt + 'T12:00:00').toISOString(); this.save(this.api.addCase({ ...this.caseForm, dueAt, treatmentId: this.caseForm.treatmentId || null }), this.t('Case created.', 'تم إنشاء الطلب.'), () => this.caseForm = { vendorId: '', patientId: '', treatmentId: '', workType: '', teeth: '', material: '', shade: '', instructions: '', dueAt: '', cost: 0 }); }
  setStatus(item: LabCase, status: number) { if (status === item.status) return; const note = window.prompt(this.t('Update note (optional)', 'ملاحظة التحديث (اختياري)')) || ''; this.save(this.api.caseStatus(item.id, status, note), this.t('Case updated.', 'تم تحديث الحالة.')); }
  createStatement() { if (!this.statementVendorId) { this.error = this.t('Choose one laboratory.', 'اختار معمل واحد.'); return; } this.save(this.api.addStatement(this.statementVendorId, [...this.selectedCases]), this.t('Statement created.', 'تم إنشاء الكشف.'), () => this.selectedCases.clear()); }
  openStatement(id: string) { this.api.statement(id).subscribe({ next: x => { this.detail = x; this.paymentAmounts = {}; }, error: e => this.fail(e) }); }
  settle() { if (!this.detail) return; const allocations = this.detail.cases.map(x => ({ itemId: x.labCase.id, amount: Number(this.paymentAmounts[x.labCase.id] || 0) })).filter(x => x.amount > 0); if (!allocations.length) { this.error = this.t('Enter at least one payment amount.', 'اكتب مبلغ دفع واحد على الأقل.'); return; } const id = this.detail.statement.id; this.save(this.api.settleStatement(id, allocations, this.paymentReference), this.t('Payment recorded.', 'تم تسجيل الدفع.'), () => { this.paymentReference = ''; this.openStatement(id); }); }
  showHistory(item: LabCase) { this.historyItem = item; this.api.caseHistory(item.id).subscribe({ next: x => this.history = x }); this.api.caseDocuments(item.id).subscribe({ next: x => this.documents = x }); }
  upload(event: Event) { const file = (event.target as HTMLInputElement).files?.[0]; if (!file || !this.historyItem) return; const id = this.historyItem.id; this.save(this.api.uploadCaseDocument(id, file), this.t('Document added.', 'تمت إضافة المرفق.'), () => this.showHistory(this.historyItem!)); (event.target as HTMLInputElement).value = ''; }
  download(doc: ClinicDocument) { this.api.downloadCaseDocument(doc.id).subscribe({ next: blob => { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = doc.fileName; a.click(); URL.revokeObjectURL(url); }, error: e => this.fail(e) }); }
}
