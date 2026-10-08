import { TestBed } from '@angular/core/testing';
import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
  withXsrfConfiguration,
} from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { AuthStore } from '../auth/auth-store';
import { Toast } from '../../shared/toast';
import { ApiError } from './api-error';
import { errorInterceptor, sessionInterceptor } from './interceptors';
describe('HTTP boundary', () => {
  const user = signal<{ role: string } | null>({ role: 'ADMIN' });
  const reset = vi.fn(() => user.set(null));
  const show = vi.fn();
  const error = vi.fn();
  let http: HttpClient;
  let backend: HttpTestingController;
  beforeEach(() => {
    vi.clearAllMocks();
    user.set({ role: 'ADMIN' });
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(
          withInterceptors([sessionInterceptor, errorInterceptor]),
          withXsrfConfiguration({ cookieName: 'XSRF-TOKEN', headerName: 'X-XSRF-TOKEN' }),
        ),
        provideHttpClientTesting(),
        { provide: AuthStore, useValue: { user, ready: () => true, reset } },
        { provide: Toast, useValue: { show, error } },
      ],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    backend.verify();
    document.cookie = 'XSRF-TOKEN=; Max-Age=0; path=/';
  });
  it('normalizes field errors and Retry-After', () => {
    let result: unknown;
    http.post('/api/admin/templates', {}).subscribe({ error: (value) => (result = value) });
    backend
      .expectOne('/api/admin/templates')
      .flush(
        { title: 'Invalid', detail: 'Invalid data', errors: { content: 'Required' } },
        { status: 429, statusText: 'Too Many Requests', headers: { 'Retry-After': '17' } },
      );
    expect(result).toBeInstanceOf(ApiError);
    expect((result as ApiError).fields).toEqual({ content: 'Required' });
    expect((result as ApiError).retryAfter).toBe(17);
  });
  it('sends native CSRF header only on same-origin writes', () => {
    document.cookie = 'XSRF-TOKEN=csrf-test; path=/';
    http.post('/api/admin/templates', {}).subscribe();
    const request = backend.expectOne('/api/admin/templates');
    expect(request.request.headers.get('X-XSRF-TOKEN')).toBe('csrf-test');
    request.flush({});
    http.get('/api/admin/templates').subscribe();
    const read = backend.expectOne('/api/admin/templates');
    expect(read.request.headers.has('X-XSRF-TOKEN')).toBe(false);
    read.flush({});
  });
  it('clears an expired session and preserves the destination', () => {
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    http.get('/api/admin/notifications').subscribe({ error: () => undefined });
    backend
      .expectOne('/api/admin/notifications')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(reset).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith(['/login'], { queryParams: { returnUrl: '/' } });
    expect(show).toHaveBeenCalled();
  });
  it('does not redirect failed login and reports permission denial', () => {
    http.post('/api/admin/auth/login', {}).subscribe({ error: () => undefined });
    backend
      .expectOne('/api/admin/auth/login')
      .flush({}, { status: 401, statusText: 'Unauthorized' });
    expect(reset).not.toHaveBeenCalled();
    http.post('/api/admin/templates', {}).subscribe({ error: () => undefined });
    backend.expectOne('/api/admin/templates').flush({}, { status: 403, statusText: 'Forbidden' });
    expect(error).toHaveBeenCalled();
  });
});
