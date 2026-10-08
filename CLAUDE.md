# Notification Console

Painel web para operar o Notification Service: acompanhar notificações, gerenciar templates, aplicações,
agendamentos e enviar notificações de teste. O painel consome somente /api/admin/** do backend.

## Stack
Angular (versão estável mais recente), TypeScript strict, componentes standalone, signals, RxJS, Angular Router,
Angular Material + CDK, ESLint (angular-eslint), Prettier. Testes: executor padrão do CLI da versão
(unitários, TestBed, HttpTestingController e harnesses do Material) e Playwright (e2e). Gerenciador de pacotes: npm.

## Regras permanentes
1. TypeScript strict. Proibido `any`. Tipos da API gerados de docs/openapi-admin.json (openapi-typescript);
   nunca escreva tipos da API à mão. Serviços de API finos, tipados com esses tipos.
2. Autenticação por cookie de sessão (HttpOnly). NUNCA guardar token, senha ou chave em localStorage,
   sessionStorage ou no código. CSRF com o suporte nativo do HttpClient (withXsrfConfiguration, cookie XSRF-TOKEN,
   header X-XSRF-TOKEN). Chamadas sempre para caminhos relativos (/api/admin/...), do mesmo domínio.
3. O painel nunca usa API Key de aplicação. A chave de uma aplicação nova é mostrada UMA vez, em um diálogo com botão
   de copiar, e nunca mais. Ela vive apenas no componente do diálogo: nunca em serviço, store, rota, URL ou log.
4. Erros da API vêm em ProblemDetail (RFC 9457). Um único interceptor converte erro em ApiError tipado, e um único
   ponto traduz isso em mensagem para o usuário.
5. Texto da interface em português (pt-BR); código, nomes e comentários técnicos em inglês.
6. Componentes com ChangeDetectionStrategy.OnPush e estado em signals. Templates com @if/@for (sempre com track).
   Nada de subscribe manual sem desinscrição: use async pipe, toSignal ou takeUntilDestroyed.
7. SEGURANÇA DE TEMPLATE: conteúdo vindo da API (assunto, corpo, variáveis, e-mails) é exibido como TEXTO por
   interpolação. Proibido [innerHTML] com esse conteúdo e proibido bypassSecurityTrust*.
8. Acessibilidade: todo campo com label, teclado completo, foco visível, contraste suficiente, papéis ARIA corretos.
   Estados de carregando, vazio e erro em TODAS as telas de dados.
9. Papéis: VIEWER não vê nem aciona botões de escrita; ADMIN vê tudo. A API é a autoridade; a interface só esconde.
10. Rotas com carregamento preguiçoso (lazy) por funcionalidade. Filtros e paginação refletidos na URL.
11. Não adicione dependências sem me avisar e justificar. Não faça commit.
12. Dados sensíveis (e-mails, variáveis) não vão para console.log nem para ferramentas de terceiros.
13. Datas chegam em UTC; exiba no fuso do navegador, com o fuso visível quando fizer diferença (agendamentos).
14. Não use APIs marcadas como experimentais ou em preview do Angular sem minha aprovação.

## Estrutura
src/app/core (auth, http, config, erros), src/app/shared (componentes, pipes e diretivas reutilizáveis),
src/app/layout (shell), src/app/features/{auth,dashboard,notifications,templates,applications,schedules,send,audit}.
Siga o guia de estilo oficial da versão do Angular instalada para nomes de arquivos e classes.

## Como trabalhar
- Para tarefas com mais de 3 arquivos, apresente um plano curto e espere minha confirmação.
- Faça só o que a etapa pede. Anote o que ficou fora do escopo.
- Ao terminar: npm run lint, npm run build e npm test. Não diga que está pronto se algo falhar.
- Resuma em até 10 linhas: o que mudou, decisões e o que revisar.
