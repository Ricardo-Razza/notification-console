import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { NotificationStatus } from '../core/api/models';
export const STATUS_INFO: Record<
  NotificationStatus,
  { label: string; icon: string; tone: string }
> = {
  SCHEDULED: { label: 'Agendada', icon: '◷', tone: 'blue' },
  PENDING: { label: 'Pendente', icon: '◌', tone: 'gray' },
  QUEUED: { label: 'Na fila', icon: '≋', tone: 'purple' },
  PROCESSING: { label: 'Processando', icon: '↻', tone: 'blue' },
  SENT: { label: 'Enviada', icon: '✓', tone: 'green' },
  FAILED: { label: 'Falhou', icon: '!', tone: 'red' },
  CANCELED: { label: 'Cancelada', icon: '−', tone: 'gray' },
};
@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<span class="badge" [class]="\'badge \' + info().tone"><span aria-hidden="true">{{ info().icon }}</span> {{ info().label }}</span>',
})
export class StatusBadge {
  readonly status = input<NotificationStatus | undefined>();
  readonly info = computed(() => STATUS_INFO[this.status() ?? 'PENDING']);
}
