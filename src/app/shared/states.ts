import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
@Component({
  selector: 'app-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<div class="state" role="status"><span class="state-symbol" aria-hidden="true">◇</span><h3>{{ title() }}</h3><p>{{ detail() }}</p></div>',
})
export class EmptyState {
  readonly title = input('Nenhum registro encontrado');
  readonly detail = input('Os resultados aparecerão aqui.');
}
@Component({
  selector: 'app-error-state',
  imports: [MatButtonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<div class="state" role="alert"><h3>Não foi possível carregar</h3><p>{{ message() }}</p><button mat-stroked-button (click)="retry.emit()">Tentar de novo</button></div>',
})
export class ErrorState {
  readonly message = input('Tente novamente em instantes.');
  readonly retry = output<void>();
}
@Component({
  selector: 'app-loading',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<div class="loading" role="status" aria-label="Carregando dados"><span>Carregando…</span><div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div></div>',
})
export class Loading {}
