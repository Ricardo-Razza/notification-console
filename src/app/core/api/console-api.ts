import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type * as M from './models';

@Injectable({ providedIn: 'root' })
export class ConsoleApi {
  private readonly http = inject(HttpClient);
  me() {
    return this.http.get<M.User>('/api/admin/auth/me');
  }
  login(body: M.LoginRequest) {
    return this.http.post<M.User>('/api/admin/auth/login', body);
  }
  logout() {
    return this.http.post<void>('/api/admin/auth/logout', {});
  }
  stats(params: HttpParams) {
    return this.http.get<M.Stats>('/api/admin/stats', { params });
  }
  queues() {
    return this.http.get<M.QueueStatus[]>('/api/admin/queues');
  }
  applications() {
    return this.http.get<M.Application[]>('/api/admin/applications');
  }
  createApplication(name: string) {
    return this.http.post<M.ApplicationCreated>('/api/admin/applications', { name });
  }
  rotateKey(id: string) {
    return this.http.post<M.ApplicationCreated>(`/api/admin/applications/${id}/rotate-key`, {});
  }
  applicationAction(id: string, action: 'activate' | 'deactivate' | 'revoke-previous-key') {
    return this.http.post<void>(`/api/admin/applications/${id}/${action}`, {});
  }
  rate(id: string, rateLimitPerMinute: number | null) {
    return this.http.patch<void>(`/api/admin/applications/${id}`, { rateLimitPerMinute });
  }
  notifications(params: HttpParams) {
    return this.http.get<M.NotificationPage>('/api/admin/notifications', { params });
  }
  notification(id: string) {
    return this.http.get<M.Notification>(`/api/admin/notifications/${id}`);
  }
  send(body: M.SendRequest) {
    return this.http.post<M.SendResult>('/api/admin/notifications', body);
  }
  retry(id: string) {
    return this.http.post<M.SendResult>(`/api/admin/notifications/${id}/retry`, {});
  }
  cancel(id: string) {
    return this.http.delete<M.SendResult>(`/api/admin/notifications/${id}`);
  }
  templates(params = new HttpParams()) {
    return this.http.get<M.TemplatePage>('/api/admin/templates', { params });
  }
  template(id: string) {
    return this.http.get<M.Template>(`/api/admin/templates/${id}`);
  }
  createTemplate(body: M.TemplateCreate) {
    return this.http.post<M.Template>('/api/admin/templates', body);
  }
  updateTemplate(id: string, body: M.TemplateUpdate) {
    return this.http.put<M.Template>(`/api/admin/templates/${id}`, body);
  }
  deleteTemplate(id: string) {
    return this.http.delete<void>(`/api/admin/templates/${id}`);
  }
  preview(body: M.PreviewRequest) {
    return this.http.post<M.Preview>('/api/admin/templates/preview', body);
  }
  schedules(params = new HttpParams()) {
    return this.http.get<M.SchedulePage>('/api/admin/schedules', { params });
  }
  schedule(id: string) {
    return this.http.get<M.Schedule>(`/api/admin/schedules/${id}`);
  }
  createSchedule(body: M.ScheduleCreate) {
    return this.http.post<M.Schedule>('/api/admin/schedules', body);
  }
  updateSchedule(id: string, body: M.ScheduleUpdate) {
    return this.http.put<M.Schedule>(`/api/admin/schedules/${id}`, body);
  }
  scheduleAction(id: string, action: 'pause' | 'resume') {
    return this.http.post<M.Schedule>(`/api/admin/schedules/${id}/${action}`, {});
  }
  deleteSchedule(id: string) {
    return this.http.delete<void>(`/api/admin/schedules/${id}`);
  }
  cron(body: M.CronRequest) {
    return this.http.post<M.CronPreview>('/api/admin/schedules/preview-cron', body);
  }
  audit(params: HttpParams) {
    return this.http.get<M.AuditPage>('/api/admin/audit-log', { params });
  }
  users() {
    return this.http.get<M.AdminUser[]>('/api/admin/users');
  }
}
