import { test as base, expect } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:8090';

type TodoRow = { todoId: string };

export async function resetTodos(): Promise<void> {
  const response = await fetch(`${apiOrigin}/api/v0/todos?status=all&limit=100`);
  if (!response.ok) {
    throw new Error(`Could not list todos before the test: ${response.status}`);
  }
  const todos = (await response.json()) as TodoRow[];
  await Promise.all(
    todos.map(todo => fetch(`${apiOrigin}/api/v0/todos/${todo.todoId}`, { method: 'DELETE' }))
  );
}

export const test = base.extend({
  page: async ({ page }, use, testInfo) => {
    await use(page);
    if (testInfo.status !== testInfo.expectedStatus) {
      return;
    }
    const screenshot = testInfo.outputPath('goal.png');
    await page.screenshot({ path: screenshot, fullPage: true });
    await testInfo.attach('After goal', {
      path: screenshot,
      contentType: 'image/png'
    });
  }
});

export { expect };
