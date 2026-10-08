import { ErrorHandler, inject, Injectable } from '@angular/core';
import { Toast } from '../../shared/toast';
@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly toast = inject(Toast);
  handleError() {
    this.toast.show('Ocorreu um erro ao exibir esta tela. Atualize e tente novamente.');
  }
}
