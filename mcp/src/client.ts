export type TodoApiClient = {
  request: <T = unknown>(method: string, path: string, body?: unknown) => Promise<T>;
};

export class TodoApiError extends Error {
  readonly status: number;
  readonly body: string;

  constructor(status: number, body: string) {
    super(`Todo API ${status}: ${body.slice(0, 500)}`);
    this.name = 'TodoApiError';
    this.status = status;
    this.body = body;
  }
}

export function getApiOrigin(): string {
  const raw = process.env.TODO_API_ORIGIN?.trim() || 'http://127.0.0.1:8000';
  return raw.replace(/\/$/, '');
}

export function createTodoApiClient(
  origin: string = getApiOrigin(),
  fetchImpl: typeof fetch = fetch
): TodoApiClient {
  return {
    async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
      const url = `${origin}${path.startsWith('/') ? path : `/${path}`}`;
      const response = await fetchImpl(url, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body)
      });

      const text = await response.text();
      if (!response.ok) {
        throw new TodoApiError(response.status, text || response.statusText);
      }

      if (response.status === 204 || text.length === 0) {
        return undefined as T;
      }

      return JSON.parse(text) as T;
    }
  };
}
