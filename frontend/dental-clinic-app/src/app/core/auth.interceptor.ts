import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  if (request.url === '/api/auth/login' || request.url.startsWith('/api/auth/invitations/')) return next(request);
  
  const token = localStorage.getItem('access_token');
  const req = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('display_name');
        localStorage.removeItem('permissions');
        localStorage.removeItem('tenant_id');
        localStorage.removeItem('tenant_name');
        localStorage.removeItem('clinics');
        window.location.assign('/login');
      }
      return throwError(() => error);
    })
  );
};


