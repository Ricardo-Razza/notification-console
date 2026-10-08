import { Component } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatDialog } from '@angular/material/dialog';
import { ConfirmDialog } from './confirm-dialog';
@Component({ template: '' })
class DialogHost {}
describe('Confirmation dialog', () => {
  beforeEach(() => TestBed.configureTestingModule({ imports: [DialogHost] }));
  it('returns true after keyboard-accessible confirm', async () => {
    const host = TestBed.createComponent(DialogHost);
    const ref = TestBed.inject(MatDialog).open(ConfirmDialog, { data: 'Confirm test action' });
    const result = firstValueFrom(ref.afterClosed());
    const loader = TestbedHarnessEnvironment.documentRootLoader(host);
    const button = await loader.getHarness(MatButtonHarness.with({ text: 'Confirmar' }));
    await button.click();
    await host.whenStable();
    expect(await result).toBe(true);
  });
  it('returns false when canceled', async () => {
    const host = TestBed.createComponent(DialogHost);
    const ref = TestBed.inject(MatDialog).open(ConfirmDialog, { data: 'Confirm test action' });
    const result = firstValueFrom(ref.afterClosed());
    const loader = TestbedHarnessEnvironment.documentRootLoader(host);
    const button = await loader.getHarness(MatButtonHarness.with({ text: 'Voltar' }));
    await button.click();
    await host.whenStable();
    expect(await result).toBe(false);
  });
});
