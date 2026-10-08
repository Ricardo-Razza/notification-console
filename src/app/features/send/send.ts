import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  computed,
} from '@angular/core';
import {
  FormBuilder,
  ReactiveFormsModule,
  FormRecord,
  FormControl,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap, of, catchError, debounceTime, merge, finalize } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import type { Application, Template, Channel, Preview, SendResult } from '../../core/api/models';
import { Toast } from '../../shared/toast';
import { ErrorState, Loading } from '../../shared/states';
import {
  visibleTemplates,
  syncMessageVariables,
  messageFieldLabel,
  messageFieldExample,
  focusInvalidField,
} from '../../shared/message-utils';
import { StatusBadge } from '../../shared/status-badge';
import { timeZones, localDateTimeToUtc } from '../../shared/time-utils';
@Component({
  selector: 'app-send',
  providers: [
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { subscriptSizing: 'dynamic' } },
  ],
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    ErrorState,
    Loading,
    StatusBadge,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './send.html',
})
export class Send {
  private readonly api = inject(ConsoleApi);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly apps = signal<Application[]>([]);
  readonly activeApps = computed(() => this.apps().filter((app) => app.active));
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
  readonly templatesLoading = signal(false);
  readonly delivery = signal<'now' | 'later'>('now');
  readonly fieldLabel = messageFieldLabel;
  readonly fieldExample = messageFieldExample;
  readonly summary = signal({ application: '', recipient: '', template: '', when: 'Agora' });
  readonly zones = timeZones();
  readonly recipient = signal('');
  readonly externalRecipient = computed(() => {
    const value = this.recipient();
    return value.includes('@') && !/@(?:localhost|[^@]+\.test|[^@]+\.invalid)$/i.test(value);
  });
  readonly form = inject(FormBuilder).nonNullable.group({
    applicationId: ['', Validators.required],
    channel: ['EMAIL' as Channel, Validators.required],
    template: [{ value: '', disabled: true }, Validators.required],
    recipient: ['', [Validators.required, Validators.email, Validators.maxLength(255)]],
    scheduledAt: [''],
    timezone: [Intl.DateTimeFormat().resolvedOptions().timeZone],
    idempotencyKey: ['', Validators.maxLength(255)],
  });
  readonly variables = new FormRecord<FormControl<string>>({});
  constructor() {
    merge(this.form.controls.applicationId.valueChanges, this.form.controls.channel.valueChanges)
      .pipe(
        switchMap(() => {
          const value = this.form.getRawValue();
          this.templateError.set('');
          this.templates.set([]);
          this.form.controls.template.disable({ emitEvent: false });
          this.preview.set(null);
          this.form.controls.template.setValue('');
          this.templatesLoading.set(!!value.applicationId);
          if (!value.applicationId) return of([] as Template[]);
          return visibleTemplates(this.api, value.applicationId, value.channel).pipe(
            catchError((error) => {
              this.templateError.set(this.toast.message(error));
              return of([] as Template[]);
            }),
          );
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((templates) => {
        this.templatesLoading.set(false);
        this.templates.set(templates);
        if (templates.length) this.form.controls.template.enable({ emitEvent: false });
        if (templates.length === 1) this.form.controls.template.setValue(templates[0].code ?? '');
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
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.updateSummary());
    this.load();
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
        next: (apps) => {
          this.apps.set(apps);
          const active = apps.filter((app) => app.active);
          if (!this.form.controls.applicationId.value && active.length === 1)
            this.form.controls.applicationId.setValue(active[0].id ?? '');
        },
        error: (error) => this.loadError.set(this.toast.message(error)),
      });
  }
  selectedTemplate() {
    return this.templates().find((item) => item.code === this.form.controls.template.value);
  }
  syncVariables() {
    this.names.set(syncMessageVariables(this.variables, this.selectedTemplate()));
  }
  setDelivery(value: 'now' | 'later') {
    this.delivery.set(value);
    if (value === 'now') this.form.controls.scheduledAt.setValue('');
    this.form.controls.scheduledAt.setValidators(value === 'later' ? Validators.required : []);
    this.form.controls.scheduledAt.updateValueAndValidity();
  }
  updateSummary() {
    const value = this.form.getRawValue();
    this.summary.set({
      application: this.apps().find((app) => app.id === value.applicationId)?.name ?? '',
      recipient: value.recipient,
      template: value.template,
      when:
        this.delivery() === 'later'
          ? (value.scheduledAt.replace(/^(\d{4})-(\d{2})-(\d{2})T/, '$3/$2/$1 às ') ||
              'Escolha a data') +
            ' · ' +
            value.timezone
          : 'Agora',
    });
  }
  send() {
    this.form.markAllAsTouched();
    this.variables.markAllAsTouched();
    if (
      this.form.invalid ||
      this.variables.invalid ||
      this.busy() ||
      this.templatesLoading() ||
      !this.selectedTemplate()
    ) {
      this.error.set('Confira os campos destacados antes de enviar.');
      focusInvalidField('send-form');
      return;
    }
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
    this.setDelivery('now');
    this.form.patchValue({ recipient: '', scheduledAt: '', idempotencyKey: '' });
    for (const control of Object.values(this.variables.controls)) control.reset('');
    this.form.markAsUntouched();
    this.form.markAsPristine();
    this.error.set('');
  }
}
