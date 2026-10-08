export type Todo = {
  todoId: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  isCompleted: boolean;
  createdAt: string;
};

export type TodoStatus = 'all' | 'completed' | 'incomplete' | 'overdue';

export type TodoSort = 'newest' | 'oldest' | 'due-soonest' | 'due-latest';

const sortParams: Record<TodoSort, { sortField: string; sortOrder: string }> = {
  newest: { sortField: 'createdAt', sortOrder: 'DESC' },
  oldest: { sortField: 'createdAt', sortOrder: 'ASC' },
  'due-soonest': { sortField: 'dueDate', sortOrder: 'ASC' },
  'due-latest': { sortField: 'dueDate', sortOrder: 'DESC' }
};

export type TodoDraft = {
  title: string;
  description: string;
  dueDate: string;
};

async function errorMessage(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { errorText?: string };
    if (body.errorText) {
      return body.errorText;
    }
  } catch {
    // Response had no JSON body.
  }
  return response.statusText || 'Request failed';
}

const API_ORIGIN = 'http://localhost:8080';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ORIGIN}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers
    }
  });
  if (!response.ok) {
    throw new Error(await errorMessage(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

export function listTodos(status: TodoStatus, sort: TodoSort = 'newest'): Promise<Todo[]> {
  const params = new URLSearchParams({
    status,
    limit: '100',
    ...sortParams[sort]
  });
  return request<Todo[]>(`/api/v0/todos?${params}`);
}

export function createTodo(draft: TodoDraft): Promise<Todo> {
  return request<Todo>('/api/v0/todos', {
    method: 'POST',
    body: JSON.stringify({
      title: draft.title.trim(),
      description: draft.description.trim() || undefined,
      dueDate: draft.dueDate || undefined
    })
  });
}

export function updateTodo(todoId: string, draft: TodoDraft): Promise<Todo> {
  return request<Todo>(`/api/v0/todos/${todoId}`, {
    method: 'PUT',
    body: JSON.stringify({
      title: draft.title.trim(),
      description: draft.description.trim(),
      dueDate: draft.dueDate || null
    })
  });
}

export function setCompleted(todoId: string, isCompleted: boolean): Promise<Todo> {
  return request<Todo>(`/api/v0/todos/${todoId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isCompleted })
  });
}

export function deleteTodo(todoId: string): Promise<void> {
  return request<void>(`/api/v0/todos/${todoId}`, { method: 'DELETE' });
}
