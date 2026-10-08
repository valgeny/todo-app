import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, 'src');

function readEnvValue(file: string, key: string): string {
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const separator = trimmed.indexOf('=');
    if (separator === -1 || trimmed.slice(0, separator).trim() !== key) {
      continue;
    }
    let value = trimmed.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    return value;
  }
  throw new Error(`${key} is missing from ${file}`);
}

function envName(mode: string): string {
  if (mode === 'development' || mode === 'production') {
    return 'local';
  }
  return mode;
}

export default defineConfig(({ mode }) => {
  const envFile = path.resolve(root, 'config', `.env.${envName(mode)}`);
  if (!fs.existsSync(envFile)) {
    throw new Error(`Missing environment file ${envFile}`);
  }
  const origin = readEnvValue(envFile, 'VITE_ORIGIN');
  const apiOrigin = readEnvValue(envFile, 'VITE_API_ORIGIN');
  const port = Number(new URL(origin).port);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error(`VITE_ORIGIN in ${envFile} must include a port`);
  }

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_ORIGIN': JSON.stringify(apiOrigin)
    },
    resolve: {
      alias: {
        '@': src
      }
    },
    server: {
      port
    },
    preview: {
      port
    }
  };
});
