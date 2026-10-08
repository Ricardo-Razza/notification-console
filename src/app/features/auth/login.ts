import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { AuthStore } from '../../core/auth/auth-store';
import { Toast } from '../../shared/toast';
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<div class="login-page">
    <div class="login-brand">
      <span class="brand-mark" aria-hidden="true">N</span> Notification Console
    </div>
    <section class="login-card">
      <p class="eyebrow">ACESSO À OPERAÇÃO</p>
      <h1>Bem-vindo de volta</h1>
      <p class="muted">Entre para acompanhar e gerenciar suas notificações.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <mat-form-field
          ><mat-label>E-mail</mat-label
          ><input
            matInput
            type="email"
            formControlName="email"
            autocomplete="username"
            required
          /><mat-error>Informe um e-mail válido.</mat-error></mat-form-field
        ><mat-form-field
          ><mat-label>Senha</mat-label
          ><input
            matInput
            type="password"
            formControlName="password"
            autocomplete="current-password"
            required
          /><mat-error>Informe sua senha.</mat-error></mat-form-field
        >
        @if (error()) {
          <p class="form-error" role="alert">{{ error() }}</p>
        }
        <button
          mat-flat-button
          class="full-width"
          type="submit"
          [disabled]="form.invalid || busy()"
        >
          {{ busy() ? 'Entrando…' : 'Entrar' }}
        </button>
        @if (busy()) {
          <mat-progress-bar mode="indeterminate" aria-label="Entrando" />
        }
      </form>
      <p class="login-footnote">
        Acesso por sessão protegida. Suas credenciais não são armazenadas no navegador.
      </p>
    </section>
  </div>`,
})
export class Login {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(Toast);
  private readonly destroy = inject(DestroyRef);
  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly busy = signal(false);
  readonly error = signal('');
  submit() {
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.auth
      .login(this.form.getRawValue())
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          const target = this.route.snapshot.queryParamMap.get('returnUrl');
          void this.router.navigateByUrl(
            target && target.startsWith('/') && !target.startsWith('//') && !target.includes('\\')
              ? target
              : '/dashboard',
          );
        },
        error: (error) => this.error.set(this.toast.message(error)),
      });
  }
}
