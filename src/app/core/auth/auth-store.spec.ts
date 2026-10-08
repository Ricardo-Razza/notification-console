import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { AuthStore } from './auth-store';
describe('Session state', () => {
  let auth: AuthStore;
  let backend: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthStore);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => backend.verify());
  it('restores the current user before routing', () => {
    auth.initialize().subscribe();
    backend
      .expectOne('/api/admin/auth/me')
      .flush({ id: 'user', email: 'admin@example.test', role: 'ADMIN' });
    expect(auth.ready()).toBe(true);
    expect(auth.admin()).toBe(true);
  });
  it('finishes anonymous initialization after 401', () => {
    auth.initialize().subscribe();
    backend.expectOne('/api/admin/auth/me').flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.ready()).toBe(true);
    expect(auth.user()).toBeNull();
  });
  it('refreshes the CSRF session after login before storing the user', () => {
    auth.login({ email: 'viewer@example.test', password: 'password-test' }).subscribe();
    const login = backend.expectOne('/api/admin/auth/login');
    expect(auth.user()).toBeNull();
    login.flush({ role: 'VIEWER' });
    backend.expectOne('/api/admin/auth/me').flush({ email: 'viewer@example.test', role: 'VIEWER' });
    expect(auth.admin()).toBe(false);
    expect(auth.user()?.email).toBe('viewer@example.test');
  });
  it('keeps invalid credentials out of state', () => {
    auth
      .login({ email: 'viewer@example.test', password: 'invalid-test' })
      .subscribe({ error: () => undefined });
    backend
      .expectOne('/api/admin/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(auth.user()).toBeNull();
  });
  it('drops current user on reset', () => {
    auth.user.set({ role: 'ADMIN' });
    auth.reset();
    expect(auth.user()).toBeNull();
  });
});
