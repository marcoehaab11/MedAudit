import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-permission-matrix',
  imports: [CommonModule],
  template: `
    <div class="permission-matrix">
      @for (group of groups(); track group.name) {
        <details class="permission-group">
          <summary><strong>{{ label(group.name) }}</strong><span>{{ count(group.items) }} / {{ group.items.length }}</span></summary>
          <div class="permission-actions">
            <button type="button" (click)="setGroup(group.items, 'all')">{{ arabic ? 'كل الصلاحيات' : 'All access' }}</button>
            <button type="button" (click)="setGroup(group.items, 'read')">{{ arabic ? 'عرض فقط' : 'View only' }}</button>
            <button type="button" (click)="setGroup(group.items, 'none')">{{ arabic ? 'بدون وصول' : 'No access' }}</button>
          </div>
          <div class="permission-items">
            @for (item of group.items; track item) {
              <label><input type="checkbox" [checked]="selected.includes(item)" (change)="toggle(item)" /><span>{{ item.split('.').slice(1).join(' · ') }}</span></label>
            }
          </div>
        </details>
      }
    </div>
  `,
  styles: [`
    .permission-matrix{display:grid;gap:.55rem;max-height:42vh;overflow:auto;margin:.8rem 0}
    .permission-group{border:1px solid #dce5ec;border-radius:12px;background:#fff;padding:.6rem .8rem}
    summary{cursor:pointer;display:flex;justify-content:space-between;gap:1rem;color:#17344a}
    summary span{font-size:.8rem;color:#64748b}
    .permission-actions{display:flex;gap:.4rem;flex-wrap:wrap;margin:.75rem 0}
    .permission-actions button{border:1px solid #cad8e3;background:#f3f8fb;border-radius:7px;padding:.35rem .6rem;cursor:pointer}
    .permission-items{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:.4rem}
    .permission-items label{display:flex;align-items:center;gap:.45rem;font-size:.82rem;color:#334155}
  `]
})
export class PermissionMatrixComponent {
  @Input() catalog: string[] = [];
  @Input() selected: string[] = [];
  @Input() arabic = false;
  @Output() selectedChange = new EventEmitter<string[]>();

  groups() {
    const map = new Map<string, string[]>();
    for (const permission of this.catalog) {
      const name = permission.split('.')[0];
      map.set(name, [...(map.get(name) || []), permission]);
    }
    return [...map].map(([name, items]) => ({ name, items }));
  }
  label(name: string) {
    if (!this.arabic) return name === 'CRM' ? 'Customer follow-up' : name;
    return ({ Patients: 'المرضى', Doctors: 'الأطباء', Appointments: 'المواعيد', Dental: 'الأسنان', DentalHistory: 'السجل العلاجي', Examination: 'الكشف', Treatments: 'العلاجات', TreatmentPlans: 'خطط العلاج', TreatmentCatalog: 'دليل العلاجات', Prescriptions: 'الروشتات', CRM: 'المتابعة', Finance: 'المالية', Reports: 'التقارير', Users: 'المستخدمون', Settings: 'الإعدادات', Notifications: 'الإشعارات', Inventory: 'المخزون', Pharmacy: 'الصيدلية', Lab: 'المعامل', Insurance: 'التأمينات', Backup: 'النسخ الاحتياطي' } as Record<string,string>)[name] || name;
  }
  count(items: string[]) { return items.filter(x => this.selected.includes(x)).length; }
  toggle(permission: string) { const set = new Set(this.selected); set.has(permission) ? set.delete(permission) : set.add(permission); this.selectedChange.emit([...set]); }
  setGroup(items: string[], mode: 'all' | 'read' | 'none') {
    const set = new Set(this.selected);
    for (const item of items) {
      const action = item.split('.').slice(1).join('.');
      if (mode === 'all' || mode === 'read' && (action.includes('View') || action === 'Dashboard')) set.add(item);
      else set.delete(item);
    }
    this.selectedChange.emit([...set]);
  }
}
