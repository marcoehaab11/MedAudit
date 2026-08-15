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
  { path: '', pathMatch: 'full', redirectTo: 'patients' },
  { path: '**', redirectTo: 'patients' },
];
