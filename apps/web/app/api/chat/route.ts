import { ask, NO_ANSWER_COSINE_THRESHOLD } from '@rag/core';
import { type ChatEvent, ChatRequestSchema } from '@rag/shared';
import { toErrorResponse } from '@/lib/errors';
import { requireUser } from '@/lib/guards';
import { CHAT_LIMIT, consumeToken } from '@/lib/rate-limit';
import { parseJsonBody } from '@/lib/request';

/**
 * Streaming grounded answers as newline-delimited JSON.
 *
 * The AI SDK offers `toTextStreamResponse()` and `toUIMessageStreamResponse()` for handing
 * a model stream straight through, and neither fits: citations are validated against the
 * retrieved passages only once the answer is complete, so the response has to carry a
 * terminal event the model never produced. `ask()` already exposes an `onToken` hook, which
 * keeps the whole pipeline — guard, generation, validation, logging — in core with the
 * route as transport.
 *
 * Streaming is not decoration here. Generated answers measured 6-20 s end to end against
 * the free tier; without it the page shows nothing for twenty seconds.
 */
export async function POST(request: Request) {
  try {
    const user = await requireUser();
    consumeToken(`chat:${user.id}`, CHAT_LIMIT);

    const body = await parseJsonBody(request, ChatRequestSchema);
    const encoder = new TextEncoder();

    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: ChatEvent) => {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        };

        try {
          const result = await ask({
            query: body.query,
            topK: body.topK,
            userId: user.id,
            onToken: (value) => send({ type: 'token', value }),
          });

          send({
            type: 'done',
            answer: result.answer,
            citations: result.citations,
            grounded: result.grounded,
            mode: result.mode,
            topCosine: result.topCosine,
            passages: result.passages,
            latencyMs: result.latencyMs,
            retrievalMs: result.retrievalMs,
            threshold: NO_ANSWER_COSINE_THRESHOLD,
          });
        } catch (error: unknown) {
          // The response has already started, so a failure cannot change the status code.
          // It goes down the stream as an error event instead of dying silently.
          console.error('Chat stream failed:', error);
          send({
            type: 'error',
            code: 'INTERNAL_ERROR',
            message: 'The answer could not be completed.',
          });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'application/x-ndjson; charset=utf-8',
        'Cache-Control': 'no-store',
        // Without this, a proxy that buffers the body defeats the point of streaming.
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
