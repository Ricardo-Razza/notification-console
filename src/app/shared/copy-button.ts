import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Clipboard } from '@angular/cdk/clipboard';
import { MatButtonModule } from '@angular/material/button';
import { Toast } from './toast';
@Component({
  selector: 'app-copy-button',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<button mat-stroked-button type="button" (click)="copy()" [attr.aria-label]="label()">Copiar</button>',
})
export class CopyButton {
  readonly value = input.required<string>();
  readonly label = input('Copiar texto');
  private readonly clipboard = inject(Clipboard);
  private readonly toast = inject(Toast);
  copy() {
    this.toast.show(
      this.clipboard.copy(this.value())
        ? 'Copiado.'
        : 'Não foi possível copiar. Selecione e copie o texto.',
    );
  }
}
