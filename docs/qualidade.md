# Qualidade e segurança — 8 de outubro de 2026

## Evidências

- Compilação de produção e Docker multi-stage executados com sucesso.
- ESLint sem erros; verificação automatizada contra innerHTML, bypassSecurityTrust,
  logs de conteúdo e armazenamento sensível.
- 29 testes unitários: CSRF, ProblemDetail, sessão, guards, status, chave local,
  confirmação com harness, debounce, erros de formulário, cron/DST e polling visível.
- Fluxo Playwright contra Spring/MySQL/RabbitMQ/Mailpit real: login, aplicação, chave,
  template, texto escapado, envio SENT capturado no Mailpit, filtro, reenvio,
  agendamento, logout e VIEWER sem escrita; API confirma 403.
- Auditoria axe sem violações sérias/críticas nas telas principais em 360, 768 e 1280 px.
- Regiões de tabela receberam tabindex e nome acessível para permitir rolagem por teclado.
- Revisão de capturas do dashboard e ajuste de largura da barra lateral.
- npm audit sem vulnerabilidades na execução local.
- Execução final: 29 testes unitários e 3 testes Playwright aprovados, incluindo geometria da barra lateral.

A automação não substitui teste com leitor de tela real. Estados têm role=status/alert, campos possuem
labels, status usa texto/símbolo além da cor, há skip link e foco visível. As listas são paginadas.

## Política CSP

nginx.conf injeta um nonce novo por resposta HTML usando request_id e ngCspNonce. index.html não é cacheado.
A política permite scripts somente da própria origem, estilos da própria origem ou com nonce,
conexões da própria origem, imagens locais/data e fontes locais. Bloqueia objetos e enquadramento.
style-src-attr permite unsafe-inline para atributos de estilo de posicionamento/dimensão do Material;
essa exceção não autoriza scripts nem elementos style sem nonce.
inlineCritical é desabilitado para evitar manipulador onload inline no CSS.

Playwright valida alteração do nonce em recarregamentos e ausência de erros CSP no login e
nos fluxos principais da imagem de produção. A imagem roda como usuário 101 em 8080.
Caddy faz TLS na produção. Fontes e gráficos não fazem chamadas externas.

Referências: [Angular Security](https://angular.dev/best-practices/security),
[CSP_NONCE](https://angular.dev/api/core/CSP_NONCE),
[nginx unprivileged](https://github.com/nginx/docker-nginx-unprivileged).

## Limites conhecidos

Sessões e rate limiter do backend são locais a uma instância; uma implantação com múltiplas instâncias
precisa sessão compartilhada/afinidade e limitação distribuída. O SMTP é at-least-once:
a aceitação SMTP antes de uma falha de gravação pode levar a duplicação na recuperação.
A aprovação SMTP não comprova entrega na caixa de entrada. Testes usam destinatários .test e Mailpit.
