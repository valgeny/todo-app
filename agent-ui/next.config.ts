import type { NextConfig } from 'next';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  output: 'standalone',
  // Monorepo: include workspace root in file tracing.
  outputFileTracingRoot: path.join(__dirname, '..'),
  serverExternalPackages: ['google-auth-library']
};

export default nextConfig;
