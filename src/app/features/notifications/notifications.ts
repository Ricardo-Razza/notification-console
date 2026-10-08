import { Subscription } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink, RouterOutlet } from '@angular/router';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, timer } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import type { Application, NotificationPage, NotificationStatus } from '../../core/api/models';
import { StatusBadge, STATUS_INFO } from '../../shared/status-badge';
import { DateTime } from '../../shared/date-time';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { NotificationEvents } from '../../shared/notification-events';
import { Toast } from '../../shared/toast';
@Component({
  selector: 'app-notifications',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    RouterOutlet,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatTableModule,
    MatPaginatorModule,
    MatSlideToggleModule,
    StatusBadge,
    DateTime,
    EmptyState,
    ErrorState,
    Loading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">HISTÓRICO</p>
        <h1 id="page-title" tabindex="-1">Notificações</h1>
        <p class="muted">Encontre um envio e acompanhe cada tentativa.</p>
      </div>
      <mat-slide-toggle [checked]="auto()" (change)="auto.set($event.checked)"
        >Atualização automática</mat-slide-toggle
      >
    </header>
    <section class="panel">
      <form class="filters" [formGroup]="form" (ngSubmit)="apply()">
        <mat-form-field
          ><mat-label>Status</mat-label
          ><mat-select multiple formControlName="status">
            @for (status of statuses; track status) {
              <mat-option [value]="status">{{ statusInfo[status].label }}</mat-option>
            }
          </mat-select></mat-form-field
        ><mat-form-field
          ><mat-label>Canal</mat-label
          ><mat-select formControlName="channel"
            ><mat-option value="">Todos</mat-option><mat-option value="EMAIL">E-mail</mat-option
            ><mat-option value="SMS">SMS</mat-option
            ><mat-option value="PUSH">Push</mat-option></mat-select
          ></mat-form-field
        ><mat-form-field
          ><mat-label>Aplicação</mat-label
          ><mat-select formControlName="applicationId"
            ><mat-option value="">Todas</mat-option>
            @for (app of apps(); track app.id) {
              <mat-option [value]="app.id">{{ app.name }}</mat-option>
            }
          </mat-select></mat-form-field
        ><mat-form-field
          ><mat-label>Destinatário</mat-label
          ><input matInput formControlName="recipient" type="search" /></mat-form-field
        ><mat-form-field
          ><mat-label>Desde</mat-label
          ><input matInput type="datetime-local" formControlName="createdFrom" /></mat-form-field
        ><mat-form-field
          ><mat-label>Até</mat-label
          ><input matInput type="datetime-local" formControlName="createdTo" /></mat-form-field
        ><mat-form-field
          ><mat-label>Ordenação</mat-label
          ><mat-select formControlName="sort"
            ><mat-option value="createdAt,desc">Mais recentes</mat-option
            ><mat-option value="createdAt,asc">Mais antigas</mat-option
            ><mat-option value="status,asc">Por status</mat-option></mat-select
          ></mat-form-field
        ><button mat-flat-button type="submit">Filtrar</button
        ><button mat-button type="button" (click)="clear()">Limpar</button>
      </form>
    </section>
    <section class="panel">
      @if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else if (busy() && !data()) {
        <app-loading />
      } @else if (!data()?.items?.length) {
        <app-empty-state
          title="Nenhuma notificação com esses filtros"
          detail="Ajuste os filtros para ampliar a busca."
        />
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Tabela com rolagem horizontal"
        >
          <table mat-table [dataSource]="data()?.items ?? []">
            <ng-container matColumnDef="created"
              ><th mat-header-cell *matHeaderCellDef>Criada em</th>
              <td mat-cell *matCellDef="let row">
                <app-date-time [value]="row.createdAt" /></td></ng-container
            ><ng-container matColumnDef="app"
              ><th mat-header-cell *matHeaderCellDef>Aplicação</th>
              <td mat-cell *matCellDef="let row">{{ appName(row.applicationId) }}</td></ng-container
            ><ng-container matColumnDef="channel"
              ><th mat-header-cell *matHeaderCellDef>Canal</th>
              <td mat-cell *matCellDef="let row">
                {{ row.channel === 'EMAIL' ? 'E-mail' : row.channel }}
              </td></ng-container
            ><ng-container matColumnDef="recipient"
              ><th mat-header-cell *matHeaderCellDef>Destinatário</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="[row.id]" queryParamsHandling="preserve">{{ row.recipient }}</a>
              </td></ng-container
            ><ng-container matColumnDef="template"
              ><th mat-header-cell *matHeaderCellDef>Template</th>
              <td mat-cell *matCellDef="let row">{{ row.template }}</td></ng-container
            ><ng-container matColumnDef="status"
              ><th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let row">
                <app-status-badge [status]="row.status" /></td></ng-container
            ><ng-container matColumnDef="attempts"
              ><th mat-header-cell *matHeaderCellDef>Tentativas</th>
              <td mat-cell *matCellDef="let row">{{ row.attempts }}</td></ng-container
            >
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="data()?.totalElements ?? 0"
          [pageIndex]="page()"
          [pageSize]="size()"
          [pageSizeOptions]="[10, 20, 50, 100]"
          aria-label="Paginação das notificações"
          (page)="paginate($event)"
        />
      }
    </section>
    <router-outlet />`,
})
export class Notifications {
  private request?: Subscription;
  private readonly api = inject(ConsoleApi);
  private readonly events = inject(NotificationEvents);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly form = inject(FormBuilder).nonNullable.group({
    status: [[] as NotificationStatus[]],
    channel: [''],
    applicationId: [''],
    recipient: [''],
    createdFrom: [''],
    createdTo: [''],
    sort: ['createdAt,desc'],
  });
  readonly statuses = Object.keys(STATUS_INFO) as NotificationStatus[];
  readonly statusInfo = STATUS_INFO;
  readonly apps = signal<Application[]>([]);
  readonly data = signal<NotificationPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly auto = signal(false);
  readonly page = signal(0);
  readonly size = signal(20);
  readonly columns = ['created', 'app', 'channel', 'recipient', 'template', 'status', 'attempts'];
  constructor() {
    this.events.changed.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => this.load());
    this.api
      .applications()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (apps) => this.apps.set(apps),
        error: (error) => this.toast.error(error),
      });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.form.patchValue(
        {
          status: (params.get('status') ?? '')
            .split(',')
            .filter((value) => value in STATUS_INFO) as NotificationStatus[],
          channel: params.get('channel') ?? '',
          applicationId: params.get('applicationId') ?? '',
          recipient: params.get('recipient') ?? '',
          createdFrom: params.get('createdFrom') ?? '',
          createdTo: params.get('createdTo') ?? '',
          sort: params.get('sort') ?? 'createdAt,desc',
        },
        { emitEvent: false },
      );
      this.page.set(Math.max(0, Number(params.get('page')) || 0));
      this.size.set(
        [10, 20, 50, 100].includes(Number(params.get('size'))) ? Number(params.get('size')) : 20,
      );
      this.load();
    });
    timer(30000, 30000)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        if (this.auto() && !document.hidden && !this.busy()) this.load();
      });
  }
  load() {
    this.request?.unsubscribe();
    for (const value of [this.form.controls.createdFrom.value, this.form.controls.createdTo.value])
      if (value && !Number.isFinite(new Date(value).getTime())) {
        this.error.set('Informe datas válidas.');
        return;
      }
    this.busy.set(true);
    this.error.set('');
    const values = this.form.getRawValue();
    let params = new HttpParams()
      .set('page', this.page())
      .set('size', this.size())
      .set('sort', values.sort);
    for (const [key, value] of Object.entries(values)) {
      if (key === 'sort' || !value?.length) continue;
      const wire = Array.isArray(value)
        ? value.join(',')
        : key === 'createdFrom' || key === 'createdTo'
          ? new Date(value).toISOString()
          : value;
      params = params.set(key, wire);
    }
    this.request = this.api
      .notifications(params)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (data) => this.data.set(data),
        error: (error) => this.error.set(this.toast.message(error)),
      });
  }
  apply() {
    const values = this.form.getRawValue();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        ...values,
        status: values.status.join(',') || null,
        page: 0,
        size: this.size(),
      },
      queryParamsHandling: 'merge',
    });
  }
  clear() {
    this.form.reset({
      status: [],
      channel: '',
      applicationId: '',
      recipient: '',
      createdFrom: '',
      createdTo: '',
      sort: 'createdAt,desc',
    });
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }
  paginate(event: PageEvent) {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page: event.pageIndex, size: event.pageSize },
      queryParamsHandling: 'merge',
    });
  }
  appName(id: string | undefined) {
    return this.apps().find((app) => app.id === id)?.name ?? '—';
  }
}
