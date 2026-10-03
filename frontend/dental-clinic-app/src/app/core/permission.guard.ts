import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from './auth.service';

const routePermissions: Record<string, string> = {
  'users': 'Users.View', 'users/:id': 'Users.View',
  'patients': 'Patients.View', 'patients/:id': 'Patients.View', 'patients/create': 'Patients.Create', 'patients/:id/edit': 'Patients.Edit', 'patients/:id/dental': 'Dental.View',
  'doctors': 'Doctors.View', 'doctors/:id': 'Doctors.View', 'doctors/create': 'Doctors.Create', 'doctors/:id/edit': 'Doctors.Edit',
  'appointments': 'Appointments.View', 'appointments/create': 'Appointments.Create',
  'appointments/:appointmentId/examination': 'Examination.View', 'appointments/:appointmentId/visit': 'Examination.View',
  'treatment-plans': 'TreatmentPlans.View', 'treatment-plans/:id': 'TreatmentPlans.View', 'treatment-plans/create': 'TreatmentPlans.Create', 'treatment-plans/:id/edit': 'TreatmentPlans.Edit',
  'treatments': 'Treatments.View', 'treatments/:id': 'Treatments.View', 'treatment-catalog': 'TreatmentCatalog.View',
  'medications-catalog': 'Prescriptions.View', 'prescriptions': 'Prescriptions.View', 'prescriptions/:id': 'Prescriptions.View', 'prescriptions/create': 'Prescriptions.Create', 'prescriptions/:id/edit': 'Prescriptions.Edit',
  'crm': 'CRM.View', 'crm/follow-ups': 'CRM.View', 'crm/follow-ups/:id': 'CRM.View', 'crm/follow-ups/create': 'CRM.CreateFollowUp',
  'finance': 'Finance.View', 'finance/revenue': 'Finance.Revenue.View', 'finance/payments': 'Finance.Payments.View', 'finance/payments/create': 'Finance.Payments.Create', 'finance/expenses': 'Finance.Expenses.View', 'finance/expenses/create': 'Finance.Expenses.Create', 'finance/categories': 'Finance.Categories.View',
  'lab': 'Lab.View', 'insurance': 'Insurance.View',
  'reports': 'Reports.View', 'reports/financial': 'Reports.Financial', 'reports/revenue': 'Reports.Financial', 'reports/expenses': 'Reports.Financial', 'reports/profit': 'Reports.Financial', 'reports/patients': 'Reports.Patients', 'reports/appointments': 'Reports.Appointments', 'reports/doctors': 'Reports.Doctors', 'reports/treatments': 'Reports.Treatments', 'reports/prescriptions': 'Reports.Prescriptions', 'reports/crm': 'Reports.CRM',
  'notifications': 'Notifications.View', 'inventory': 'Inventory.View', 'online-booking': 'Settings.PublicBooking', 'settings': 'Settings.View',
  'backup': 'Backup.Create',
};

export const permissionGuard: CanActivateFn = route => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const required = routePermissions[route.routeConfig?.path || ''];
  if (!required) return true;
  return auth.refreshPermissions().pipe(
    map(() => auth.hasPermission(required) ? true : router.createUrlTree(['/access-denied'])),
    catchError(() => of(router.createUrlTree(['/access-denied']))),
  );
};
