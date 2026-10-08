import { Subscription } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, filter, switchMap } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import type { Application, SchedulePage, Schedule, NotificationPage } from '../../core/api/models';
import { Toast } from '../../shared/toast';
import { Confirm } from '../../shared/confirm-dialog';
import { DateTime } from '../../shared/date-time';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { describeCron } from '../../shared/time-utils';
@Component({
  selector: 'app-schedules',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    DateTime,
    EmptyState,
    ErrorState,
    Loading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">AUTOMAÇÃO</p>
        <h1 id="page-title" tabindex="-1">Agendamentos</h1>
        <p class="muted">Envios recorrentes e notificações com data marcada.</p>
      </div>
      @if (auth.admin()) {
        <a mat-flat-button routerLink="/schedules/new">Novo agendamento</a>
      }
    </header>
    <section class="panel">
      <form class="filters" [formGroup]="form" (ngSubmit)="apply()">
        <mat-form-field
          ><mat-label>Aplicação</mat-label
          ><mat-select formControlName="applicationId"
            ><mat-option value="">Todas</mat-option>
            @for (app of apps(); track app.id) {
              <mat-option [value]="app.id">{{ app.name }}</mat-option>
            }
          </mat-select></mat-form-field
        ><mat-form-field
          ><mat-label>Situação</mat-label
          ><mat-select formControlName="active"
            ><mat-option value="">Todas</mat-option><mat-option value="true">Ativo</mat-option
            ><mat-option value="false">Pausado</mat-option></mat-select
          ></mat-form-field
        ><button mat-flat-button>Filtrar</button>
      </form>
    </section>
    <section class="panel">
      <h2>Agendamentos recorrentes</h2>
      @if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else if (busy() && !data()) {
        <app-loading />
      } @else if (!data()?.items?.length) {
        <app-empty-state title="Nenhum agendamento recorrente" />
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Tabela com rolagem horizontal"
        >
          <table mat-table [dataSource]="data()?.items ?? []">
            <ng-container matColumnDef="name"
              ><th mat-header-cell *matHeaderCellDef>Nome</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/schedules', row.id]">{{ row.name }}</a>
              </td></ng-container
            ><ng-container matColumnDef="app"
              ><th mat-header-cell *matHeaderCellDef>Aplicação</th>
              <td mat-cell *matCellDef="let row">{{ appName(row.applicationId) }}</td></ng-container
            ><ng-container matColumnDef="cron"
              ><th mat-header-cell *matHeaderCellDef>Frequência / fuso</th>
              <td mat-cell *matCellDef="let row">
                {{ describe(row.cron ?? '') }}<br /><small class="muted">{{ row.timezone }}</small>
              </td></ng-container
            ><ng-container matColumnDef="next"
              ><th mat-header-cell *matHeaderCellDef>Próxima execução</th>
              <td mat-cell *matCellDef="let row">
                <app-date-time [value]="row.nextRunAt" /></td></ng-container
            ><ng-container matColumnDef="last"
              ><th mat-header-cell *matHeaderCellDef>Última execução</th>
              <td mat-cell *matCellDef="let row">
                <app-date-time [value]="row.lastRunAt" /></td></ng-container
            ><ng-container matColumnDef="active"
              ><th mat-header-cell *matHeaderCellDef>Situação</th>
              <td mat-cell *matCellDef="let row">
                {{ row.active ? '✓ Ativo' : 'Ⅱ Pausado' }}
              </td></ng-container
            ><ng-container matColumnDef="actions"
              ><th mat-header-cell *matHeaderCellDef>Ações</th>
              <td mat-cell *matCellDef="let row">
                @if (auth.admin()) {
                  <button
                    mat-button
                    [disabled]="busy()"
                    (click)="action(row, row.active ? 'pause' : 'resume')"
                  >
                    {{ row.active ? 'Pausar' : 'Retomar' }}</button
                  ><button mat-button [disabled]="busy()" (click)="action(row, 'delete')">
                    Remover
                  </button>
                }
              </td></ng-container
            >
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="data()?.totalElements ?? 0"
          [pageIndex]="page()"
          [pageSize]="20"
          (page)="paginate($event)"
          aria-label="Paginação dos agendamentos"
        />
      }
    </section>
    <section class="panel">
      <h2>Envios agendados únicos</h2>
      @if (onceError()) {
        <app-error-state [message]="onceError()" (retry)="loadOnce()" />
      } @else if (!once()) {
        <app-loading />
      } @else if (!once()?.items?.length) {
        <app-empty-state title="Nenhum envio com data marcada" />
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Tabela com rolagem horizontal"
        >
          <table>
            <thead>
              <tr>
                <th>Destinatário</th>
                <th>Template</th>
                <th>Data marcada</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              @for (row of once()?.items; track row.id) {
                <tr>
                  <td>
                    <a [routerLink]="['/notifications', row.id]">{{ row.recipient }}</a>
                  </td>
                  <td>{{ row.template }}</td>
                  <td><app-date-time [value]="row.scheduledAt" /></td>
                  <td>
                    @if (auth.admin()) {
                      <button mat-button (click)="cancel(row.id)">Cancelar</button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <a
          mat-button
          routerLink="/notifications"
          [queryParams]="{ status: 'SCHEDULED', applicationId: form.controls.applicationId.value }"
          >Ver todos os envios agendados</a
        >
      }
    </section>`,
})
export class Schedules {
  private request?: Subscription;
  private readonly api = inject(ConsoleApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  readonly auth = inject(AuthStore);
  readonly apps = signal<Application[]>([]);
  readonly data = signal<SchedulePage | null>(null);
  readonly once = signal<NotificationPage | null>(null);
  readonly error = signal('');
  readonly onceError = signal('');
  readonly busy = signal(false);
  readonly page = signal(0);
  readonly columns = ['name', 'app', 'cron', 'next', 'last', 'active', 'actions'];
  readonly describe = describeCron;
  readonly form = inject(FormBuilder).nonNullable.group({ applicationId: [''], active: [''] });
  constructor() {
    this.api
      .applications()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (apps) => this.apps.set(apps),
        error: (error) => this.toast.error(error),
      });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.form.patchValue({
        applicationId: params.get('applicationId') ?? '',
        active: params.get('active') ?? '',
      });
      this.page.set(Math.max(0, Number(params.get('page')) || 0));
      this.load();
      this.loadOnce();
    });
  }
  load() {
    this.request?.unsubscribe();
    let params = new HttpParams().set('page', this.page()).set('size', 20);
    for (const [key, value] of Object.entries(this.form.getRawValue()))
      if (value) params = params.set(key, value);
    this.busy.set(true);
    this.error.set('');
    this.request = this.api
      .schedules(params)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (data) => this.data.set(data),
        error: (error) => this.error.set(this.toast.message(error)),
      });
  }
  loadOnce() {
    let params = new HttpParams().set('status', 'SCHEDULED').set('size', 20);
    if (this.form.controls.applicationId.value)
      params = params.set('applicationId', this.form.controls.applicationId.value);
    this.onceError.set('');
    this.api
      .notifications(params)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (data) => this.once.set(data),
        error: (error) => this.onceError.set(this.toast.message(error)),
      });
  }
  apply() {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { ...this.form.getRawValue(), page: 0 },
    });
  }
  paginate(event: PageEvent) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: event.pageIndex },
      queryParamsHandling: 'merge',
    });
  }
  appName(id: string | undefined) {
    return this.apps().find((app) => app.id === id)?.name ?? '—';
  }
  action(row: Schedule, action: 'pause' | 'resume' | 'delete') {
    if (!row.id) return;
    const id = row.id;
    this.confirm
      .ask(
        action === 'delete'
          ? 'Remover este agendamento? Os envios já criados permanecerão no histórico.'
          : action === 'pause'
            ? 'Pausar as próximas execuções?'
            : 'Retomar as próximas execuções?',
      )
      .pipe(
        filter(Boolean),
        switchMap(() =>
          action === 'delete' ? this.api.deleteSchedule(id) : this.api.scheduleAction(id, action),
        ),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({ next: () => this.load(), error: (error) => this.toast.error(error) });
  }
  cancel(id: string | undefined) {
    if (!id) return;
    this.confirm
      .ask('Cancelar este envio agendado?')
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.cancel(id)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({ next: () => this.loadOnce(), error: (error) => this.toast.error(error) });
  }
}
