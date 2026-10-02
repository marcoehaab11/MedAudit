import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);

  if (request.url.startsWith('/api/auth/')) return next(request);
  
  const token = localStorage.getItem('access_token');
  const req = token ? request.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : request;

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('display_name');
        localStorage.removeItem('permissions');
        void router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};


