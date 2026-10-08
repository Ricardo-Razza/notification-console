import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AuthStore } from './auth-store';
export const authGuard: CanActivateFn = (_route, state) =>
  inject(AuthStore).user()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
export const roleGuard: CanActivateFn = () =>
  inject(AuthStore).admin() ? true : inject(Router).createUrlTree(['/dashboard']);
export interface DirtyEditor {
  hasUnsavedChanges(): boolean;
}
export const unsavedGuard: CanDeactivateFn<DirtyEditor> = (component) =>
  !component.hasUnsavedChanges() || window.confirm('Há alterações não salvas. Deseja sair?');
