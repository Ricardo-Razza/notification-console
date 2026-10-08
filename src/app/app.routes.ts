import { Routes } from '@angular/router';
import { isDevMode } from '@angular/core';
import { authGuard, roleGuard, unsavedGuard } from './core/auth/guards';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./features/auth/login').then((m) => m.Login) },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/dashboard/dashboard').then((m) => m.Dashboard),
      },
      {
        path: 'notifications',
        loadComponent: () =>
          import('./features/notifications/notifications').then((m) => m.Notifications),
        children: [
          {
            path: ':id',
            loadComponent: () =>
              import('./features/notifications/notification-detail').then(
                (m) => m.NotificationDetail,
              ),
          },
        ],
      },
      {
        path: 'templates',
        loadComponent: () => import('./features/templates/templates').then((m) => m.Templates),
      },
      {
        path: 'templates/new',
        canActivate: [roleGuard],
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import('./features/templates/template-editor').then((m) => m.TemplateEditor),
      },
      {
        path: 'templates/:id',
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import('./features/templates/template-editor').then((m) => m.TemplateEditor),
      },
      {
        path: 'applications',
        loadComponent: () =>
          import('./features/applications/applications').then((m) => m.Applications),
      },
      {
        path: 'schedules',
        loadComponent: () => import('./features/schedules/schedules').then((m) => m.Schedules),
      },
      {
        path: 'schedules/new',
        canActivate: [roleGuard],
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import('./features/schedules/schedule-editor').then((m) => m.ScheduleEditor),
      },
      {
        path: 'schedules/:id',
        canDeactivate: [unsavedGuard],
        loadComponent: () =>
          import('./features/schedules/schedule-editor').then((m) => m.ScheduleEditor),
      },
      {
        path: 'send',
        canActivate: [roleGuard],
        loadComponent: () => import('./features/send/send').then((m) => m.Send),
      },
      {
        path: 'audit',
        canActivate: [roleGuard],
        loadComponent: () => import('./features/audit/audit').then((m) => m.Audit),
      },
      ...(isDevMode()
        ? [
            {
              path: '_ui',
              loadComponent: () => import('./shared/ui-gallery').then((m) => m.UiGallery),
            },
          ]
        : []),
      { path: '**', loadComponent: () => import('./shared/not-found').then((m) => m.NotFound) },
    ],
  },
];
