import { ChangeDetectionStrategy, Component } from '@angular/core';
import { StatusBadge, STATUS_INFO } from './status-badge';
import { EmptyState, ErrorState, Loading } from './states';
import type { NotificationStatus } from '../core/api/models';
@Component({
  selector: 'app-ui-gallery',
  imports: [StatusBadge, EmptyState, ErrorState, Loading],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template:
    '<h1>Componentes e estados</h1>@for (status of statuses; track status) {<app-status-badge [status]="status" />}<app-loading /><app-empty-state /><app-error-state />',
})
export class UiGallery {
  readonly statuses = Object.keys(STATUS_INFO) as NotificationStatus[];
}
