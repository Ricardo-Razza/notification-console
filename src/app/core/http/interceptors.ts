import { inject } from '@angular/core';
import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthStore } from '../auth/auth-store';
import { ApiError, normalizeError } from './api-error';
import { Toast } from '../../shared/toast';
export const errorInterceptor: HttpInterceptorFn = (request, next) =>
  next(request).pipe(
    catchError((error: unknown) =>
      throwError(() => (error instanceof HttpErrorResponse ? normalizeError(error) : error)),
    ),
  );
export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(AuthStore);
  const router = inject(Router);
  const toast = inject(Toast);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof ApiError &&
        error.status === 401 &&
        auth.ready() &&
        !request.url.includes('/auth/')
      ) {
        const returnUrl = router.url;
        auth.reset();
        toast.show('Sua sessão expirou. Entre novamente para continuar.');
        void router.navigate(['/login'], { queryParams: { returnUrl } });
      }
      if (error instanceof ApiError && error.status === 403) toast.error(error);
      return throwError(() => error);
    }),
  );
};
