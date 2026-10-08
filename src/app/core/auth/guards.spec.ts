import { TestBed } from '@angular/core/testing';
import {
  provideRouter,
  Router,
  ActivatedRouteSnapshot,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthStore } from './auth-store';
import { authGuard, roleGuard, unsavedGuard } from './guards';
describe('Route permissions', () => {
  const user = signal<{ role: string } | null>(null);
  beforeEach(() => {
    user.set(null);
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        { provide: AuthStore, useValue: { user, admin: () => user()?.role === 'ADMIN' } },
      ],
    });
  });
  it('preserves the route without a session and permits authenticated users', () => {
    const route = {} as ActivatedRouteSnapshot,
      state = { url: '/templates' } as RouterStateSnapshot;
    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toContain(
      'returnUrl=%2Ftemplates',
    );
    user.set({ role: 'VIEWER' });
    expect(TestBed.runInInjectionContext(() => authGuard(route, state))).toBe(true);
  });
  it('denies VIEWER write routes', () => {
    user.set({ role: 'VIEWER' });
    expect(
      TestBed.runInInjectionContext(() =>
        roleGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ),
    ).toBeInstanceOf(UrlTree);
    user.set({ role: 'ADMIN' });
    expect(
      TestBed.runInInjectionContext(() =>
        roleGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot),
      ),
    ).toBe(true);
  });
  it('asks before discarding changes and permits clean navigation', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    const args = [
      {} as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
      {} as RouterStateSnapshot,
    ] as const;
    expect(unsavedGuard({ hasUnsavedChanges: () => true }, ...args)).toBe(false);
    expect(confirm).toHaveBeenCalled();
    expect(unsavedGuard({ hasUnsavedChanges: () => false }, ...args)).toBe(true);
    confirm.mockRestore();
  });
});
