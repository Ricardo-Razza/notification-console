export const CRON_PRESETS = [
  { label: 'Todo dia às 8h', value: '0 0 8 * * *' },
  { label: 'De hora em hora', value: '0 0 * * * *' },
  { label: 'Dias úteis às 9h', value: '0 0 9 * * MON-FRI' },
  { label: 'Toda segunda às 8h', value: '0 0 8 * * MON' },
];
export function describeCron(cron: string): string {
  return CRON_PRESETS.find((item) => item.value === cron)?.label ?? 'Cron: ' + cron;
}
export function timeZones(): string[] {
  return [
    ...new Set([
      'UTC',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      ...Intl.supportedValuesOf('timeZone'),
    ]),
  ];
}
function wallTime(instant: number, zone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return (
    part('year') +
    '-' +
    part('month') +
    '-' +
    part('day') +
    'T' +
    part('hour') +
    ':' +
    part('minute')
  );
}
export function localDateTimeToUtc(value: string, zone: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))
    throw new Error('Informe uma data e hora válidas.');
  const base = Date.parse(value + 'Z');
  if (!Number.isFinite(base) || new Date(base).toISOString().slice(0, 16) !== value)
    throw new Error('Informe uma data e hora válidas.');
  const matches: number[] = [];
  // Probe every possible UTC offset in 15 minute increments, including DST overlaps.
  for (let offset = -14 * 60; offset <= 14 * 60; offset += 15) {
    const candidate = base + offset * 60000;
    if (wallTime(candidate, zone) === value) matches.push(candidate);
  }
  if (matches.length === 0)
    throw new Error('Este horário não existe nesse fuso por uma mudança de horário de verão.');
  if (matches.length > 1)
    throw new Error(
      'Este horário ocorre duas vezes nesse fuso. Escolha um horário fora da mudança de horário de verão.',
    );
  return new Date(matches[0]).toISOString();
}
