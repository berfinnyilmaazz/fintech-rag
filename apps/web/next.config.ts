import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import type { NextConfig } from 'next';

/**
 * Next reads .env relative to its own project root, which in a monorepo is apps/web — but
 * the repo keeps one .env at the top so the CLI scripts, the MCP server and the web app
 * cannot drift apart. Loading it here populates process.env before the config is used, for
 * both dev and build.
 */
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '../../.env'), quiet: true });

const nextConfig: NextConfig = {
  // Workspace packages ship raw TypeScript with no build step, so Next compiles them.
  transpilePackages: ['@rag/core', '@rag/db', '@rag/shared'],

  // Verified against next@16.3.1's config-shared.d.ts: `serverExternalPackages` is the
  // current key and `serverComponentsExternalPackages` is deprecated.
  //
  // onnxruntime-node loads a native .node binary; bundling it breaks the build rather
  // than failing at runtime, which is why this only shows up in `next build`.
  serverExternalPackages: ['@huggingface/transformers', 'onnxruntime-node', 'sharp'],
};

export default nextConfig;
