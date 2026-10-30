import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { loadModelKey, modelRefusalWhy, type ModelKeyDb } from '../_shared/modelKey.ts'
import { base64OfBytes } from '../_shared/messagesEmailFiles.ts'
import {
  BILL_BETAS,
  BILL_FILE_MAX_BYTES,
  BILL_MODEL,
  BILL_READ_DAILY_CAP,
  BILL_READ_ROLES,
  BILL_READ_SWITCH_KEY,
  BILL_READ_WORDS,
  BILL_SCHEMA,
  BILL_SYSTEM,
  billCostCents,
  billFromAnswer,
  billMedia,
  billReadIsOn,
  billStoragePath,
  billUserMessage,
  readBillRequest,
  type BillRead,
  type BillReadRequest,
} from '../_shared/billRead.ts'

/**
 * bill-read (punch list #179 PR 2, v2.6088): a supply-house bill's PDF, or a picture of the counter ticket, read into
 * the fields of the Add invoice window for a person to check and save. The machine fills, a person presses: this
 * function writes no invoice. It fetches the file from our bucket (a file on the house's thread, or a file dropped on
 * the form, which it puts in the bucket first), asks Claude Sonnet 5.5 for one JSON object held to `BILL_SCHEMA`
 * (structured output; Anthropic's default fallback on a refusal), reads the answer into cents and a kind
 * (`readBillAnswer`), writes one row to `supply_bill_reads` and answers the read with where the file is and what the
 * call cost. The matching (the job, the pair), the checks (the sum, the duplicate) and the words are the app's kernels
 * in `src/lib/materials/bills/`, over this answer.
 *
 * The caller: the office (dev, master_technician, assistant, controller), a real account, not read-only, since a fill
 * costs money. The switch `app_settings.bill_read_on_v1` must read 'true', except for a dev, who may try it off. The
 * function stops at BILL_READ_DAILY_CAP fills in a rolling day. The key: Vault first (`model_secret_get`, the Model
 * keys card), then ANTHROPIC_API_KEY; with neither the answer is 409 `noKey` and the form stays as it is.
 *
 *   POST { attachment_id, supply_house_id? }                   a file on the house's thread
 *   POST { supply_house_id, file: { name, mime, base64 } }     another file, kept under bills/<house>/<uuid>/<name>
 *   either with model: 'claude-haiku-5-5' for a dev's trial on the made-up set
 *   200  { ok: true, read: BillRead, file: { path, name, mime, attachmentId, supplyHouseId }, model, cents, readId }
 *   409  { ok: false, error: 'off' | 'noKey', words }   429 'capped'   400 'badRequest'   404 'notHere'
 *   401 'signIn'   403 'notAllowed'   502 'refused' | 'failed' with `why`, Anthropic's own reason, never the key
 *
 * Gateway verify_jwt = false: the function checks the bearer itself.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

const BUCKET = 'message-attachments'

type FilePlace = { path: string; name: string; mime: string | null; attachmentId: string | null; supplyHouseId: string | null }

/** A thread file: its row, its copy in the bucket, and the house its line's contact is. */
async function threadFile(admin: SupabaseClient, attachmentId: string, supplyHouseId: string | null): Promise<{ place: FilePlace; bytes: Uint8Array } | { problem: 'notHere' | 'tooBig' }> {
  const { data: row } = await admin.from('message_attachments').select('id, name, mime, bucket_path, kind, message_id').eq('id', attachmentId).maybeSingle()
  const a = row as { id: string; name: string; mime: string | null; bucket_path: string | null; kind: string; message_id: string } | null
  if (!a || a.kind === 'link' || !a.bucket_path) return { problem: 'notHere' }
  let houseId = supplyHouseId
  if (!houseId) {
    const { data: msg } = await admin.from('messages').select('contact_id').eq('id', a.message_id).maybeSingle()
    const contactId = (msg as { contact_id?: string | null } | null)?.contact_id ?? null
    if (contactId) {
      const { data: contact } = await admin.from('contacts').select('supply_house_id').eq('id', contactId).maybeSingle()
      houseId = (contact as { supply_house_id?: string | null } | null)?.supply_house_id ?? null
    }
  }
  const { data: blob, error } = await admin.storage.from(BUCKET).download(a.bucket_path)
  if (error || !blob) return { problem: 'notHere' }
  if (blob.size > BILL_FILE_MAX_BYTES) return { problem: 'tooBig' }
  const bytes = new Uint8Array(await blob.arrayBuffer())
  return { place: { path: a.bucket_path, name: a.name, mime: a.mime, attachmentId: a.id, supplyHouseId: houseId }, bytes }
}

/** A dropped-in file: decoded, and put in the bucket under the house before it is read, so the row can keep it. */
async function uploadedFile(admin: SupabaseClient, r: Extract<BillReadRequest, { source: 'upload' }>): Promise<{ place: FilePlace; bytes: Uint8Array } | { problem: 'badBytes' | 'notStored' }> {
  let bytes: Uint8Array
  try {
    const binary = atob(r.base64)
    bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  } catch {
    return { problem: 'badBytes' }
  }
  const path = billStoragePath(r.supplyHouseId, crypto.randomUUID(), r.name)
  const { error } = await admin.storage.from(BUCKET).upload(path, bytes, { contentType: r.mime || 'application/octet-stream', upsert: false })
  if (error) {
    console.error('[bill-read] upload', error.message)
    return { problem: 'notStored' }
  }
  return { place: { path, name: r.name, mime: r.mime || null, attachmentId: null, supplyHouseId: r.supplyHouseId }, bytes }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'badRequest', words: 'Ask for the fill with POST.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'failed', words: BILL_READ_WORDS.notSetUp }, 503)

    // ── Who is asking ──────────────────────────────────────────────────────
    const authHeader = req.headers.get('Authorization') ?? ''
    const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!jwt) return json({ ok: false, error: 'signIn', words: BILL_READ_WORDS.signIn }, 401)
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
    const {
      data: { user },
      error: authError,
    } = await userClient.auth.getUser(jwt)
    if (authError || !user) return json({ ok: false, error: 'signIn', words: BILL_READ_WORDS.signIn }, 401)

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const { data: who } = await admin.from('users').select('id, role, read_only').match(REAL_ACCOUNT).eq('id', user.id).maybeSingle()
    const me = who as { role?: string; read_only?: boolean } | null
    const role = String(me?.role ?? '')
    if (!me || me.read_only || !BILL_READ_ROLES.has(role)) return json({ ok: false, error: 'notAllowed', words: BILL_READ_WORDS.notAllowed }, 403)

    // ── The switch, the body, the cap ──────────────────────────────────────
    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', BILL_READ_SWITCH_KEY).maybeSingle()
    if (!billReadIsOn((setting as { value_text?: string | null } | null)?.value_text) && role !== 'dev') return json({ ok: false, error: 'off', words: BILL_READ_WORDS.off }, 409)

    const read = readBillRequest(await req.json().catch(() => null))
    if (!read.ok) return json({ ok: false, error: 'badRequest', words: read.why }, 400)
    const request = read.request
    // The trial model is a dev's to pick; everyone else fills with the one the card chose.
    const model = role === 'dev' ? request.model : BILL_MODEL

    const since = new Date(Date.now() - 24 * 60 * 60_000).toISOString()
    const { count } = await admin.from('supply_bill_reads').select('id', { count: 'exact', head: true }).gte('read_at', since)
    if ((count ?? 0) >= BILL_READ_DAILY_CAP) return json({ ok: false, error: 'capped', words: BILL_READ_WORDS.capped }, 429)

    const { key } = await loadModelKey(admin as unknown as ModelKeyDb, (k) => Deno.env.get(k), 'anthropic')
    if (!key) return json({ ok: false, error: 'noKey', words: BILL_READ_WORDS.noKey }, 409)

    // ── The file ───────────────────────────────────────────────────────────
    const got = request.source === 'attachment' ? await threadFile(admin, request.attachmentId, request.supplyHouseId) : await uploadedFile(admin, request)
    if ('problem' in got) {
      if (got.problem === 'tooBig') return json({ ok: false, error: 'badRequest', words: `The file is over ${Math.round(BILL_FILE_MAX_BYTES / 1_000_000)} MB. Send a smaller scan.` }, 400)
      if (got.problem === 'badBytes') return json({ ok: false, error: 'badRequest', words: 'The file came with bytes that could not be read.' }, 400)
      if (got.problem === 'notStored') return json({ ok: false, error: 'failed', words: 'The file could not be kept. Try again.' }, 502)
      return json({ ok: false, error: 'notHere', words: BILL_READ_WORDS.notHere }, 404)
    }
    const { place, bytes } = got
    const media = billMedia(place.mime, place.name)
    if (!media) return json({ ok: false, error: 'badRequest', words: BILL_READ_WORDS.notReadable }, 400)

    let houseName = ''
    if (place.supplyHouseId) {
      const { data: house } = await admin.from('supply_houses').select('name').eq('id', place.supplyHouseId).maybeSingle()
      houseName = (house as { name?: string } | null)?.name ?? ''
    }

    // ── The read, and its row in the ledger ────────────────────────────────
    const ledger = async (fields: { ok: boolean; answer: BillRead | null; why: string | null; usage?: { input_tokens?: number; output_tokens?: number } | null }) => {
      const { data } = await admin
        .from('supply_bill_reads')
        .insert({
          read_by: user.id,
          supply_house_id: place.supplyHouseId,
          attachment_id: place.attachmentId,
          file_path: place.path,
          file_name: place.name,
          file_mime: place.mime,
          model,
          ok: fields.ok,
          input_tokens: fields.usage?.input_tokens ?? null,
          output_tokens: fields.usage?.output_tokens ?? null,
          cents: fields.usage ? billCostCents(model, fields.usage) : null,
          answer: fields.answer,
          why: fields.why,
        })
        .select('id')
        .maybeSingle()
      return (data as { id?: string } | null)?.id ?? null
    }

    const data = base64OfBytes(bytes)
    const document =
      media.kind === 'pdf'
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
        : { type: 'image' as const, source: { type: 'base64' as const, media_type: media.mediaType, data } }
    const client = new Anthropic({ apiKey: key })
    let answer: Awaited<ReturnType<typeof client.beta.messages.create>>
    try {
      answer = await client.beta.messages.create({
        model,
        max_tokens: 8192,
        // Sonnet goes to Anthropic's default fallback on a refusal; Haiku has none.
        ...(model === BILL_MODEL ? { betas: [...BILL_BETAS], fallbacks: 'default' as const } : {}),
        system: BILL_SYSTEM,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: BILL_SCHEMA } },
        messages: [{ role: 'user', content: [document, { type: 'text', text: billUserMessage(houseName) }] }],
      })
    } catch (e) {
      // The reason rides back as `why`: Anthropic's own type and message, never the key.
      const refusal = modelRefusalWhy(e)
      console.error('[bill-read]', refusal.status ?? '', refusal.why)
      const readId = await ledger({ ok: false, answer: null, why: refusal.why })
      return json({ ok: false, error: 'failed', words: BILL_READ_WORDS.failed, why: refusal.why, readId }, 502)
    }
    if (!('content' in answer)) {
      const readId = await ledger({ ok: false, answer: null, why: 'no answer' })
      return json({ ok: false, error: 'failed', words: BILL_READ_WORDS.failed, readId }, 502)
    }
    const usage = answer.usage as { input_tokens?: number; output_tokens?: number }
    if (answer.stop_reason === 'refusal') {
      const readId = await ledger({ ok: false, answer: null, why: 'refusal', usage })
      return json({ ok: false, error: 'refused', words: BILL_READ_WORDS.refused, readId }, 502)
    }
    const bill = billFromAnswer(answer.content as ReadonlyArray<{ type: string; text?: string }>)
    if (!bill) {
      const readId = await ledger({ ok: false, answer: null, why: 'not the shape asked for', usage })
      return json({ ok: false, error: 'failed', words: BILL_READ_WORDS.failed, readId }, 502)
    }
    const readId = await ledger({ ok: true, answer: bill, why: null, usage })
    return json({ ok: true, read: bill, file: place, model: answer.model, cents: billCostCents(model, usage), readId })
  } catch (e) {
    const refusal = modelRefusalWhy(e)
    console.error('[bill-read]', refusal.status ?? '', refusal.why)
    return json({ ok: false, error: 'failed', words: BILL_READ_WORDS.failed, why: refusal.why }, 502)
  }
})
