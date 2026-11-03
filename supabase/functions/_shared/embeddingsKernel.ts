/**
 * Search by meaning (punch list #240, PR 4): the rules, pure, so `src/lib/documents/embeddingsKernel.test.ts` reads
 * them as `_shared/embeddings.ts` does. The provider is Gemini's `gemini-embedding-001` at 768 dimensions (the card's
 * recommended default: one key in the GCP project the app already has, no new vendor), the key read from the secret
 * `GEMINI_API_KEY`. This file knows how a file's text is cut into chunks, what one request carries, how the answer and
 * the refusal read, the dimension the table is made with, and when a file is tried again. No imports.
 */

/** The model and the dimension `file_index_chunks.embedding` is made with: fixed at table creation, so a change is a new table. */
export const EMBED_MODEL = 'gemini-embedding-001'
export const EMBED_DIM = 768
/** The secret that holds the key; unset means search by meaning is not set up and the words alone answer. */
export const EMBED_KEY_SECRET = 'GEMINI_API_KEY'
/** A chunk: about 800 tokens of text with some overlap, so a thought cut by the edge is whole in one of them. */
export const CHUNK_CHARS = 3200
export const CHUNK_OVERLAP = 400
/** At most this many chunks per file (the first 112k characters): the cost cap, and a spec book's front half is its meaning. */
export const CHUNKS_PER_FILE_MAX = 40
/** One request carries at most this many chunks (the provider's batch cap). */
export const EMBED_BATCH_MAX = 100
/** A file the provider refused is tried again after this long. */
export const EMBED_RETRY_MS = 24 * 60 * 60 * 1000
/** Past this cosine distance a chunk is not about the query: the vector side answers nothing for it (tunable; set from live reads). */
export const MEANING_MAX_DISTANCE = 0.45
/** How many files the sweep embeds per run once set up (the rows indexed before the key was set catch up by themselves). */
export const SWEEP_EMBED_ROWS = 10
/** The provider's answer is waited for this long; past it the file is refused for the day, never a request held open. */
export const EMBED_READ_MS = 20_000
/** What one chunk's vector costs in CPU to read and write back (768 numbers each way), for the pass's clock: small, but forty chunks a file over forty files is not. */
export const EMBED_CPU_MS_PER_CHUNK = 0.5
/** The header the key rides in: never the URL, which an error message copies into a row every office reader sees. */
export const EMBED_KEY_HEADER = 'x-goog-api-key'

export type EmbedTask = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

/** A file's text as chunks, cut on a space near the edge when one is close and started on a word, each with its place. */
export function chunkText(text: string, opts: { size?: number; overlap?: number; max?: number } = {}): { chunk_no: number; text: string }[] {
  const size = opts.size ?? CHUNK_CHARS
  const overlap = Math.min(opts.overlap ?? CHUNK_OVERLAP, Math.floor(size / 2))
  const max = opts.max ?? CHUNKS_PER_FILE_MAX
  const clean = text.replace(/\s+/g, ' ').trim()
  const out: { chunk_no: number; text: string }[] = []
  if (!clean) return out
  let at = 0
  while (at < clean.length && out.length < max) {
    let end = Math.min(clean.length, at + size)
    if (end < clean.length) {
      const sp = clean.lastIndexOf(' ', end)
      if (sp > at + size / 2) end = sp
    }
    out.push({ chunk_no: out.length, text: clean.slice(at, end).trim() })
    if (end >= clean.length) break
    at = Math.max(at + 1, end - overlap)
    // The next chunk opens on a word, never mid-word: its opening is the line a hit found by meaning shows.
    const word = clean.indexOf(' ', at)
    if (word > 0 && word < end) at = word + 1
  }
  return out
}

/** Whether the chunks stop short of the text (the cap): the row keeps a note, so a search knows the back half is unread. */
export function chunksCut(text: string, chunks: readonly { text: string }[]): boolean {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean || chunks.length === 0) return false
  return !clean.endsWith(chunks[chunks.length - 1]!.text)
}

/** The note a row keeps when its chunks stop short of its text. */
export function chunksCutNote(n: number): string {
  return `Embedded the first ${n} chunks; the text runs longer, so its back half is found by the words alone.`
}

/** The endpoint one batch goes to; the key rides in `EMBED_KEY_HEADER`, never here. */
export function embedEndpoint(): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${EMBED_MODEL}:batchEmbedContents`
}

/** One batch request: every text with the task and the dimension. */
export function embedRequestBody(texts: readonly string[], task: EmbedTask): Record<string, unknown> {
  return {
    requests: texts.map((text) => ({ model: `models/${EMBED_MODEL}`, content: { parts: [{ text }] }, taskType: task, outputDimensionality: EMBED_DIM })),
  }
}

export type EmbedAnswer = { ok: true; vectors: number[][] } | { ok: false; error: string }

/** The provider's answer as the index reads it: one vector per text, each the dimension, or its own reason in one line. */
export function embedReadAnswer(status: number, body: unknown, expected: number): EmbedAnswer {
  const o = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const err = o.error && typeof o.error === 'object' ? (o.error as Record<string, unknown>) : null
  if (status < 200 || status >= 300 || err) {
    const code = err && typeof err.status === 'string' ? err.status : `HTTP ${status}`
    const message = err && typeof err.message === 'string' ? err.message : typeof body === 'string' ? body.slice(0, 300) : 'no reason given'
    return { ok: false, error: `Gemini answered ${code}: ${message}`.slice(0, 1000) }
  }
  const list = Array.isArray(o.embeddings) ? o.embeddings : null
  if (!list || list.length !== expected) return { ok: false, error: `Gemini answered ${list ? list.length : 'no'} embeddings for ${expected} texts.` }
  const vectors: number[][] = []
  for (const e of list) {
    const values = e && typeof e === 'object' && Array.isArray((e as { values?: unknown }).values) ? ((e as { values: unknown[] }).values as unknown[]) : null
    if (!values || values.length !== EMBED_DIM || !values.every((v) => typeof v === 'number' && Number.isFinite(v))) return { ok: false, error: `Gemini answered a vector of ${values ? values.length : 'no'} numbers; the table takes ${EMBED_DIM}.` }
    vectors.push(values as number[])
  }
  return { ok: true, vectors }
}

/** Whether a file's text is due for embedding: never tried, or tried over a day ago; a row embedded since its last index is current. */
export function embedDue(row: { embedded_at: string | null; indexed_at: string; embed_tried_at: string | null }, now: Date, retryMs = EMBED_RETRY_MS): boolean {
  if (row.embedded_at && Date.parse(row.embedded_at) >= Date.parse(row.indexed_at)) return false
  if (!row.embed_tried_at) return true
  const t = Date.parse(row.embed_tried_at)
  return !Number.isFinite(t) || now.getTime() - t >= retryMs
}

/** How a hit was found, as the hybrid RPC names it. */
export type FoundBy = 'words' | 'meaning' | 'both'

/** The words the probe and the report use for the provider's state. */
export function embedStateWords(keySet: boolean): string {
  return keySet ? `Search by meaning is set up: ${EMBED_MODEL} at ${EMBED_DIM} dimensions.` : `Search by meaning is not set up: set the secret ${EMBED_KEY_SECRET} (docs/DRIVE_INTAKE_SETUP.md → Search by meaning) and every indexed file is embedded from then on.`
}
