import { inject, Injectable, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
@Injectable({ providedIn: 'root' })
export class Theme {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(false);
  constructor() {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem('notification-console-theme');
    } catch {
      /* Storage can be disabled. */
    }
    this.dark.set(saved ? saved === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches);
    this.apply();
  }
  toggle() {
    this.dark.update((value) => !value);
    this.apply();
    try {
      localStorage.setItem('notification-console-theme', this.dark() ? 'dark' : 'light');
    } catch {
      /* Storage can be disabled. */
    }
  }
  private apply() {
    this.document.documentElement.setAttribute('data-theme', this.dark() ? 'dark' : 'light');
  }
}
