import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';
@Injectable({ providedIn: 'root' })
export class NotificationEvents {
  readonly changed = new Subject<void>();
}
