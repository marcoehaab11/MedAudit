import {
  AfterViewInit,
  Component,
  ElementRef,
  forwardRef,
  Input,
  OnDestroy,
  ViewChild,
  ViewEncapsulation,
} from '@angular/core';
import {
  AbstractControl,
  ControlValueAccessor,
  NG_VALIDATORS,
  NG_VALUE_ACCESSOR,
  ValidationErrors,
  Validator,
} from '@angular/forms';
import intlTelInput from 'intl-tel-input';
// @ts-ignore
import { Iti } from 'intl-tel-input';

@Component({
  selector: 'app-phone-input',
  standalone: true,
  template: `
    <div class="phone-input-wrapper" dir="ltr">
      <input
        #phoneInput
        type="tel"
        class="form-control"
        [placeholder]="placeholder"
        [disabled]="disabled"
        (input)="onInputChange()"
        (keyup)="onInputChange()"
        (change)="onInputChange()"
        (blur)="onBlur()"
      />
    </div>
  `,
  styleUrl: './phone-input.scss',
  encapsulation: ViewEncapsulation.None,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
    {
      provide: NG_VALIDATORS,
      useExisting: forwardRef(() => PhoneInputComponent),
      multi: true,
    },
  ],
})
export class PhoneInputComponent implements ControlValueAccessor, Validator, AfterViewInit, OnDestroy {
  @ViewChild('phoneInput') phoneInputRef!: ElementRef<HTMLInputElement>;
  
  @Input() placeholder = '';

  disabled = false;
  private iti?: Iti;
  private value = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    const input = this.phoneInputRef.nativeElement;
    this.iti = intlTelInput(input, {
      initialCountry: 'eg',
      loadUtils: () => import('intl-tel-input/utils'),
      // @ts-ignore
      showSelectedDialCode: true,
      strictMode: false,
    } as any);

    if (this.value) {
      this.iti.setNumber(this.value);
    }
    
    input.addEventListener('countrychange', () => {
      this.onInputChange();
      try {
        const itiContainer = input.closest('.iti');
        const dropdown = itiContainer?.querySelector('.iti__dropdown-content, .iti__country-list');
        if (dropdown) {
          dropdown.classList.add('iti__hide');
        }
        const btn = itiContainer?.querySelector('.iti__selected-country, [aria-haspopup="true"]');
        if (btn) {
          btn.setAttribute('aria-expanded', 'false');
        }
      } catch {}
    });

    const wrapper = input.closest('.phone-input-wrapper');
    if (wrapper) {
      wrapper.addEventListener('click', (e) => {
        const target = e.target as HTMLElement;
        if (target.closest('.iti__country, .iti__country-list, .iti__dropdown-content, .iti__search-input, .iti__selected-country')) {
          e.stopPropagation();
        }
      });
    }
  }

  ngOnDestroy(): void {
    if (this.iti) {
      this.iti.destroy();
    }
  }

  onInputChange(): void {
    if (this.iti) {
      let fullNumber = '';
      try {
        fullNumber = this.iti.getNumber();
      } catch {
        fullNumber = this.phoneInputRef.nativeElement.value;
      }
      if (!fullNumber) {
        fullNumber = this.phoneInputRef.nativeElement.value;
      }
      this.value = fullNumber;
      this.onChange(this.value);
    }
  }

  onBlur(): void {
    this.onTouched();
  }

  writeValue(obj: any): void {
    this.value = obj || '';
    if (this.iti) {
      this.iti.setNumber(this.value);
    } else if (this.phoneInputRef) {
      this.phoneInputRef.nativeElement.value = this.value;
    }
  }

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  validate(control: AbstractControl): ValidationErrors | null {
    if (!control.value) {
      return null;
    }

    const val = String(control.value);
    const digits = val.replace(/\D/g, '');
    if (digits.length < 10) {
      return { invalidPhone: true };
    }
    
    return null;
  }
}
