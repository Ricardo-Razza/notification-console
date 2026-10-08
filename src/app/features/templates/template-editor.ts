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
import { MatFormFieldModule } from '@angular/material/form-field';
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
@Component({
  selector: 'app-template-editor',
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
  template: `<header class="page-header">
      <div>
        <p class="eyebrow">CONTEÚDO</p>
        <h1 id="page-title" tabindex="-1">{{ id ? 'Template' : 'Novo template' }}</h1>
        <p class="muted">
          {{
            auth.admin()
              ? 'Edite a mensagem e confira o resultado antes de salvar.'
              : 'Consulta do template e prévia de exemplo.'
          }}
        </p>
      </div>
      <a mat-button routerLink="/templates">Voltar</a>
    </header>
    @if (busy()) {
      <app-loading />
    } @else if (loadError()) {
      <app-error-state [message]="loadError()" (retry)="load()" />
    } @else {
      <div class="two-column">
        <section class="panel">
          <form [formGroup]="form" (ngSubmit)="save()">
            <div class="form-grid">
              <mat-form-field
                ><mat-label>Código</mat-label
                ><input matInput formControlName="code" maxlength="100" /><mat-error>{{
                  fieldError('code') || 'Use letras maiúsculas, números e underscore.'
                }}</mat-error></mat-form-field
              ><mat-form-field
                ><mat-label>Canal</mat-label
                ><mat-select formControlName="channel"
                  ><mat-option value="EMAIL">E-mail</mat-option
                  ><mat-option value="SMS">SMS</mat-option
                  ><mat-option value="PUSH">Push</mat-option></mat-select
                ></mat-form-field
              >
            </div>
            <mat-form-field
              ><mat-label>Escopo</mat-label
              ><mat-select formControlName="applicationId"
                ><mat-option value="">Global</mat-option>
                @for (app of apps(); track app.id) {
                  <mat-option [value]="app.id">{{ app.name }}</mat-option>
                }
              </mat-select></mat-form-field
            ><mat-form-field
              ><mat-label>Assunto</mat-label
              ><input matInput formControlName="subject" maxlength="255" /><mat-error>{{
                fieldError('subject') || 'Informe o assunto do e-mail.'
              }}</mat-error></mat-form-field
            ><mat-form-field
              ><mat-label>Conteúdo</mat-label
              ><textarea matInput formControlName="content" rows="12" maxlength="50000"></textarea
              ><mat-error>{{
                fieldError('content') || 'Informe o conteúdo.'
              }}</mat-error></mat-form-field
            >
            @if (saveError()) {
              <p role="alert" class="form-error">{{ saveError() }}</p>
            }
            @if (auth.admin()) {
              <button mat-flat-button [disabled]="form.invalid || saving()">
                {{ saving() ? 'Salvando…' : 'Salvar template' }}
              </button>
            }
          </form>
        </section>
        <section class="panel">
          <h2>Prévia ao vivo</h2>
          <p class="muted">Variáveis de sistema disponíveis: today e now.</p>
          <div class="chips">
            @for (name of names(); track name) {
              <span class="chip">{{ name }}</span>
            }
          </div>
          <form [formGroup]="examples">
            @for (name of names(); track name) {
              @if (name !== 'today' && name !== 'now') {
                <mat-form-field
                  ><mat-label>Exemplo: {{ name }}</mat-label
                  ><input matInput [formControlName]="name" maxlength="2000"
                /></mat-form-field>
              }
            }
          </form>
          @if (previewError()) {
            <p role="alert" class="form-error">{{ previewError() }}</p>
          }
          @if (preview(); as result) {
            @if (result.missingVariables?.length) {
              <p class="form-note" role="status">
                Faltam valores: {{ result.missingVariables.join(', ') }}
              </p>
            }
            <h3>{{ result.subject }}</h3>
            <pre>{{ result.content }}</pre>
          }
        </section>
      </div>
    }`,
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
  hasUnsavedChanges() {
    return this.auth.admin() && this.form.dirty;
  }
  save() {
    if (!this.auth.admin() || this.form.invalid) return;
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
