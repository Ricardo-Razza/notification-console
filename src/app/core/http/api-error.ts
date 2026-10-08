import { HttpErrorResponse } from '@angular/common/http';
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly title: string,
    readonly detail: string,
    readonly fields: Readonly<Record<string, string>> = {},
    readonly retryAfter: number | null = null,
  ) {
    super(detail);
  }
}
export function normalizeError(error: HttpErrorResponse): ApiError {
  const body: unknown = error.error;
  const data = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const fields: Record<string, string> = {};
  const errors = data['errors'];
  if (typeof errors === 'object' && errors !== null)
    for (const [name, value] of Object.entries(errors))
      if (typeof value === 'string') fields[name] = value;
  const retry = error.headers.get('Retry-After');
  return new ApiError(
    error.status,
    typeof data['title'] === 'string' ? data['title'] : 'Erro',
    typeof data['detail'] === 'string'
      ? data['detail']
      : 'Não foi possível concluir a solicitação.',
    fields,
    retry && Number.isFinite(Number(retry)) ? Number(retry) : null,
  );
}
