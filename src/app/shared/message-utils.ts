import { HttpParams } from '@angular/common/http';
import { FormControl, FormRecord, Validators } from '@angular/forms';
import { EMPTY, expand, forkJoin, map, reduce } from 'rxjs';
import { ConsoleApi } from '../core/api/console-api';
import type { Channel, Template } from '../core/api/models';
import { detectVariables } from './template-utils';

export function visibleTemplates(api: ConsoleApi, applicationId: string, channel: Channel) {
  const allPages = (params: HttpParams) =>
    api.templates(params.set('size', 100).set('page', 0)).pipe(
      expand((page, index) =>
        (index + 1) * 100 < (page.totalElements ?? 0)
          ? api.templates(params.set('size', 100).set('page', index + 1))
          : EMPTY,
      ),
      reduce((items: Template[], page) => [...items, ...(page.items ?? [])], []),
    );
  return forkJoin([
    allPages(new HttpParams().set('scope', 'GLOBAL').set('channel', channel)),
    allPages(new HttpParams().set('applicationId', applicationId).set('channel', channel)),
  ]).pipe(
    map(([global, own]) => {
      const visible = new Map<string, Template>();
      for (const item of [...global, ...own]) if (item.code) visible.set(item.code, item);
      return [...visible.values()].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''));
    }),
  );
}
export function syncMessageVariables(
  form: FormRecord<FormControl<string>>,
  template?: Template,
  values?: Record<string, string>,
  additionalNames: string[] = [],
) {
  const names = [
    ...new Set([
      ...detectVariables(template?.subject ?? '', template?.content ?? ''),
      ...additionalNames,
    ]),
  ].filter((name) => name !== 'today' && name !== 'now');
  for (const name of Object.keys(form.controls))
    if (!names.includes(name)) form.removeControl(name, { emitEvent: false });
  for (const name of names) {
    if (!form.contains(name))
      form.addControl(
        name,
        new FormControl(values?.[name] ?? '', {
          nonNullable: true,
          validators: [Validators.required, Validators.maxLength(2000)],
        }),
        { emitEvent: false },
      );
    else if (values?.[name] !== undefined)
      form.controls[name].setValue(values[name], { emitEvent: false });
  }
  return names;
}
export function focusInvalidField(formId: string) {
  queueMicrotask(() =>
    document
      .getElementById(formId)
      ?.querySelector<HTMLElement>('input.ng-invalid, textarea.ng-invalid, mat-select.ng-invalid')
      ?.focus(),
  );
}
export function messageFieldLabel(name: string) {
  const labels: Record<string, string> = {
    name: 'Nome',
    nome: 'Nome',
    email: 'E-mail',
    link: 'Link',
    url: 'Link',
    code: 'Código',
    codigo: 'Código',
    message: 'Mensagem',
    mensagem: 'Mensagem',
  };
  return labels[name] ?? name.replace(/_/g, ' ').replace(/^./, (letter) => letter.toUpperCase());
}
export function messageFieldExample(name: string) {
  const examples: Record<string, string> = {
    name: 'Ex.: Maria',
    nome: 'Ex.: Maria',
    email: 'Ex.: maria@exemplo.com',
    link: 'Ex.: https://seusite.com/novidades',
    url: 'Ex.: https://seusite.com/novidades',
    code: 'Ex.: 123456',
    codigo: 'Ex.: 123456',
  };
  return examples[name] ?? 'Digite o texto que aparecerá na mensagem';
}
