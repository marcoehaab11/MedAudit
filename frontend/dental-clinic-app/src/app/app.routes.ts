import { Routes } from '@angular/router';
import { authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login.component').then((x) => x.LoginComponent),
  },
  {
    path: 'accept-invitation',
    loadComponent: () =>
      import('./features/auth/accept-invitation.component').then(
        (x) => x.AcceptInvitationComponent,
      ),
  },
  {
    path: 'users',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/users-page.component').then((x) => x.UsersPageComponent),
  },
  {
    path: 'users/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/users/user-details.component').then((x) => x.UserDetailsComponent),
  },
  {
    path: 'patients',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patients/patients-page.component').then((x) => x.PatientsPageComponent),
  },
  {
    path: 'patients/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patients/patient-form.component').then((x) => x.PatientFormComponent),
  },
  {
    path: 'patients/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patients/patient-form.component').then((x) => x.PatientFormComponent),
  },
  {
    path: 'patients/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/patients/patient-details.component').then(
        (x) => x.PatientDetailsComponent,
      ),
  },
  {
    path: 'doctors',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/doctors/doctors-page.component').then((x) => x.DoctorsPageComponent),
  },
  {
    path: 'doctors/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/doctors/doctor-form.component').then((x) => x.DoctorFormComponent),
  },
  {
    path: 'doctors/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/doctors/doctor-form.component').then((x) => x.DoctorFormComponent),
  },
  {
    path: 'doctors/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/doctors/doctor-details.component').then((x) => x.DoctorDetailsComponent),
  },
  {
    path: 'appointments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/appointments-page.component').then(
        (x) => x.AppointmentsPageComponent,
      ),
  },
  {
    path: 'appointments/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/appointments/appointment-create.component').then(
        (x) => x.AppointmentCreateComponent,
      ),
  },
  {
    path: 'appointments/:appointmentId/examination',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dental/examination.component').then((x) => x.ExaminationComponent),
  },
  {
    path: 'patients/:id/dental',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dental/patient-dental.component').then((x) => x.PatientDentalComponent),
  },
  {
    path: 'treatment-plans',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/treatments/treatment-plans-page.component').then(
        (x) => x.TreatmentPlansPageComponent,
      ),
  },
  {
    path: 'treatment-plans/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/treatments/treatment-plan-form.component').then(
        (x) => x.TreatmentPlanFormComponent,
      ),
  },
  {
    path: 'treatment-plans/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/treatments/treatment-plan-form.component').then(
        (x) => x.TreatmentPlanFormComponent,
      ),
  },
  {
    path: 'treatment-plans/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/treatments/treatment-plan-details.component').then(
        (x) => x.TreatmentPlanDetailsComponent,
      ),
  },
  {
    path: 'treatments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/treatments/treatments-page.component').then(
        (x) => x.TreatmentsPageComponent,
      ),
  },
  {
    path: 'treatments/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/treatments/treatment-details.component').then(
        (x) => x.TreatmentDetailsComponent,
      ),
  },
  {
    path: 'prescriptions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/prescriptions/prescriptions-page.component').then(
        (x) => x.PrescriptionsPageComponent,
      ),
  },
  {
    path: 'prescriptions/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/prescriptions/prescription-form.component').then(
        (x) => x.PrescriptionFormComponent,
      ),
  },
  {
    path: 'prescriptions/:id/edit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/prescriptions/prescription-form.component').then(
        (x) => x.PrescriptionFormComponent,
      ),
  },
  {
    path: 'prescriptions/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/prescriptions/prescription-details.component').then(
        (x) => x.PrescriptionDetailsComponent,
      ),
  },
  {
    path: 'crm',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/crm/crm-dashboard.component').then((x) => x.CrmDashboardComponent),
  },
  {
    path: 'crm/follow-ups',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/crm/follow-ups-page.component').then((x) => x.FollowUpsPageComponent),
  },
  {
    path: 'crm/follow-ups/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/crm/follow-up-form.component').then((x) => x.FollowUpFormComponent),
  },
  {
    path: 'crm/follow-ups/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/crm/follow-up-details.component').then((x) => x.FollowUpDetailsComponent),
  },
  {
    path: 'finance',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/finance-dashboard.component').then(
        (x) => x.FinanceDashboardComponent,
      ),
  },
  {
    path: 'finance/revenue',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/revenue-page.component').then((x) => x.RevenuePageComponent),
  },
  {
    path: 'finance/payments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/payments-page.component').then((x) => x.PaymentsPageComponent),
  },
  {
    path: 'finance/payments/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/payments-page.component').then((x) => x.PaymentFormComponent),
  },
  {
    path: 'finance/expenses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/expenses-page.component').then((x) => x.ExpensesPageComponent),
  },
  {
    path: 'finance/expenses/create',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/expenses-page.component').then((x) => x.ExpenseFormComponent),
  },
  {
    path: 'finance/categories',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/finance/categories-page.component').then((x) => x.CategoriesPageComponent),
  },
  {
    path: 'reports',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/reports-dashboard.component').then(
        (x) => x.ReportsDashboardComponent,
      ),
  },
  {
    path: 'reports/financial',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/financial-report.component').then(
        (x) => x.FinancialReportComponent,
      ),
  },
  {
    path: 'reports/revenue',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/revenue-report.component').then((x) => x.RevenueReportComponent),
  },
  {
    path: 'reports/expenses',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/expense-report.component').then((x) => x.ExpenseReportComponent),
  },
  {
    path: 'reports/profit',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/profit-report.component').then((x) => x.ProfitReportComponent),
  },
  {
    path: 'reports/patients',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/patient-report.component').then((x) => x.PatientReportComponent),
  },
  {
    path: 'reports/appointments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/appointment-report.component').then(
        (x) => x.AppointmentReportComponent,
      ),
  },
  {
    path: 'reports/doctors',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/doctor-report.component').then((x) => x.DoctorReportComponent),
  },
  {
    path: 'reports/treatments',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/treatment-report.component').then(
        (x) => x.TreatmentReportComponent,
      ),
  },
  {
    path: 'reports/prescriptions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/prescription-report.component').then(
        (x) => x.PrescriptionReportComponent,
      ),
  },
  {
    path: 'reports/crm',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/reports/crm-report.component').then((x) => x.CrmReportComponent),
  },
  {
    path: 'notifications',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/notifications/notifications-page.component').then(
        (x) => x.NotificationsPageComponent,
      ),
  },
  {
    path: 'inventory',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/inventory/inventory-page.component').then(
        (x) => x.InventoryPageComponent,
      ),
  },
  {
    path: 'pharmacy',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pharmacy/pharmacy-page.component').then(
        (x) => x.PharmacyPageComponent,
      ),
  },
  { path: '', pathMatch: 'full', redirectTo: 'patients' },
  { path: '**', redirectTo: 'patients' },
];
