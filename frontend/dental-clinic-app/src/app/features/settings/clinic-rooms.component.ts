import { Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { DestroyRef } from '@angular/core';
import { LocalizationService } from '../../core/localization.service';
import { AppointmentApiService, ClinicRoom } from '../appointments/appointment-api.service';

@Component({
  selector: 'app-clinic-rooms',
  imports: [ReactiveFormsModule],
  template: `
    <section class="panel">
      <h2>{{ t('Clinic rooms', 'غرف العيادة') }}</h2>
      @if (error()) { <p role="alert">{{ error() }}</p> }
      @if (rooms().length) {
        <ul>@for (room of rooms(); track room.id) { <li>{{ room.name }}</li> }</ul>
      }
      <form (ngSubmit)="add()" class="room-form">
        <label class="workspace-filter-field"><span>{{ t('Room name', 'اسم الغرفة') }}</span>
          <input [formControl]="name" maxlength="80" />
        </label>
        <button class="button" type="submit" [disabled]="saving() || !name.value.trim()">{{ t('Add room', 'إضافة غرفة') }}</button>
      </form>
    </section>
  `,
  styles: `.room-form { display:flex; align-items:end; gap:.75rem; flex-wrap:wrap; }`,
})
export class ClinicRoomsComponent {
  private readonly api = inject(AppointmentApiService);
  private readonly i18n = inject(LocalizationService);
  private readonly destroyRef = inject(DestroyRef);
  readonly name = new FormControl('', { nonNullable: true, validators: [Validators.maxLength(80)] });
  readonly rooms = signal<ClinicRoom[]>([]);
  readonly error = signal('');
  readonly saving = signal(false);

  constructor() {
    this.api.rooms().pipe(takeUntilDestroyed()).subscribe({
      next: rooms => this.rooms.set(rooms),
      error: () => this.error.set(this.t('Could not load rooms.', 'تعذر تحميل الغرف.')),
    });
  }

  add(): void {
    const name = this.name.value.trim();
    if (!name || this.name.invalid || this.saving()) return;
    this.saving.set(true);
    this.error.set('');
    this.api.addRoom(name).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: room => {
        this.rooms.update(rooms => [...rooms, room]);
        this.name.reset();
        this.saving.set(false);
      },
      error: error => {
        this.error.set(error.status === 409
          ? this.t('This room name already exists.', 'اسم الغرفة موجود بالفعل.')
          : this.t('Could not add this room.', 'تعذرت إضافة الغرفة.'));
        this.saving.set(false);
      },
    });
  }

  t(en: string, ar: string): string { return this.i18n.language() === 'ar' ? ar : en; }
}
