import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, filter, switchMap } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import type { Notification } from '../../core/api/models';
import { AuthStore } from '../../core/auth/auth-store';
import { StatusBadge } from '../../shared/status-badge';
import { DateTime } from '../../shared/date-time';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { Confirm } from '../../shared/confirm-dialog';
import { NotificationEvents } from '../../shared/notification-events';
import { Toast } from '../../shared/toast';
@Component({
  selector: 'app-notification-detail',
  imports: [RouterLink, MatButtonModule, StatusBadge, DateTime, EmptyState, ErrorState, Loading],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<aside class="detail-overlay" role="region" aria-label="Detalhe da notificação">
    <header class="page-header">
      <h2>Detalhe da notificação</h2>
      <a mat-button routerLink=".." queryParamsHandling="preserve">Fechar</a>
    </header>
    @if (error()) {
      <app-error-state [message]="error()" (retry)="load()" />
    } @else if (!data()) {
      <app-loading />
    } @else if (data(); as n) {
      <app-status-badge [status]="n.status" />
      <dl class="detail-grid">
        <dt>Identificador</dt>
        <dd>{{ n.id }}</dd>
        <dt>Destinatário</dt>
        <dd>{{ n.recipient }}</dd>
        <dt>Template / canal</dt>
        <dd>{{ n.template }} · {{ n.channel }}</dd>
        <dt>Origem</dt>
        <dd>
          {{
            n.origin === 'PANEL'
              ? 'Painel'
              : n.origin === 'SCHEDULE'
                ? 'Agendamento recorrente'
                : 'Aplicação'
          }}
        </dd>
        <dt>Criada</dt>
        <dd><app-date-time [value]="n.createdAt" /></dd>
        <dt>Agendada</dt>
        <dd><app-date-time [value]="n.scheduledAt" [showZone]="true" /></dd>
        <dt>Enviada</dt>
        <dd><app-date-time [value]="n.sentAt" /></dd>
        <dt>Último motivo</dt>
        <dd>{{ n.lastError ?? '—' }}</dd>
      </dl>
      <h2>Variáveis</h2>
      @for (variable of variables(); track variable.name) {
        <p>
          <strong>{{ variable.name }}</strong
          >: {{ variable.value }}
        </p>
      } @empty {
        <p class="muted">Sem variáveis disponíveis.</p>
      }
      <h2>Tentativas</h2>
      @for (attempt of n.attemptsHistory; track attempt.attemptNumber) {
        <article class="attempt">
          <strong
            >Tentativa {{ attempt.attemptNumber }} ·
            {{ attempt.status === 'SUCCESS' ? 'Sucesso' : 'Falha' }}</strong
          >
          <p>
            <app-date-time [value]="attempt.startedAt" /> →
            <app-date-time [value]="attempt.finishedAt" />
          </p>
          <p>{{ attempt.errorMessage ?? 'Envio concluído.' }}</p>
        </article>
      } @empty {
        <app-empty-state
          title="Nenhuma tentativa registrada"
          detail="O envio ainda não foi processado."
        />
      }
      @if (auth.admin()) {
        <div class="actions">
          @if (n.status === 'FAILED') {
            <button mat-flat-button [disabled]="busy()" (click)="act('retry')">Reenviar</button>
          }
          @if (n.status === 'SCHEDULED') {
            <button mat-stroked-button [disabled]="busy()" (click)="act('cancel')">
              Cancelar envio
            </button>
          }
        </div>
      }
    }
  </aside>`,
  styles: `
    .detail-overlay {
      position: fixed;
      right: 0;
      top: 0;
      bottom: 0;
      z-index: 20;
      width: min(560px, 100%);
      overflow: auto;
      padding: 28px;
      background: var(--mat-sys-surface);
      box-shadow: -10px 0 50px #0002;
    }
    .attempt {
      padding: 15px 0;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
      margin-bottom: 15px;
    }
    .attempt p {
      font-size: 0.82rem;
    }
    .detail-grid {
      margin: 24px 0 32px;
    }
  `,
})
export class NotificationDetail {
  readonly auth = inject(AuthStore);
  private readonly api = inject(ConsoleApi);
  private readonly events = inject(NotificationEvents);
  private readonly route = inject(ActivatedRoute);
  private readonly destroy = inject(DestroyRef);
  private readonly confirm = inject(Confirm);
  private readonly toast = inject(Toast);
  readonly data = signal<Notification | null>(null);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly variables = computed(() =>
    Object.entries(this.data()?.variables ?? {}).map(([name, value]) => ({ name, value })),
  );
  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.load());
  }
  load() {
    this.error.set('');
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.api
      .notification(id)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.data.set(data),
        error: (error) => this.error.set(this.toast.message(error)),
      });
  }
  act(action: 'retry' | 'cancel') {
    const id = this.data()?.id;
    if (!id) return;
    this.confirm
      .ask(
        action === 'retry'
          ? 'Reenviar esta notificação? Um novo e-mail poderá ser enviado.'
          : 'Cancelar este envio agendado?',
      )
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          return (action === 'retry' ? this.api.retry(id) : this.api.cancel(id)).pipe(
            finalize(() => this.busy.set(false)),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.load();
          this.events.changed.next();
          this.toast.show('Ação concluída.');
        },
        error: (error) => this.toast.error(error),
      });
  }
}
