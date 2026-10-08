import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { Clipboard } from '@angular/cdk/clipboard';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ConsoleApi } from '../../core/api/console-api';
import { Toast } from '../../shared/toast';
type KeyCommand = { name: string; id?: never } | { id: string; name?: never };
@Component({
  selector: 'app-key-dialog',
  imports: [MatDialogModule, MatButtonModule, MatCheckboxModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<h2 mat-dialog-title>
      {{ command.id ? 'Nova chave da aplicação' : 'Aplicação criada' }}
    </h2>
    <mat-dialog-content>
      <p class="form-note">Guarde agora. Não será possível ver esta chave de novo.</p>
      @if (key()) {
        <pre aria-label="Chave da aplicação">{{ key() }}</pre>
        <button mat-stroked-button (click)="copy()">Copiar chave</button>
        <p aria-live="polite">{{ copied() ? 'Chave copiada.' : '' }}</p>
        <mat-checkbox [checked]="acknowledged()" (change)="acknowledged.set($event.checked)"
          >Confirmei que guardei a chave em um local seguro</mat-checkbox
        >
      } @else if (error()) {
        <p role="alert">{{ error() }}</p>
      } @else {
        <p role="status">Gerando chave…</p>
      }</mat-dialog-content
    ><mat-dialog-actions align="end"
      ><button mat-flat-button [disabled]="!error() && !acknowledged()" (click)="close()">
        Concluir
      </button></mat-dialog-actions
    >`,
})
export class KeyDialog {
  readonly command = inject<KeyCommand>(MAT_DIALOG_DATA);
  private readonly api = inject(ConsoleApi);
  private readonly ref = inject(MatDialogRef<KeyDialog>);
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(Toast);
  private readonly destroy = inject(DestroyRef);
  readonly key = signal('');
  readonly copied = signal(false);
  readonly acknowledged = signal(false);
  readonly error = signal('');
  constructor() {
    const operation = this.command.id
      ? this.api.rotateKey(this.command.id)
      : this.api.createApplication(this.command.name ?? '');
    operation.pipe(takeUntilDestroyed(this.destroy)).subscribe({
      next: (value) => {
        this.key.set(value.apiKey ?? '');
        if (!value.apiKey) this.error.set('A resposta não incluiu a chave.');
      },
      error: (error) => this.error.set(this.toast.message(error)),
    });
    this.destroy.onDestroy(() => this.key.set(''));
  }
  copy() {
    this.copied.set(this.clipboard.copy(this.key()));
  }
  close() {
    this.key.set('');
    this.ref.close(true);
  }
}
