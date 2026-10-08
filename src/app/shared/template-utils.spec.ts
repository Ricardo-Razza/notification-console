import { detectVariables, localPreview, readVariables } from './template-utils';
import { localDateTimeToUtc, describeCron, CRON_PRESETS } from './time-utils';
describe('Template and scheduling rules', () => {
  it('detects spaced, repeated and system variables without accepting malformed names', () => {
    expect(detectVariables('{{ name }} {{name}} {{today}} {{not-valid}}', '{{other}}')).toEqual([
      'name',
      'other',
      'today',
    ]);
  });
  it('keeps unfilled placeholders and treats markup as text', () => {
    const value = localPreview('Hello {{ name }}', '<script>{{missing}}</script>', {
      name: '<b>R</b>',
    });
    expect(value.subject).toBe('Hello <b>R</b>');
    expect(value.content).toBe('<script>{{missing}}</script>');
    expect(value.missingVariables).toEqual(['missing']);
  });
  it('rejects variable arrays and non-string values', () => {
    expect(() => readVariables('[]')).toThrow();
    expect(() => readVariables('{"a":1}')).toThrow();
    expect(readVariables('{"name":"R"}')).toEqual({ name: 'R' });
  });
  it('converts selected IANA time into UTC', () => {
    expect(localDateTimeToUtc('2026-10-08T08:00', 'America/Sao_Paulo')).toBe(
      '2026-10-08T11:00:00.000Z',
    );
  });
  it('rejects invalid dates, DST gaps and ambiguous times', () => {
    expect(() => localDateTimeToUtc('2026-02-30T08:00', 'UTC')).toThrow();
    expect(() => localDateTimeToUtc('2026-03-08T02:30', 'America/New_York')).toThrow(/não existe/);
    expect(() => localDateTimeToUtc('2026-11-01T01:30', 'America/New_York')).toThrow(/duas vezes/);
  });
  it('describes every cron preset', () => {
    for (const preset of CRON_PRESETS) expect(describeCron(preset.value)).toBe(preset.label);
    expect(describeCron('0 15 * * * *')).toContain('0 15');
  });
});
