import {
  Component,
  ElementRef,
  EventEmitter,
  forwardRef,
  inject,
  Input,
  Output,
  ViewChild,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LocalizationService } from '../../core/localization.service';

export interface TagSuggestion {
  en: string;
  ar: string;
}

@Component({
  selector: 'app-tag-input',
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TagInputComponent),
      multi: true,
    },
  ],
  template: `
    <div
      class="tag-input-container"
      [class.focused]="isFocused()"
      [class.theme-danger]="theme === 'danger'"
      [class.theme-warning]="theme === 'warning'"
      [class.theme-info]="theme === 'info'"
      (click)="focusInput()"
    >
      @for (tag of tags; track tag) {
        <span class="tag-badge">
          <span class="tag-text">{{ tag }}</span>
          <button
            type="button"
            class="tag-remove-btn"
            (click)="removeTag(tag, $event)"
            [title]="t('Remove', 'إزالة')"
          >
            &times;
          </button>
        </span>
      }

      <input
        #inputElement
        type="text"
        class="tag-text-input"
        [placeholder]="tags.length === 0 ? placeholder : ''"
        [(ngModel)]="inputValue"
        (keydown)="onKeyDown($event)"
        (blur)="onBlur()"
        (focus)="isFocused.set(true)"
      />
    </div>

    @if (suggestions.length > 0) {
      <div class="presets-chips-bar">
        <span class="chips-label">💡 {{ t('Suggestions:', 'اقتراحات:') }}</span>
        <div class="chips-scroll-wrap">
          @for (s of suggestions; track s.en) {
            @let label = i18n.language() === 'ar' ? s.ar : s.en;
            @let isSelected = hasTag(label);
            <button
              type="button"
              class="chip-suggest"
              [class.selected]="isSelected"
              [class.allergy-chip]="theme === 'danger'"
              [class.condition-chip]="theme === 'warning'"
              [class.medication-chip]="theme === 'info'"
              (click)="toggleSuggestion(label, $event)"
            >
              {{ isSelected ? '✓ ' : '+ ' }}{{ label }}
            </button>
          }
        </div>
      </div>
    }
  `,
  styles: [
    `
      :host {
        display: block;
        width: 100%;
      }

      .tag-input-container {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 0.4rem;
        min-height: 42px;
        padding: 0.35rem 0.6rem;
        background: #ffffff;
        border: 1.5px solid var(--border, #cbd5e1);
        border-radius: var(--radius-md, 8px);
        cursor: text;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;

        &:hover {
          border-color: #93c5fd;
        }

        &.focused {
          border-color: var(--brand-cyan, #00b4d8);
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.16);
        }

        &.theme-danger {
          border-color: #fecdd3;
        }

        &.theme-warning {
          border-color: #fef08a;
        }

        &.theme-info {
          border-color: #bae6fd;
        }

        &.theme-danger.focused {
          border-color: #ef4444;
          box-shadow: 0 0 0 3px rgba(239, 68, 68, 0.16);
        }

        &.theme-warning.focused {
          border-color: #f59e0b;
          box-shadow: 0 0 0 3px rgba(245, 158, 11, 0.16);
        }

        &.theme-info.focused {
          border-color: #0284c7;
          box-shadow: 0 0 0 3px rgba(2, 132, 199, 0.16);
        }
      }

      .tag-badge {
        display: inline-flex;
        align-items: center;
        gap: 0.3rem;
        padding: 0.2rem 0.55rem;
        border-radius: 999px;
        font-size: 0.82rem;
        font-weight: 700;
        line-height: 1.2;
        background: #f1f5f9;
        color: #334155;
        border: 1px solid #cbd5e1;
        animation: popIn 0.15s cubic-bezier(0.175, 0.885, 0.32, 1.275);

        .tag-text {
          max-width: 220px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .tag-remove-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 16px;
          height: 16px;
          padding: 0;
          margin: 0;
          background: rgba(0, 0, 0, 0.08);
          border: none;
          border-radius: 50%;
          font-size: 0.85rem;
          line-height: 1;
          color: inherit;
          cursor: pointer;
          transition: background 0.15s ease, transform 0.1s ease;

          &:hover {
            background: rgba(0, 0, 0, 0.2);
            transform: scale(1.1);
          }
        }
      }

      .theme-danger .tag-badge {
        background: #fef2f2;
        color: #dc2626;
        border-color: #fecaca;
        .tag-remove-btn:hover { background: #fca5a5; color: #991b1b; }
      }

      .theme-warning .tag-badge {
        background: #fffbeb;
        color: #b45309;
        border-color: #fde68a;
        .tag-remove-btn:hover { background: #fcd34d; color: #78350f; }
      }

      .theme-info .tag-badge {
        background: #f0f9ff;
        color: #0284c7;
        border-color: #bae6fd;
        .tag-remove-btn:hover { background: #7dd3fc; color: #075985; }
      }

      .tag-text-input {
        flex: 1 1 100px;
        min-width: 80px;
        height: 30px;
        border: none !important;
        outline: none !important;
        box-shadow: none !important;
        background: transparent !important;
        padding: 0 0.3rem !important;
        font-size: 0.88rem;
        color: var(--ink, #0f172a);
        font-family: inherit;
      }

      .presets-chips-bar {
        display: flex;
        align-items: center;
        gap: 0.45rem;
        flex-wrap: wrap;
        margin-top: 0.45rem;

        .chips-label {
          font-size: 0.78rem;
          font-weight: 750;
          color: #64748b;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .chips-scroll-wrap {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.35rem;
        }

        .chip-suggest {
          display: inline-flex;
          align-items: center;
          padding: 0.22rem 0.65rem;
          border-radius: 9999px;
          font-size: 0.78rem;
          font-weight: 700;
          cursor: pointer;
          white-space: nowrap;
          flex-shrink: 0;
          border: 1px solid transparent;
          transition: all 0.15s ease;

          &.allergy-chip {
            background: #ffffff;
            color: #be123c;
            border-color: #fecdd3;
            &:hover { background: #fee2e2; border-color: #f87171; }
            &.selected { background: #be123c; color: #ffffff; border-color: #be123c; }
          }

          &.condition-chip {
            background: #ffffff;
            color: #b45309;
            border-color: #fef08a;
            &:hover { background: #fef3c7; border-color: #f59e0b; }
            &.selected { background: #b45309; color: #ffffff; border-color: #b45309; }
          }

          &.medication-chip {
            background: #ffffff;
            color: #0284c7;
            border-color: #bae6fd;
            &:hover { background: #e0f2fe; border-color: #38bdf8; }
            &.selected { background: #0284c7; color: #ffffff; border-color: #0284c7; }
          }
        }
      }

      @keyframes popIn {
        from {
          opacity: 0;
          transform: scale(0.85);
        }
        to {
          opacity: 1;
          transform: scale(1);
        }
      }
    `,
  ],
})
export class TagInputComponent implements ControlValueAccessor {
  readonly i18n = inject(LocalizationService);

  @Input() tags: string[] = [];
  @Output() tagsChange = new EventEmitter<string[]>();

  @Input() placeholder = '';
  @Input() theme: 'danger' | 'warning' | 'info' | 'default' = 'default';
  @Input() suggestions: TagSuggestion[] = [];

  @ViewChild('inputElement') inputRef!: ElementRef<HTMLInputElement>;

  inputValue = '';
  readonly isFocused = signal(false);

  private onChange: (value: string[]) => void = () => {};
  private onTouched: () => void = () => {};

  writeValue(value: string[] | string | null): void {
    if (Array.isArray(value)) {
      this.tags = [...value];
    } else if (typeof value === 'string' && value.trim()) {
      this.tags = value.split(/[,،\n]/).map((s) => s.trim()).filter(Boolean);
    } else {
      this.tags = [];
    }
  }

  registerOnChange(fn: (value: string[]) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  focusInput(): void {
    this.inputRef?.nativeElement?.focus();
  }

  hasTag(text: string): boolean {
    const clean = text.trim().toLowerCase();
    return this.tags.some((t) => t.trim().toLowerCase() === clean);
  }

  addTag(text: string): void {
    const clean = text.trim();
    if (!clean) return;

    if (!this.hasTag(clean)) {
      this.tags = [...this.tags, clean];
      this.emitChange();
    }
    this.inputValue = '';
  }

  removeTag(tagToRemove: string, event?: Event): void {
    if (event) event.stopPropagation();
    this.tags = this.tags.filter((t) => t !== tagToRemove);
    this.emitChange();
  }

  toggleSuggestion(label: string, event?: Event): void {
    if (event) event.stopPropagation();
    if (this.hasTag(label)) {
      this.removeTag(label);
    } else {
      this.addTag(label);
    }
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ',' || event.key === '،') {
      event.preventDefault();
      this.addTag(this.inputValue);
    } else if (event.key === 'Backspace' && !this.inputValue && this.tags.length > 0) {
      this.tags = this.tags.slice(0, -1);
      this.emitChange();
    }
  }

  onBlur(): void {
    this.isFocused.set(false);
    if (this.inputValue.trim()) {
      this.addTag(this.inputValue);
    }
    this.onTouched();
  }

  private emitChange(): void {
    this.tagsChange.emit(this.tags);
    this.onChange(this.tags);
  }

  t(en: string, ar: string): string {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
