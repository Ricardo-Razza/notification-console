# Notification Console

Painel Angular 22.2 standalone, TypeScript strict e detecção de mudanças sem zone.js. Material 3,
componentes OnPush, signals e rotas lazy. Testes usam o Vitest padrão do CLI e Playwright.
Interface em português; datas da API em UTC são exibidas no fuso do navegador.

## Execução local

Requer Node 24.15 ou superior e npm. O backend deve estar em execução.

```sh
npm ci
npm start
```

Abra http://localhost:4200. Todas as chamadas são relativas a /api/admin/**.
proxy.conf.json encaminha ao backend em localhost:8080. Para a stack smoke, use
`npm start -- --proxy-config proxy.e2e.conf.json` (destino 127.0.0.1:18080).
Configure ADMIN_EMAIL e ADMIN_PASSWORD no backend para criar o primeiro administrador;
após o bootstrap, remova a senha do ambiente e reinicie. A senha precisa ter ao menos 12 caracteres
e no máximo 72 bytes UTF-8. A sessão fica em cookie HttpOnly, SameSite Strict; o CSRF usa
XSRF-TOKEN e X-XSRF-TOKEN pelo suporte nativo do HttpClient. Produção requer HTTPS e ADMIN_COOKIE_SECURE=true.

## Contrato e verificações

```sh
npm ci --prefix tools/api-types
npm run api:types
npm run lint
npm run security
npm test
npm run build
npm audit --audit-level=high
```

docs/openapi-admin.json é exportado pelo backend usando scripts/export-openapi.sh.
O gerador usa um workspace separado porque openapi-typescript 7 usa TypeScript 5 e Angular 22 usa
TypeScript 6. Isso mantém os peers compatíveis. Os tipos gerados são a única fonte de tipos da API.
A exceção de lint sobre assinatura de índice aplica-se apenas ao arquivo gerado.

O bundle inicial tem aproximadamente 508 kB (128 kB de transferência estimada), com orçamento
de aviso 550 kB e erro 700 kB. As funcionalidades são lazy; o gráfico SVG é carregado com @defer e
tem tabela equivalente. Não há dependência adicional de gráficos, cron, fontes ou ícones remotos.

## Testes integrados

Na pasta irmã notification-service:

```sh
docker build -t notification-service:part2 .
docker build -t notification-console:part2 ../notification-console
docker compose -f docker-compose.smoke.yml up -d --wait
```

No painel:

```sh
npx playwright install chromium
E2E_BASE_URL=http://127.0.0.1:14201 npm run e2e
```

PowerShell: `$env:E2E_BASE_URL='http://127.0.0.1:14201'; npm run e2e`.
O proxy de testes serve a imagem de produção e encaminha a API para o backend real.
Os dados são fictícios, o SMTP é Mailpit e as credenciais em compose são exclusivas dessa stack.
O teste de reenvio altera apenas a notificação que acabou de criar, no banco isolado smoke.
Nunca execute essa suíte com um ambiente real.
Os testes verificam login, chave única, prévia como texto, SENT no Mailpit, filtros, reenvio,
agendamento e VIEWER. Axe cobre as telas principais em 360/768/1280 px.
Traces, vídeos e capturas automáticas de falhas ficam desabilitados; screenshots de revisão mostram o dashboard.

## Implantação

Mantenha notification-console e notification-service como repositórios irmãos no servidor.
O compose de produção do backend constrói o painel e Caddy encaminha /api/** para o serviço;
os demais caminhos vão ao nginx não-root do painel. O nginx usa fallback para index.html,
cache imutável para JS/CSS e no-store para index.html e version.json.

```sh
docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build console proxy
curl https://seu-dominio/version.json
```

Execute os comandos acima na pasta do backend. /version.json contém versão, revisão e instante do build.
Para identificar um commit, passe BUILD_REVISION ao docker build; a construção local sem commits
usa development. O workflow constrói a imagem sem publicá-la.
O job de integração busca o backend no repositório Ricardo-Razza/notification-service;
as mudanças dos dois repositórios precisam estar publicadas antes da primeira execução remota.
Veja [docs/qualidade.md](docs/qualidade.md) para validação e CSP.

## Operação

VIEWER consulta dados com destinatários mascarados e não tem ações de escrita.
A prévia de templates para VIEWER é local, como texto, porque a política da API reserva POST a ADMIN.
Chaves aparecem somente no diálogo que as gera e são descartadas ao fechar/destruir.
O único uso de localStorage é a preferência visual de tema. Logout recarrega a aplicação.
Os presets de cron são descritos em português; expressões avançadas preservam os seis campos.
Datas inexistentes ou ambíguas por DST são rejeitadas antes do envio.
