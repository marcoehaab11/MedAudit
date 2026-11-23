import { Component, inject, output, signal, viewChild } from '@angular/core';
import { LocalizationService } from '../../core/localization.service';
import { WorkspaceDialogComponent } from '../../shared/workspace-dialog.component';
import { PatientFormComponent } from './patient-form.component';

@Component({
  selector: 'app-patient-create-dialog',
  imports: [WorkspaceDialogComponent, PatientFormComponent],
  template: `
    <app-workspace-dialog #dialog width="46rem"
      [title]="isArabic() ? 'إضافة مريض' : 'Add patient'"
      [closeLabel]="isArabic() ? 'إغلاق' : 'Close'"
      [closeDisabled]="!!form()?.saving()" (closed)="visible.set(false)">
      @if (visible()) {
        <app-patient-form [embedded]="true" (cancelled)="dialog.close()" (created)="finish($event)" />
      }
    </app-workspace-dialog>
  `,
})
export class PatientCreateDialogComponent {
  private readonly i18n = inject(LocalizationService);
  private readonly dialog = viewChild.required<WorkspaceDialogComponent>('dialog');
  readonly created = output<string>();
  protected readonly visible = signal(false);
  protected readonly form = viewChild(PatientFormComponent);

  open(): void {
    this.visible.set(true);
    this.dialog().open();
  }

  protected finish(id: string): void {
    this.dialog().close();
    this.created.emit(id);
  }

  protected isArabic(): boolean {
    return this.i18n.language() === 'ar';
  }
}
