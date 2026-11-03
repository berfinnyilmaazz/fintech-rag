import type { McpServer } from '@modelcontextprotocol/server';
import { ask, search } from '@rag/core';
import { SearchRequestSchema } from '@rag/shared';
import { z } from 'zod';

/**
 * The MCP surface is a **transport adapter**, not a second implementation.
 *
 * Both tools call the same `search` and `ask` functions the chat page and the API routes
 * call, and their input schemas are the same Zod schemas the HTTP layer validates against.
 * That is how "expose search as an MCP tool" is answered architecturally: there is one
 * retrieval pipeline, and MCP is one more way to reach it. Nothing about ranking, the
 * no-answer guard or citation validation is restated here — if it were, the two surfaces
 * could disagree.
 */

/** Reused verbatim from the HTTP layer, minus nothing. */
const SearchInput = SearchRequestSchema;

const AnswerInput = z.object({
  query: z.string().min(1).max(500).describe('A natural-language question about the corpus.'),
  topK: z.number().int().min(1).max(20).default(6).describe('How many passages to retrieve.'),
});

export function registerTools(server: McpServer): void {
  server.registerTool(
    'search_documents',
    {
      title: 'Search the Vantor payments corpus',
      description:
        'Hybrid semantic + keyword retrieval over the internal corpus. Returns ranked passages ' +
        'with their fused score, the rank each arm gave them, and document metadata. Does not ' +
        'call a language model — use this when you want sources rather than an answer.',
      inputSchema: SearchInput,
    },
    async (args) => {
      const result = await search({
        query: args.query,
        topK: args.topK,
        mode: args.mode,
        docType: args.docType,
        project: args.project,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                query: args.query,
                mode: result.mode,
                topCosine: result.topCosine,
                latencyMs: result.latencyMs,
                results: result.chunks.map((chunk, index) => ({
                  rank: index + 1,
                  title: chunk.title,
                  sourcePath: chunk.sourcePath,
                  docType: chunk.docType,
                  project: chunk.project,
                  period: chunk.period,
                  status: chunk.status,
                  score: chunk.score,
                  cosine: chunk.cosine,
                  vectorRank: chunk.vectorRank,
                  keywordRank: chunk.keywordRank,
                  content: chunk.content,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    'answer_question',
    {
      title: 'Answer a question from the corpus',
      description:
        'Retrieves passages and produces a grounded answer with citations back to the source ' +
        'documents. When the corpus does not cover the question it says so and returns no ' +
        'citations rather than inventing them.',
      inputSchema: AnswerInput,
    },
    async (args) => {
      // `log: false` keeps MCP traffic out of the dashboard's search analytics, which
      // describe what people asked in the app.
      const result = await ask({ query: args.query, topK: args.topK, log: false });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                answer: result.answer,
                grounded: result.grounded,
                mode: result.mode,
                topCosine: result.topCosine,
                citations: result.citations,
                sources: result.passages.map((passage, index) => ({
                  index: index + 1,
                  title: passage.title,
                  sourcePath: passage.sourcePath,
                  status: passage.status,
                })),
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
