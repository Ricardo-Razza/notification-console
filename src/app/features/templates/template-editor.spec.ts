import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, convertToParamMap } from '@angular/router';
import { signal } from '@angular/core';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { TemplateEditor } from './template-editor';
import { ConsoleApi } from '../../core/api/console-api';
import { AuthStore } from '../../core/auth/auth-store';
import { Toast } from '../../shared/toast';
import { ApiError } from '../../core/http/api-error';
describe('Template editor', () => {
  const admin = signal(true);
  const preview = vi.fn(() => of({ content: 'Preview' }));
  const createTemplate = vi.fn(() => of({ id: 'template' }));
  beforeEach(() => {
    admin.set(true);
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      imports: [TemplateEditor],
      providers: [
        provideRouter([]),
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({}) } } },
        { provide: ConsoleApi, useValue: { applications: () => of([]), preview, createTemplate } },
        { provide: AuthStore, useValue: { admin } },
        { provide: Toast, useValue: { show: vi.fn(), message: () => 'Validation error' } },
      ],
    });
  });
  afterEach(() => vi.useRealTimers());
  it('debounces preview and generates distinct example controls', async () => {
    vi.useFakeTimers();
    const fixture = TestBed.createComponent(TemplateEditor);
    const editor = fixture.componentInstance;
    editor.form.patchValue({ content: '{{ name }} {{name}} {{today}}' });
    expect(editor.names()).toEqual(['name', 'today']);
    expect(Object.keys(editor.examples.controls)).toEqual(['name']);
    await vi.advanceTimersByTimeAsync(399);
    expect(preview).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(preview).toHaveBeenCalledTimes(1);
    fixture.destroy();
  });
  it('marks server field errors and retains unsaved changes', () => {
    createTemplate.mockImplementationOnce(() =>
      throwError(() => new ApiError(400, 'Invalid', 'Invalid', { content: 'Content invalid' })),
    );
    const editor = TestBed.createComponent(TemplateEditor).componentInstance;
    editor.form.patchValue({ code: 'TEST', subject: 'Test', content: 'Test' });
    editor.form.markAsDirty();
    editor.save();
    expect(editor.form.controls.content.getError('server')).toBe('Content invalid');
    expect(editor.hasUnsavedChanges()).toBe(true);
  });
  it('prevents VIEWER from saving', () => {
    admin.set(false);
    const editor = TestBed.createComponent(TemplateEditor).componentInstance;
    editor.form.patchValue({ code: 'TEST', subject: 'Test', content: 'Test' });
    editor.save();
    expect(createTemplate).not.toHaveBeenCalled();
    expect(editor.hasUnsavedChanges()).toBe(false);
  });
});
