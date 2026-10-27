import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: 'register', loadComponent: () => import('./features/registration/clinic-registration.component').then(m => m.ClinicRegistrationComponent) },
  { path: 'confirm-email', loadComponent: () => import('./features/registration/clinic-registration.component').then(m => m.ClinicRegistrationComponent) },
  {
    path: 'book/:clinicSlug',
    loadComponent: () =>
      import('./features/booking/public-booking.component').then((m) => m.PublicBookingComponent),
  },
  {
    path: 'book/confirmation/:reference',
    loadComponent: () =>
      import('./features/booking/booking-confirmation.component').then(
        (m) => m.BookingConfirmationComponent,
      ),
  },
  {
    path: '',
    loadComponent: () => import('./features/home/home.component').then((m) => m.HomeComponent),
  },
];
