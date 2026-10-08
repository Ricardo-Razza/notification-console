import { Subscription } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import type { AuditPage, AdminUser } from '../../core/api/models';
import { DateTime } from '../../shared/date-time';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { Toast } from '../../shared/toast';
@Component({
  selector: 'app-audit',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatInputModule,
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
        <p class="eyebrow">RASTREABILIDADE</p>
        <h1 id="page-title" tabindex="-1">Auditoria</h1>
        <p class="muted">Registro das ações administrativas e acessos.</p>
      </div>
    </header>
    <section class="panel">
      <form class="filters" [formGroup]="form" (ngSubmit)="apply()">
        <mat-form-field
          ><mat-label>Usuário</mat-label
          ><mat-select formControlName="userId"
            ><mat-option value="">Todos</mat-option>
            @for (user of users(); track user.id) {
              <mat-option [value]="user.id">{{ user.email }}</mat-option>
            }
          </mat-select></mat-form-field
        ><mat-form-field
          ><mat-label>Ação</mat-label
          ><input
            matInput
            formControlName="action"
            placeholder="Ex.: TEMPLATE_CREATE" /></mat-form-field
        ><button mat-flat-button>Filtrar</button>
      </form>
    </section>
    <section class="panel">
      @if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else if (busy() && !data()) {
        <app-loading />
      } @else if (!data()?.items?.length) {
        <app-empty-state title="Nenhuma ação com esses filtros" />
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Tabela com rolagem horizontal"
        >
          <table mat-table [dataSource]="data()?.items ?? []">
            <ng-container matColumnDef="date"
              ><th mat-header-cell *matHeaderCellDef>Data</th>
              <td mat-cell *matCellDef="let row">
                <app-date-time [value]="row.createdAt" /></td></ng-container
            ><ng-container matColumnDef="user"
              ><th mat-header-cell *matHeaderCellDef>Usuário</th>
              <td mat-cell *matCellDef="let row">{{ userName(row.adminUserId) }}</td></ng-container
            ><ng-container matColumnDef="action"
              ><th mat-header-cell *matHeaderCellDef>Ação</th>
              <td mat-cell *matCellDef="let row">{{ row.action }}</td></ng-container
            ><ng-container matColumnDef="target"
              ><th mat-header-cell *matHeaderCellDef>Alvo</th>
              <td mat-cell *matCellDef="let row">
                {{ row.targetType }}<br /><small>{{ row.targetId }}</small>
              </td></ng-container
            ><ng-container matColumnDef="details"
              ><th mat-header-cell *matHeaderCellDef>Detalhes</th>
              <td mat-cell *matCellDef="let row">
                <pre>{{ details(row.details) }}</pre>
              </td></ng-container
            ><ng-container matColumnDef="ip"
              ><th mat-header-cell *matHeaderCellDef>IP</th>
              <td mat-cell *matCellDef="let row">{{ row.ip }}</td></ng-container
            >
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
        <mat-paginator
          [length]="data()?.totalElements ?? 0"
          [pageIndex]="page()"
          [pageSize]="20"
          aria-label="Paginação da auditoria"
          (page)="paginate($event)"
        />
      }
    </section>`,
})
export class Audit {
  private request?: Subscription;
  private readonly api = inject(ConsoleApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly users = signal<AdminUser[]>([]);
  readonly data = signal<AuditPage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  readonly columns = ['date', 'user', 'action', 'target', 'details', 'ip'];
  readonly form = inject(FormBuilder).nonNullable.group({ userId: [''], action: [''] });
  constructor() {
    this.api
      .users()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (users) => this.users.set(users),
        error: (error) => this.toast.error(error),
      });
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroy)).subscribe((params) => {
      this.form.patchValue({
        userId: params.get('userId') ?? '',
        action: params.get('action') ?? '',
      });
      this.page.set(Math.max(0, Number(params.get('page')) || 0));
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    let params = new HttpParams().set('page', this.page()).set('size', 20);
    for (const [key, value] of Object.entries(this.form.getRawValue())) {
      if (!value) continue;
      if (key === 'from' || key === 'to') {
        const date = new Date(value);
        if (!Number.isFinite(date.getTime())) {
          this.error.set('Informe datas válidas.');
          return;
        }
        params = params.set(key, date.toISOString());
      } else params = params.set(key, value);
    }
    this.busy.set(true);
    this.error.set('');
    this.request = this.api
      .audit(params)
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
  userName(id: string | undefined) {
    return this.users().find((user) => user.id === id)?.email ?? 'Usuário não identificado';
  }
  details(value: Record<string, string> | undefined) {
    return Object.entries(value ?? {})
      .map(([key, item]) => key + ': ' + item)
      .join('\n');
  }
}
