import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNgIconLoader, withCaching } from '@ng-icons/core';
import { routes } from './app.routes';
import { provideDataLayer } from './core/data/data-providers';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { AuthService } from './core/services/auth.service';
import { SincronizacionPestanas } from './core/session/sincronizacion-pestanas.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideDataLayer(),
    // F5 keeps the session while the HttpOnly refresh cookie is valid; if not, the guard sends the user to /login.
    provideAppInitializer(() => inject(AuthService).restaurarSesion()),
    // Signing out in one tab signs out the others.
    provideAppInitializer(() => void inject(SincronizacionPestanas)),
    provideHttpClient(withInterceptors([authInterceptor, errorInterceptor])),
    // Every Lucide icon is available by name without listing them one by one.
    // The whole set is a single lazy chunk instead of ~870 kB in the initial
    // bundle: the dynamic import resolves once, then `withCaching()` keeps each
    // resolved icon in memory.
    provideNgIconLoader(async (name) => {
      const icons = (await import('@ng-icons/lucide')) as unknown as Record<string, string>;
      return icons[name] ?? '';
    }, withCaching()),
  ],
};
