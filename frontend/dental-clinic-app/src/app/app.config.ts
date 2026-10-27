import { requestLimitInterceptor } from './core/request-limit.interceptor';
import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './core/auth.interceptor';

import { routes } from './app.routes';
import { AuthService } from './core/auth.service';
import { firstValueFrom } from 'rxjs';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor, requestLimitInterceptor])),
    provideAppInitializer(async () => {
      const auth = inject(AuthService);
      // Retire old offline navigation caches so private pages always reach the server.
      if ('serviceWorker' in navigator) {
        try {
          const registrations = await navigator.serviceWorker.getRegistrations();
          for (const registration of registrations) if (new URL(registration.scope).origin === location.origin) await registration.unregister();
        } catch {}
      }
      await firstValueFrom(auth.restoreSession());
    }),
  ],
};

