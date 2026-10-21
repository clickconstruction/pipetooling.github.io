/**
 * Messages, cut 10 (photos saved on arrival): our copy of each picture or file that comes on a text, kept the moment the
 * quo-webhook writes the text's line, since "Quo's link to the picture is best treated as temporary" (the prototype's
 * quo-messages-mockup.html draft 8, on branch spike/gc-mode). Each file is fetched once from Quo's link into the private
 * message-attachments bucket an email's files use (cut 6) and gets a `message_attachments` row, named and placed by
 * `quoMediaPlans` and written by `quoMediaRow` (src/lib/quo/mediaKeep.ts). One that does not read, or is over an email's
 * 25 MB, keeps its row marked `quo_not_copied`, so the line still says a picture came. Quo's retry keeps nothing twice
 * (`mediaToKeep`). Once kept, a photo on a ticked job goes to the job's photos in Drive with the photo-save sweep.
 */
import { keepsCopy, mediaToKeep, quoMediaPlans, quoMediaRow, type QuoMediaFetch, type QuoMediaPlan } from './gcKernels/lib/quo/mediaKeep.ts'
import type { QuoMedia } from './gcKernels/lib/quo/events.ts'
import { loadQuoApiKey } from './quoKey.ts'

const BUCKET = 'message-attachments'
/** How long one file's fetch may take before it is marked not copied. */
const FETCH_MS = 10_000

/** Quo's link, read once; a link that refuses a plain read is asked again with the API key (Vault's, else QUO_API_KEY). */
async function fetchMedia(url: string, apiKey: string): Promise<{ bytes: Uint8Array } | { failed: string }> {
  const read = async (headers: Record<string, string>) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(FETCH_MS) })
    return res
  }
  try {
    let res = await read({})
    if ((res.status === 401 || res.status === 403) && apiKey) res = await read({ Authorization: apiKey })
    if (!res.ok) return { failed: `Quo's link answered ${res.status}` }
    return { bytes: new Uint8Array(await res.arrayBuffer()) }
  } catch (e) {
    return { failed: e instanceof Error ? e.message : String(e) }
  }
}

/** Our copy, uploaded; the fetch's outcome as `quoMediaRow` takes it. */
// deno-lint-ignore no-explicit-any
async function keepOne(admin: any, plan: QuoMediaPlan, apiKey: string): Promise<QuoMediaFetch> {
  const got = await fetchMedia(plan.url, apiKey)
  if ('failed' in got) {
    console.warn('[quo-webhook] a picture was not copied', plan.bucket_path, got.failed)
    return { ok: false }
  }
  const fetched: QuoMediaFetch = { ok: true, bytes: got.bytes.length }
  // Over the cap: not uploaded, and the row says so.
  if (!keepsCopy(fetched)) return fetched
  const up = await admin.storage.from(BUCKET).upload(plan.bucket_path, got.bytes, { contentType: plan.mime ?? 'application/octet-stream', upsert: true })
  if (up.error) {
    console.warn('[quo-webhook] a picture did not upload', plan.bucket_path, up.error.message)
    return { ok: false, bytes: got.bytes.length }
  }
  return fetched
}

/**
 * Keeps a text's pictures and files on its line. A row that does not write throws, so the webhook answers 500 and Quo
 * sends the event again; a file that does not fetch or upload is only marked.
 */
// deno-lint-ignore no-explicit-any
export async function keepTextMedia(admin: any, messageId: string, quoId: string, media: readonly QuoMedia[]): Promise<void> {
  if (media.length === 0) return
  const { data: kept, error } = await admin.from('message_attachments').select('sort_order').eq('message_id', messageId)
  if (error) throw new Error(`message_attachments: ${error.message}`)
  const plans = mediaToKeep(quoMediaPlans(quoId, media), ((kept ?? []) as { sort_order: number }[]).map((k) => k.sort_order))
  if (plans.length === 0) return
  const { key: apiKey } = await loadQuoApiKey(admin, (k) => Deno.env.get(k))
  for (const plan of plans) {
    const fetched = await keepOne(admin, plan, apiKey)
    const { error: rowError } = await admin.from('message_attachments').insert(quoMediaRow(messageId, plan, fetched))
    if (rowError) throw new Error(`message_attachments: ${rowError.message}`)
  }
}
