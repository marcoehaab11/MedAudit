import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { AuthService } from './auth.service';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (!request.url.startsWith('/api/')) return next(request);
  const auth = inject(AuthService);
  const req = request.clone({ setHeaders: { 'X-App-Request': '1' } });
  return next(req).pipe(catchError((error: HttpErrorResponse) => {
    if (error.status === 401) {
      auth.clearSession();
      if (!['/api/auth/login', '/api/auth/session'].includes(request.url) && !request.url.startsWith('/api/auth/invitations/')) window.location.assign('/login');
    }
    return throwError(() => error);
  }));
};
