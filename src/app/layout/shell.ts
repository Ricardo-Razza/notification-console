import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';
import { BreakpointObserver } from '@angular/cdk/layout';
import { toSignal, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { map } from 'rxjs';
import { AuthStore } from '../core/auth/auth-store';
import { Theme } from '../shared/theme';
import { Toast } from '../shared/toast';
@Component({
  selector: 'app-shell',
  imports: [
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatMenuModule,
    MatButtonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: ` <a class="skip-link" href="#main-content">Pular para o conteúdo</a>
    <mat-sidenav-container class="shell">
      <mat-sidenav #nav [mode]="narrow() ? 'over' : 'side'" [opened]="!narrow()" class="sidebar">
        <a class="brand" routerLink="/dashboard"
          ><span class="brand-mark" aria-hidden="true">N</span
          ><span>Notification<small>Console</small></span></a
        >
        <p class="nav-caption">OPERAÇÃO</p>
        <mat-nav-list aria-label="Navegação principal">
          @for (item of links; track item.path) {
            @if (!item.admin || auth.admin()) {
              <a
                mat-list-item
                [routerLink]="item.path"
                routerLinkActive="nav-active"
                (click)="narrow() && nav.close()"
                ><span class="nav-symbol" aria-hidden="true">{{ item.icon }}</span
                >{{ item.label }}</a
              >
            }
          }
        </mat-nav-list>
        <div class="sidebar-note">
          <span class="live-dot" aria-hidden="true"></span> Sessão protegida<small
            >Operação no mesmo domínio</small
          >
        </div>
      </mat-sidenav>
      <mat-sidenav-content>
        <mat-toolbar class="topbar">
          @if (narrow()) {
            <button mat-icon-button aria-label="Abrir menu" (click)="nav.toggle()">☰</button>
          }
          <span class="topbar-title">Central de notificações</span><span class="spacer"></span>
          <button mat-button [matMenuTriggerFor]="userMenu" aria-label="Menu da conta">
            <span class="avatar" aria-hidden="true">{{
              (auth.user()?.email ?? 'U').slice(0, 1).toUpperCase()
            }}</span
            ><span class="account-label">{{ auth.user()?.email }}</span> ▾
          </button>
          <mat-menu #userMenu="matMenu"
            ><div class="menu-info">
              {{ auth.user()?.email
              }}<small>{{ auth.admin() ? 'Administrador' : 'Visualizador' }}</small>
            </div>
            <button mat-menu-item (click)="theme.toggle()">
              {{ theme.dark() ? 'Usar tema claro' : 'Usar tema escuro' }}</button
            ><button mat-menu-item (click)="logout()">Sair</button></mat-menu
          >
        </mat-toolbar>
        <main id="main-content" tabindex="-1"><router-outlet /></main>
      </mat-sidenav-content>
    </mat-sidenav-container>`,
})
export class Shell {
  readonly auth = inject(AuthStore);
  readonly theme = inject(Theme);
  private readonly toast = inject(Toast);
  private readonly destroy = inject(DestroyRef);
  readonly narrow = toSignal(
    inject(BreakpointObserver)
      .observe('(max-width: 900px)')
      .pipe(map((value) => value.matches)),
    { initialValue: false },
  );
  readonly links = [
    { path: '/dashboard', label: 'Visão geral', icon: '▦', admin: false },
    { path: '/notifications', label: 'Notificações', icon: '✉', admin: false },
    { path: '/templates', label: 'Templates', icon: '▤', admin: false },
    { path: '/applications', label: 'Aplicações', icon: '◇', admin: false },
    { path: '/schedules', label: 'Agendamentos', icon: '◷', admin: false },
    { path: '/send', label: 'Enviar', icon: '↗', admin: true },
    { path: '/audit', label: 'Auditoria', icon: '◎', admin: true },
  ];
  logout() {
    this.auth
      .logout()
      .pipe(takeUntilDestroyed(this.destroy))
      .subscribe({ error: (error) => this.toast.error(error) });
  }
}
