import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ApiError } from '../core/http/api-error';
@Injectable({ providedIn: 'root' })
export class Toast {
  private readonly snack = inject(MatSnackBar);
  show(message: string) {
    this.snack.open(message, 'Fechar', { duration: 6000, politeness: 'polite' });
  }
  message(error: unknown): string {
    if (!(error instanceof ApiError)) return 'Não foi possível concluir a ação. Tente novamente.';
    if (error.status === 0) return 'Não foi possível conectar ao serviço.';
    if (error.status === 401) return 'Credenciais inválidas ou sessão expirada.';
    if (error.status === 403)
      return 'Você não tem permissão para esta ação. Reabra a sessão se necessário.';
    if (error.status === 423)
      return 'Conta temporariamente bloqueada por tentativas de acesso. Tente novamente mais tarde.';
    if (error.status === 429)
      return `Limite de uso atingido. Tente novamente em ${error.retryAfter ?? 60} segundos.`;
    if (error.status === 413) return 'O conteúdo excede o tamanho permitido.';
    if (error.status === 409)
      return 'Já existe um registro com esses dados, ou o estado mudou. Confira e tente novamente.';
    if (error.title === 'Missing Template Variable')
      return 'Preencha todas as variáveis exigidas pelo template.';
    if (error.title === 'Unsupported Channel')
      return 'Este canal ainda não está disponível para envio.';
    if (/idempotency/i.test(error.title))
      return 'Esta chave de idempotência já foi usada com conteúdo diferente. Use o pedido original ou uma nova chave.';
    if (error.status === 422)
      return 'Verifique o template, as variáveis e a chave de idempotência. O canal escolhido pode estar indisponível.';
    if (error.status === 404) return 'O registro não foi encontrado.';
    if (error.status === 503)
      return 'O serviço está temporariamente indisponível. O pedido pode ter sido salvo; confira o histórico.';
    return 'Verifique os campos informados e tente novamente.';
  }
  error(error: unknown) {
    this.show(this.message(error));
  }
}
