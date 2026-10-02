import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  FormsModule,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import { LocalizationService } from '../../core/localization.service';

@Component({
  selector: 'app-date-input',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div
      class="date-input-container"
      [class.disabled]="disabled"
      [class.is-invalid]="isInvalid"
      (click)="onContainerClick($event)"
    >
      <div class="date-segments">
        <input
          #dayInput
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="2"
          [placeholder]="t('DD', 'يوم')"
          [disabled]="disabled"
          [(ngModel)]="dayVal"
          (input)="onDayInput($event)"
          (keydown)="onDayKeydown($event)"
          (paste)="onPaste($event)"
          (blur)="onBlur()"
          class="date-part day"
        />
        <span class="date-sep">/</span>
        <input
          #monthInput
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="2"
          [placeholder]="t('MM', 'شهر')"
          [disabled]="disabled"
          [(ngModel)]="monthVal"
          (input)="onMonthInput($event)"
          (keydown)="onMonthKeydown($event)"
          (paste)="onPaste($event)"
          (blur)="onBlur()"
          class="date-part month"
        />
        <span class="date-sep">/</span>
        <input
          #yearInput
          type="text"
          inputmode="numeric"
          pattern="[0-9]*"
          maxlength="4"
          [placeholder]="t('YYYY', 'سنة')"
          [disabled]="disabled"
          [(ngModel)]="yearVal"
          (input)="onYearInput($event)"
          (keydown)="onYearKeydown($event)"
          (paste)="onPaste($event)"
          (blur)="onBlur()"
          class="date-part year"
        />
      </div>

      <button
        type="button"
        class="btn-cal-picker"
        [disabled]="disabled"
        (click)="triggerNativePicker($event)"
        tabindex="-1"
        [attr.title]="t('Pick from calendar', 'اختيار من التقويم')"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
          <line x1="16" y1="2" x2="16" y2="6"></line>
          <line x1="8" y1="2" x2="8" y2="6"></line>
          <line x1="3" y1="10" x2="21" y2="10"></line>
        </svg>
      </button>

      <input
        #nativeDatePicker
        type="date"
        class="hidden-native-date"
        [max]="max"
        [min]="min"
        [disabled]="disabled"
        [value]="internalValue"
        (change)="onNativeDateChange($event)"
        tabindex="-1"
      />
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .date-input-container {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      height: 42px;
      border: 1.5px solid var(--border, #d2e4df);
      border-radius: var(--radius-md, 0.65rem);
      padding: 0 0.65rem 0 0.85rem;
      background: #ffffff;
      color: var(--ink, #15312d);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 1px 2px rgba(0, 0, 0, 0.02);
      box-sizing: border-box;
      cursor: text;
      position: relative;

      &:hover:not(.disabled) {
        border-color: #93c5fd;
      }

      &:focus-within {
        outline: none;
        border-color: var(--brand-cyan, #00b4d8);
        background: #ffffff;
        box-shadow: 0 0 0 3.5px rgba(0, 180, 216, 0.18);
      }

      &.disabled {
        background: #f1f5f9;
        opacity: 0.7;
        cursor: not-allowed;
      }

      &.is-invalid {
        border-color: #ef4444;
        box-shadow: 0 0 0 2px rgba(239, 68, 68, 0.15);
      }
    }

    .date-segments {
      display: flex;
      align-items: center;
      gap: 0.2rem;
      direction: ltr; /* Keeps day/month/year order consistent across locales */
      flex: 1;
      min-width: 0;
    }

    .date-part {
      border: none;
      background: transparent;
      outline: none;
      font-family: inherit;
      font-size: 0.92rem;
      font-weight: 500;
      color: var(--ink, #15312d);
      text-align: center;
      padding: 0;
      margin: 0;
      height: 100%;
      box-shadow: none;

      &::placeholder {
        color: var(--muted, #94a3b8);
        font-weight: 400;
        opacity: 0.8;
      }

      &:disabled {
        cursor: not-allowed;
        color: #94a3b8;
      }

      &.day {
        width: 2.2rem;
      }

      &.month {
        width: 2.2rem;
      }

      &.year {
        width: 3.2rem;
      }
    }

    .date-sep {
      color: #cbd5e1;
      font-size: 0.95rem;
      font-weight: 600;
      user-select: none;
      pointer-events: none;
      padding: 0 0.1rem;
    }

    .btn-cal-picker {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      background: transparent;
      border: none;
      border-radius: 0.375rem;
      padding: 0.3rem;
      color: #64748b;
      cursor: pointer;
      line-height: 1;
      margin-inline-start: 0.5rem;
      flex-shrink: 0;
      height: 30px;
      width: 30px;
      transition: all 0.15s ease;

      &:hover:not(:disabled) {
        background: #f1f5f9;
        color: var(--brand, #087b68);
      }

      &:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }
    }

    .hidden-native-date {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      width: 0;
      height: 0;
      margin: 0;
      padding: 0;
      border: none;
      bottom: 0;
      right: 0;
    }
  `],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => DateInputComponent),
      multi: true,
    },
  ],
})
export class DateInputComponent implements ControlValueAccessor, Validator {
  readonly i18n = inject(LocalizationService);

  @Input() min = '1900-01-01';
  @Input() max = '2099-12-31';
  @Input() isInvalid = false;
  @Output() dateChange = new EventEmitter<string>();

  @ViewChild('dayInput') dayInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('monthInput') monthInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('yearInput') yearInputRef?: ElementRef<HTMLInputElement>;
  @ViewChild('nativeDatePicker') nativeDatePickerRef?: ElementRef<HTMLInputElement>;

  dayVal = '';
  monthVal = '';
  yearVal = '';

  internalValue = '';
  disabled = false;

  onChange: (val: string) => void = () => {};
  onTouched: () => void = () => {};

  writeValue(val: string | null | undefined): void {
    if (!val) {
      this.dayVal = '';
      this.monthVal = '';
      this.yearVal = '';
      this.internalValue = '';
      return;
    }

    const cleanDate = typeof val === 'string' && val.includes('T') ? val.split('T')[0] : String(val).slice(0, 10);
    this.internalValue = cleanDate;
    const parts = cleanDate.split('-');
    if (parts.length === 3) {
      this.yearVal = parts[0];
      this.monthVal = parts[1];
      this.dayVal = parts[2];
    }
  }

  registerOnChange(fn: (val: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }
    const val = control.value;
    const parts = val.split('-');
    if (parts.length !== 3) {
      return { invalidDate: true };
    }
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);

    if (isNaN(y) || isNaN(m) || isNaN(d) || m < 1 || m > 12 || d < 1 || d > 31) {
      return { invalidDate: true };
    }

    const date = new Date(y, m - 1, d);
    if (date.getFullYear() !== y || date.getMonth() + 1 !== m || date.getDate() !== d) {
      return { invalidDate: true };
    }

    if (this.max && val > this.max) {
      return { maxDate: true };
    }
    if (this.min && val < this.min) {
      return { minDate: true };
    }

    return null;
  }

  onContainerClick(event: MouseEvent): void {
    if (this.disabled) return;
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'BUTTON' || target.closest('button')) {
      return;
    }
    if (!this.dayVal) {
      this.dayInputRef?.nativeElement.focus();
    } else if (!this.monthVal) {
      this.monthInputRef?.nativeElement.focus();
    } else if (!this.yearVal) {
      this.yearInputRef?.nativeElement.focus();
    } else {
      this.dayInputRef?.nativeElement.focus();
    }
  }

  onDayInput(event: Event): void {
    this.dayVal = this.dayVal.replace(/\D/g, '');
    const num = parseInt(this.dayVal, 10);

    if (this.dayVal.length === 2 || (this.dayVal.length === 1 && num > 3)) {
      if (this.dayVal.length === 1 && num > 3) {
        this.dayVal = `0${this.dayVal}`;
      }
      this.monthInputRef?.nativeElement.focus();
      this.monthInputRef?.nativeElement.select();
    }
    this.syncModel();
  }

  onDayKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === '/' || event.key === '-' || event.key === '.') {
      event.preventDefault();
      this.monthInputRef?.nativeElement.focus();
      this.monthInputRef?.nativeElement.select();
    }
  }

  onMonthInput(event: Event): void {
    this.monthVal = this.monthVal.replace(/\D/g, '');
    const num = parseInt(this.monthVal, 10);

    if (this.monthVal.length === 2 || (this.monthVal.length === 1 && num > 1)) {
      if (this.monthVal.length === 1 && num > 1) {
        this.monthVal = `0${this.monthVal}`;
      }
      this.yearInputRef?.nativeElement.focus();
      this.yearInputRef?.nativeElement.select();
    }
    this.syncModel();
  }

  onMonthKeydown(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight' || event.key === '/' || event.key === '-' || event.key === '.') {
      event.preventDefault();
      this.yearInputRef?.nativeElement.focus();
      this.yearInputRef?.nativeElement.select();
    } else if (event.key === 'Backspace' && !this.monthVal) {
      event.preventDefault();
      this.dayInputRef?.nativeElement.focus();
    } else if (event.key === 'ArrowLeft' && (event.target as HTMLInputElement).selectionStart === 0) {
      this.dayInputRef?.nativeElement.focus();
    }
  }

  onYearInput(event: Event): void {
    this.yearVal = this.yearVal.replace(/\D/g, '');
    if (this.yearVal.length === 4) {
      this.yearInputRef?.nativeElement.blur();
    }
    this.syncModel();
  }

  onYearKeydown(event: KeyboardEvent): void {
    if (event.key === 'Backspace' && !this.yearVal) {
      event.preventDefault();
      this.monthInputRef?.nativeElement.focus();
    } else if (event.key === 'ArrowLeft' && (event.target as HTMLInputElement).selectionStart === 0) {
      this.monthInputRef?.nativeElement.focus();
    }
  }

  onPaste(event: ClipboardEvent): void {
    const text = event.clipboardData?.getData('text') || '';
    if (!text) return;

    // Support formats: YYYY-MM-DD, DD/MM/YYYY, DD-MM-YYYY, DD.MM.YYYY
    const isoMatch = text.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
    if (isoMatch) {
      event.preventDefault();
      this.yearVal = isoMatch[1];
      this.monthVal = this.pad(parseInt(isoMatch[2], 10));
      this.dayVal = this.pad(parseInt(isoMatch[3], 10));
      this.syncModel();
      return;
    }

    const dmyMatch = text.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmyMatch) {
      event.preventDefault();
      this.dayVal = this.pad(parseInt(dmyMatch[1], 10));
      this.monthVal = this.pad(parseInt(dmyMatch[2], 10));
      this.yearVal = dmyMatch[3];
      this.syncModel();
      return;
    }
  }

  onBlur(): void {
    if (this.dayVal) {
      this.dayVal = this.pad(parseInt(this.dayVal, 10));
    }
    if (this.monthVal) {
      this.monthVal = this.pad(parseInt(this.monthVal, 10));
    }
    this.syncModel();
    this.onTouched();
  }

  private syncModel(): void {
    if (this.yearVal && this.monthVal && this.dayVal && this.yearVal.length === 4) {
      const formatted = `${this.yearVal}-${this.pad(parseInt(this.monthVal, 10))}-${this.pad(parseInt(this.dayVal, 10))}`;
      this.internalValue = formatted;
      this.onChange(formatted);
      this.dateChange.emit(formatted);
    } else if (!this.yearVal && !this.monthVal && !this.dayVal) {
      this.internalValue = '';
      this.onChange('');
      this.dateChange.emit('');
    }
  }

  triggerNativePicker(event: MouseEvent): void {
    event.stopPropagation();
    const el = this.nativeDatePickerRef?.nativeElement;
    if (el) {
      if (typeof (el as any).showPicker === 'function') {
        try {
          (el as any).showPicker();
        } catch {
          el.focus();
          el.click();
        }
      } else {
        el.focus();
        el.click();
      }
    }
  }

  onNativeDateChange(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (input.value) {
      this.writeValue(input.value);
      this.onChange(input.value);
      this.dateChange.emit(input.value);
      this.onTouched();
    }
  }

  pad(num: number): string {
    if (isNaN(num)) return '';
    return num < 10 ? `0${num}` : `${num}`;
  }

  t(en: string, ar: string): string {
    return this.i18n.language() === 'ar' ? ar : en;
  }
}
