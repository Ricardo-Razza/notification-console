export type Frequency = 'daily' | 'weekdays' | 'weekly' | 'monthly' | 'hourly' | 'custom';
export const WEEKDAYS = [
  { value: 'MON', label: 'Segunda-feira' },
  { value: 'TUE', label: 'Terça-feira' },
  { value: 'WED', label: 'Quarta-feira' },
  { value: 'THU', label: 'Quinta-feira' },
  { value: 'FRI', label: 'Sexta-feira' },
  { value: 'SAT', label: 'Sábado' },
  { value: 'SUN', label: 'Domingo' },
];
export interface Recurrence {
  frequency: Frequency;
  time: string;
  weekday: string;
  monthDay: number;
}
export function recurrenceCron(value: Recurrence): string {
  if (value.frequency === 'hourly') return '0 0 * * * *';
  const match = /^(\d{2}):(\d{2})$/.exec(value.time);
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59)
    throw new Error('Escolha um horário válido.');
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  switch (value.frequency) {
    case 'daily':
      return `0 ${minute} ${hour} * * *`;
    case 'weekdays':
      return `0 ${minute} ${hour} * * MON-FRI`;
    case 'weekly':
      if (!WEEKDAYS.some((day) => day.value === value.weekday))
        throw new Error('Escolha um dia da semana.');
      return `0 ${minute} ${hour} * * ${value.weekday}`;
    case 'monthly':
      if (!Number.isInteger(value.monthDay) || value.monthDay < 1 || value.monthDay > 31)
        throw new Error('Escolha um dia entre 1 e 31.');
      return `0 ${minute} ${hour} ${value.monthDay} * *`;
    default:
      throw new Error('Use a expressão avançada para esta frequência.');
  }
}
export function parseRecurrence(cron: string): Recurrence {
  const result: Recurrence = { frequency: 'custom', time: '08:00', weekday: 'MON', monthDay: 1 };
  if (cron === '0 0 * * * *') return { ...result, frequency: 'hourly' };
  const fields = cron.trim().split(/\s+/);
  if (
    fields.length !== 6 ||
    fields[0] !== '0' ||
    !/^\d+$/.test(fields[1]) ||
    !/^\d+$/.test(fields[2]) ||
    Number(fields[1]) > 59 ||
    Number(fields[2]) > 23 ||
    fields[4] !== '*'
  )
    return result;
  result.time = fields[2].padStart(2, '0') + ':' + fields[1].padStart(2, '0');
  if (fields[3] === '*') {
    if (fields[5] === '*') result.frequency = 'daily';
    else if (fields[5] === 'MON-FRI') result.frequency = 'weekdays';
    else if (WEEKDAYS.some((day) => day.value === fields[5])) {
      result.frequency = 'weekly';
      result.weekday = fields[5];
    }
  } else if (
    /^\d+$/.test(fields[3]) &&
    Number(fields[3]) >= 1 &&
    Number(fields[3]) <= 31 &&
    fields[5] === '*'
  ) {
    result.frequency = 'monthly';
    result.monthDay = Number(fields[3]);
  }
  return result;
}
export function recurrenceDescription(cron: string): string {
  const value = parseRecurrence(cron);
  switch (value.frequency) {
    case 'daily':
      return `Todos os dias às ${value.time}`;
    case 'weekdays':
      return `De segunda a sexta às ${value.time}`;
    case 'weekly':
      return `${WEEKDAYS.find((day) => day.value === value.weekday)?.label} às ${value.time}`;
    case 'monthly':
      return `Todo mês, dia ${value.monthDay}, às ${value.time}`;
    case 'hourly':
      return 'A cada hora, no início da hora';
    default:
      return 'Frequência personalizada: ' + cron;
  }
}
