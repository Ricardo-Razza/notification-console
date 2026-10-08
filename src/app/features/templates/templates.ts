import { Subscription } from 'rxjs';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, filter, switchMap } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import type { Application, TemplatePage, Template } from '../../core/api/models';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { Toast } from '../../shared/toast';
import { Confirm } from '../../shared/confirm-dialog';
@Component({
  selector: 'app-templates',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatTableModule,
    MatPaginatorModule,
    EmptyState,
    ErrorState,
    Loading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">CONTEÚDO</p>
        <h1 id="page-title" tabindex="-1">Templates</h1>
        <p class="muted">Mensagens reutilizáveis, com variáveis e prévia ao vivo.</p>
      </div>
      @if (auth.admin()) {
        <a mat-flat-button routerLink="/templates/new">Novo template</a>
      }
    </header>
    <section class="panel">
      <form class="filters" [formGroup]="form" (ngSubmit)="apply()">
        <mat-form-field
          ><mat-label>Canal</mat-label
          ><mat-select formControlName="channel"
            ><mat-option value="">Todos</mat-option><mat-option value="EMAIL">E-mail</mat-option
            ><mat-option value="SMS">SMS</mat-option
            ><mat-option value="PUSH">Push</mat-option></mat-select
          ></mat-form-field
        ><mat-form-field
          ><mat-label>Escopo</mat-label
          ><mat-select formControlName="scope"
            ><mat-option value="">Todos</mat-option><mat-option value="GLOBAL">Global</mat-option
            ><mat-option value="APPLICATION">Por aplicação</mat-option></mat-select
          ></mat-form-field
        ><mat-form-field
          ><mat-label>Aplicação</mat-label
          ><mat-select formControlName="applicationId"
            ><mat-option value="">Todas</mat-option>
            @for (app of apps(); track app.id) {
              <mat-option [value]="app.id">{{ app.name }}</mat-option>
            }
          </mat-select></mat-form-field
        ><button mat-flat-button>Filtrar</button>
      </form>
    </section>
    <section class="panel">
      @if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else if (busy() && !data()) {
        <app-loading />
      } @else if (!data()?.items?.length) {
        <app-empty-state title="Nenhum template encontrado" />
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Tabela com rolagem horizontal"
        >
          <table mat-table [dataSource]="data()?.items ?? []">
            <ng-container matColumnDef="code"
              ><th mat-header-cell *matHeaderCellDef>Código</th>
              <td mat-cell *matCellDef="let row">
                <a [routerLink]="['/templates', row.id]">{{ row.code }}</a>
              </td></ng-container
            ><ng-container matColumnDef="channel"
              ><th mat-header-cell *matHeaderCellDef>Canal</th>
              <td mat-cell *matCellDef="let row">
                {{ row.channel === 'EMAIL' ? 'E-mail' : row.channel }}
              </td></ng-container
            ><ng-container matColumnDef="scope"
              ><th mat-header-cell *matHeaderCellDef>Escopo</th>
              <td mat-cell *matCellDef="let row">
                <span class="badge purple">{{ scopeName(row.applicationId) }}</span>
              </td></ng-container
            ><ng-container matColumnDef="subject"
              ><th mat-header-cell *matHeaderCellDef>Assunto</th>
              <td mat-cell *matCellDef="let row">{{ row.subject || '—' }}</td></ng-container
            ><ng-container matColumnDef="actions"
              ><th mat-header-cell *matHeaderCellDef>Ações</th>
              <td mat-cell *matCellDef="let row">
                @if (auth.admin()) {
                  <button mat-button [disabled]="busy()" (click)="remove(row)">Remover</button>
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
          aria-label="Paginação dos templates"
          (page)="paginate($event)"
        />
      }
    </section>`,
})
export class Templates {
  private request?: Subscription;
  private readonly api = inject(ConsoleApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  private readonly confirm = inject(Confirm);
  readonly auth = inject(AuthStore);
  readonly form = inject(FormBuilder).nonNullable.group({
    channel: [''],
    scope: [''],
    applicationId: [''],
  });
  readonly apps = signal<Application[]>([]);
  readonly data = signal<TemplatePage | null>(null);
  readonly busy = signal(false);
  readonly error = signal('');
  readonly page = signal(0);
  readonly columns = ['code', 'channel', 'scope', 'subject', 'actions'];
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
        channel: params.get('channel') ?? '',
        scope: params.get('scope') ?? '',
        applicationId: params.get('applicationId') ?? '',
      });
      this.page.set(Math.max(0, Number(params.get('page')) || 0));
      this.load();
    });
  }
  load() {
    this.request?.unsubscribe();
    this.busy.set(true);
    this.error.set('');
    let params = new HttpParams().set('page', this.page()).set('size', 20);
    for (const [key, value] of Object.entries(this.form.getRawValue()))
      if (value) params = params.set(key, value);
    this.request = this.api
      .templates(params)
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
  scopeName(id: string | undefined) {
    return id ? (this.apps().find((app) => app.id === id)?.name ?? 'Aplicação') : 'Global';
  }
  remove(row: Template) {
    if (!row.id) return;
    const id = row.id;
    this.confirm
      .ask('Remover este template? Envios que dependem dele poderão falhar.')
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.deleteTemplate(id)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({ next: () => this.load(), error: (error) => this.toast.error(error) });
  }
}
