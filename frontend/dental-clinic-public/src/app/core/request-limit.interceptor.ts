import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';

// Every screen, including downloads and background reads, gets a visible wait message.
export const requestLimitInterceptor: HttpInterceptorFn = (request, next) => next(request.url.startsWith('/api/') ? request.clone({ setHeaders: { 'X-App-Request': '1' } }) : request).pipe(
  catchError((error: HttpErrorResponse) => {
    if (error.status === 429 || (error.status === 503 && ['rate_limit_unavailable', 'session_unavailable'].includes(error.error?.code))) {
      const seconds = Number(error.headers.get('Retry-After') || error.error?.retryAfter || 30);
      const wait = Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds) : 30;
      const arabic = document.documentElement.lang.startsWith('ar') || document.documentElement.dir === 'rtl';
      const message = error.status === 429
        ? (arabic ? `طلبات كثيرة جدًا. انتظر ${wait} ثانية ثم حاول مرة أخرى.` : `Too many requests. Please wait ${wait} seconds and try again.`)
        : (arabic ? error.error?.messageAr || 'خدمة حماية الطلبات غير متاحة مؤقتًا. انتظر 30 ثانية ثم حاول مرة أخرى.' : error.error?.message || 'Request protection is temporarily unavailable. Please wait 30 seconds and try again.');
      let notice = document.getElementById('request-limit-notice');
      if (!notice) {
        notice = document.createElement('div');
        notice.id = 'request-limit-notice';
        notice.setAttribute('role', 'alert');
        notice.style.cssText = 'position:fixed;top:16px;inset-inline:16px;z-index:2147483647;padding:18px;background:#fff3cd;color:#513c06;border:1px solid #a67c17;border-radius:8px;box-shadow:0 4px 16px #0003;white-space:normal';
        document.body.appendChild(notice);
      }
      notice.replaceChildren(document.createTextNode(message + ' '));
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = arabic ? 'إغلاق' : 'Close';
      close.onclick = () => notice?.remove();
      notice.appendChild(close);
    }
    return throwError(() => error);
  }),
);
