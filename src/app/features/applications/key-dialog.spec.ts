import { TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Clipboard } from '@angular/cdk/clipboard';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { KeyDialog } from './key-dialog';
import { ConsoleApi } from '../../core/api/console-api';
import { Toast } from '../../shared/toast';
describe('One-time application key', () => {
  it('creates inside the dialog and erases the local signal on close and destroy', () => {
    const api = { createApplication: vi.fn(() => of({ apiKey: 'one-time-test-key' })) };
    const close = vi.fn();
    TestBed.configureTestingModule({
      imports: [KeyDialog],
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: { name: 'Test' } },
        { provide: MatDialogRef, useValue: { close } },
        { provide: ConsoleApi, useValue: api },
        { provide: Clipboard, useValue: { copy: vi.fn(() => true) } },
        { provide: Toast, useValue: { message: () => '' } },
      ],
    });
    const fixture = TestBed.createComponent(KeyDialog);
    fixture.detectChanges();
    const dialog = fixture.componentInstance;
    expect(dialog.key()).toBe('one-time-test-key');
    expect(Object.keys(api)).toEqual(['createApplication']);
    expect(fixture.nativeElement.querySelector('mat-dialog-actions button').disabled).toBe(true);
    dialog.copy();
    dialog.acknowledged.set(true);
    dialog.close();
    expect(dialog.key()).toBe('');
    expect(close).toHaveBeenCalledWith(true);
    fixture.destroy();
    expect(dialog.key()).toBe('');
  });
});
