import {
  Component,
  ElementRef,
  HostListener,
  Input,
  OnInit,
  forwardRef,
  inject,
  signal,
} from '@angular/core';
import { ControlValueAccessor, FormsModule, NG_VALUE_ACCESSOR } from '@angular/forms';
import { LocalizationService } from '../core/localization.service';
import { PatientApiService, PatientListItem } from '../features/patients/patient-api.service';

@Component({
  selector: 'app-patient-select',
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => PatientSelectComponent),
      multi: true,
    },
  ],
  styles: [
    `
      :host {
        display: block;
        position: relative;
        inline-size: 100%;
      }

      .picker-wrapper {
        position: relative;
        inline-size: 100%;
      }

      .selected-display {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.5rem;
        height: 42px;
        padding: 0 0.85rem;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        background-color: #ffffff;
        cursor: pointer;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
        user-select: none;

        &:hover:not(.disabled) {
          border-color: #93c5fd;
        }

        &.active {
          border-color: var(--brand-cyan);
          box-shadow: 0 0 0 3px rgba(0, 180, 216, 0.18);
        }

        &.invalid {
          border-color: #ef4444 !important;
          background-color: #fffafb;
        }

        &.disabled {
          background-color: #f1f5f9;
          color: #94a3b8;
          cursor: not-allowed;
          opacity: 0.8;
        }
      }

      .patient-info {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        overflow: hidden;
        white-space: nowrap;
        text-overflow: ellipsis;
        flex: 1;

        .name {
          font-weight: 700;
          color: var(--ink);
          font-size: 0.89rem;
        }

        .phone {
          color: var(--muted);
          font-size: 0.82rem;
          font-weight: 500;
        }

        .tag {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 4px;
          padding: 0.12rem 0.4rem;
          font-size: 0.72rem;
          font-weight: 700;
          color: var(--brand-dark);
          line-height: 1;
        }
      }

      .placeholder-text {
        color: var(--muted);
        font-size: 0.88rem;
        font-weight: 500;
      }

      .picker-actions {
        display: flex;
        align-items: center;
        gap: 0.35rem;
      }

      .clear-btn {
        background: transparent;
        border: none;
        color: var(--muted);
        font-size: 1.1rem;
        cursor: pointer;
        padding: 0 0.25rem;
        line-height: 1;
        border-radius: 50%;
        display: inline-flex;
        align-items: center;
        justify-content: center;

        &:hover {
          color: #dc2626;
          background: #fee2e2;
        }
      }

      .dropdown-arrow {
        color: var(--ink-secondary);
        font-size: 0.65rem;
        transition: transform 0.15s ease;

        &.open {
          transform: rotate(180deg);
        }
      }

      .dropdown-backdrop {
        position: fixed;
        inset: 0;
        z-index: 990;
        background: transparent;
      }

      .dropdown-menu {
        position: absolute;
        top: calc(100% + 4px);
        left: 0;
        right: 0;
        z-index: 1000;
        background: #ffffff;
        border: 1.5px solid var(--border);
        border-radius: var(--radius-md);
        box-shadow: 0 10px 25px rgba(12, 40, 117, 0.15);
        overflow: hidden;
        display: flex;
        flex-direction: column;
        max-height: 320px;
      }

      .search-box {
        padding: 0.6rem;
        border-block-end: 1px solid var(--border);
        background: var(--surface);

        input {
          inline-size: 100%;
          height: 36px;
          border: 1.5px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 0 0.75rem;
          font-size: 0.86rem;
          background: #ffffff;
          font-family: inherit;

          &:focus {
            outline: none;
            border-color: var(--brand-cyan);
            box-shadow: 0 0 0 2.5px rgba(0, 180, 216, 0.18);
          }
        }
      }

      .options-list {
        overflow-y: auto;
        max-height: 240px;
        list-style: none;
        margin: 0;
        padding: 0.3rem 0;

        li {
          padding: 0.6rem 0.85rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 0.5rem;
          cursor: pointer;
          transition: background 0.1s ease;

          &:hover {
            background: #f0fdfa;
          }

          &.selected {
            background: #e0f2fe;

            .patient-name {
              color: #0369a1;
              font-weight: 800;
            }
          }
        }
      }

      .patient-row {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;

        .patient-name {
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--ink);
        }

        .patient-sub {
          font-size: 0.78rem;
          color: var(--muted);
          display: flex;
          gap: 0.45rem;
          align-items: center;
        }
      }

      .empty-results {
        padding: 1.25rem 1rem;
        text-align: center;
        color: var(--muted);
        font-size: 0.84rem;
      }
    `,
  ],
  template: `
    <div class="picker-wrapper">
      <div
        class="selected-display"
        [class.active]="isOpen()"
        [class.invalid]="isInvalid"
        [class.disabled]="disabled"
        (click)="toggleDropdown($event)"
      >
        @if (selectedPatient()) {
          <div class="patient-info">
            <span class="name">{{ selectedPatient()!.fullName }}</span>
            @if (selectedPatient()!.phone) {
              <span class="phone">📞 {{ selectedPatient()!.phone }}</span>
            }
            <span class="tag">{{ selectedPatient()!.patientNumber }}</span>
          </div>
        } @else {
          <span class="placeholder-text">{{ resolvedPlaceholder() }}</span>
        }

        <div class="picker-actions">
          @if (allowClear && selectedPatient() && !disabled) {
            <button
              type="button"
              class="clear-btn"
              (click)="clearSelection($event)"
              title="Clear selection"
            >
              ×
            </button>
          }
          <span class="dropdown-arrow" [class.open]="isOpen()">▼</span>
        </div>
      </div>

      @if (isOpen()) {
        <div class="dropdown-backdrop" (click)="closeDropdown($event)"></div>
        <div class="dropdown-menu" (click)="$event.stopPropagation()">
          <div class="search-box">
            <input
              #searchInput
              type="text"
              [placeholder]="i18n.language() === 'ar' ? 'ابحث بالاسم، التليفون، أو رقم الملف…' : 'Search by name, phone, or file #…'"
              [(ngModel)]="searchQuery"
              (input)="onSearchChange()"
              (keydown.escape)="closeDropdown($event)"
            />
          </div>

          <ul class="options-list">
            @if (allowClear && !searchQuery.trim()) {
              <li (click)="selectPatient(null, $event)" [class.selected]="!selectedPatient()">
                <div class="patient-row">
                  <span class="patient-name">{{ i18n.language() === 'ar' ? '— كل المرضى (بدون تحديد) —' : '— All patients (no filter) —' }}</span>
                </div>
              </li>
            }

            @for (p of filteredPatients(); track p.id) {
              <li
                (click)="selectPatient(p, $event)"
                [class.selected]="selectedPatient()?.id === p.id"
              >
                <div class="patient-row">
                  <span class="patient-name">{{ p.fullName }}</span>
                  <span class="patient-sub">
                    @if (p.phone) { <span>📞 {{ p.phone }}</span> · }
                    <span>📁 {{ p.patientNumber }}</span>
                  </span>
                </div>
              </li>
            } @empty {
              <div class="empty-results">
                {{ i18n.language() === 'ar' ? 'لا يوجد مريض مطابق للبحث' : 'No patients match your search' }}
              </div>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class PatientSelectComponent implements OnInit, ControlValueAccessor {
  @Input() placeholder = '';
  @Input() allowClear = true;
  @Input() isInvalid = false;

  private readonly patientApi = inject(PatientApiService);
  readonly i18n = inject(LocalizationService);
  private readonly elementRef = inject(ElementRef);

  readonly allPatients = signal<PatientListItem[]>([]);
  readonly filteredPatients = signal<PatientListItem[]>([]);
  readonly selectedPatient = signal<PatientListItem | null>(null);
  readonly isOpen = signal(false);

  searchQuery = '';
  disabled = false;
  currentValue = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    this.loadPatients();
  }

  resolvedPlaceholder() {
    if (this.placeholder) return this.placeholder;
    return this.i18n.language() === 'ar' ? 'اختر المريض (ابحث بالاسم أو التليفون)…' : 'Select patient (search name or phone)…';
  }

  loadPatients() {
    this.patientApi.listAll().subscribe({
      next: (items) => {
        this.allPatients.set(items);
        this.filterList();
        this.syncSelected();
      },
      error: () => this.allPatients.set([]),
    });
  }

  onSearchChange() {
    this.filterList();
  }

  filterList() {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredPatients.set(this.allPatients());
      return;
    }

    const filtered = this.allPatients().filter((p) => {
      const matchName = (p.fullName || '').toLowerCase().includes(q);
      const matchPhone = (p.phone || '').toLowerCase().includes(q);
      const matchNumber = (p.patientNumber || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchNumber;
    });

    this.filteredPatients.set(filtered);
  }

  toggleDropdown(event: Event) {
    if (this.disabled) return;
    event.stopPropagation();
    const nextState = !this.isOpen();
    this.isOpen.set(nextState);

    if (nextState) {
      this.searchQuery = '';
      this.filterList();
      setTimeout(() => {
        const input = this.elementRef.nativeElement.querySelector('input');
        if (input) input.focus();
      }, 50);
    } else {
      this.onTouched();
    }
  }

  closeDropdown(event?: Event) {
    if (event) event.stopPropagation();
    this.isOpen.set(false);
    this.onTouched();
  }

  selectPatient(p: PatientListItem | null, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedPatient.set(p);
    this.currentValue = p ? p.id : '';
    this.onChange(this.currentValue);
    this.onTouched();
    this.isOpen.set(false);
  }

  clearSelection(event: MouseEvent) {
    event.stopPropagation();
    this.selectPatient(null);
  }

  syncSelected() {
    if (this.currentValue) {
      const found = this.allPatients().find((p) => p.id === this.currentValue);
      this.selectedPatient.set(found ?? null);
    } else {
      this.selectedPatient.set(null);
    }
  }

  writeValue(value: string | null): void {
    this.currentValue = value || '';
    this.syncSelected();
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}

