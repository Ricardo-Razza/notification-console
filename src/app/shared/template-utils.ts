import type { Preview } from '../core/api/models';
export function detectVariables(...texts: string[]): string[] {
  return [
    ...new Set(
      texts.flatMap((text) => [...text.matchAll(/{{\s*(\w+)\s*}}/g)].map((match) => match[1])),
    ),
  ].sort();
}
export function localPreview(
  subject: string,
  content: string,
  values: Record<string, string>,
): Preview {
  const now = new Date();
  const variables = { today: now.toISOString().slice(0, 10), now: now.toISOString(), ...values };
  const names = detectVariables(subject, content);
  const missingVariables = names.filter(
    (name) => !(name in variables) || !variables[name as keyof typeof variables],
  );
  const render = (text: string) =>
    text.replace(
      /{{\s*(\w+)\s*}}/g,
      (match: string, name: string) => variables[name as keyof typeof variables] ?? match,
    );
  return { subject: render(subject), content: render(content), variables: names, missingVariables };
}
export function readVariables(json: string): Record<string, string> {
  const value: unknown = JSON.parse(json || '{}');
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Use um objeto JSON com valores de texto.');
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string') throw new Error('Os valores das variáveis devem ser texto.');
    if (key.length > 64 || item.length > 2000)
      throw new Error('Uma variável excede o tamanho permitido.');
    result[key] = item;
  }
  if (Object.keys(result).length > 50) throw new Error('Use no máximo 50 variáveis.');
  return result;
}
