import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  catchError,
  EMPTY,
  forkJoin,
  fromEvent,
  map,
  merge,
  of,
  startWith,
  Subject,
  switchMap,
  timer,
} from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import type { Application, NotificationStatus, QueueStatus, Stats } from '../../core/api/models';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { StatusBadge } from '../../shared/status-badge';
import { DateTime } from '../../shared/date-time';
import { Toast } from '../../shared/toast';
@Component({
  selector: 'app-dashboard',
  imports: [
    DecimalPipe,
    RouterLink,
    MatButtonModule,
    MatButtonToggleModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    EmptyState,
    ErrorState,
    Loading,
    StatusBadge,
    DateTime,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <header class="page-header">
      <div>
        <p class="eyebrow">ACOMPANHAMENTO</p>
        <h1 id="page-title" tabindex="-1">Visão geral</h1>
        <p class="muted">O pulso das suas notificações, em um só lugar.</p>
      </div>
      <div class="actions">
        <mat-button-toggle-group
          [value]="period()"
          (change)="setPeriod($event.value)"
          aria-label="Período"
          ><mat-button-toggle value="24h">24 horas</mat-button-toggle
          ><mat-button-toggle value="7d">7 dias</mat-button-toggle
          ><mat-button-toggle value="30d">30 dias</mat-button-toggle></mat-button-toggle-group
        ><button mat-stroked-button (click)="refresh.next()">Atualizar agora</button>
      </div>
    </header>
    <div class="filters">
      <mat-form-field
        ><mat-label>Aplicação</mat-label
        ><mat-select [value]="application()" (selectionChange)="setApplication($event.value)"
          ><mat-option value="">Todas as aplicações</mat-option>
          @for (app of applications(); track app.id) {
            <mat-option [value]="app.id">{{ app.name }}</mat-option>
          }
        </mat-select></mat-form-field
      >
      <p class="muted">
        Atualização a cada 30s ·
        @if (updated()) {
          <app-date-time [value]="updated()" />
        } @else {
          Aguardando dados
        }
      </p>
    </div>
    @if (statsError()) {
      <app-error-state [message]="statsError()" (retry)="refresh.next()" />
    } @else if (!stats()) {
      <app-loading />
    } @else if (stats(); as s) {
      <div class="grid metric-grid">
        <article class="panel metric">
          <span class="muted">Total no período</span><strong>{{ s.total | number }}</strong
          ><small>Notificações criadas</small>
        </article>
        <a
          class="panel metric metric-link"
          routerLink="/notifications"
          [queryParams]="{ status: 'SENT', applicationId: application() }"
          ><span class="muted">Enviadas</span><strong>{{ s.sent | number }}</strong
          ><small>✓ Aceitas pelo SMTP</small></a
        ><a
          class="panel metric metric-link"
          routerLink="/notifications"
          [queryParams]="{ status: 'FAILED', applicationId: application() }"
          ><span class="muted">Falhas</span><strong>{{ s.failed | number }}</strong
          ><small>! Precisam de atenção</small></a
        >
        <article class="panel metric">
          <span class="muted">Taxa de sucesso</span
          ><strong>{{ s.successRate | number: '1.1-1' }}%</strong
          ><small>Entre envios concluídos</small>
        </article>
        <article class="panel metric">
          <span class="muted">Pendentes na fila</span><strong>{{ s.queued | number }}</strong
          ><small>Aguardando ou processando</small>
        </article>
        <article class="panel metric">
          <span class="muted">Tempo médio de envio</span
          ><strong>{{ (s.averageSendMillis ?? 0) / 1000 | number: '1.1-1' }}s</strong
          ><small>Da criação até o envio</small>
        </article>
      </div>
      <section class="panel">
        <div class="page-header">
          <div>
            <h2>Envios ao longo do tempo</h2>
            <p class="muted">Enviadas e falhas por hora ou dia.</p>
          </div>
          <button mat-button (click)="table.update(toggle)">
            {{ table() ? 'Ver gráfico' : 'Ver tabela' }}
          </button>
        </div>
        @if (!(s.total ?? 0)) {
          <app-empty-state
            title="Ainda não há notificações neste período"
            detail="Escolha outro período ou envie uma notificação."
          />
        } @else if (table()) {
          <div
            class="table-scroll"
            tabindex="0"
            role="region"
            aria-label="Tabela com rolagem horizontal"
          >
            <table mat-table [dataSource]="s.series ?? []">
              <ng-container matColumnDef="time"
                ><th mat-header-cell *matHeaderCellDef>Período</th>
                <td mat-cell *matCellDef="let row">
                  <app-date-time [value]="row.time" /></td></ng-container
              ><ng-container matColumnDef="sent"
                ><th mat-header-cell *matHeaderCellDef>Enviadas</th>
                <td mat-cell *matCellDef="let row">{{ row.sent }}</td></ng-container
              ><ng-container matColumnDef="failed"
                ><th mat-header-cell *matHeaderCellDef>Falhas</th>
                <td mat-cell *matCellDef="let row">{{ row.failed }}</td></ng-container
              >
              <tr mat-header-row *matHeaderRowDef="chartColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: chartColumns"></tr>
            </table>
          </div>
        } @else {
          @defer (on viewport) {
            <svg
              class="graph"
              viewBox="0 0 600 190"
              role="img"
              aria-label="Gráfico de enviadas e falhas. Use Ver tabela para consultar os valores exatos."
            >
              <line x1="10" y1="170" x2="590" y2="170" stroke="currentColor" opacity=".2" />
              <polyline
                [attr.points]="sentPoints()"
                fill="none"
                stroke="#2b8c58"
                stroke-width="3"
              />
              <polyline
                [attr.points]="failedPoints()"
                fill="none"
                stroke="#c94a50"
                stroke-width="3"
                stroke-dasharray="6 4"
              />
            </svg>
            <p class="muted">━ Enviadas · ┄ Falhas</p>
          } @placeholder {
            <app-loading />
          }
        }
      </section>
      <div class="two-column">
        <section class="panel">
          <h2>Distribuição por status</h2>
          @for (item of statuses(); track item.status) {
            <a
              class="distribution-row"
              routerLink="/notifications"
              [queryParams]="{ status: item.status, applicationId: application() }"
              ><app-status-badge [status]="item.status" /><strong>{{ item.amount }}</strong></a
            >
          }
        </section>
        <section class="panel">
          <h2>Canais</h2>
          @for (channel of channels(); track channel.name) {
            <div class="distribution-row">
              <span>{{ channel.name }}</span
              ><strong>{{ channel.amount }}</strong>
            </div>
          }
        </section>
      </div>
    }
    <section class="panel">
      <h2>Saúde das filas</h2>
      @if (queueError()) {
        <app-error-state [message]="queueError()" (retry)="refresh.next()" />
      } @else if (queues() === null) {
        <app-loading />
      } @else {
        <div class="grid">
          @for (queue of queues(); track queue.name; let first = $first) {
            <article class="queue-card">
              <strong>{{ queue.name }}</strong>
              @if (queue.unavailable) {
                <p role="status">Indisponível no momento</p>
              } @else {
                <p>{{ queue.ready }} mensagens prontas · {{ queue.consumers }} consumidores</p>
                @if (
                  ((queue.name ?? '').includes('dlq') && (queue.ready ?? 0) > 0) ||
                  (first && !queue.consumers)
                ) {
                  <p class="form-error" role="status">! Esta fila precisa de atenção.</p>
                }
              }
            </article>
          }
        </div>
      }
    </section>`,
  styles: `
    .metric-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 24px;
    }
    .metric {
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .metric strong {
      font-size: 2rem;
      letter-spacing: -0.04em;
    }
    .metric small {
      color: var(--mat-sys-on-surface-variant);
    }
    .metric-link {
      text-decoration: none;
      color: inherit;
    }
    .metric-link:hover {
      border-color: var(--mat-sys-primary);
    }
    .graph {
      width: 100%;
      height: 220px;
    }
    .distribution-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 15px;
      padding: 12px 0;
      text-decoration: none;
      color: inherit;
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }
    .queue-card {
      padding: 15px;
      background: var(--mat-sys-surface-container-low);
      border-radius: 12px;
    }
    .queue-card strong {
      font-size: 0.8rem;
      overflow-wrap: anywhere;
    }
    .queue-card p {
      font-size: 0.78rem;
    }
    @media (max-width: 650px) {
      .metric-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
      .metric {
        padding: 16px;
      }
      .metric strong {
        font-size: 1.6rem;
      }
    }
  `,
})
export class Dashboard {
  readonly api = inject(ConsoleApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly stats = signal<Stats | null>(null);
  readonly queues = signal<QueueStatus[] | null>(null);
  readonly applications = signal<Application[]>([]);
  readonly statsError = signal('');
  readonly queueError = signal('');
  readonly updated = signal('');
  readonly period = signal('24h');
  readonly application = signal('');
  readonly table = signal(false);
  readonly refresh = new Subject<void>();
  readonly toggle = (value: boolean) => !value;
  readonly chartColumns = ['time', 'sent', 'failed'];
  readonly statuses = computed(() =>
    Object.entries(this.stats()?.byStatus ?? {}).map(([status, amount]) => ({
      status: status as NotificationStatus,
      amount,
    })),
  );
  readonly channels = computed(() =>
    Object.entries(this.stats()?.byChannel ?? {}).map(([name, amount]) => ({ name, amount })),
  );
  readonly sentPoints = computed(() => this.points('sent'));
  readonly failedPoints = computed(() => this.points('failed'));
  constructor() {
    this.api
      .applications()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.applications.set(data),
        error: (error) => this.toast.error(error),
      });
    const visible = fromEvent(document, 'visibilitychange').pipe(
      startWith(null),
      map(() => !document.hidden),
    );
    this.route.queryParamMap
      .pipe(
        switchMap((params) => {
          this.period.set(
            ['24h', '7d', '30d'].includes(params.get('period') ?? '')
              ? (params.get('period') ?? '24h')
              : '24h',
          );
          this.application.set(params.get('applicationId') ?? '');
          return visible.pipe(
            switchMap((value) => (value ? merge(timer(0, 30000), this.refresh) : EMPTY)),
          );
        }),
        switchMap(() => {
          const end = new Date();
          const days = this.period() === '30d' ? 30 : this.period() === '7d' ? 7 : 1;
          let params = new HttpParams()
            .set('from', new Date(end.getTime() - days * 86400000).toISOString())
            .set('to', end.toISOString());
          if (this.application()) params = params.set('applicationId', this.application());
          this.statsError.set('');
          this.queueError.set('');
          return forkJoin({
            stats: this.api.stats(params).pipe(
              catchError((error) => {
                this.statsError.set(this.toast.message(error));
                return of(null);
              }),
            ),
            queues: this.api.queues().pipe(
              catchError((error) => {
                this.queueError.set(this.toast.message(error));
                return of(null);
              }),
            ),
          });
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((data) => {
        this.stats.set(data.stats);
        this.queues.set(data.queues);
        this.updated.set(new Date().toISOString());
      });
  }
  setPeriod(period: string) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { period },
      queryParamsHandling: 'merge',
    });
  }
  setApplication(applicationId: string) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { applicationId: applicationId || null },
      queryParamsHandling: 'merge',
    });
  }
  private points(kind: 'sent' | 'failed') {
    const rows = this.stats()?.series ?? [];
    const max = Math.max(1, ...rows.flatMap((row) => [row.sent ?? 0, row.failed ?? 0]));
    return rows
      .map(
        (row, index) =>
          `${10 + (index * 580) / Math.max(1, rows.length - 1)},${170 - ((row[kind] ?? 0) * 150) / max}`,
      )
      .join(' ');
  }
}
