import { Component, EventEmitter, Input, Output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LocalizationService } from '../../core/localization.service';
import { FINDING_APPEARANCE, PROCEDURE_APPEARANCE } from './dental-appearance';
import { ToothChartSummary } from './dental-api.service';

@Component({
  selector: 'app-dental-chart',
  imports: [FormsModule],
  styleUrl: './dental-chart.scss',
  template: ` <section class="chart-panel" aria-labelledby="chart-title">
    <div class="chart-tools">
      <div>
        <h2 id="chart-title">{{ t('Dental chart', 'مخطط الأسنان') }}</h2>
        <p>{{ t('Permanent dentition · FDI notation', 'الأسنان الدائمة · ترقيم FDI') }}</p>
      </div>
      <form (ngSubmit)="search()">
        <label for="tooth-search">{{ t('Find tooth', 'ابحث عن سن') }}</label>
        <span
          ><input
            id="tooth-search"
            name="tooth"
            inputmode="numeric"
            [(ngModel)]="query"
            placeholder="36"
            maxlength="2"
          />
          <button type="submit">{{ t('Select', 'اختيار') }}</button></span
        >
      </form>
    </div>
    @if (searchError) {
      <p class="inline-error" role="alert">
        {{ t('Enter a permanent FDI tooth number.', 'أدخل رقم سن دائم صحيح بنظام FDI.') }}
      </p>
    }
    <div class="dentition" role="group" [attr.aria-label]="t('Permanent teeth', 'الأسنان الدائمة')">
      @for (row of rows; track $index) {
        <div class="tooth-row" [class.lower]="$index > 1">
          @for (number of row; track number) {
            @let tooth = find(number);
            <button
              type="button"
              class="tooth"
              [class.selected]="selectedNumber === number"
              [class.has-records]="
                !!tooth &&
                (!!tooth.findings.length || !!tooth.procedures.length || tooth.hasEndodonticRecord)
              "
              (click)="choose(number)"
              [attr.aria-pressed]="selectedNumber === number"
              [attr.aria-label]="t('Tooth', 'السن') + ' ' + number"
            >
              <span class="tooth-shape" aria-hidden="true"><i></i></span
              ><strong>{{ number }}</strong>
              <span class="markers" aria-hidden="true">
                @for (finding of tooth?.findings?.slice(0, 2) ?? []; track finding) {
                  <b class="{{ findingAppearance[finding].cssClass }}">{{
                    findingAppearance[finding].symbol
                  }}</b>
                }
                @for (procedure of tooth?.procedures?.slice(0, 1) ?? []; track procedure) {
                  <b class="{{ procedureAppearance[procedure].cssClass }}">{{
                    procedureAppearance[procedure].symbol
                  }}</b>
                }
                @if (tooth?.hasEndodonticRecord) {
                  <b class="root-canal">R</b>
                }
              </span>
            </button>
          }
        </div>
        @if ($index === 1) {
          <div class="arch-divider">
            <span>{{ t('Upper', 'علوي') }}</span
            ><span>{{ t('Lower', 'سفلي') }}</span>
          </div>
        }
      }
    </div>
    <p class="chart-help">
      {{
        t(
          'Markers include letters and symbols so meaning never depends on color alone.',
          'تتضمن العلامات حروفًا ورموزًا حتى لا يعتمد المعنى على اللون فقط.'
        )
      }}
    </p>
  </section>`,
})
export class DentalChartComponent {
  @Input() teeth: ToothChartSummary[] = [];
  @Input() selectedNumber = 11;
  @Output() readonly selectedNumberChange = new EventEmitter<number>();
  readonly rows = [
    [18, 17, 16, 15, 14, 13, 12, 11],
    [21, 22, 23, 24, 25, 26, 27, 28],
    [48, 47, 46, 45, 44, 43, 42, 41],
    [31, 32, 33, 34, 35, 36, 37, 38],
  ];
  readonly findingAppearance = FINDING_APPEARANCE;
  readonly procedureAppearance = PROCEDURE_APPEARANCE;
  query = '';
  searchError = false;
  constructor(private readonly i18n: LocalizationService) {}
  find(number: number) {
    return this.teeth.find((x) => x.toothNumber === number);
  }
  choose(number: number) {
    this.selectedNumber = number;
    this.selectedNumberChange.emit(number);
    this.searchError = false;
  }
  search() {
    const value = Number(this.query);
    if (!this.rows.flat().includes(value)) {
      this.searchError = true;
      return;
    }
    this.choose(value);
  }
  t(en: string, ar: string) {
    return this.i18n.language() === 'en' ? en : ar;
  }
}
