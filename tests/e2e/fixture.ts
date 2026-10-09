import type { ConsoleMessage, Page, TestInfo } from '@playwright/test';
import { test as base, expect } from '@playwright/test';

const apiOrigin = 'http://127.0.0.1:8090';

type TodoRow = { todoId: string };

type BrowserLog = {
  type: string;
  text: string;
};

type Fixtures = {
  takeScreenshot: (name: string) => Promise<void>;
  browserLogs: BrowserLog[];
  endScreenshot: undefined;
};

async function attachScreenshot(
  page: Page,
  testInfo: TestInfo,
  name: string,
  fileName: string
): Promise<void> {
  const path = testInfo.outputPath(fileName);
  await page.screenshot({ path, fullPage: true });
  await testInfo.attach(name, { path, contentType: 'image/png' });
}

function screenshotFileName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug || 'screenshot'}.png`;
}

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

export const test = base.extend<Fixtures>({
  browserLogs: [
    async ({ page }, use, testInfo) => {
      const logs: BrowserLog[] = [];
      const onConsole = (message: ConsoleMessage) => {
        logs.push({ type: message.type(), text: message.text() });
      };
      const onPageError = (error: Error) => {
        logs.push({ type: 'pageerror', text: error.message });
      };
      page.on('console', onConsole);
      page.on('pageerror', onPageError);
      await use(logs);
      page.off('console', onConsole);
      page.off('pageerror', onPageError);
      const body = logs.map(entry => `[${entry.type}] ${entry.text}`).join('\n');
      await testInfo.attach('Browser logs', {
        body: body || '(no browser logs)',
        contentType: 'text/plain'
      });
    },
    { auto: true }
  ],
  takeScreenshot: async ({ page }, use, testInfo) => {
    const used = new Map<string, number>();
    await use(async (name: string) => {
      const baseName = screenshotFileName(name);
      const count = used.get(baseName) ?? 0;
      used.set(baseName, count + 1);
      const fileName = count === 0 ? baseName : baseName.replace(/\.png$/, `-${count + 1}.png`);
      await attachScreenshot(page, testInfo, name, fileName);
    });
  },
  endScreenshot: [
    async ({ page, browserLogs }, use, testInfo) => {
      void browserLogs;
      await use();
      if (testInfo.status !== testInfo.expectedStatus) {
        return;
      }
      await attachScreenshot(page, testInfo, 'After goal', 'goal.png');
    },
    { auto: true }
  ]
});

export { expect };
