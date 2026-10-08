import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { Dashboard } from './dashboard';
import { ConsoleApi } from '../../core/api/console-api';
import { Toast } from '../../shared/toast';
describe('Dashboard polling', () => {
  const stats = vi.fn(() => of({ total: 0, sent: 0, failed: 0, series: [] }));
  const queues = vi.fn(() => of([]));
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    TestBed.configureTestingModule({
      imports: [Dashboard],
      providers: [
        provideRouter([]),
        {
          provide: ActivatedRoute,
          useValue: { queryParamMap: of(convertToParamMap({ period: '7d' })) },
        },
        { provide: ConsoleApi, useValue: { applications: () => of([]), stats, queues } },
        { provide: Toast, useValue: { message: () => 'Queue unavailable', error: vi.fn() } },
      ],
    });
  });
  afterEach(() => {
    vi.useRealTimers();
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
  });
  it('preserves statistics on queue failure and shows an independent error', async () => {
    queues.mockImplementationOnce(() => throwError(() => new Error('Unavailable')));
    const fixture = TestBed.createComponent(Dashboard);
    await vi.advanceTimersByTimeAsync(0);
    fixture.detectChanges();
    expect(fixture.componentInstance.stats()?.total).toBe(0);
    expect(fixture.componentInstance.queueError()).toBe('Queue unavailable');
    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'Ainda não há notificações',
    );
    fixture.destroy();
  });
  it('pauses polling while hidden and refreshes when visible', async () => {
    const fixture = TestBed.createComponent(Dashboard);
    await vi.advanceTimersByTimeAsync(0);
    expect(stats).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(60000);
    expect(stats).toHaveBeenCalledTimes(1);
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(stats).toHaveBeenCalledTimes(2);
    fixture.destroy();
  });
  it('restores period and updates query parameters', () => {
    const fixture = TestBed.createComponent(Dashboard);
    expect(fixture.componentInstance.period()).toBe('7d');
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture.componentInstance.setPeriod('30d');
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { period: '30d' }, queryParamsHandling: 'merge' }),
    );
    fixture.destroy();
  });
});
