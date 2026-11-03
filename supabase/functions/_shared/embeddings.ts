/**
 * Search by meaning (punch list #240, PR 4): Gemini's text embeddings behind one function, the key read from the secret
 * `GEMINI_API_KEY` at call time. Unset, `embeddingsSetup` answers null and the index keeps the words alone; set, every
 * indexed file's chunks get a vector in `file_index_chunks`, and a search embeds the query the same way. The rules are
 * pure in `embeddingsKernel.ts`. Setup: docs/DRIVE_INTAKE_SETUP.md → Search by meaning.
 */
import { EMBED_BATCH_MAX, EMBED_KEY_HEADER, EMBED_KEY_SECRET, EMBED_READ_MS, embedEndpoint, embedReadAnswer, embedRequestBody, type EmbedAnswer, type EmbedTask } from './embeddingsKernel.ts'

export interface EmbeddingsSetup {
  url: string
  /** Sent as a header, never in the URL: a network error's message carries the URL, and that message lands on a row. */
  key: string
}

/** The setup for this request, or null when the secret is not set. */
export function embeddingsSetup(): EmbeddingsSetup | null {
  const key = Deno.env.get(EMBED_KEY_SECRET)?.trim()
  return key ? { url: embedEndpoint(), key } : null
}

/** Texts into vectors, one batch at a time within `EMBED_READ_MS` each, or the provider's own reason. Never throws, never names the key. */
export async function embedTexts(setup: EmbeddingsSetup, texts: readonly string[], task: EmbedTask, waitMs = EMBED_READ_MS): Promise<EmbedAnswer> {
  const vectors: number[][] = []
  for (let i = 0; i < texts.length; i += EMBED_BATCH_MAX) {
    const batch = texts.slice(i, i + EMBED_BATCH_MAX)
    const stop = new AbortController()
    const timer = setTimeout(() => stop.abort(), waitMs)
    try {
      const res = await fetch(setup.url, { method: 'POST', headers: { 'Content-Type': 'application/json', [EMBED_KEY_HEADER]: setup.key }, body: JSON.stringify(embedRequestBody(batch, task)), signal: stop.signal })
      const text = await res.text()
      let body: unknown = text
      try {
        body = text ? JSON.parse(text) : null
      } catch { /* a non-JSON reply is reported as text */ }
      const answer = embedReadAnswer(res.status, body, batch.length)
      if (!answer.ok) return answer
      vectors.push(...answer.vectors)
    } catch (e) {
      if (stop.signal.aborted) return { ok: false, error: `Gemini did not answer within ${Math.round(waitMs / 1000)} s.` }
      return { ok: false, error: `The embedding call did not go through: ${(e instanceof Error ? e.message : String(e)).replace(setup.key, '…')}` }
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: true, vectors }
}
