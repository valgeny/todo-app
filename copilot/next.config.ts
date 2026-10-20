import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: include workspace root in file tracing.
  outputFileTracingRoot: path.join(__dirname, '..'),
  // Local ADC fallback only; Cloud Run mints ID tokens via the metadata server.
  serverExternalPackages: ['google-auth-library']
};

export default nextConfig;
