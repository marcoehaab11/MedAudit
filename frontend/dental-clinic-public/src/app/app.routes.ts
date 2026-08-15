import { Routes } from '@angular/router';

export const routes: Routes = [
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
    pathMatch: 'full',
    redirectTo: 'book/demo-clinic',
  },
];
