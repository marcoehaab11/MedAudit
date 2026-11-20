import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { LocalizationService } from '../../core/localization.service';
import { WorkspaceDialogComponent } from '../../shared/workspace-dialog.component';
import { AppointmentCreateComponent } from './appointment-create.component';
import { PatientFormComponent } from '../patients/patient-form.component';
import { AuthService } from '../../core/auth.service';

@Component({
  selector: 'app-appointment-intake-actions',
  imports: [WorkspaceDialogComponent, AppointmentCreateComponent, PatientFormComponent],
  template: `
    <div class="actions">
      @if (auth.hasPermission('Appointments.Create')) {
        <button type="button" class="button primary" aria-haspopup="dialog"
          (click)="mode.set('appointment'); dialog.open()">{{ t('Book appointment', 'حجز موعد') }}</button>
      }
      @if (auth.hasPermission('Patients.Create')) {
        <button type="button" class="button add-patient" aria-haspopup="dialog"
          (click)="mode.set('patient'); dialog.open()">{{ t('Add patient', 'إضافة مريض') }}</button>
      }
    </div>
    <app-workspace-dialog #dialog
      [title]="mode() === 'patient' ? t('Add patient', 'إضافة مريض') : t('Book appointment', 'حجز موعد')"
      [closeLabel]="t('Close', 'إغلاق')" [closeDisabled]="saving()" (closed)="mode.set(null)">
      @switch (mode()) {
        @case ('appointment') {
          <app-appointment-create [embedded]="true" [initialDate]="date()" (cancelled)="dialog.close()"
            (created)="dialog.close(); appointmentCreated.emit()" />
        }
        @case ('patient') {
          <app-patient-form [embedded]="true" (cancelled)="dialog.close()"
            (created)="dialog.close(); patientCreated.emit($event)" />
        }
      }
    </app-workspace-dialog>
  `,
  styles: `
    .actions { display: flex; flex-wrap: wrap; gap: .65rem; }
    .actions button { min-block-size: 44px; }
    .add-patient { background: #e0f5ef; color: #105d51; border-color: #c9e9df; }
  `,
})
export class AppointmentIntakeActionsComponent {
  readonly auth = inject(AuthService);
  private readonly i18n = inject(LocalizationService);
  readonly date = input('');
  readonly appointmentCreated = output<void>();
  readonly patientCreated = output<string>();
  readonly mode = signal<'appointment' | 'patient' | null>(null);
  private readonly booking = viewChild(AppointmentCreateComponent);
  private readonly patientForm = viewChild(PatientFormComponent);
  readonly saving = computed(() => !!(this.booking()?.saving() || this.patientForm()?.saving()));

  t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
