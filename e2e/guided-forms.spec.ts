import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type {
  Template,
  SendRequest,
  ScheduleCreate,
  ScheduleUpdate,
} from '../src/app/core/api/models';
const applicationId = '10000000-0000-4000-8000-000000000001';
const templateId = '20000000-0000-4000-8000-000000000001';
async function choose(page: Page, label: string, value: string) {
  await page.getByLabel(label, { exact: true }).click();
  await page.getByRole('option', { name: value, exact: true }).click();
}
async function fixtures(page: Page, savedCron = '0 25 10 * * WED') {
  let templates: Template[] = [
    {
      id: templateId,
      code: 'BOAS_VINDAS',
      channel: 'EMAIL',
      applicationId,
      subject: 'Olá, {{nome}}!',
      content: 'Olá, {{nome}}! Sua conta está pronta.',
    },
  ];
  let send: SendRequest | undefined;
  let schedule: ScheduleCreate | undefined;
  let update: ScheduleUpdate | undefined;
  const writes: string[] = [];
  // Every API request stays in the browser test fixture; these tests never deliver email.
  await page.route('**/api/admin/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    let response: unknown = {};
    if (method !== 'GET') writes.push(path);
    if (path.endsWith('/auth/me'))
      response = { id: 'admin', email: 'admin@example.test', role: 'ADMIN', active: true };
    else if (path.endsWith('/applications'))
      response = [{ id: applicationId, name: 'Meu site', active: true }];
    else if (path.endsWith('/templates/preview')) {
      const body = request.postDataJSON() as {
        subject?: string;
        content: string;
        variables: Record<string, string>;
      };
      const render = (value: string) =>
        value.replace(/{{\s*(\w+)\s*}}/g, (token, name: string) => body.variables[name] || token);
      response = {
        subject: render(body.subject ?? ''),
        content: render(body.content),
        missingVariables: [],
      };
    } else if (path.endsWith('/templates') && method === 'GET') {
      const items = templates.filter(
        (item) =>
          item.channel === (url.searchParams.get('channel') ?? item.channel) &&
          (url.searchParams.get('scope') === 'GLOBAL' ? !item.applicationId : true),
      );
      response = { items, totalElements: items.length };
    } else if (path.endsWith('/templates') && method === 'POST') {
      const item = { ...(request.postDataJSON() as Template), id: templateId + '-new' };
      templates = [item];
      response = item;
    } else if (path.endsWith('/templates/' + templateId)) response = templates[0];
    else if (path.endsWith('/schedules/preview-cron'))
      response = {
        occurrences: Array.from({ length: 5 }, (_, index) => ({
          utc: `2030-01-0${index + 1}T12:00:00Z`,
          local: `0${index + 1}/01/2030 às 09:00`,
          timezone: 'America/Sao_Paulo',
        })),
      };
    else if (path.endsWith('/schedules') && method === 'POST') {
      schedule = request.postDataJSON() as ScheduleCreate;
      response = { id: 'schedule' };
    } else if (path.endsWith('/notifications') && method === 'POST') {
      send = request.postDataJSON() as SendRequest;
      response = { id: 'notification', status: send.scheduledAt ? 'SCHEDULED' : 'PENDING' };
    } else if (path.endsWith('/schedules/saved') && method === 'PUT') {
      update = request.postDataJSON() as ScheduleUpdate;
      response = { id: 'saved' };
    } else if (path.endsWith('/schedules/saved'))
      response = {
        id: 'saved',
        applicationId,
        name: 'Existente',
        cron: savedCron,
        timezone: 'America/Sao_Paulo',
        channel: 'EMAIL',
        recipient: 'maria@example.test',
        template: 'BOAS_VINDAS',
        variables: { nome: 'Maria', referencia: 'Cliente antigo' },
      };
    else if (path.endsWith('/schedules') || path.endsWith('/notifications'))
      response = { items: [], totalElements: 0 };
    await route.fulfill({ json: response });
  });
  return {
    sent: () => send,
    scheduled: () => schedule,
    updated: () => update,
    writes: () => writes,
  };
}
test('template: start from an example, personalize and preview without markup', async ({
  page,
}) => {
  await fixtures(page);
  await page.goto('/templates/new');
  await page.getByRole('button', { name: 'Boas-vindas', exact: true }).click();
  await page.getByLabel('Exemplo: Nome', { exact: true }).fill('<b>Maria</b>');
  await expect(page.locator('pre')).toContainText('Olá, <b>Maria</b>');
  await expect(page.locator('pre b')).toHaveCount(0);
  await page.getByLabel('Identificador do template').fill('Boas vindas');
  await page.getByLabel('Mensagem', { exact: true }).click();
  await expect(page.getByLabel('Identificador do template')).toHaveValue('BOAS_VINDAS');
  await page.getByLabel('Nome do dado personalizado').fill('empresa');
  await page.getByRole('button', { name: 'Inserir dado', exact: true }).click();
  await expect(page.getByLabel('Mensagem', { exact: true })).toHaveValue(/{{empresa}}/);
  await page.getByRole('button', { name: 'Salvar template' }).click();
  await expect(page).toHaveURL(/\/templates$/);
});
test('schedule: choose a template and weekly recurrence without JSON or cron', async ({ page }) => {
  const fixture = await fixtures(page);
  await page.goto('/schedules/new');
  await page.getByLabel('Nome do agendamento').fill('Lembrete semanal');
  await expect(page.getByLabel('Template', { exact: true })).toContainText('BOAS_VINDAS');
  await page.getByLabel('Destinatário', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Nome', { exact: true }).fill('Maria');
  await choose(page, 'Repetir', 'Uma vez por semana');
  await choose(page, 'Dia da semana', 'Quarta-feira');
  await page.getByLabel('Horário do envio').fill('10:25');
  await expect(page.getByLabel('Expressão cron (avançado)')).toHaveCount(0);
  await expect(page.locator('pre')).toContainText('Olá, Maria!');
  await expect(page.locator('ol li')).toHaveCount(5);
  await page.getByRole('button', { name: 'Salvar agendamento' }).click();
  await expect(page).toHaveURL(/\/schedules$/);
  expect(fixture.scheduled()?.schedule?.cron).toBe('0 25 10 * * WED');
  expect(fixture.scheduled()?.schedule?.variables).toEqual({ nome: 'Maria' });
});
test('editing a schedule preserves its recurrence and saved message data', async ({ page }) => {
  const fixture = await fixtures(page);
  await page.goto('/schedules/saved');
  await expect(page.getByLabel('Repetir', { exact: true })).toContainText('Uma vez por semana');
  await expect(page.getByLabel('Horário do envio')).toHaveValue('10:25');
  await expect(page.getByLabel('Nome', { exact: true })).toHaveValue('Maria');
  await expect(page.getByLabel('Referencia', { exact: true })).toHaveValue('Cliente antigo');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await expect(page.locator('pre')).toContainText('Olá, Ana!');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page).toHaveURL(/\/schedules$/);
  expect(fixture.updated()?.variables).toEqual({ nome: 'Ana', referencia: 'Cliente antigo' });
  expect(fixture.updated()?.cron).toBe('0 25 10 * * WED');
});
test('existing advanced schedules keep their original expression', async ({ page }) => {
  const fixture = await fixtures(page, '0 */5 * * * MON-FRI');
  await page.goto('/schedules/saved');
  await expect(page.getByLabel('Repetir', { exact: true })).toContainText(
    'Personalizado (avançado)',
  );
  await expect(page.getByLabel('Expressão cron (avançado)')).toHaveValue('0 */5 * * * MON-FRI');
  await page.getByRole('button', { name: 'Salvar agendamento', exact: true }).click();
  await expect(page).toHaveURL(/\/schedules$/);
  expect(fixture.updated()?.cron).toBe('0 */5 * * * MON-FRI');
});
test('send: validates missing data, defaults to now and can schedule a single send', async ({
  page,
}) => {
  const fixture = await fixtures(page);
  await page.goto('/send');
  await expect(page.getByLabel('Template', { exact: true })).toContainText('BOAS_VINDAS');
  await page.getByRole('button', { name: 'Enviar notificação', exact: true }).click();
  await expect(page.getByText('Informe um destinatário válido.', { exact: true })).toBeVisible();
  expect(fixture.sent()).toBeUndefined();
  await page.getByLabel('Destinatário', { exact: true }).fill('maria@example.test');
  await page.getByLabel('Nome', { exact: true }).fill('Maria');
  await choose(page, 'Momento do envio', 'Agendar para uma data');
  await page.getByLabel('Data e hora do envio').fill('2030-01-15T10:30');
  await expect(
    page.getByLabel('Identificador para evitar duplicidade (opcional)'),
  ).not.toBeVisible();
  await page.getByRole('button', { name: 'Agendar envio', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notificação registrada' })).toBeVisible();
  expect(fixture.sent()?.variables).toEqual({ nome: 'Maria' });
  expect(fixture.sent()?.scheduledAt).toMatch(/^2030-01-15T/);
  await page.getByRole('button', { name: 'Enviar outra', exact: true }).click();
  await expect(page.getByLabel('Momento do envio')).toContainText('Enviar agora');
  await page.getByLabel('Destinatário', { exact: true }).fill('ana@example.test');
  await page.getByLabel('Nome', { exact: true }).fill('Ana');
  await page.getByRole('button', { name: 'Enviar notificação', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Notificação registrada' })).toBeVisible();
  expect(fixture.sent()?.scheduledAt).toBeUndefined();
});
test('guided forms remain accessible on mobile and desktop', async ({ page }, testInfo) => {
  test.setTimeout(180000);
  await fixtures(page);
  for (const width of [360, 1280]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/templates/new', '/schedules/new', '/send']) {
      await page.goto(path);
      await expect(page.locator('app-loading')).toHaveCount(0);
      await expect(page.locator('#page-title')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        path + width,
      ).toBe(true);
      const result = await new AxeBuilder({ page }).analyze();
      expect(
        result.violations
          .filter((item) => ['critical', 'serious'].includes(item.impact ?? ''))
          .map((item) => ({ id: item.id, nodes: item.nodes.map((node) => node.target) })),
      ).toEqual([]);
      await page.screenshot({
        path: testInfo.outputPath(path.split('/')[1] + '-' + width + '.png'),
        fullPage: true,
      });
    }
  }
});
