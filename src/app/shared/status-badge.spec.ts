import { TestBed } from '@angular/core/testing';
import { StatusBadge, STATUS_INFO } from './status-badge';
import type { NotificationStatus } from '../core/api/models';
describe('Status badge', () => {
  it('provides visible text and a symbol for every status', () => {
    TestBed.configureTestingModule({ imports: [StatusBadge] });
    const fixture = TestBed.createComponent(StatusBadge);
    for (const status of Object.keys(STATUS_INFO) as NotificationStatus[]) {
      fixture.componentRef.setInput('status', status);
      fixture.detectChanges();
      const text = (fixture.nativeElement as HTMLElement).textContent;
      expect(text).toContain(STATUS_INFO[status].label);
      expect(STATUS_INFO[status].icon).toBeTruthy();
    }
  });
});
