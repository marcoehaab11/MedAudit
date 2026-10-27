import { Component, input, output } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ImplantData, ImplantField, ImplantValue } from './implant-fields';
import { ImplantIconComponent } from './implant-icon.component';
@Component({selector:'app-implant-field',standalone:true,imports:[FormsModule,ImplantIconComponent],template:`
  <fieldset class="implant-card" [class.notes-card]="field().kind === 'notes'" [class.compact-field]="compact()">
    <legend><app-implant-icon class="field-symbol" [name]="field().kind === 'date' ? 'date' : field().kind === 'notes' ? 'notes' : field().key === 'hygiene' ? 'shield' : field().key === 'component' || field().key === 'coping' ? 'implant' : 'tooth'"/><span>{{field().en}} @if(field().required){<i>*</i>}<small lang="ar" dir="rtl">{{field().ar}}</small></span></legend>
    @switch(field().kind) {
      @case('radio') { <div class="choices">@for(option of field().options;track option.value){<label class="choice"><input type="radio" [name]="group() + field().key" [value]="option.value" [ngModel]="data()[field().key]" (ngModelChange)="set($event)"><span>{{option.en}}<small lang="ar" dir="rtl">{{option.ar}}</small></span></label>}</div> }
      @case('checks') { <div class="choices">@for(option of field().options;track option.value){<label class="choice"><input type="checkbox" [checked]="checked(option.value)" (change)="toggle(option.value,$event)"><span>{{option.en}}<small lang="ar" dir="rtl">{{option.ar}}</small></span></label>}</div> }
      @case('select') { <select [attr.aria-label]="field().ar" [ngModel]="data()[field().key] || ''" (ngModelChange)="set($event)"><option value="">اختر / Select</option>@for(option of field().options;track option.value){<option [value]="option.value">{{option.en}} — {{option.ar}}</option>}</select> }
      @case('notes') { <textarea rows="3" maxlength="4000" [attr.aria-label]="field().ar" placeholder="أضف ملاحظاتك هنا… / Add your notes…" [ngModel]="data()[field().key] || ''" (ngModelChange)="set($event)"></textarea> }
      @case('toggle') { <label class="choice"><input type="checkbox" [checked]="data()[field().key] === true" (change)="set($any($event.target).checked)"><span>إضافة تطعيم عظمي / Add bone graft</span></label> }
      @default { <input [type]="field().kind" [attr.aria-label]="field().ar" [attr.list]="suggestions().length ? group()+'-'+field().key+'-options' : null" [min]="field().min ?? null" [max]="field().max ?? null" [step]="field().kind === 'number' ? 'any' : null" maxlength="4000" [ngModel]="data()[field().key] ?? ''" (ngModelChange)="set($event)">@if(suggestions().length){<datalist [id]="group()+'-'+field().key+'-options'">@for(value of suggestions();track value){<option [value]="value"></option>}</datalist>} }
    }
  </fieldset>`,styleUrl:'./implant-workflow.scss'})
export class ImplantFieldComponent {
  readonly field = input.required<ImplantField>(); readonly data = input.required<ImplantData>(); readonly group = input.required<string>();
  readonly compact=input(false);
  readonly changed=output<string>();
  suggestions():string[] { switch(this.field().key){case 'brand':return ['Straumann','Nobel Biocare','Astra Tech','Osstem','Dentium','Neodent','Zimmer'];case 'system':return ['BLX','BLT','Tissue Level','NobelActive','NobelParallel','Astra EV','TSIII'];case 'connection':return ['RC (Regular CrossFit)','NC (Narrow CrossFit)','BLX','Conical connection','Internal hex'];case 'shade':return ['A1','A2','A3','A3.5','A4','B1','B2','B3','B4','C1','C2','C3','C4','D2','D3','D4'];default:return [];} }
  set(value:ImplantValue) { this.data()[this.field().key] = value; this.changed.emit(this.field().key); }
  checked(value:string) { const selected=this.data()[this.field().key]; return Array.isArray(selected) && selected.includes(value); }
  toggle(value:string,event:Event) { const selected=this.data()[this.field().key]; const values=Array.isArray(selected)?selected:[]; this.set((event.target as HTMLInputElement).checked ? [...values,value] : values.filter(v=>v!==value)); }
}
