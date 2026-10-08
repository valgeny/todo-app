import type { Page } from '@playwright/test';
import { expect, resetTodos, test } from './fixture';

function card(page: Page, title: string) {
  return page.getByTestId('todo-card').filter({
    has: page.getByRole('heading', { level: 2, name: title, exact: true })
  });
}

async function addTodo(
  page: Page,
  todo: { title: string; description?: string; dueDate?: string }
) {
  await page.getByTestId('add-todo').click();
  const dialog = page.getByTestId('todo-dialog');
  await dialog.getByTestId('todo-title').fill(todo.title);
  if (todo.description) {
    await dialog.getByTestId('todo-description').fill(todo.description);
  }
  if (todo.dueDate) {
    await dialog.getByTestId('todo-due-date').fill(todo.dueDate);
  }
  await dialog.getByTestId('todo-submit').click();
  await expect(dialog).toBeHidden();
}

test.beforeEach(async ({ page }) => {
  await resetTodos();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'To-dos' })).toBeVisible();
});

test('shows an empty list', async ({ page }) => {
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
});

test('creates a to-do', async ({ page }) => {
  await addTodo(page, {
    title: 'Buy milk',
    description: 'Two litres',
    dueDate: '2099-01-01'
  });

  const item = card(page, 'Buy milk');
  await expect(item.getByText('Two litres')).toBeVisible();
  await expect(item.getByText('Due 2099-01-01')).toBeVisible();
});

test('keeps Add disabled until the title has text', async ({ page }, testInfo) => {
  await page.getByTestId('add-todo').click();
  const dialog = page.getByTestId('todo-dialog');
  const add = dialog.getByTestId('todo-submit');
  await expect(add).toBeDisabled();
  await dialog.getByTestId('todo-title').fill('   ');
  await expect(add).toBeDisabled();
  const screenshot = testInfo.outputPath('add-disabled.png');
  await page.screenshot({ path: screenshot, fullPage: true });
  await testInfo.attach('Add disabled', { path: screenshot, contentType: 'image/png' });
  await dialog.getByTestId('todo-cancel').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
});

test('completes a to-do and filters open and done', async ({ page }) => {
  await addTodo(page, { title: 'Walk the dog' });
  const item = card(page, 'Walk the dog');
  await item.getByTestId('todo-complete').click();

  await expect(item.getByRole('heading', { name: 'Walk the dog' })).toHaveCSS(
    'text-decoration-line',
    'line-through'
  );
  await expect(item.getByText('Done', { exact: true })).toBeVisible();

  await page.getByTestId('filter-incomplete').click();
  await expect(page.getByRole('heading', { name: 'Walk the dog' })).toHaveCount(0);

  await page.getByTestId('filter-completed').click();
  await expect(page.getByRole('heading', { name: 'Walk the dog' })).toBeVisible();

  await card(page, 'Walk the dog').getByTestId('todo-complete').click();
  await page.getByTestId('filter-incomplete').click();
  await expect(page.getByRole('heading', { name: 'Walk the dog' })).toBeVisible();
  await expect(card(page, 'Walk the dog').getByText('Done', { exact: true })).toHaveCount(0);
});

test('edits the title and clears the due date', async ({ page }) => {
  await addTodo(page, { title: 'Draft', dueDate: '2099-01-01' });
  await card(page, 'Draft').getByTestId('todo-edit').click();
  const dialog = page.getByTestId('todo-dialog');
  await dialog.getByTestId('todo-title').fill('Ready');
  await dialog.getByTestId('todo-due-date').fill('');
  await dialog.getByTestId('todo-submit').click();
  await expect(dialog).toBeHidden();

  const item = card(page, 'Ready');
  await expect(item).toBeVisible();
  await expect(item.getByText('Due 2099-01-01')).toHaveCount(0);
});

test('deletes a to-do', async ({ page }) => {
  await addTodo(page, { title: 'Throw away' });
  await card(page, 'Throw away').getByTestId('todo-delete').click();
  await expect(page.getByRole('heading', { name: 'Throw away' })).toHaveCount(0);
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
});

test('filters overdue items', async ({ page }) => {
  await addTodo(page, { title: 'Late', dueDate: '2001-01-01' });
  await addTodo(page, { title: 'Later', dueDate: '2099-01-01' });
  await page.getByTestId('filter-overdue').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Late']);

  await card(page, 'Late').getByTestId('todo-complete').click();
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
});

test('sorts by created time and due date', async ({ page }) => {
  // created_at is stored to the second, so back-to-back creates can tie.
  await addTodo(page, { title: 'Undated' });
  await page.waitForTimeout(1100);
  await addTodo(page, { title: 'Future', dueDate: '2099-01-01' });
  await page.waitForTimeout(1100);
  await addTodo(page, { title: 'Past', dueDate: '2001-01-01' });

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Past', 'Future', 'Undated']);

  await page.getByTestId('sort').click();
  await page.getByTestId('sort-oldest').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Undated', 'Future', 'Past']);

  await page.getByTestId('sort').click();
  await page.getByTestId('sort-due-soonest').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Undated', 'Past', 'Future']);

  await page.getByTestId('sort').click();
  await page.getByTestId('sort-due-latest').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Future', 'Past', 'Undated']);
});

test('shows an error when the list fails to load', async ({ page }) => {
  await page.route('**/api/v0/todos**', route => route.abort());
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
});
