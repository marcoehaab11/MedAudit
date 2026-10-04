import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { UserApiService, UserListItem } from '../users/user-api.service';
import { PatientApiService, PatientListItem } from '../patients/patient-api.service';

interface Branch {
  id: string;
  name: string;
  slug: string;
  phone: string;
  address: string;
  city: string;
  country: string;
  active: boolean;
  hasAccess: boolean;
  isMain: boolean;
}
interface BranchTotals { id: string; name: string; patients: number; appointments: number; revenue: number; payments: number; expenses: number }

@Component({
  selector: 'app-branches-page',
  imports: [FormsModule],
  template: `
    <section class="branches-page">
      <header class="heading">
        <div><span class="eyebrow">{{ t('Clinic management', 'إدارة العيادة') }}</span>
          <h1>{{ t('Branches', 'الفروع') }}</h1>
          <p>{{ t('Each branch has separate patients, appointments, finance and inventory. The clinic subscription covers all branches.', 'كل فرع له مرضاه وحجوزاته وحساباته ومخزونه بشكل منفصل. اشتراك العيادة يشمل كل الفروع.') }}</p>
        </div>
      </header>

      @if (error()) { <div class="notice error" role="alert">{{ error() }}</div> }
      @if (success()) { <div class="notice success" role="status">{{ success() }}</div> }

      <div class="branch-grid">
        @for (branch of branches(); track branch.id) {
          <article class="branch-card" [class.current]="branch.id === auth.tenantId()">
            <div class="branch-card-top"><strong>{{ branch.name }}</strong><span>{{ branch.isMain ? t('Main branch', 'الفرع الرئيسي') : t('Branch', 'فرع') }}</span></div>
            <p>{{ branch.address }}, {{ branch.city }}, {{ branch.country }}</p>
            <p>{{ branch.phone }}</p>
            <div class="branch-actions">
              @if (branch.id === auth.tenantId()) { <span class="active-tag">{{ t('Current branch', 'الفرع الحالي') }}</span> }
              @else if (branch.hasAccess && branch.active) { <button type="button" (click)="switchTo(branch.id)">{{ t('Open branch', 'فتح الفرع') }}</button> }
              @else { <span class="muted">{{ t('No access', 'لا توجد صلاحية دخول') }}</span> }
              @if (canManage() && !branch.isMain) { <button type="button" class="secondary-action" (click)="setBranchActive(branch)">{{ branch.active ? t('Pause branch', 'إيقاف الفرع') : t('Reactivate branch', 'إعادة تفعيل الفرع') }}</button> }
            </div>
          </article>
        }
      </div>

      @if (canManage() && totals().length) {
        <section class="panel totals-panel"><h2>{{ t('All branch accounts', 'حسابات كل الفروع') }}</h2>
          <div class="totals-scroll"><table><thead><tr><th>{{ t('Branch', 'الفرع') }}</th><th>{{ t('Patients', 'المرضى') }}</th><th>{{ t('Appointments', 'الحجوزات') }}</th><th>{{ t('Revenue', 'الإيراد') }}</th><th>{{ t('Payments', 'المدفوعات') }}</th><th>{{ t('Expenses', 'المصروفات') }}</th></tr></thead>
            <tbody>@for (row of totals(); track row.id) { <tr><td>{{ row.name }}</td><td>{{ row.patients }}</td><td>{{ row.appointments }}</td><td>{{ row.revenue }}</td><td>{{ row.payments }}</td><td>{{ row.expenses }}</td></tr> }</tbody>
            <tfoot><tr><th>{{ t('Clinic total', 'إجمالي العيادة') }}</th><th>{{ totalPatients() }}</th><th>{{ totalAppointments() }}</th><th>{{ totalRevenue() }}</th><th>{{ totalPayments() }}</th><th>{{ totalExpenses() }}</th></tr></tfoot>
          </table></div>
        </section>
      }

      @if (canManage()) {
        <div class="management-grid">
          <form class="panel" (ngSubmit)="createBranch()">
            <h2>{{ t('Add a branch', 'إضافة فرع') }}</h2>
            <p>{{ t('The new branch starts with its own data, roles and online booking page.', 'الفرع الجديد يبدأ ببيانات وصلاحيات وصفحة حجز مستقلة.') }}</p>
            <label>{{ t('Branch name', 'اسم الفرع') }}<input name="branchName" [(ngModel)]="draft.name" required maxlength="200"></label>
            <label>{{ t('Branch code', 'رمز الفرع') }}<input name="branchCode" [(ngModel)]="draft.code" required maxlength="30" pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="maadi"></label>
            <label>{{ t('Phone', 'الهاتف') }}<input name="branchPhone" [(ngModel)]="draft.phone" required maxlength="50"></label>
            <label>{{ t('Address', 'العنوان') }}<input name="branchAddress" [(ngModel)]="draft.address" required maxlength="500"></label>
            <div class="row"><label>{{ t('City', 'المدينة') }}<input name="branchCity" [(ngModel)]="draft.city" required maxlength="100"></label>
              <label>{{ t('Country', 'الدولة') }}<input name="branchCountry" [(ngModel)]="draft.country" required maxlength="100"></label></div>
            <button type="submit" [disabled]="busy()">{{ t('Create branch', 'إنشاء الفرع') }}</button>
          </form>

          <form class="panel" (ngSubmit)="transferStaff()">
            <h2>{{ t('Move a team member', 'نقل موظف') }}</h2>
            <p>{{ t('Their old work stays with this branch. Access moves to the selected branch.', 'شغله القديم يفضل في الفرع الحالي، ودخوله ينتقل للفرع المختار.') }}</p>
            <label>{{ t('Search team', 'ابحث عن موظف') }}<input name="staffSearch" [(ngModel)]="staffSearch" (ngModelChange)="searchStaff()" [placeholder]="t('Name or email', 'الاسم أو البريد')"></label>
            <label>{{ t('Team member', 'الموظف') }}<select name="staffId" [(ngModel)]="staffId" required>
              <option value="">{{ t('Choose a member', 'اختار الموظف') }}</option>
              @for (member of staff(); track member.id) { @if (member.id !== auth.userId() && member.status === 1) { <option [value]="member.id">{{ member.displayName }} — {{ member.email }}</option> } }
            </select></label>
            @if (staffPage < staffTotalPages) { <button type="button" class="secondary-action load-more" (click)="loadStaff(true)">{{ t('Load more team members', 'عرض موظفين أكثر') }}</button> }
            <label>{{ t('Destination branch', 'الفرع الجديد') }}<select name="targetBranchId" [(ngModel)]="targetBranchId" required>
              <option value="">{{ t('Choose a branch', 'اختار الفرع') }}</option>
              @for (branch of branches(); track branch.id) { @if (branch.id !== auth.tenantId() && branch.active) { <option [value]="branch.id">{{ branch.name }}</option> } }
            </select></label>
            <button type="submit" [disabled]="busy() || !staffId || !targetBranchId">{{ t('Move member', 'نقل الموظف') }}</button>
          </form>

          <form class="panel" (ngSubmit)="transferPatient()">
            <h2>{{ t('Transfer a patient', 'نقل مريض') }}</h2>
            <p>{{ t('The medical profile moves to the new branch. Previous visits and payments remain in the original branch and clinical history remains readable.', 'الملف الطبي ينتقل للفرع الجديد. الزيارات والدفعات القديمة تفضل في الفرع الأصلي، والتاريخ الطبي يفضل متاح للقراءة.') }}</p>
            <label>{{ t('Search patients', 'ابحث عن مريض') }}<input name="patientSearch" [(ngModel)]="patientSearch" (ngModelChange)="searchPatients()" [placeholder]="t('Name, phone or file number', 'الاسم أو الهاتف أو رقم الملف')"></label>
            <label>{{ t('Patient', 'المريض') }}<select name="patientId" [(ngModel)]="patientId" required>
              <option value="">{{ t('Choose a patient', 'اختار المريض') }}</option>
              @for (patient of patients(); track patient.id) { @if (patient.status === 1) { <option [value]="patient.id">{{ patient.fullName }} — {{ patient.patientNumber }}</option> } }
            </select></label>
            @if (patientPage < patientTotalPages) { <button type="button" class="secondary-action load-more" (click)="loadPatients(true)">{{ t('Load more patients', 'عرض مرضى أكثر') }}</button> }
            <label>{{ t('Destination branch', 'الفرع الجديد') }}<select name="patientTargetBranchId" [(ngModel)]="patientTargetBranchId" required>
              <option value="">{{ t('Choose a branch', 'اختار الفرع') }}</option>
              @for (branch of branches(); track branch.id) { @if (branch.id !== auth.tenantId() && branch.active) { <option [value]="branch.id">{{ branch.name }}</option> } }
            </select></label>
            <button type="submit" [disabled]="busy() || !patientId || !patientTargetBranchId">{{ t('Transfer patient', 'نقل المريض') }}</button>
          </form>
        </div>
      }
    </section>
  `,
  styles: [`
    .branches-page{max-width:1160px;margin:auto;padding:28px 24px;color:#17333f}.heading{margin-bottom:26px}.eyebrow{color:#087e88;font-size:12px;font-weight:800;text-transform:uppercase;letter-spacing:.08em}h1{font-size:32px;margin:6px 0}h2{font-size:21px;margin:0 0 8px}p{color:#627784;line-height:1.6}.branch-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(255px,1fr));gap:16px;margin-bottom:24px}.branch-card,.panel{border:1px solid #dde8e8;border-radius:18px;background:#fff;box-shadow:0 10px 28px rgba(24,70,76,.04)}.branch-card{padding:20px}.branch-card.current{border-color:#08a3a2}.branch-card-top{display:flex;align-items:center;justify-content:space-between;gap:8px}.branch-card-top strong{font-size:18px}.branch-card-top span,.active-tag{font-size:12px;color:#087e88;background:#e7f8f5;padding:6px 9px;border-radius:999px}.branch-card p{margin:9px 0}.branch-actions{margin-top:16px}.secondary-action{margin-inline-start:8px;background:#e6f1f0;color:#17656b}.load-more{margin:10px 0 0}.totals-panel{margin-bottom:24px}.totals-scroll{overflow-x:auto}.totals-panel table{width:100%;border-collapse:collapse;min-width:650px}.totals-panel th,.totals-panel td{padding:11px;border-bottom:1px solid #e0eded;text-align:start}.totals-panel tfoot{background:#e7f8f5}.management-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(315px,1fr));gap:18px}.panel{padding:22px}.panel label{display:block;font-weight:700;font-size:13px;margin-top:14px}.panel input,.panel select{display:block;width:100%;box-sizing:border-box;margin-top:6px;padding:11px 12px;border:1px solid #ccdada;border-radius:10px;background:white;color:#17333f}.row{display:grid;grid-template-columns:1fr 1fr;gap:12px}button{border:0;border-radius:10px;background:#087e88;color:#fff;font-weight:700;padding:11px 17px;cursor:pointer}button:disabled{opacity:.55;cursor:not-allowed}.muted{color:#82939d}.notice{padding:12px 15px;border-radius:10px;margin:12px 0}.notice.error{background:#fff0ef;color:#a72e2e}.notice.success{background:#e8f8f2;color:#12734f}@media(max-width:600px){.branches-page{padding:18px}.row{grid-template-columns:1fr}}
  `],
})
export class BranchesPageComponent {
  private readonly http = inject(HttpClient);
  private readonly users = inject(UserApiService);
  private readonly patientApi = inject(PatientApiService);
  protected readonly auth = inject(AuthService);
  private readonly i18n = inject(LocalizationService);
  protected readonly branches = signal<Branch[]>([]);
  protected readonly staff = signal<UserListItem[]>([]);
  protected readonly patients = signal<PatientListItem[]>([]);
  protected readonly totals = signal<BranchTotals[]>([]);
  protected readonly canManage = signal(false);
  protected readonly busy = signal(false);
  protected readonly error = signal('');
  protected readonly success = signal('');
  protected draft = { name: '', code: '', phone: '', address: '', city: '', country: 'Egypt' };
  protected staffId = '';
  protected targetBranchId = '';
  protected patientId = '';
  protected patientTargetBranchId = '';
  protected staffSearch = '';
  protected patientSearch = '';
  protected staffPage = 0;
  protected staffTotalPages = 0;
  protected patientPage = 0;
  protected patientTotalPages = 0;
  private staffSearchTimer?: ReturnType<typeof setTimeout>;
  private patientSearchTimer?: ReturnType<typeof setTimeout>;

  constructor() { this.load(); }

  protected t(en: string, ar: string): string { return this.i18n.language() === 'en' ? en : ar; }

  private load(): void {
    this.http.get<{ branches: Branch[]; canManage: boolean }>('/api/branches').subscribe({
      next: result => {
        this.branches.set(result.branches);
        this.canManage.set(result.canManage);
        if (result.canManage) { this.loadStaff(false); this.loadPatients(false); }
        if (result.canManage) this.http.get<{ branches: BranchTotals[] }>('/api/branches/summary').subscribe({ next: value => this.totals.set(value.branches) });
      },
      error: () => this.error.set(this.t('Could not load branches.', 'تعذر تحميل الفروع.')),
    });
  }

  protected searchStaff(): void {
    clearTimeout(this.staffSearchTimer);
    this.staffSearchTimer = setTimeout(() => { this.staffId = ''; this.loadStaff(false); }, 250);
  }

  protected searchPatients(): void {
    clearTimeout(this.patientSearchTimer);
    this.patientSearchTimer = setTimeout(() => { this.patientId = ''; this.loadPatients(false); }, 250);
  }

  protected loadStaff(more: boolean): void {
    const page = more ? this.staffPage + 1 : 1;
    const search = this.staffSearch.trim();
    this.users.users(search, '', 'active', page).subscribe({ next: value => {
      if (search !== this.staffSearch.trim()) return;
      this.staff.set(more ? [...this.staff(), ...value.items] : value.items);
      this.staffPage = value.page; this.staffTotalPages = value.totalPages;
    }});
  }

  protected loadPatients(more: boolean): void {
    const page = more ? this.patientPage + 1 : 1;
    const search = this.patientSearch.trim();
    this.patientApi.patients({ search, status: 'active', page, pageSize: 50 }).subscribe({ next: value => {
      if (search !== this.patientSearch.trim()) return;
      this.patients.set(more ? [...this.patients(), ...value.items] : value.items);
      this.patientPage = value.page; this.patientTotalPages = value.totalPages;
    }});
  }

  protected createBranch(): void {
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.post('/api/branches', this.draft).subscribe({
      next: () => {
        this.busy.set(false);
        this.success.set(this.t('Branch created. You can open it from the branch selector.', 'تم إنشاء الفرع. تقدر تفتحه من قائمة الفروع.'));
        this.draft = { name: '', code: '', phone: '', address: '', city: '', country: 'Egypt' };
        this.auth.refreshClinics().subscribe({ error: () => {} });
        this.load();
      },
      error: err => { this.busy.set(false); this.error.set(err?.error?.message ?? this.t('Could not create branch.', 'تعذر إنشاء الفرع.')); },
    });
  }

  protected transferStaff(): void {
    if (!this.staffId || !this.targetBranchId) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.post(`/api/branches/${this.targetBranchId}/staff/${this.staffId}/transfer`, {}).subscribe({
      next: () => {
        this.busy.set(false); this.staffId = ''; this.targetBranchId = '';
        this.success.set(this.t('Team member moved. Historical work stayed in the original branch.', 'تم نقل الموظف. شغله القديم فضل في الفرع الأصلي.'));
        this.load();
      },
      error: err => { this.busy.set(false); this.error.set(err?.error?.message ?? this.t('Could not move team member.', 'تعذر نقل الموظف.')); },
    });
  }

  protected switchTo(tenantId: string): void {
    this.auth.switchClinic(tenantId).subscribe({
      next: () => window.location.assign('/dashboard'),
      error: () => this.error.set(this.t('Could not open this branch.', 'تعذر فتح الفرع.')),
    });
  }

  protected totalPatients(): number { return this.totals().reduce((sum, x) => sum + x.patients, 0); }
  protected totalAppointments(): number { return this.totals().reduce((sum, x) => sum + x.appointments, 0); }
  protected totalRevenue(): number { return this.totals().reduce((sum, x) => sum + x.revenue, 0); }
  protected totalPayments(): number { return this.totals().reduce((sum, x) => sum + x.payments, 0); }
  protected totalExpenses(): number { return this.totals().reduce((sum, x) => sum + x.expenses, 0); }

  protected setBranchActive(branch: Branch): void {
    this.busy.set(true); this.error.set('');
    this.http.put(`/api/branches/${branch.id}/status`, { active: !branch.active }).subscribe({
      next: () => { this.busy.set(false); this.load(); this.auth.refreshClinics().subscribe({ error: () => {} }); },
      error: () => { this.busy.set(false); this.error.set(this.t('Could not change branch status.', 'تعذر تغيير حالة الفرع.')); },
    });
  }

  protected transferPatient(): void {
    if (!this.patientId || !this.patientTargetBranchId) return;
    this.busy.set(true); this.error.set(''); this.success.set('');
    this.http.post(`/api/branches/${this.patientTargetBranchId}/patients/${this.patientId}/transfer`, {}).subscribe({
      next: () => {
        this.busy.set(false); this.patientId = ''; this.patientTargetBranchId = '';
        this.success.set(this.t('Patient transferred. Historical payments and visits stayed in the original branch.', 'تم نقل المريض. الزيارات والدفعات القديمة فضلت في الفرع الأصلي.'));
        this.load();
      },
      error: err => { this.busy.set(false); this.error.set(err?.error?.message ?? this.t('Could not transfer patient.', 'تعذر نقل المريض.')); },
    });
  }
}
