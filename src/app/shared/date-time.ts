import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatTooltipModule } from '@angular/material/tooltip';
@Component({
  selector: 'app-date-time',
  imports: [DatePipe, MatTooltipModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    "<time [attr.datetime]=\"value()\" [matTooltip]=\"value() ? value() + ' (UTC)' : 'Sem data'\">{{ value() ? (value() | date:'dd/MM/yyyy HH:mm') : '—' }} @if (showZone()) { <small>{{ zone }}</small> }</time>",
})
export class DateTime {
  readonly value = input<string | undefined>();
  readonly showZone = input(false);
  readonly zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
}
