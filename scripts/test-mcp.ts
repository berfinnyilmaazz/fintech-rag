import 'dotenv/config';
import { resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';

/**
 * Drives the stdio server the way Claude Desktop would: spawns it, lists its tools, then
 * calls both. This is the check that the MCP surface actually works end to end rather than
 * merely compiling.
 */

const SERVER = resolve(process.cwd(), 'apps/mcp/src/stdio.ts');

function textOf(result: { content: Array<{ type: string; text?: string }> }): string {
  return result.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text ?? '')
    .join('\n');
}

async function main(): Promise<void> {
  const transport = new StdioClientTransport({
    command: process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm',
    args: ['exec', 'tsx', SERVER],
    cwd: process.cwd(),
    // The server reads DATABASE_URL and the model settings from the repo-root .env, but
    // pass them through too so this mirrors a real client config.
    env: {
      ...process.env,
      DATABASE_URL: process.env.DATABASE_URL ?? '',
    } as Record<string, string>,
    stderr: 'pipe',
  });

  const client = new Client({ name: 'test-harness', version: '1.0.0' });

  console.log('connecting to the stdio server…');
  await client.connect(transport);
  console.log('connected\n');

  // ── (a) tools/list ────────────────────────────────────────────────────────────────
  const { tools } = await client.listTools();
  console.log(`tools/list → ${tools.length} tools`);
  for (const tool of tools) {
    console.log(`  ${tool.name}`);
    console.log(`    ${tool.description?.slice(0, 90)}…`);
    const properties = Object.keys(
      (tool.inputSchema as { properties?: Record<string, unknown> }).properties ?? {},
    );
    console.log(`    input: ${properties.join(', ')}`);
  }

  // ── (a) search_documents ──────────────────────────────────────────────────────────
  console.log('\ncalling search_documents("How do I create a payment with the current API?")');
  const search = await client.callTool({
    name: 'search_documents',
    arguments: { query: 'How do I create a payment with the current API?', topK: 3 },
  });

  const searchPayload = JSON.parse(textOf(search as never)) as {
    mode: string;
    topCosine: number;
    results: Array<{ rank: number; sourcePath: string; score: number; status: string }>;
  };
  console.log(`  mode ${searchPayload.mode} · topCosine ${searchPayload.topCosine.toFixed(4)}`);
  for (const row of searchPayload.results) {
    console.log(
      `  ${row.rank}. ${row.score.toFixed(6)}  ${row.status.padEnd(11)} ${row.sourcePath}`,
    );
  }

  // ── (b) answer_question, out of corpus ────────────────────────────────────────────
  console.log('\ncalling answer_question("What is the parental leave policy at Vantor?")');
  const answer = await client.callTool({
    name: 'answer_question',
    arguments: { query: 'What is the parental leave policy at Vantor?' },
  });

  const answerPayload = JSON.parse(textOf(answer as never)) as {
    answer: string;
    grounded: boolean;
    citations: unknown[];
    topCosine: number | null;
  };
  console.log(`  answer    : ${JSON.stringify(answerPayload.answer)}`);
  console.log(`  grounded  : ${answerPayload.grounded}`);
  console.log(`  citations : ${answerPayload.citations.length}`);
  console.log(`  topCosine : ${answerPayload.topCosine?.toFixed(4) ?? 'n/a'}`);

  await client.close();
  console.log('\nclosed');
}

main().catch((error: unknown) => {
  console.error('\ntest-mcp failed:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
