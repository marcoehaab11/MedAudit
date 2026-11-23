import { Component, computed, inject, input, output, signal, viewChild } from '@angular/core';
import { LocalizationService } from '../../core/localization.service';
import { WorkspaceDialogComponent } from '../../shared/workspace-dialog.component';
import { AppointmentCreateComponent } from './appointment-create.component';
import { PatientCreateDialogComponent } from '../patients/patient-create-dialog.component';
import { AuthService } from '../../core/auth.service';
import { RouterLink } from '@angular/router';
import { NgTemplateOutlet } from '@angular/common';

@Component({
  selector: 'app-appointment-intake-actions',
  imports: [RouterLink, NgTemplateOutlet, WorkspaceDialogComponent, AppointmentCreateComponent, PatientCreateDialogComponent],
  template: `
    <div class="actions">
      @if (auth.hasPermission('Appointments.Create')) {
        @if (bookingPage()) {
          <a class="button primary" routerLink="/appointments/create" [queryParams]="{ date: date(), from: 'dashboard' }">
            <ng-container *ngTemplateOutlet="bookLabel" />
          </a>
        } @else {
          <button type="button" class="button primary" aria-haspopup="dialog"
            (click)="bookingOpen.set(true); dialog.open()">
            <ng-container *ngTemplateOutlet="bookLabel" />
          </button>
        }
        <ng-template #bookLabel>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M7 3v4m10-4v4M3 10h18m-9 2v6m-3-3h6"/></svg>
          {{ t('Book appointment', 'حجز موعد') }}
        </ng-template>
      }
      @if (auth.hasPermission('Patients.Create')) {
        <button type="button" class="button add-patient" aria-haspopup="dialog"
          (click)="addPatient.open()">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><circle cx="9" cy="7" r="3"/><path d="M3 20v-2a5 5 0 0 1 5-5h2a5 5 0 0 1 5 5v2zm15-13v6m-3-3h6"/></svg>
          {{ t('Add patient', 'إضافة مريض') }}
        </button>
      }
    </div>
    <app-patient-create-dialog #addPatient (created)="patientCreated.emit($event)" />
    <app-workspace-dialog #dialog
      [title]="t('Book appointment', 'حجز موعد')"
      [closeLabel]="t('Close', 'إغلاق')" [closeDisabled]="saving()" (closed)="bookingOpen.set(false)">
      @if (bookingOpen()) {
        <app-appointment-create [embedded]="true" [initialDate]="date()" (cancelled)="dialog.close()"
          (created)="dialog.close(); appointmentCreated.emit()" />
      }
    </app-workspace-dialog>
  `,
  styles: `
    .actions { display: flex; flex-wrap: wrap; gap: .65rem; }
    .actions .button { display: inline-flex; align-items: center; justify-content: center; gap: .5rem; min-block-size: 44px; box-shadow: none; }
    .actions svg { inline-size: 18px; block-size: 18px; flex: none; }
    :host-context(.workspace-dashboard) .actions { flex-direction: row-reverse; justify-content: flex-end; }
    :host-context(.workspace-dashboard) .primary { background: #15796a; }
    :host-context(.workspace-dashboard) .primary:hover { background: #0c6659; }
    :host-context(.workspace-dashboard) .add-patient { background: #f7fcfb; border-color: #258778; }
    :host-context(.workspace-dashboard) .add-patient:hover { background: #e0f5ef; }
    .add-patient { background: #e0f5ef; color: #105d51; border-color: #c9e9df; }
  `,
})
export class AppointmentIntakeActionsComponent {
  readonly auth = inject(AuthService);
  private readonly i18n = inject(LocalizationService);
  readonly date = input('');
  readonly bookingPage = input(false);
  readonly appointmentCreated = output<void>();
  readonly patientCreated = output<string>();
  readonly bookingOpen = signal(false);
  private readonly booking = viewChild(AppointmentCreateComponent);
  readonly saving = computed(() => !!this.booking()?.saving());

  t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
