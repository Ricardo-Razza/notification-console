import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatDialog } from '@angular/material/dialog';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap, filter } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import type { Application } from '../../core/api/models';
import { Confirm } from '../../shared/confirm-dialog';
import { Toast } from '../../shared/toast';
import { DateTime } from '../../shared/date-time';
import { EmptyState, ErrorState, Loading } from '../../shared/states';
import { KeyDialog } from './key-dialog';
@Component({
  selector: 'app-applications',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatTableModule,
    MatButtonModule,
    MatInputModule,
    MatFormFieldModule,
    DateTime,
    EmptyState,
    ErrorState,
    Loading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">INTEGRAÇÕES</p>
        <h1 id="page-title" tabindex="-1">Aplicações</h1>
        <p class="muted">Controle o acesso dos sistemas que enviam notificações.</p>
      </div>
    </header>
    @if (auth.admin()) {
      <section class="panel">
        <form class="filters" [formGroup]="form" (ngSubmit)="create()">
          <mat-form-field
            ><mat-label>Nome da nova aplicação</mat-label
            ><input matInput formControlName="name" maxlength="100" /><mat-error
              >Informe um nome.</mat-error
            ></mat-form-field
          ><button mat-flat-button [disabled]="form.invalid || busy()">Criar aplicação</button>
        </form>
      </section>
    }
    <section class="panel">
      @if (error()) {
        <app-error-state [message]="error()" (retry)="load()" />
      } @else if (busy() && !loaded()) {
        <app-loading />
      } @else if (!rows().length) {
        <app-empty-state
          title="Nenhuma aplicação"
          detail="Crie uma aplicação para começar a enviar."
        />
      } @else {
        <div
          class="table-scroll"
          tabindex="0"
          role="region"
          aria-label="Tabela com rolagem horizontal"
        >
          <table mat-table [dataSource]="rows()">
            <ng-container matColumnDef="name"
              ><th mat-header-cell *matHeaderCellDef>Nome</th>
              <td mat-cell *matCellDef="let row">
                <button mat-button (click)="selected.set(row)">{{ row.name }}</button>
              </td></ng-container
            >
            <ng-container matColumnDef="active"
              ><th mat-header-cell *matHeaderCellDef>Acesso</th>
              <td mat-cell *matCellDef="let row">
                <span class="badge" [class.green]="row.active" [class.gray]="!row.active">{{
                  row.active ? '✓ Ativo' : 'Ⅱ Inativo'
                }}</span>
              </td></ng-container
            >
            <ng-container matColumnDef="created"
              ><th mat-header-cell *matHeaderCellDef>Criada</th>
              <td mat-cell *matCellDef="let row"><app-date-time [value]="row.createdAt" /></td
            ></ng-container>
            <ng-container matColumnDef="used"
              ><th mat-header-cell *matHeaderCellDef>Última utilização</th>
              <td mat-cell *matCellDef="let row"><app-date-time [value]="row.lastUsedAt" /></td
            ></ng-container>
            <ng-container matColumnDef="volume"
              ><th mat-header-cell *matHeaderCellDef>Envios em 7 dias</th>
              <td mat-cell *matCellDef="let row">{{ row.volume7Days ?? 0 }}</td></ng-container
            >
            <ng-container matColumnDef="rate"
              ><th mat-header-cell *matHeaderCellDef>Limite por minuto</th>
              <td mat-cell *matCellDef="let row">
                {{ row.rateLimitPerMinute ?? 'Padrão' }}
              </td></ng-container
            >
            <ng-container matColumnDef="actions"
              ><th mat-header-cell *matHeaderCellDef>Ações</th>
              <td mat-cell *matCellDef="let row">
                @if (auth.admin()) {
                  <button mat-button [disabled]="busy()" (click)="action(row)">
                    {{ row.active ? 'Desativar' : 'Ativar' }}</button
                  ><button mat-button [disabled]="busy()" (click)="rotate(row)">
                    Rotacionar chave
                  </button>
                }
              </td></ng-container
            >
            <tr mat-header-row *matHeaderRowDef="columns; sticky: true"></tr>
            <tr mat-row *matRowDef="let row; columns: columns"></tr>
          </table>
        </div>
      }
    </section>
    @if (selected(); as app) {
      <section class="panel">
        <div class="page-header">
          <h2>{{ app.name }}</h2>
          <button mat-button (click)="selected.set(null)">Fechar detalhes</button>
        </div>
        <p>{{ app.volume7Days ?? 0 }} notificações nos últimos 7 dias.</p>
        <div class="actions">
          <a
            mat-stroked-button
            routerLink="/notifications"
            [queryParams]="{ applicationId: app.id }"
            >Últimas notificações</a
          ><a mat-stroked-button routerLink="/schedules" [queryParams]="{ applicationId: app.id }"
            >Agendamentos</a
          >
        </div>
        @if (auth.admin()) {
          <hr />
          <form class="filters" (ngSubmit)="rate(app, rateInput.value)">
            <mat-form-field
              ><mat-label>Limite por minuto (vazio usa padrão)</mat-label
              ><input
                matInput
                #rateInput
                type="number"
                min="1"
                max="100000"
                [value]="app.rateLimitPerMinute ?? ''" /></mat-form-field
            ><button mat-flat-button [disabled]="busy()">Salvar limite</button>
          </form>
          <button mat-button [disabled]="busy()" (click)="revoke(app)">
            Encerrar chave anterior agora
          </button>
        }
      </section>
    }`,
})
export class Applications {
  private readonly api = inject(ConsoleApi);
  private readonly dialog = inject(MatDialog);
  private readonly confirm = inject(Confirm);
  private readonly toast = inject(Toast);
  private readonly destroy = inject(DestroyRef);
  readonly auth = inject(AuthStore);
  readonly rows = signal<Application[]>([]);
  readonly selected = signal<Application | null>(null);
  readonly busy = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly columns = ['name', 'active', 'created', 'used', 'volume', 'rate', 'actions'];
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
  });
  constructor() {
    this.load();
  }
  load() {
    this.busy.set(true);
    this.error.set('');
    this.api
      .applications()
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (rows) => {
          this.rows.set(rows);
          this.loaded.set(true);
          const id = this.selected()?.id;
          if (id) this.selected.set(rows.find((row) => row.id === id) ?? null);
        },
        error: (error) => this.error.set(this.toast.message(error)),
      });
  }
  create() {
    if (this.form.invalid) return;
    this.dialog
      .open(KeyDialog, {
        data: { name: this.form.getRawValue().name },
        disableClose: true,
        width: '600px',
      })
      .afterClosed()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => {
        this.form.reset();
        this.load();
      });
  }
  rotate(app: Application) {
    if (!app.id) return;
    this.confirm
      .ask(
        'A chave anterior continuará válida por 24 horas. Gere uma nova chave e atualize o sistema que usa esta aplicação.',
      )
      .pipe(filter(Boolean), takeUntilDestroyed(this.destroy))
      .subscribe(() =>
        this.dialog
          .open(KeyDialog, { data: { id: app.id }, disableClose: true, width: '600px' })
          .afterClosed()
          .pipe(takeUntilDestroyed(this.destroy))
          .subscribe(() => this.load()),
      );
  }
  action(app: Application) {
    if (!app.id) return;
    const id = app.id;
    this.confirm
      .ask(
        app.active
          ? 'O sistema deixará de conseguir enviar notificações. Desativar aplicação?'
          : 'Restabelecer os envios desta aplicação?',
      )
      .pipe(
        filter(Boolean),
        switchMap(() => {
          this.busy.set(true);
          return this.api.applicationAction(id, app.active ? 'deactivate' : 'activate');
        }),
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.toast.show('Aplicação atualizada.');
          this.load();
        },
        error: (error) => this.toast.error(error),
      });
  }
  revoke(app: Application) {
    if (!app.id) return;
    const id = app.id;
    this.confirm
      .ask('A chave anterior deixará de funcionar imediatamente. Encerrar a carência?')
      .pipe(
        filter(Boolean),
        switchMap(() => this.api.applicationAction(id, 'revoke-previous-key')),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => this.toast.show('Chave anterior encerrada.'),
        error: (error) => this.toast.error(error),
      });
  }
  rate(app: Application, text: string) {
    if (!app.id) return;
    const value = text.trim() ? Number(text) : null;
    if (value !== null && (!Number.isInteger(value) || value < 1 || value > 100000)) {
      this.toast.show('Informe um limite inteiro entre 1 e 100000.');
      return;
    }
    this.busy.set(true);
    this.api
      .rate(app.id, value)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.toast.show('Limite atualizado.');
          this.load();
        },
        error: (error) => this.toast.error(error),
      });
  }
}
