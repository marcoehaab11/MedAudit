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
  { path: '', pathMatch: 'full', redirectTo: 'patients' },
  { path: '**', redirectTo: 'patients' },
];
