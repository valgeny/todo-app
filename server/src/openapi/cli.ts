import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { buildOpenApiDocument } from '@/openapi/buildOpenApi';

async function main(): Promise<void> {
  const repoRoot = resolve(__dirname, '../../..');
  const specPath = join(repoRoot, 'postman/specs/openapi.json');
  const redocDir = join(repoRoot, 'redoc-report');
  const redocPath = join(redocDir, 'index.html');

  const document = buildOpenApiDocument();
  mkdirSync(dirname(specPath), { recursive: true });
  writeFileSync(specPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`Wrote OpenAPI spec → ${specPath}`);

  const { execFileSync } = await import('node:child_process');
  mkdirSync(redocDir, { recursive: true });
  execFileSync('yarn', ['redocly', 'build-docs', specPath, '--output', redocPath], {
    cwd: join(repoRoot, 'server'),
    stdio: 'inherit'
  });
  // Keep the raw spec next to the HTML for download / tooling.
  writeFileSync(join(redocDir, 'openapi.json'), `${JSON.stringify(document, null, 2)}\n`, 'utf8');
  console.log(`Wrote Redoc site → ${redocPath}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
