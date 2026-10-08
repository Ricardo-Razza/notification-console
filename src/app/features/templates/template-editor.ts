import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  FormBuilder,
  FormRecord,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule, MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap, of, catchError, merge, finalize } from 'rxjs';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import type { Application, Channel, Preview } from '../../core/api/models';
import { ApiError } from '../../core/http/api-error';
import { Toast } from '../../shared/toast';
import { Loading, ErrorState } from '../../shared/states';
import { detectVariables, localPreview } from '../../shared/template-utils';
import {
  messageFieldLabel,
  messageFieldExample,
  focusInvalidField,
} from '../../shared/message-utils';
@Component({
  selector: 'app-template-editor',
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
    Loading,
    ErrorState,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-editor.html',
})
export class TemplateEditor {
  private readonly api = inject(ConsoleApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly destroy = inject(DestroyRef);
  private readonly toast = inject(Toast);
  readonly auth = inject(AuthStore);
  readonly id = this.route.snapshot.paramMap.get('id');
  readonly apps = signal<Application[]>([]);
  readonly names = signal<string[]>([]);
  readonly preview = signal<Preview | null>(null);
  readonly previewError = signal('');
  readonly loadError = signal('');
  readonly saveError = signal('');
  readonly busy = signal(!!this.id);
  readonly saving = signal(false);
  readonly fieldLabel = messageFieldLabel;
  readonly fieldExample = messageFieldExample;
  readonly variableName = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.pattern(/^\w{1,64}$/)],
  });
  readonly insertionField = signal<'subject' | 'content'>('content');
  private insertionStart = 0;
  private insertionEnd = 0;
  readonly starters = [
    {
      label: 'Boas-vindas',
      code: 'BOAS_VINDAS',
      subject: 'Boas-vindas, {{nome}}!',
      content:
        'Olá, {{nome}}!\n\nÉ um prazer ter você por aqui. Sua conta está pronta para usar.\n\nAté logo!',
    },
    {
      label: 'Lembrete',
      code: 'LEMBRETE',
      subject: 'Lembrete: {{titulo}}',
      content:
        'Olá, {{nome}}!\n\nPassando para lembrar: {{titulo}}.\nData: {{data}}\n\nSe precisar de ajuda, entre em contato.',
    },
    {
      label: 'Aviso de novidade',
      code: 'NOVIDADE',
      subject: '{{titulo}}',
      content: 'Olá, {{nome}}!\n\n{{mensagem}}\n\nSaiba mais: {{link}}',
    },
  ];
  readonly form = inject(FormBuilder).nonNullable.group({
    code: [
      '',
      [Validators.required, Validators.pattern(/^[A-Z0-9_]+$/), Validators.maxLength(100)],
    ],
    channel: ['EMAIL' as Channel, Validators.required],
    applicationId: [''],
    subject: ['', Validators.maxLength(255)],
    content: ['', [Validators.required, Validators.maxLength(50000)]],
  });
  readonly examples = new FormRecord<FormControl<string>>({});
  constructor() {
    this.api
      .applications()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({
        next: (apps) => this.apps.set(apps),
        error: (error) => this.toast.error(error),
      });
    this.form.controls.channel.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.validateSubject());
    this.form.valueChanges
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe(() => this.syncVariables());
    merge(this.form.valueChanges, this.examples.valueChanges)
      .pipe(
        debounceTime(400),
        switchMap(() => {
          const value = this.form.getRawValue();
          this.previewError.set('');
          return this.auth.admin()
            ? this.api
                .preview({
                  subject: value.subject,
                  content: value.content,
                  variables: this.examples.getRawValue(),
                })
                .pipe(
                  catchError((error) => {
                    this.previewError.set(this.toast.message(error));
                    return of(null);
                  }),
                )
            : of(localPreview(value.subject, value.content, this.examples.getRawValue()));
        }),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe((result) => this.preview.set(result));
    this.validateSubject();
    if (this.id) this.load();
  }
  load() {
    if (!this.id) return;
    this.busy.set(true);
    this.loadError.set('');
    this.api
      .template(this.id)
      .pipe(
        finalize(() => this.busy.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: (item) => {
          this.form.patchValue({
            code: item.code ?? '',
            channel: item.channel ?? 'EMAIL',
            applicationId: item.applicationId ?? '',
            subject: item.subject ?? '',
            content: item.content ?? '',
          });
          if (this.auth.admin()) {
            this.form.controls.code.disable();
            this.form.controls.channel.disable();
            this.form.controls.applicationId.disable();
          } else this.form.disable();
          this.form.markAsPristine();
          this.syncVariables();
        },
        error: (error) => this.loadError.set(this.toast.message(error)),
      });
  }
  syncVariables() {
    const value = this.form.getRawValue();
    const names = detectVariables(value.subject, value.content);
    this.names.set(names);
    for (const name of Object.keys(this.examples.controls))
      if (!names.includes(name)) this.examples.removeControl(name, { emitEvent: false });
    for (const name of names)
      if (name !== 'today' && name !== 'now' && !this.examples.contains(name))
        this.examples.addControl(
          name,
          new FormControl('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
          { emitEvent: false },
        );
  }
  validateSubject() {
    this.form.controls.subject.setValidators(
      this.form.controls.channel.value === 'EMAIL'
        ? [Validators.required, Validators.maxLength(255)]
        : [Validators.maxLength(255)],
    );
    this.form.controls.subject.updateValueAndValidity({ emitEvent: false });
  }
  fieldError(name: keyof typeof this.form.controls) {
    return this.form.controls[name].getError('server') as string | undefined;
  }
  normalizeCode() {
    if (this.id) return;
    this.form.controls.code.setValue(
      this.form.controls.code.value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, ''),
    );
  }
  useStarter(index: number) {
    if (!this.auth.admin() || this.id || this.form.controls.content.value) return;
    const starter = this.starters[index];
    if (!starter) return;
    this.form.patchValue({
      code: this.form.controls.code.value || starter.code,
      subject: starter.subject,
      content: starter.content,
    });
    this.form.markAsDirty();
  }
  rememberCursor(field: 'subject' | 'content', element: HTMLInputElement | HTMLTextAreaElement) {
    this.insertionField.set(field);
    this.insertionStart = element.selectionStart ?? element.value.length;
    this.insertionEnd = element.selectionEnd ?? element.value.length;
  }
  insertVariable(name = this.variableName.value) {
    if (!this.auth.admin() || !/^\w{1,64}$/.test(name)) {
      this.variableName.markAsTouched();
      return;
    }
    const control = this.form.controls[this.insertionField()];
    const text = control.value;
    const start = Math.min(this.insertionStart, text.length);
    const end = Math.min(this.insertionEnd, text.length);
    const token = '{{' + name + '}}';
    control.setValue(text.slice(0, start) + token + text.slice(end));
    this.insertionStart = this.insertionEnd = start + token.length;
    control.markAsDirty();
    this.variableName.reset('');
  }
  hasUnsavedChanges() {
    return this.auth.admin() && this.form.dirty;
  }
  save() {
    if (!this.auth.admin() || this.saving()) return;
    this.normalizeCode();
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.saveError.set('Confira os campos destacados antes de salvar.');
      focusInvalidField('template-form');
      return;
    }
    const value = this.form.getRawValue();
    this.saving.set(true);
    this.saveError.set('');
    const operation = this.id
      ? this.api.updateTemplate(this.id, { subject: value.subject, content: value.content })
      : this.api.createTemplate({ ...value, applicationId: value.applicationId || undefined });
    operation
      .pipe(
        finalize(() => this.saving.set(false)),
        takeUntilDestroyed(this.destroy),
      )
      .subscribe({
        next: () => {
          this.form.markAsPristine();
          this.toast.show('Template salvo.');
          void this.router.navigate(['/templates']);
        },
        error: (error) => {
          this.saveError.set(this.toast.message(error));
          if (error instanceof ApiError)
            for (const [name, message] of Object.entries(error.fields)) {
              if (name in this.form.controls)
                this.form.controls[name as keyof typeof this.form.controls].setErrors({
                  server: message,
                });
            }
        },
      });
  }
}
