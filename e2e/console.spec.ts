import { test, expect, type Page, type APIResponse } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import type {
  Application,
  AdminUser,
  SendResult,
  Notification,
  Template,
} from '../src/app/core/api/models';
const stamp = Date.now().toString();
const appName = 'Console E2E ' + stamp;
const templateCode = 'E2E_' + stamp;
const recipient = 'console-' + stamp + '@example.test';
async function json<T>(response: APIResponse): Promise<T> {
  expect(response.ok(), 'API response status ' + response.status()).toBeTruthy();
  return (await response.json()) as T;
}
async function select(page: Page, label: string, option: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: option, exact: true }).click();
}
async function csrf(page: Page) {
  return (
    (await page.context().cookies()).find((cookie) => cookie.name === 'XSRF-TOKEN')?.value ?? ''
  );
}
async function login(page: Page, email = 'admin@example.test', password = 'SmokePassword123!') {
  await page.goto('/login');
  await page.getByLabel('E-mail', { exact: true }).fill(email);
  await page.getByLabel('Senha', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  await expect(page).toHaveURL(/dashboard/);
}
test('real backend: keys, preview, delivery, retry, schedule and viewer', async ({ page }) => {
  test.setTimeout(180000);
  const violations: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|violates.*directive/i.test(message.text())
    )
      violations.push('CSP');
  });
  await login(page);
  await page.goto('/applications');
  await page.getByLabel('Nome da nova aplicação').fill(appName);
  await page.getByRole('button', { name: 'Criar aplicação', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Guarde agora.', { exact: false })).toBeVisible();
  await expect(dialog.locator('pre')).not.toBeEmpty();
  await expect(dialog.getByRole('button', { name: 'Concluir' })).toBeDisabled();
  await dialog.getByLabel('Confirmei que guardei a chave em um local seguro').check();
  await dialog.getByRole('button', { name: 'Concluir' }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((key) => key !== 'notification-console-theme'),
    ),
  ).toEqual([]);
  expect(await page.evaluate(() => Object.keys(sessionStorage))).toEqual([]);
  const apps = await json<Application[]>(await page.request.get('/api/admin/applications'));
  const app = apps.find((item) => item.name === appName);
  expect(app?.id).toBeTruthy();
  await page.goto('/templates/new');
  await page.getByLabel('Código', { exact: true }).fill(templateCode);
  await select(page, 'Escopo', appName);
  await page.getByLabel('Assunto', { exact: true }).fill('Teste {{ name }}');
  await page
    .getByLabel('Conteúdo', { exact: true })
    .fill('Olá {{ name }}. Conteúdo <b>seguro como texto</b>.');
  await page.getByLabel('Exemplo: name', { exact: true }).fill('Operação');
  await expect(page.locator('pre')).toContainText('Olá Operação');
  await expect(page.locator('pre b')).toHaveCount(0);
  await page.getByRole('button', { name: 'Salvar template', exact: true }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await page.goto('/send');
  await select(page, 'Aplicação', appName);
  await select(page, 'Template', templateCode);
  await page.getByLabel('Destinatário', { exact: true }).fill(recipient);
  await page.getByLabel('Variável: name', { exact: true }).fill('Operação');
  await expect(page.locator('pre')).toContainText('Olá Operação');
  await page.getByRole('button', { name: 'Enviar notificação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notificação registrada' })).toBeVisible();
  const link = page.getByRole('link', { name: 'Acompanhar notificação' });
  const href = await link.getAttribute('href');
  const id = href?.split('/').at(-1);
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  await expect
    .poll(
      async () => {
        const item = await json<Notification>(
          await page.request.get('/api/admin/notifications/' + id),
        );
        return item.status;
      },
      { timeout: 30000 },
    )
    .toBe('SENT');
  const mail = await page.request.get('http://127.0.0.1:18025/api/v1/messages');
  expect((await mail.text()).includes(recipient)).toBe(true);
  await link.click();
  await expect(page.getByRole('region', { name: 'Detalhe da notificação' })).toContainText(
    'Sucesso',
  );
  await page.getByRole('link', { name: 'Fechar', exact: true }).click();
  await page.getByLabel('Destinatário', { exact: true }).fill(recipient);
  await page.getByRole('button', { name: 'Filtrar', exact: true }).click();
  await expect(page).toHaveURL(new RegExp('recipient=console-'));
  await expect(page.locator('table')).toContainText(recipient);
  // Test fixture only: mutate the exact notification created above in the isolated smoke database.
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) throw new Error('Invalid fixture id');
  execFileSync(
    'docker',
    [
      'compose',
      '-f',
      'docker-compose.smoke.yml',
      'exec',
      '-T',
      '-e',
      'MYSQL_PWD=smoke-test-only',
      'mysql',
      'mysql',
      '-usmoke',
      'notification_smoke',
      '-e',
      "UPDATE notification SET status='FAILED', last_error='Test fixture', updated_at=UTC_TIMESTAMP(6) WHERE id='" +
        id +
        "' AND recipient='" +
        recipient +
        "';",
    ],
    { cwd: resolve('../notification-service'), stdio: 'pipe' },
  );
  await page.goto('/notifications/' + id);
  await page.getByRole('button', { name: 'Reenviar', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirmar', exact: true }).click();
  await expect
    .poll(
      async () => {
        const item = await json<Notification>(
          await page.request.get('/api/admin/notifications/' + id),
        );
        return item.status;
      },
      { timeout: 30000 },
    )
    .toBe('SENT');
  await page.goto('/schedules/new');
  await page.getByLabel('Nome', { exact: true }).fill('Diário ' + stamp);
  await select(page, 'Aplicação', appName);
  await page.getByLabel('Destinatário', { exact: true }).fill(recipient);
  await page.getByLabel('Código do template', { exact: true }).fill(templateCode);
  await page.getByLabel('Variáveis (objeto JSON com valores de texto)').fill('{"name":"Operação"}');
  await expect(page.getByRole('heading', { name: 'Próximas execuções' })).toBeVisible();
  await expect(page.locator('ol li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page).toHaveURL(/\/schedules$/);
  await expect(page.locator('table').first()).toContainText('Diário ' + stamp);
  const viewerEmail = 'viewer-' + stamp + '@example.test';
  await json<AdminUser>(
    await page.request.post('/api/admin/users', {
      headers: { 'X-XSRF-TOKEN': await csrf(page) },
      data: { email: viewerEmail, password: 'ViewerPassword123!', role: 'VIEWER' },
    }),
  );
  await page.getByRole('button', { name: 'Menu da conta' }).click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await expect(page).toHaveURL(/login/);
  await login(page, viewerEmail, 'ViewerPassword123!');
  await page.goto('/applications');
  await expect(page.getByRole('button', { name: 'Criar aplicação' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Rotacionar chave' })).toHaveCount(0);
  await page.goto('/templates');
  await expect(page.getByRole('link', { name: 'Novo template' })).toHaveCount(0);
  await page.getByRole('link', { name: templateCode, exact: true }).click();
  await expect(page.getByRole('button', { name: 'Salvar template' })).toHaveCount(0);
  await expect(page.getByLabel('Código', { exact: true })).toBeDisabled();
  await page.getByLabel('Exemplo: name', { exact: true }).fill('Consulta');
  await expect(page.locator('pre')).toContainText('Olá Consulta');
  await page.goto('/send');
  await expect(page).toHaveURL(/dashboard/);
  const forbidden = await page.request.post('/api/admin/applications', {
    headers: { 'X-XSRF-TOKEN': await csrf(page) },
    data: { name: 'forbidden' },
  });
  expect(forbidden.status()).toBe(403);
  expect(violations).toEqual([]);
});
test('production headers, responsive screens and accessibility', async ({ page }, testInfo) => {
  test.setTimeout(240000);
  const csp: string[] = [];
  page.on('console', (message) => {
    if (
      message.type() === 'error' &&
      /Content Security Policy|violates.*directive/i.test(message.text())
    )
      csp.push('CSP');
  });
  const response = await page.goto('/login');
  expect(response?.headers()['content-security-policy']).toContain("script-src 'self'");
  expect(response?.headers()['cache-control']).toContain('no-store');
  const nonce1 = await page.locator('app-root').getAttribute('ngCspNonce');
  await page.reload();
  const nonce2 = await page.locator('app-root').getAttribute('ngCspNonce');
  expect(nonce1).not.toBe(nonce2);
  expect(nonce1).not.toBe('__CSP_NONCE__');
  const loginAxe = await new AxeBuilder({ page }).analyze();
  expect(
    loginAxe.violations.filter((item) => ['serious', 'critical'].includes(item.impact ?? '')),
  ).toEqual([]);
  await login(page);
  const firstTemplate = (
    await json<{ items?: Template[] }>(await page.request.get('/api/admin/templates?size=20'))
  ).items?.[0];
  for (const width of [360, 768, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of [
      '/dashboard',
      '/notifications',
      '/templates',
      '/applications',
      '/schedules',
      '/send',
      '/audit',
      ...(firstTemplate?.id ? ['/templates/' + firstTemplate.id] : []),
    ]) {
      await page.goto(path);
      await expect(page.locator('#page-title')).toBeVisible();
      if (path === '/dashboard') {
        await page
          .getByRole('heading', { name: 'Envios ao longo do tempo' })
          .scrollIntoViewIfNeeded();
        await expect(page.locator('svg.graph')).toBeVisible();
      }
      await expect(page.locator('app-loading')).toHaveCount(0);
      const results = await new AxeBuilder({ page }).analyze();
      expect(
        results.violations
          .filter((item) => ['serious', 'critical'].includes(item.impact ?? ''))
          .map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) })),
        path + ' ' + width,
      ).toEqual([]);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
        path + ' ' + width + ' viewport overflow',
      ).toBe(true);
      if (path === '/dashboard')
        await page.screenshot({
          path: testInfo.outputPath('dashboard-' + width + '.png'),
          fullPage: true,
        });
    }
  }
  expect(csp).toEqual([]);
});
