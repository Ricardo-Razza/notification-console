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
  FormControl,
  FormRecord,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  debounceTime,
  switchMap,
  of,
  catchError,
  finalize,
  merge,
  map,
  distinctUntilChanged,
  startWith,
} from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import type {
  Application,
  Channel,
  CronPreview,
  ScheduleUpdate,
  Template,
  Preview,
} from '../../core/api/models';
import { Toast } from '../../shared/toast';
import { DateTime } from '../../shared/date-time';
import { Loading, ErrorState } from '../../shared/states';
import { timeZones, localDateTimeToUtc } from '../../shared/time-utils';
import { localPreview } from '../../shared/template-utils';
import {
  visibleTemplates,
  syncMessageVariables,
  messageFieldLabel,
  messageFieldExample,
  focusInvalidField,
} from '../../shared/message-utils';
import {
  WEEKDAYS,
  recurrenceCron,
  parseRecurrence,
  recurrenceDescription,
  type Frequency,
} from '../../shared/schedule-rules';
@Component({
  selector: 'app-schedule-editor',
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
    DateTime,
    Loading,
    ErrorState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './schedule-editor.html',
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
  readonly activeApps = computed(() => this.apps().filter((app) => app.active));
  readonly busy = signal(!!this.id);
  readonly saving = signal(false);
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly previewError = signal('');
  readonly preview = signal<CronPreview | null>(null);
  readonly nextRun = signal<string | undefined>(undefined);
  readonly weekdays = WEEKDAYS;
  readonly templates = signal<Template[]>([]);
  readonly templatesLoading = signal(false);
  readonly templateError = signal('');
  readonly names = signal<string[]>([]);
  readonly messagePreview = signal<Preview | null>(null);
  readonly fieldLabel = messageFieldLabel;
  readonly fieldExample = messageFieldExample;
  readonly recurrenceText = signal('Todos os dias às 08:00');
  readonly recurrenceError = signal('');
  readonly frequency = signal<Frequency>('daily');
  private savedVariables: Record<string, string> = {};
  private additionalNames: string[] = [];
  readonly variables = new FormRecord<FormControl<string>>({});
  readonly recurrence = inject(FormBuilder).nonNullable.group({
    frequency: ['daily' as Frequency],
    time: ['08:00'],
    weekday: ['MON'],
    monthDay: [1],
  });
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
    template: [{ value: '', disabled: true }, [Validators.required, Validators.maxLength(100)]],
    startAt: [''],
    endAt: [''],
  });
  constructor() {
    this.recurrence.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      const value = this.recurrence.getRawValue();
      this.frequency.set(value.frequency);
      this.recurrenceError.set('');
      if (value.frequency !== 'custom') {
        try {
          this.form.controls.cron.setValue(recurrenceCron(value));
        } catch (error) {
          this.recurrenceError.set(error instanceof Error ? error.message : 'Confira o horário.');
        }
      }
      this.form.markAsDirty();
    });
    this.form.valueChanges.pipe(takeUntilDestroyed(this.destroy)).subscribe(() => {
      this.recurrenceText.set(recurrenceDescription(this.form.controls.cron.value));
    });
    merge(this.form.controls.applicationId.valueChanges, this.form.controls.channel.valueChanges)
      .pipe(
        map(() => ({
          applicationId: this.form.controls.applicationId.value,
          channel: this.form.controls.channel.value,
        })),
        debounceTime(0),
        switchMap((value) => {
          this.templates.set([]);
          this.form.controls.template.disable({ emitEvent: false });
          this.messagePreview.set(null);
          this.templateError.set('');
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
        if (templates.length && this.auth.admin())
          this.form.controls.template.enable({ emitEvent: false });
        if (!this.form.controls.template.value && templates.length === 1)
          this.form.controls.template.setValue(templates[0].code ?? '');
        this.syncVariables();
      });
    merge(this.form.controls.template.valueChanges, this.variables.valueChanges)
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.syncVariables());
    this.form.controls.channel.valueChanges
      .pipe(startWith(this.form.controls.channel.value), takeUntilDestroyed(this.destroy))
      .subscribe((channel) => {
        this.form.controls.recipient.setValidators(
          channel === 'EMAIL'
            ? [Validators.required, Validators.email, Validators.maxLength(255)]
            : [Validators.required, Validators.maxLength(255)],
        );
        this.form.controls.recipient.updateValueAndValidity({ emitEvent: false });
      });
    this.form.valueChanges
      .pipe(
        map(() => ({
          cron: this.form.controls.cron.value,
          timezone: this.form.controls.timezone.value,
        })),
        distinctUntilChanged((a, b) => a.cron === b.cron && a.timezone === b.timezone),
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
    this.load();
    if (!this.id) this.form.updateValueAndValidity();
  }
  load() {
    this.busy.set(true);
    this.loadError.set('');
    this.api
      .applications()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (apps) => {
          this.apps.set(apps);
          const active = apps.filter((app) => app.active);
          if (!this.id && !this.form.controls.applicationId.value && active.length === 1)
            this.form.controls.applicationId.setValue(active[0].id ?? '');
          if (!this.id) this.busy.set(false);
        },
        error: (error) => {
          this.loadError.set(this.toast.message(error));
          this.busy.set(false);
        },
      });
    if (!this.id) return;
    this.api
      .schedule(this.id)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (item) => {
          this.savedVariables = item.variables ?? {};
          this.additionalNames = Object.keys(this.savedVariables);
          this.form.patchValue(
            {
              name: item.name ?? '',
              applicationId: item.applicationId ?? '',
              cron: item.cron ?? '',
              timezone: item.timezone ?? this.browserZone,
              channel: item.channel ?? 'EMAIL',
              recipient: item.recipient ?? '',
              template: item.template ?? '',
              startAt: this.localInput(item.startAt, item.timezone),
              endAt: this.localInput(item.endAt, item.timezone),
            },
            { emitEvent: false },
          );
          this.form.controls.applicationId.updateValueAndValidity();
          this.form.controls.channel.updateValueAndValidity();
          const recurrence = parseRecurrence(item.cron ?? '');
          this.recurrence.patchValue(recurrence, { emitEvent: false });
          this.frequency.set(recurrence.frequency);
          this.nextRun.set(item.nextRunAt);
          if (this.auth.admin()) this.form.controls.applicationId.disable();
          else {
            this.form.disable();
            this.recurrence.disable();
            this.variables.disable();
          }
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
  occurrenceLabel(value: string | undefined, zone: string | undefined) {
    if (!value) return 'Data indisponível';
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: zone ?? this.form.controls.timezone.value,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }
  hasUnsavedChanges() {
    return this.auth.admin() && (this.form.dirty || this.variables.dirty);
  }
  selectedTemplate() {
    return this.templates().find((template) => template.code === this.form.controls.template.value);
  }
  changeMessage() {
    this.savedVariables = {};
    this.additionalNames = [];
    this.form.controls.template.setValue('');
    this.names.set([]);
    for (const name of Object.keys(this.variables.controls))
      this.variables.removeControl(name, { emitEvent: false });
    this.messagePreview.set(null);
  }
  syncVariables() {
    const template = this.selectedTemplate();
    if (!template) {
      this.messagePreview.set(null);
      return;
    }
    this.names.set(
      syncMessageVariables(this.variables, template, this.savedVariables, this.additionalNames),
    );
    this.savedVariables = {};
    if (!this.auth.admin()) this.variables.disable({ emitEvent: false });
    this.messagePreview.set(
      localPreview(template.subject ?? '', template.content ?? '', this.variables.getRawValue()),
    );
  }
  save() {
    if (!this.auth.admin() || this.saving()) return;
    this.form.markAllAsTouched();
    this.variables.markAllAsTouched();
    if (
      this.form.invalid ||
      this.variables.invalid ||
      this.recurrenceError() ||
      this.templatesLoading() ||
      !this.selectedTemplate()
    ) {
      this.saveError.set('Confira os campos destacados e selecione um template disponível.');
      focusInvalidField('schedule-form');
      return;
    }
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
        variables: this.variables.getRawValue(),
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
          this.variables.markAsPristine();
          this.toast.show('Agendamento salvo.');
          void this.router.navigate(['/schedules']);
        },
        error: (error) => this.saveError.set(this.toast.message(error)),
      });
  }
}
