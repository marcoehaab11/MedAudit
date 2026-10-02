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
import { DoctorApiService, DoctorListItem } from '../features/doctors/doctor-api.service';

@Component({
  selector: 'app-doctor-select',
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DoctorSelectComponent),
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

      .doctor-info {
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

        .spec {
          color: var(--muted);
          font-size: 0.82rem;
          font-weight: 500;
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

            .doctor-name {
              color: #0369a1;
              font-weight: 800;
            }
          }
        }
      }

      .doctor-row {
        display: flex;
        flex-direction: column;
        gap: 0.15rem;

        .doctor-name {
          font-weight: 700;
          font-size: 0.88rem;
          color: var(--ink);
        }

        .doctor-sub {
          font-size: 0.78rem;
          color: var(--muted);
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
        @if (selectedDoctor()) {
          <div class="doctor-info">
            <span class="name">{{ selectedDoctor()!.displayName }}</span>
            <span class="spec">({{ selectedDoctor()!.specialization }})</span>
          </div>
        } @else {
          <span class="placeholder-text">{{ resolvedPlaceholder() }}</span>
        }

        <div class="picker-actions">
          @if (allowClear && selectedDoctor() && !disabled) {
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
              [placeholder]="i18n.language() === 'ar' ? 'ابحث بالاسم أو التخصص…' : 'Search by name or specialization…'"
              [(ngModel)]="searchQuery"
              (input)="onSearchChange()"
              (keydown.escape)="closeDropdown($event)"
            />
          </div>

          <ul class="options-list">
            @if (allowClear && !searchQuery.trim()) {
              <li (click)="selectDoctor(null, $event)" [class.selected]="!selectedDoctor()">
                <div class="doctor-row">
                  <span class="doctor-name">{{ i18n.language() === 'ar' ? '— كل الأطباء (بدون تحديد) —' : '— All doctors (no filter) —' }}</span>
                </div>
              </li>
            }

            @for (d of filteredDoctors(); track d.id) {
              <li
                (click)="selectDoctor(d, $event)"
                [class.selected]="selectedDoctor()?.id === d.id"
              >
                <div class="doctor-row">
                  <span class="doctor-name">{{ d.displayName }}</span>
                  <span class="doctor-sub">{{ d.specialization }}</span>
                </div>
              </li>
            } @empty {
              <div class="empty-results">
                {{ i18n.language() === 'ar' ? 'لا يوجد طبيب مطابق للبحث' : 'No doctors match your search' }}
              </div>
            }
          </ul>
        </div>
      }
    </div>
  `,
})
export class DoctorSelectComponent implements OnInit, ControlValueAccessor {
  @Input() placeholder = '';
  @Input() allowClear = true;
  @Input() isInvalid = false;

  private readonly doctorApi = inject(DoctorApiService);
  readonly i18n = inject(LocalizationService);
  private readonly elementRef = inject(ElementRef);

  readonly allDoctors = signal<DoctorListItem[]>([]);
  readonly filteredDoctors = signal<DoctorListItem[]>([]);
  readonly selectedDoctor = signal<DoctorListItem | null>(null);
  readonly isOpen = signal(false);

  searchQuery = '';
  disabled = false;
  currentValue = '';

  private onChange: (value: string) => void = () => {};
  private onTouched: () => void = () => {};

  ngOnInit() {
    this.loadDoctors();
  }

  resolvedPlaceholder() {
    if (this.placeholder) return this.placeholder;
    return this.i18n.language() === 'ar' ? 'اختر الطبيب…' : 'Select doctor…';
  }

  loadDoctors() {
    this.doctorApi.listAll().subscribe({
      next: (items) => {
        this.allDoctors.set(items);
        this.filterList();
        this.syncSelected();
      },
      error: () => this.allDoctors.set([]),
    });
  }

  onSearchChange() {
    this.filterList();
  }

  filterList() {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredDoctors.set(this.allDoctors());
      return;
    }

    const filtered = this.allDoctors().filter((d) => {
      const matchName = (d.displayName || '').toLowerCase().includes(q);
      const matchSpec = (d.specialization || '').toLowerCase().includes(q);
      return matchName || matchSpec;
    });

    this.filteredDoctors.set(filtered);
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

  selectDoctor(d: DoctorListItem | null, event?: Event) {
    if (event) event.stopPropagation();
    this.selectedDoctor.set(d);
    this.currentValue = d ? d.id : '';
    this.onChange(this.currentValue);
    this.onTouched();
    this.isOpen.set(false);
  }

  clearSelection(event: MouseEvent) {
    event.stopPropagation();
    this.selectDoctor(null);
  }

  syncSelected() {
    if (this.currentValue) {
      const found = this.allDoctors().find((d) => d.id === this.currentValue);
      this.selectedDoctor.set(found ?? null);
    } else {
      this.selectedDoctor.set(null);
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

