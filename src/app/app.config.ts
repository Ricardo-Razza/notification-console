import {
  ApplicationConfig,
  ErrorHandler,
  inject,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { firstValueFrom } from 'rxjs';
import { AuthStore } from './core/auth/auth-store';
import { errorInterceptor, sessionInterceptor } from './core/http/interceptors';
import { GlobalErrorHandler } from './core/http/global-error-handler';
import { routes } from './app.routes';
registerLocaleData(localePt, 'pt-BR');

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(
      withInterceptors([sessionInterceptor, errorInterceptor]),
      withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
    ),
    { provide: LOCALE_ID, useValue: 'pt-BR' },
    { provide: ErrorHandler, useClass: GlobalErrorHandler },
    provideAppInitializer(() => firstValueFrom(inject(AuthStore).initialize())),
  ],
};
