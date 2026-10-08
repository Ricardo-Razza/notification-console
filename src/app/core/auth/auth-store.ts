import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, of, switchMap, tap } from 'rxjs';
import { ConsoleApi } from '../api/console-api';
import type { LoginRequest, User } from '../api/models';
@Injectable({ providedIn: 'root' })
export class AuthStore {
  private readonly api = inject(ConsoleApi);
  readonly user = signal<User | null>(null);
  readonly ready = signal(false);
  readonly admin = computed(() => this.user()?.role === 'ADMIN');
  initialize() {
    return this.api.me().pipe(
      tap((user) => this.user.set(user)),
      catchError(() => of(null)),
      tap(() => this.ready.set(true)),
    );
  }
  login(body: LoginRequest) {
    return this.api.login(body).pipe(
      switchMap(() => this.api.me()),
      tap((user) => {
        this.user.set(user);
        this.ready.set(true);
      }),
    );
  }
  reset() {
    this.user.set(null);
  }
  logout() {
    return this.api.logout().pipe(
      tap(() => {
        this.reset();
        window.location.assign('/login');
      }),
    );
  }
}
