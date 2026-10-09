import type { McpServer } from '@modelcontextprotocol/server';
import type { TodoApiClient } from './client.js';
import {
  createTodoInputSchema,
  getTodoInputSchema,
  listTodosInputSchema,
  todoIdOnlySchema,
  updateTodoInputSchema
} from './schemas.js';

function textResult(data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  return { content: [{ type: 'text' as const, text }] };
}

function buildListQuery(input: {
  status: string;
  sortField: string;
  sortOrder: string;
  limit: number;
  offset: number;
}): string {
  const params = new URLSearchParams({
    status: input.status,
    sortField: input.sortField,
    sortOrder: input.sortOrder,
    limit: String(input.limit),
    offset: String(input.offset)
  });
  return params.toString();
}

export function registerTodoTools(server: McpServer, api: TodoApiClient): void {
  server.registerTool(
    'list_todos',
    {
      description:
        'List to-do items with optional status filter (all/completed/incomplete/overdue), sort, and pagination.',
      inputSchema: listTodosInputSchema
    },
    async input => {
      const query = buildListQuery(input);
      const items = await api.request('GET', `/api/v0/todos?${query}`);
      return textResult(items);
    }
  );

  server.registerTool(
    'get_todo',
    {
      description: 'Get a single to-do by its UUID.',
      inputSchema: getTodoInputSchema
    },
    async ({ todoId }) => {
      const item = await api.request('GET', `/api/v0/todos/${todoId}`);
      return textResult(item);
    }
  );

  server.registerTool(
    'create_todo',
    {
      description:
        'Create a to-do. Title is required; description and dueDate (YYYY-MM-DD) are optional.',
      inputSchema: createTodoInputSchema
    },
    async input => {
      const body: Record<string, unknown> = { title: input.title };
      if (input.description !== undefined) {
        body.description = input.description;
      }
      if (input.dueDate !== undefined) {
        body.dueDate = input.dueDate;
      }
      const item = await api.request('POST', '/api/v0/todos', body);
      return textResult(item);
    }
  );

  server.registerTool(
    'update_todo',
    {
      description:
        'Update title, description, and/or dueDate of a to-do. Provide at least one field. Does not change completion.',
      inputSchema: updateTodoInputSchema
    },
    async input => {
      const body: Record<string, unknown> = {};
      if (input.title !== undefined) {
        body.title = input.title;
      }
      if (input.description !== undefined) {
        body.description = input.description;
      }
      if (input.dueDate !== undefined) {
        body.dueDate = input.dueDate;
      }
      const item = await api.request('PUT', `/api/v0/todos/${input.todoId}`, body);
      return textResult(item);
    }
  );

  server.registerTool(
    'complete_todo',
    {
      description: 'Mark a to-do as completed by UUID.',
      inputSchema: todoIdOnlySchema
    },
    async ({ todoId }) => {
      const item = await api.request('PATCH', `/api/v0/todos/${todoId}`, { isCompleted: true });
      return textResult(item);
    }
  );

  server.registerTool(
    'incomplete_todo',
    {
      description: 'Mark a to-do as not completed by UUID.',
      inputSchema: todoIdOnlySchema
    },
    async ({ todoId }) => {
      const item = await api.request('PATCH', `/api/v0/todos/${todoId}`, { isCompleted: false });
      return textResult(item);
    }
  );

  server.registerTool(
    'delete_todo',
    {
      description: 'Permanently delete a to-do by UUID.',
      inputSchema: todoIdOnlySchema
    },
    async ({ todoId }) => {
      await api.request('DELETE', `/api/v0/todos/${todoId}`);
      return textResult({ deleted: true, todoId });
    }
  );
}
