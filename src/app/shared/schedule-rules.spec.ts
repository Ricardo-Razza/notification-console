import {
  recurrenceCron,
  parseRecurrence,
  recurrenceDescription,
  type Recurrence,
} from './schedule-rules';
describe('Guided recurrence', () => {
  const base: Recurrence = { frequency: 'daily', time: '09:35', weekday: 'WED', monthDay: 31 };
  it('round trips each supported frequency without changing execution time', () => {
    for (const frequency of ['daily', 'weekdays', 'weekly', 'monthly', 'hourly'] as const) {
      const cron = recurrenceCron({ ...base, frequency });
      expect(recurrenceCron(parseRecurrence(cron))).toBe(cron);
    }
    expect(recurrenceDescription('0 35 9 * * WED')).toBe('Quarta-feira às 09:35');
    expect(recurrenceCron({ ...base, frequency: 'monthly' })).toBe('0 35 9 31 * *');
  });
  it('keeps advanced cron expressions in custom mode', () => {
    for (const cron of [
      '0 */5 * * * *',
      '0 0 8 L * *',
      '15 0 8 * * *',
      '0 0 8 * * 2',
      '0 0 8 * JAN *',
    ])
      expect(parseRecurrence(cron).frequency).toBe('custom');
  });
  it('rejects invalid input instead of quietly using an earlier valid time', () => {
    expect(recurrenceCron({ ...base, frequency: 'hourly', time: '' })).toBe('0 0 * * * *');
    expect(() => recurrenceCron({ ...base, time: '' })).toThrow();
    expect(() => recurrenceCron({ ...base, time: '24:00' })).toThrow();
    expect(() => recurrenceCron({ ...base, frequency: 'monthly', monthDay: 32 })).toThrow();
    expect(() => recurrenceCron({ ...base, frequency: 'weekly', weekday: 'UNKNOWN' })).toThrow();
  });
});
