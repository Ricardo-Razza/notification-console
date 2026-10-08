import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import { HttpParams } from '@angular/common/http';
import {
  FormBuilder,
  ReactiveFormsModule,
  FormRecord,
  FormControl,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin, switchMap, of, catchError, debounceTime, merge, finalize } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import type { Application, Template, Channel, Preview, SendResult } from '../../core/api/models';
import { Toast } from '../../shared/toast';
import { ErrorState, Loading } from '../../shared/states';
import { detectVariables } from '../../shared/template-utils';
import { timeZones, localDateTimeToUtc } from '../../shared/time-utils';
@Component({
  selector: 'app-send',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    ErrorState,
    Loading,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">NOVO ENVIO</p>
        <h1 id="page-title" tabindex="-1">Enviar notificação</h1>
        <p class="muted">Envie em nome de uma aplicação e acompanhe o resultado.</p>
      </div>
    </header>
    @if (loadError()) {
      <app-error-state [message]="loadError()" (retry)="load()" />
    } @else if (loading()) {
      <app-loading />
    } @else if (result(); as value) {
      <section class="panel" role="status">
        <h2>Notificação registrada</h2>
        <p>O envio foi registrado com status {{ value.status }}.</p>
        <a mat-flat-button [routerLink]="['/notifications', value.id]">Acompanhar notificação</a
        ><button mat-button (click)="another()">Enviar outra</button>
      </section>
    } @else {
      <div class="two-column">
        <section class="panel">
          <form [formGroup]="form" (ngSubmit)="send()">
            <mat-form-field
              ><mat-label>Aplicação</mat-label
              ><mat-select formControlName="applicationId">
                @for (app of apps(); track app.id) {
                  <mat-option [value]="app.id" [disabled]="!app.active"
                    >{{ app.name }}{{ !app.active ? ' (inativa)' : '' }}</mat-option
                  >
                }</mat-select
              ><mat-error>Selecione uma aplicação.</mat-error></mat-form-field
            ><mat-form-field
              ><mat-label>Canal</mat-label
              ><mat-select formControlName="channel"
                ><mat-option value="EMAIL">E-mail</mat-option
                ><mat-option value="SMS">SMS</mat-option
                ><mat-option value="PUSH">Push</mat-option></mat-select
              ></mat-form-field
            >
            <mat-form-field
              ><mat-label>Template</mat-label
              ><mat-select formControlName="template">
                @for (template of templates(); track template.id) {
                  <mat-option [value]="template.code"
                    >{{ template.code }} {{ template.applicationId ? '' : '(global)' }}</mat-option
                  >
                }</mat-select
              ><mat-error>Selecione um template.</mat-error></mat-form-field
            >
            @if (templateError()) {
              <p class="form-error" role="alert">{{ templateError() }}</p>
            }
            <mat-form-field
              ><mat-label>Destinatário</mat-label
              ><input matInput formControlName="recipient" maxlength="255" /><mat-error
                >Informe um destinatário válido.</mat-error
              ></mat-form-field
            >
            @if (externalRecipient()) {
              <p class="form-note">
                Isto enviará um e-mail de verdade. Confira o destinatário antes de enviar.
              </p>
            }
            <div [formGroup]="variables">
              @for (name of names(); track name) {
                <mat-form-field
                  ><mat-label>Variável: {{ name }}</mat-label
                  ><input matInput [formControlName]="name" maxlength="2000" /><mat-error
                    >Informe o valor desta variável.</mat-error
                  ></mat-form-field
                >
              }
            </div>
            <mat-form-field
              ><mat-label>Data e hora opcionais</mat-label
              ><input
                matInput
                type="datetime-local"
                formControlName="scheduledAt" /></mat-form-field
            ><mat-form-field
              ><mat-label>Fuso da data marcada</mat-label
              ><mat-select formControlName="timezone">
                @for (zone of zones; track zone) {
                  <mat-option [value]="zone">{{ zone }}</mat-option>
                }
              </mat-select></mat-form-field
            ><mat-form-field
              ><mat-label>Chave de idempotência opcional</mat-label
              ><input matInput formControlName="idempotencyKey" maxlength="255" /><mat-hint
                >Use a mesma chave para repetir o mesmo pedido com segurança.</mat-hint
              ></mat-form-field
            >
            @if (error()) {
              <p role="alert" class="form-error">{{ error() }}</p>
            }
            <button
              mat-flat-button
              [disabled]="form.invalid || variables.invalid || busy() || !!templateError()"
            >
              {{ busy() ? 'Registrando…' : 'Enviar notificação' }}
            </button>
          </form>
        </section>
        <section class="panel">
          <h2>Prévia</h2>
          @if (previewError()) {
            <p class="form-error" role="alert">{{ previewError() }}</p>
          }
          @if (preview(); as value) {
            @if (value.missingVariables?.length) {
              <p class="form-note">Faltam valores: {{ value.missingVariables.join(', ') }}</p>
            }
            <h3>{{ value.subject }}</h3>
            <pre>{{ value.content }}</pre>
          } @else {
            <p class="muted">Selecione uma aplicação e um template.</p>
          }
        </section>
      </div>
    }`,
})
export class Send {
  private readonly api = inject(ConsoleApi);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly apps = signal<Application[]>([]);
  readonly templates = signal<Template[]>([]);
  readonly names = signal<string[]>([]);
  readonly preview = signal<Preview | null>(null);
  readonly result = signal<SendResult | null>(null);
  readonly loading = signal(false);
  readonly loadError = signal('');
  readonly templateError = signal('');
  readonly previewError = signal('');
  readonly error = signal('');
  readonly busy = signal(false);
  readonly zones = timeZones();
  readonly recipient = signal('');
  readonly externalRecipient = computed(() => {
    const value = this.recipient();
    return value.includes('@') && !/@(?:localhost|[^@]+\.test|[^@]+\.invalid)$/i.test(value);
  });
  readonly form = inject(FormBuilder).nonNullable.group({
    applicationId: ['', Validators.required],
    channel: ['EMAIL' as Channel, Validators.required],
    template: ['', Validators.required],
    recipient: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    scheduledAt: [''],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone],
    idempotencyKey: ['', Validators.maxLength(255)],
  });
  readonly variables = new FormRecord<FormControl<string>>({});
  constructor() {
    this.load();
    merge(this.form.controls.applicationId.valueChanges, this.form.controls.channel.valueChanges)
      .pipe(
        switchMap(() => {
          const value = this.form.getRawValue();
          this.templateError.set('');
          if (!value.applicationId) return of([] as Template[]);
          return forkJoin([
            this.api.templates(
              new HttpParams()
                .set('scope', 'GLOBAL')
                .set('channel', value.channel)
                .set('size', 100),
            ),
            this.api.templates(
              new HttpParams()
                .set('applicationId', value.applicationId)
                .set('channel', value.channel)
                .set('size', 100),
            ),
          ]).pipe(
            switchMap(([global, own]) => {
              const visible = new Map<string, Template>();
              for (const item of [...(global.items ?? []), ...(own.items ?? [])])
                if (item.code) visible.set(item.code, item);
              return of([...visible.values()]);
            }),
            catchError((error) => {
              this.templateError.set(this.toast.message(error));
              return of([] as Template[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((templates) => {
        this.templates.set(templates);
        this.form.controls.template.setValue('');
      });
    this.form.controls.template.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.syncVariables());
    this.form.controls.recipient.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((value) => this.recipient.set(value));
    this.form.controls.channel.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe((channel) => {
        this.form.controls.recipient.setValidators(
          channel === 'EMAIL'
            ? [Validators.required, Validators.email, Validators.maxLength(255)]
            : [Validators.required, Validators.maxLength(255)],
        );
        this.form.controls.recipient.updateValueAndValidity({ emitEvent: false });
      });
    merge(this.form.valueChanges, this.variables.valueChanges)
      .pipe(
        debounceTime(400),
        switchMap(() => {
          const template = this.selectedTemplate();
          this.previewError.set('');
          if (!template?.content) return of(null);
          return this.api
            .preview({
              subject: template.subject,
              content: template.content,
              variables: this.variables.getRawValue(),
            })
            .pipe(
              catchError((error) => {
                this.previewError.set(this.toast.message(error));
                return of(null);
              }),
            );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((preview) => this.preview.set(preview));
  }
  load() {
    this.loading.set(true);
    this.loadError.set('');
    this.api
      .applications()
      .pipe(
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (apps) => this.apps.set(apps),
        error: (error) => this.loadError.set(this.toast.message(error)),
      });
  }
  selectedTemplate() {
    return this.templates().find((item) => item.code === this.form.controls.template.value);
  }
  syncVariables() {
    const template = this.selectedTemplate();
    const names = detectVariables(template?.subject ?? '', template?.content ?? '').filter(
      (name) => name !== 'today' && name !== 'now',
    );
    this.names.set(names);
    for (const name of Object.keys(this.variables.controls))
      if (!names.includes(name)) this.variables.removeControl(name, { emitEvent: false });
    for (const name of names)
      if (!this.variables.contains(name))
        this.variables.addControl(
          name,
          new FormControl('', {
            nonNullable: true,
            validators: [Validators.required, Validators.maxLength(2000)],
          }),
          { emitEvent: false },
        );
  }
  send() {
    if (this.form.invalid || this.variables.invalid || this.busy()) return;
    this.error.set('');
    const value = this.form.getRawValue();
    let scheduledAt: string | undefined;
    try {
      if (value.scheduledAt) {
        scheduledAt = localDateTimeToUtc(value.scheduledAt, value.timezone);
        if (Date.parse(scheduledAt) <= Date.now())
          throw new Error('A data marcada deve estar no futuro.');
      }
    } catch (error) {
      this.error.set(error instanceof Error ? error.message : 'Verifique a data marcada.');
      return;
    }
    this.busy.set(true);
    this.api
      .send({
        applicationId: value.applicationId,
        channel: value.channel,
        recipient: value.recipient,
        template: value.template,
        variables: this.variables.getRawValue(),
        scheduledAt,
        idempotencyKey: value.idempotencyKey || undefined,
      })
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (result) => this.result.set(result),
        error: (error) => this.error.set(this.toast.message(error)),
      });
  }
  another() {
    this.result.set(null);
    this.form.patchValue({ recipient: '', scheduledAt: '', idempotencyKey: '' });
    for (const control of Object.values(this.variables.controls)) control.reset('');
    this.error.set('');
  }
}
