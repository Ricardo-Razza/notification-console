import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap, of, catchError, finalize } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import type { Application, Channel, CronPreview, ScheduleUpdate } from '../../core/api/models';
import { Toast } from '../../shared/toast';
import { DateTime } from '../../shared/date-time';
import { Loading, ErrorState } from '../../shared/states';
import { CRON_PRESETS, timeZones, localDateTimeToUtc } from '../../shared/time-utils';
import { readVariables } from '../../shared/template-utils';
@Component({
  selector: 'app-schedule-editor',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    DateTime,
    Loading,
    ErrorState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">AUTOMAÇÃO</p>
        <h1 id="page-title" tabindex="-1">{{ id ? 'Agendamento' : 'Novo agendamento' }}</h1>
        <p class="muted">Configure quando e para quem enviar.</p>
      </div>
      <a mat-button routerLink="/schedules">Voltar</a>
    </header>
    @if (busy()) {
      <app-loading />
    } @else if (loadError()) {
      <app-error-state [message]="loadError()" (retry)="load()" />
    } @else {
      <div class="two-column">
        <section class="panel">
          <form [formGroup]="form" (ngSubmit)="save()">
            <mat-form-field
              ><mat-label>Nome</mat-label
              ><input matInput formControlName="name" maxlength="100" /><mat-error
                >Informe o nome.</mat-error
              ></mat-form-field
            ><mat-form-field
              ><mat-label>Aplicação</mat-label
              ><mat-select formControlName="applicationId">
                @for (app of apps(); track app.id) {
                  <mat-option [value]="app.id">{{ app.name }}</mat-option>
                }</mat-select
              ><mat-error>Selecione uma aplicação.</mat-error></mat-form-field
            >
            @if (auth.admin()) {
              <mat-form-field
                ><mat-label>Frequência sugerida</mat-label
                ><mat-select
                  (selectionChange)="form.controls.cron.setValue($event.value); form.markAsDirty()"
                >
                  @for (preset of presets; track preset.value) {
                    <mat-option [value]="preset.value">{{ preset.label }}</mat-option>
                  }
                </mat-select></mat-form-field
              >
            }
            <mat-form-field
              ><mat-label>Cron avançado (6 campos)</mat-label
              ><input matInput formControlName="cron" /><mat-hint
                >Segundo, minuto, hora, dia, mês e dia da semana.</mat-hint
              ><mat-error>Informe um cron com 6 campos.</mat-error></mat-form-field
            >
            @if (auth.admin()) {
              <mat-form-field
                ><mat-label>Buscar fuso</mat-label
                ><input matInput #zoneInput type="search" (input)="zoneSearch.set(zoneInput.value)"
              /></mat-form-field>
            }
            <mat-form-field
              ><mat-label>Fuso do agendamento</mat-label
              ><mat-select formControlName="timezone">
                @for (zone of filteredZones(); track zone) {
                  <mat-option [value]="zone">{{ zone }}</mat-option>
                }
              </mat-select></mat-form-field
            >
            <div class="form-grid">
              <mat-form-field
                ><mat-label>Início opcional (no fuso escolhido)</mat-label
                ><input matInput type="datetime-local" formControlName="startAt" /></mat-form-field
              ><mat-form-field
                ><mat-label>Fim opcional (no fuso escolhido)</mat-label
                ><input matInput type="datetime-local" formControlName="endAt"
              /></mat-form-field>
            </div>
            <mat-form-field
              ><mat-label>Canal</mat-label
              ><mat-select formControlName="channel"
                ><mat-option value="EMAIL">E-mail</mat-option
                ><mat-option value="SMS">SMS</mat-option
                ><mat-option value="PUSH">Push</mat-option></mat-select
              ></mat-form-field
            ><mat-form-field
              ><mat-label>Destinatário</mat-label
              ><input matInput formControlName="recipient" maxlength="255" /><mat-error
                >Informe um destinatário válido.</mat-error
              ></mat-form-field
            ><mat-form-field
              ><mat-label>Código do template</mat-label
              ><input matInput formControlName="template" maxlength="100" /><mat-error
                >Informe o template.</mat-error
              ></mat-form-field
            ><mat-form-field
              ><mat-label>Variáveis (objeto JSON com valores de texto)</mat-label
              ><textarea matInput formControlName="variables" rows="5"></textarea>
            </mat-form-field>
            @if (saveError()) {
              <p class="form-error" role="alert">{{ saveError() }}</p>
            }
            @if (auth.admin()) {
              <button mat-flat-button [disabled]="form.invalid || saving()">
                {{ saving() ? 'Salvando…' : 'Salvar agendamento' }}
              </button>
            }
          </form>
        </section>
        <section class="panel">
          <h2>Próximas execuções</h2>
          <p class="muted">Fuso do navegador: {{ browserZone }}</p>
          @if (previewError()) {
            <p class="form-error" role="alert">{{ previewError() }}</p>
          }
          @if (!auth.admin()) {
            <p class="muted">
              O acesso de consulta permite ver as datas já calculadas. A simulação de cron exige
              administrador.
            </p>
          }
          @if (preview(); as result) {
            @if (result.daylightSavingTransition) {
              <p class="form-note">
                Há uma mudança de horário de verão neste período. Confira as datas.
              </p>
            }
            <ol>
              @for (item of result.occurrences; track item.utc) {
                <li>
                  <p>
                    {{ item.local }} ({{ item.timezone }})<br /><app-date-time [value]="item.utc" />
                  </p>
                </li>
              }
            </ol>
            @if (highFrequency()) {
              <p class="form-note">
                Este agendamento executa com frequência alta. Confira o limite de uso da aplicação.
              </p>
            }
          }
          @if (nextRun()) {
            <h3>Próxima execução salva</h3>
            <app-date-time [value]="nextRun()" />
          }
        </section>
      </div>
    }`,
})
export class ScheduleEditor {
  private readonly api = inject(ConsoleApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly auth = inject(AuthStore);
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly apps = signal<Application[]>([]);
  readonly busy = signal(!!this.id);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly previewError = signal('');
  readonly preview = signal<CronPreview | null>(null);
  readonly nextRun = signal<string | undefined>(undefined);
  readonly presets = CRON_PRESETS;
  readonly zones = timeZones();
  readonly browserZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  readonly zoneSearch = signal('');
  readonly filteredZones = computed(() =>
    this.zones.filter((zone) => zone.toLowerCase().includes(this.zoneSearch().toLowerCase())),
  );
  readonly highFrequency = computed(() => {
    const dates = this.preview()?.occurrences ?? [];
    return (
      dates.length > 1 && Date.parse(dates[1].utc ?? '') - Date.parse(dates[0].utc ?? '') < 3600000
    );
  });
  readonly form = inject(FormBuilder).nonNullable.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    applicationId: ['', Validators.required],
    cron: ['0 0 8 * * *', [Validators.required, Validators.pattern(/^\S+(\s+\S+){5}$/)]],
    timezone: [this.browserZone, Validators.required],
    channel: ['EMAIL' as Channel, Validators.required],
    recipient: ['', [Validators.required, Validators.maxLength(255)]],
    template: ['', [Validators.required, Validators.maxLength(100)]],
    variables: ['{}'],
    startAt: [''],
    endAt: [''],
  });
  constructor() {
    this.api
      .applications()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (apps) => this.apps.set(apps),
        error: (error) => this.toast.error(error),
      });
    this.form.valueChanges
      .pipe(
        debounceTime(400),
        switchMap(() => {
          if (!this.auth.admin()) return of(null);
          const value = this.form.getRawValue();
          this.previewError.set('');
          return this.api.cron({ cron: value.cron, timezone: value.timezone, count: 5 }).pipe(
            catchError((error) => {
              this.previewError.set(this.toast.message(error));
              return of(null);
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((value) => this.preview.set(value));
    if (this.id) this.load();
    else this.form.updateValueAndValidity();
  }
  load() {
    if (!this.id) return;
    this.busy.set(true);
    this.loadError.set('');
    this.api
      .schedule(this.id)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (item) => {
          this.form.patchValue({
            name: item.name ?? '',
            applicationId: item.applicationId ?? '',
            cron: item.cron ?? '',
            timezone: item.timezone ?? this.browserZone,
            channel: item.channel ?? 'EMAIL',
            recipient: item.recipient ?? '',
            template: item.template ?? '',
            variables: JSON.stringify(item.variables ?? {}, null, 2),
            startAt: this.localInput(item.startAt, item.timezone),
            endAt: this.localInput(item.endAt, item.timezone),
          });
          this.nextRun.set(item.nextRunAt);
          if (this.auth.admin()) this.form.controls.applicationId.disable();
          else this.form.disable();
          this.form.markAsPristine();
        },
        error: (error) => this.loadError.set(this.toast.message(error)),
      });
  }
  localInput(value: string | undefined, zone: string | undefined) {
    if (!value) return '';
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: zone ?? this.browserZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).format(new Date(value));
    return parts.replace(' ', 'T');
  }
  hasUnsavedChanges() {
    return this.auth.admin() && this.form.dirty;
  }
  save() {
    if (!this.auth.admin() || this.form.invalid) return;
    this.saveError.set('');
    const value = this.form.getRawValue();
    let body: ScheduleUpdate;
    try {
      body = {
        name: value.name,
        cron: value.cron,
        timezone: value.timezone,
        channel: value.channel,
        recipient: value.recipient,
        template: value.template,
        variables: readVariables(value.variables),
        startAt: value.startAt ? localDateTimeToUtc(value.startAt, value.timezone) : undefined,
        endAt: value.endAt ? localDateTimeToUtc(value.endAt, value.timezone) : undefined,
      };
      if (body.startAt && body.endAt && body.endAt <= body.startAt)
        throw new Error('O fim deve ser posterior ao início.');
      if (value.channel === 'EMAIL' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.recipient))
        throw new Error('Informe um endereço de e-mail válido.');
    } catch (error) {
      this.saveError.set(
        error instanceof Error ? error.message : 'Verifique as variáveis e as datas.',
      );
      return;
    }
    this.saving.set(true);
    const operation = this.id
      ? this.api.updateSchedule(this.id, body)
      : this.api.createSchedule({ applicationId: value.applicationId, schedule: body });
    operation
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.form.markAsPristine();
          this.toast.show('Agendamento salvo.');
          void this.router.navigate(['/schedules']);
        },
        error: (error) => this.saveError.set(this.toast.message(error)),
      });
  }
}
