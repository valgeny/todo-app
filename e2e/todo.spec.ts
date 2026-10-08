import type { Page } from '@playwright/test';
import { expect, resetTodos, test } from './fixture';

function card(page: Page, title: string) {
  return page.getByTestId('todo-card').filter({
    has: page.getByRole('heading', { level: 2, name: title, exact: true })
  });
}

async function addTodo(
  page: Page,
  todo: { title: string; description?: string; dueDate?: string },
  beforeSubmit?: () => Promise<void>
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
  if (beforeSubmit) {
    await beforeSubmit();
  }
  await dialog.getByTestId('todo-submit').click();
  await expect(dialog).toBeHidden();
}

const positive = { tag: '@positive' };
const negative = { tag: '@negative' };

test.beforeEach(async ({ page }) => {
  await resetTodos();
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: 'To-dos' })).toBeVisible();
});

test('shows an empty list', positive, async ({ page, takeScreenshot }) => {
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
  await takeScreenshot('Main goal');
});

test('creates a to-do', positive, async ({ page, takeScreenshot }) => {
  await addTodo(
    page,
    {
      title: 'Buy milk',
      description: 'Two litres',
      dueDate: '2099-01-01'
    },
    () => takeScreenshot('Before add')
  );

  const item = card(page, 'Buy milk');
  await expect(item.getByText('Two litres')).toBeVisible();
  await expect(item.getByText('Due 2099-01-01')).toBeVisible();
  await takeScreenshot('Main goal');
});

test('keeps Add disabled until the title has text', negative, async ({ page, takeScreenshot }) => {
  await page.getByTestId('add-todo').click();
  const dialog = page.getByTestId('todo-dialog');
  const add = dialog.getByTestId('todo-submit');
  await expect(add).toBeDisabled();
  await takeScreenshot('Before title');
  await dialog.getByTestId('todo-title').fill('   ');
  await expect(add).toBeDisabled();
  await takeScreenshot('Main goal');
  await dialog.getByTestId('todo-cancel').click();
  await expect(dialog).toBeHidden();
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
});

test('completes a to-do and filters open and done', positive, async ({ page, takeScreenshot }) => {
  await addTodo(page, { title: 'Walk the dog' });
  const item = card(page, 'Walk the dog');
  await takeScreenshot('Before complete');
  await item.getByTestId('todo-complete').click();

  await expect(item.getByRole('heading', { name: 'Walk the dog' })).toHaveCSS(
    'text-decoration-line',
    'line-through'
  );
  await expect(item.getByText('Done', { exact: true })).toBeVisible();
  await takeScreenshot('Main goal');

  await page.getByTestId('filter-incomplete').click();
  await expect(page.getByRole('heading', { name: 'Walk the dog' })).toHaveCount(0);
  await takeScreenshot('After open filter');

  await page.getByTestId('filter-completed').click();
  await expect(page.getByRole('heading', { name: 'Walk the dog' })).toBeVisible();
  await takeScreenshot('After done filter');

  await card(page, 'Walk the dog').getByTestId('todo-complete').click();
  await page.getByTestId('filter-incomplete').click();
  await expect(page.getByRole('heading', { name: 'Walk the dog' })).toBeVisible();
  await expect(card(page, 'Walk the dog').getByText('Done', { exact: true })).toHaveCount(0);
});

test('edits the title and clears the due date', positive, async ({ page, takeScreenshot }) => {
  await addTodo(page, { title: 'Draft', dueDate: '2099-01-01' });
  await takeScreenshot('Before edit');
  await card(page, 'Draft').getByTestId('todo-edit').click();
  const dialog = page.getByTestId('todo-dialog');
  await dialog.getByTestId('todo-title').fill('Ready');
  await dialog.getByTestId('todo-due-date').fill('');
  await dialog.getByTestId('todo-submit').click();
  await expect(dialog).toBeHidden();

  const item = card(page, 'Ready');
  await expect(item).toBeVisible();
  await expect(item.getByText('Due 2099-01-01')).toHaveCount(0);
  await takeScreenshot('Main goal');
});

test('deletes a to-do', positive, async ({ page, takeScreenshot }) => {
  await addTodo(page, { title: 'Throw away' });
  await takeScreenshot('Before delete');
  await card(page, 'Throw away').getByTestId('todo-delete').click();
  await expect(page.getByRole('heading', { name: 'Throw away' })).toHaveCount(0);
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
  await takeScreenshot('Main goal');
});

test('filters overdue items', positive, async ({ page, takeScreenshot }) => {
  await addTodo(page, { title: 'Late', dueDate: '2001-01-01' });
  await addTodo(page, { title: 'Later', dueDate: '2099-01-01' });
  await takeScreenshot('Before overdue filter');
  await page.getByTestId('filter-overdue').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Late']);
  await takeScreenshot('Main goal');

  await card(page, 'Late').getByTestId('todo-complete').click();
  await expect(page.getByText('No to-dos in this view.')).toBeVisible();
});

test('sorts by created time and due date', positive, async ({ page, takeScreenshot }) => {
  // created_at is stored to the second, so back-to-back creates can tie.
  await addTodo(page, { title: 'Undated' });
  await page.waitForTimeout(1100);
  await addTodo(page, { title: 'Future', dueDate: '2099-01-01' });
  await page.waitForTimeout(1100);
  await addTodo(page, { title: 'Past', dueDate: '2001-01-01' });

  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Past', 'Future', 'Undated']);
  await takeScreenshot('Before sort');

  await page.getByTestId('sort').click();
  await page.getByTestId('sort-oldest').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Undated', 'Future', 'Past']);
  await takeScreenshot('After oldest');

  await page.getByTestId('sort').click();
  await page.getByTestId('sort-due-soonest').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Undated', 'Past', 'Future']);
  await takeScreenshot('After due soonest');

  await page.getByTestId('sort').click();
  await page.getByTestId('sort-due-latest').click();
  await expect(page.getByRole('heading', { level: 2 })).toHaveText(['Future', 'Past', 'Undated']);
  await takeScreenshot('Main goal');
});

test('shows an error when the list fails to load', negative, async ({ page, takeScreenshot }) => {
  await takeScreenshot('Before reload');
  await page.route('**/api/v0/todos**', route => route.abort());
  await page.reload();
  await expect(page.getByRole('alert')).toBeVisible();
  await takeScreenshot('Main goal');
});
