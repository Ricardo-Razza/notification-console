import { FormControl, FormRecord } from '@angular/forms';
import { HttpParams } from '@angular/common/http';
import { of, firstValueFrom } from 'rxjs';
import { vi } from 'vitest';
import { ConsoleApi } from '../core/api/console-api';
import { syncMessageVariables, visibleTemplates } from './message-utils';
describe('Guided message data', () => {
  it('restores saved values and keeps user edits while updating the preview', () => {
    const form = new FormRecord<FormControl<string>>({});
    const template = { subject: '{{nome}}', content: '{{nome}} {{link}} {{today}} {{now}}' };
    expect(
      syncMessageVariables(form, template, { nome: 'Maria', link: 'https://example.test' }),
    ).toEqual(['link', 'nome']);
    form.controls['nome'].setValue('Ana');
    syncMessageVariables(form, template);
    expect(form.getRawValue()['nome']).toBe('Ana');
    expect(form.valid).toBe(true);
    syncMessageVariables(form, { content: '{{novo}}' });
    expect(form.getRawValue()).toEqual({ novo: '' });
    expect(form.invalid).toBe(true);
  });
  it('loads every page and gives the application template priority over a global one', async () => {
    const templates = vi.fn((params: HttpParams) => {
      const global = params.get('scope') === 'GLOBAL';
      const second = params.get('page') === '1';
      return of({
        totalElements: global ? 101 : 1,
        items: global
          ? second
            ? [{ code: 'LAST', content: 'Last page' }]
            : [{ code: 'WELCOME', content: 'Global' }]
          : [{ code: 'WELCOME', content: 'Application' }],
      });
    });
    const api = { templates } as unknown as ConsoleApi;
    const result = await firstValueFrom(visibleTemplates(api, 'app', 'EMAIL'));
    expect(result.map((item) => item.code)).toEqual(['LAST', 'WELCOME']);
    expect(result.find((item) => item.code === 'WELCOME')?.content).toBe('Application');
    expect(templates).toHaveBeenCalledTimes(3);
  });
});
