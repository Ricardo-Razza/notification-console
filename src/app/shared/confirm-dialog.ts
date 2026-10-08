import { ChangeDetectionStrategy, Component, inject, Injectable } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<h2 mat-dialog-title>Confirmar ação</h2><mat-dialog-content><p>{{ message }}</p></mat-dialog-content><mat-dialog-actions align="end"><button mat-button [mat-dialog-close]="false">Voltar</button><button mat-flat-button [mat-dialog-close]="true">Confirmar</button></mat-dialog-actions>',
})
export class ConfirmDialog {
  readonly message = inject<string>(MAT_DIALOG_DATA);
}
@Injectable({ providedIn: 'root' })
export class Confirm {
  private readonly dialog = inject(MatDialog);
  ask(message: string) {
    return this.dialog
      .open<ConfirmDialog, string, boolean>(ConfirmDialog, { data: message, width: '420px' })
      .afterClosed();
  }
}
