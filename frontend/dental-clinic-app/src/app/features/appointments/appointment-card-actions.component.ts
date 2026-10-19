import { Component, EventEmitter, inject, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { LocalizationService } from '../../core/localization.service';
import { AppointmentItem } from './appointment-api.service';
@Component({
  selector:'app-appointment-card-actions',imports:[RouterLink],
  template:`<div class="primary-actions">
    @if (waiting && !beforeVisit) {
      @if (auth.hasPermission('Appointments.CheckIn')) { <button type="button" (click)="action.emit('check-in')">{{ t('Arrived','حضر') }}</button> }
      @if (auth.hasPermission('Appointments.MarkNoShow')) { <button type="button" class="outline" (click)="action.emit('no-show')">{{ t('Did not attend','لم يحضر') }}</button> }
    } @else if (waiting && beforeVisit) {
      @if (appointment.status===1 && auth.hasPermission('Appointments.Edit')) { <button type="button" (click)="action.emit('confirm')">{{ t('Confirm appointment','تأكيد الموعد') }}</button> }
      @if (auth.hasPermission('Appointments.Cancel')) { <button type="button" class="outline" (click)="cancel.emit()">{{ t('Cancel appointment','إلغاء الموعد') }}</button> }
    }
    @if ([3,4].includes(appointment.status) && auth.hasPermission('Examination.View')) {
      <a [routerLink]="['/appointments',appointment.id,'visit']">{{ appointment.status===4 ? t('Continue visit','متابعة الزيارة') : t('Open visit','فتح الزيارة') }}</a>
    }
    @if (appointment.status===5 && auth.hasPermission('Examination.View')) { <a class="outline" [routerLink]="['/appointments',appointment.id,'examination']">{{ t('View visit record','عرض سجل الزيارة') }}</a> }
    @if (appointment.status===7) {
      <p>{{ t('Did not attend — recorded in appointment history.','لم يحضر — تم تسجيل الحالة في سجل المواعيد.') }}</p>
      @if (auth.hasPermission('Appointments.Create')) { <a class="outline" routerLink="/appointments/create" [queryParams]="{patientId:appointment.patientId,doctorProfileId:appointment.doctorProfileId}">{{ t('Book another appointment','حجز موعد بديل') }}</a> }
    }
  </div>
  @if (!beforeVisit && appointment.status<=3 && auth.hasPermission('Appointments.Cancel')) {
    <details class="secondary-actions"><summary>{{ t('Other actions','إجراءات أخرى') }}</summary><button type="button" class="outline" (click)="cancel.emit()">{{ t('Cancel appointment','إلغاء الموعد') }}</button></details>
  }`,
  styles:[`.primary-actions{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin:12px 0}button,a{box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;min-height:40px;height:auto;padding:9px 16px;border:1px solid #15816c;border-radius:8px;background:#15816c;color:white;font:inherit;font-size:.88rem;font-weight:700;text-decoration:none;cursor:pointer}.outline{background:white;color:#406b62;border-color:#ccded8}p{width:100%;font-size:.85rem;color:#64748b;margin:0}.secondary-actions{margin:8px 0;font-size:.85rem;color:#64748b}.secondary-actions button{margin-top:8px}summary{cursor:pointer}button:focus-visible,a:focus-visible{outline:3px solid #73bda8;outline-offset:3px}`]
})
export class AppointmentCardActionsComponent {
  readonly auth=inject(AuthService);private readonly i18n=inject(LocalizationService);
  @Input({required:true}) appointment!:AppointmentItem;
  @Output() action=new EventEmitter<'confirm'|'check-in'|'no-show'>();
  @Output() cancel=new EventEmitter<void>();
  get waiting(){return [1,2].includes(this.appointment.status);}
  get beforeVisit(){const format=new Intl.DateTimeFormat('en-CA',{timeZone:this.appointment.timeZone,year:'numeric',month:'2-digit',day:'2-digit'});return format.format(new Date(this.appointment.startAt))>format.format(new Date());}
  t(en:string,ar:string){return this.i18n.language()==='ar'?ar:en;}
}
