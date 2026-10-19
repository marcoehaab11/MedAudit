import { Component, Input } from '@angular/core';

export interface ExtractionDraft {
  type: 'Simple Extraction' | 'Surgical Extraction';
  condition: 'Normal' | 'Impacted' | 'Root Remnant';
  direction: string | null;
}

@Component({
  selector: 'app-extraction-editor',
  standalone: true,
  template: `
    <fieldset class="extraction-group" [disabled]="disabled">
      <legend>{{ english ? 'Extraction type' : 'نوع الخلع' }} <span>*</span></legend>
      <div class="choices two" dir="ltr">
        @for (type of types; track type) {
          <label class="choice" [class.selected]="draft.type === type">
            <input type="radio" [name]="'extraction-type-' + tooth" [value]="type" [checked]="draft.type === type" (change)="draft.type = type" />
            <span>{{ type }}</span>
          </label>
        }
      </div>
    </fieldset>
    <fieldset class="extraction-group" [disabled]="disabled">
      <legend>{{ english ? 'Tooth condition' : 'حالة السن' }} <span>*</span></legend>
      <div class="choices three" dir="ltr">
        @for (condition of conditions; track condition) {
          <label class="choice illustrated" [class.selected]="draft.condition === condition">
            <input type="radio" [name]="'extraction-condition-' + tooth" [value]="condition" [checked]="draft.condition === condition" (change)="selectCondition(condition)" />
            <svg viewBox="0 0 68 58" aria-hidden="true"><path d="M5 52V32Q19 24 34 32Q49 24 63 32V52Z" fill="#fbe4e0" />
              <g [attr.transform]="condition === 'Impacted' ? 'rotate(-40 34 30)' : null"><path d="M24 8Q17 7 18 19Q19 27 22 30L25 48Q28 52 30 36Q34 28 38 36Q40 52 43 48L46 30Q50 21 49 15Q48 4 38 9Q34 12 30 9Z" [attr.fill]="condition === 'Root Remnant' ? '#e8ecec' : '#fff'" stroke="#72928e" stroke-width="1.5" /></g>
            </svg>
            <span>{{ condition }}</span>
          </label>
        }
      </div>
    </fieldset>
    @if (draft.condition === 'Impacted') {
      <fieldset class="extraction-group direction-group" [disabled]="disabled">
        <legend>{{ english ? 'Tooth direction' : 'اتجاه الضرس' }} <span>*</span></legend>
        <div class="choices four" dir="ltr">
          @for (direction of directions; track direction.label) {
            <label class="choice illustrated" [class.selected]="draft.direction === direction.label">
              <input type="radio" [name]="'extraction-direction-' + tooth" [value]="direction.label" [checked]="draft.direction === direction.label" (change)="draft.direction = direction.label" />
              <svg viewBox="0 0 68 58" aria-hidden="true"><path d="M4 52V34Q34 24 64 34V52Z" fill="#fbe4e0" />
                <g [attr.transform]="'rotate(' + direction.angle + ' 34 30)'"><path d="M24 8Q17 7 18 19Q19 27 22 30L25 48Q28 52 30 36Q34 28 38 36Q40 52 43 48L46 30Q50 21 49 15Q48 4 38 9Q34 12 30 9Z" fill="white" stroke="#72928e" stroke-width="1.5" /></g>
              </svg>
              <span>{{ direction.label }}</span>
            </label>
          }
        </div>
      </fieldset>
    }
  `,
  styles: [`
    :host { display: block; grid-column: 1 / -1; }
    .extraction-group { border: 0; padding: 0; margin: 0 0 18px; min-width: 0; }
    legend { font-size: 14px; font-weight: 600; color: #345b52; margin-bottom: 10px; }
    legend span { color: #d95757; }
    .choices { display: grid; gap: 10px; }
    .two { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .three { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .four { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .choice { display: flex; align-items: center; gap: 10px; padding: 12px 14px; border: 1px solid #dce8e4; border-radius: 9px; background: white; cursor: pointer; font-size: 13px; color: #263c38; min-width: 0; }
    .choice.selected { border-color: #5bae98; background: #edf8f4; }
    input { accent-color: #13866e; margin: 0; width: 17px; height: 17px; flex-shrink: 0; }
    svg { width: 50px; height: 48px; flex-shrink: 0; }
    .illustrated { padding: 8px 10px; gap: 8px; }
    .direction-group { border-top: 1px solid #e3ede9; padding-top: 14px; }
    fieldset:disabled .choice { cursor: default; opacity: .65; }
    @media(max-width: 900px) { .four { grid-template-columns: repeat(2, minmax(0, 1fr)); } .illustrated { flex-wrap: wrap; } }
    @media(max-width: 550px) { .two, .three { grid-template-columns: 1fr; } }
  `]
})
export class ExtractionEditorComponent {
  @Input({ required: true }) draft!: ExtractionDraft;
  @Input() tooth = 0;
  @Input() disabled = false;
  @Input() english = false;
  readonly types = ['Simple Extraction', 'Surgical Extraction'] as const;
  readonly conditions = ['Normal', 'Impacted', 'Root Remnant'] as const;
  readonly directions = [{ label: 'Mesial Inclination', angle: -40 }, { label: 'Distal Inclination', angle: 40 }, { label: 'Vertical', angle: 0 }, { label: 'Horizontal', angle: -90 }];
  selectCondition(condition: ExtractionDraft['condition']) {
    this.draft.condition = condition;
    if (condition !== 'Impacted') this.draft.direction = null;
  }
}
