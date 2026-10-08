import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector: 'app-not-found',
  imports: [RouterLink, MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<section class="state"><p class="eyebrow">404</p><h1>Página não encontrada</h1><p>Confira o endereço ou volte para a visão geral.</p><a mat-flat-button routerLink="/dashboard">Voltar à visão geral</a></section>',
})
export class NotFound {}
