import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'npm:@anthropic-ai/sdk@1.3.0'
import { REAL_ACCOUNT } from '../_shared/realAccount.ts'
import { loadModelKey, modelRefusalWhy, type ModelKeyDb } from '../_shared/modelKey.ts'
import { base64OfBytes } from '../_shared/messagesEmailFiles.ts'
import { refuseArchivedCaller } from '../_shared/refuseArchivedCaller.ts'
import { DRIVE, googleAccessToken } from '../_shared/driveUpload.ts'
import { driveFileBytes } from '../_shared/driveJobFolder.ts'
import { textFromBytes } from '../_shared/fileText.ts'
import { newPassSpend, type PassSpend, type PdfReadLimits } from '../_shared/fileIndexKernel.ts'
import { BILL_BETAS, BILL_FILE_MAX_BYTES, BILL_MODEL, billCostCents, billMedia, type BillMedia } from '../_shared/billRead.ts'
import {
  BILL_SWEEP_DAILY_CAP,
  BILL_SWEEP_SWITCH_KEY,
  EMPTY_SWEEP_RUN,
  PAGES_PER_READ,
  PAPERS_SCHEMA,
  PAPERS_SYSTEM,
  SWEEP_CONCURRENCY,
  SWEEP_FILES,
  SWEEP_FILES_MAX,
  SWEEP_MAX_PAGES,
  SWEEP_MAX_TOKENS,
  SWEEP_START_BUDGET_MS,
  billSweepIsOn,
  joinPapers,
  matchRows,
  pageRanges,
  paperRowOf,
  papersFromContent,
  papersUserMessage,
  probePick,
  probeWords,
  seenKey,
  statusWords,
  sweepPlan,
  sweepWords,
  type FileJob,
  type FilePaper,
  type HoldWhy,
  type PaperText,
  type SweepHold,
  type SweepInvoice,
  type SweepRun,
} from '../_shared/billSweep.ts'

/**
 * bill-lines-sweep (punch list #298 PR 2, v2.6882): the lines of the supply house bills already on file, read from
 * the PDF each row links and kept as rows (`supply_papers`, `supply_paper_lines`). The office types a bill and pastes
 * a Drive link; nobody presses anything for its lines. A cron calls this every ten minutes (migration
 * 20261110230000), and the same call is the backfill of the bills recorded before it.
 *
 *   POST { sweep: { limit? } }   (X-Cron-Secret, or a dev's bearer)
 *     1. Reads every bill's row, which have a paper and the holds, and plans (`sweepPlan`): the files whose rows have
 *        no paper, newest bill first, one file once however many rows link it.
 *     2. Takes `limit` files (3; at most 12), four side by side, and for each: claims it (a `reading` hold on its
 *        first row, so two runs never read one file), asks Drive what it is, downloads it as the service account
 *        (the bills' folder is shared with it as a viewer), reads the PDF's own text layer for the code check, and
 *        asks Claude Sonnet 5.5 for every paper in it (`PAPERS_SCHEMA`: the bill reader's fields per paper, with its
 *        pages). A file over three pages is split with pdf-lib and read three pages at a time, the ranges together,
 *        and a paper that runs across two ranges is joined; a range whose answer was cut is read again a page at a
 *        time. One long file a run.
 *     3. Gives each row its paper by the invoice number, exactly (`matchRows`), checks it (`checkPaper`: the four
 *        sums against the row's amount, and every part code found in the PDF's text) and writes the paper and its
 *        lines; a paper no row took is kept with no bill. A row with no paper is held with its reason
 *        (`supply_bill_holds`): the app cannot open the file, the number is not in it, the file is a statement,
 *        the read was refused or cut. Nothing is written for a file whose read did not come back whole.
 *     4. Every model read is a `supply_bill_reads` row with `source = 'sweep'`, which the sweep's own cap counts
 *        (BILL_SWEEP_DAILY_CAP, 600 a rolling day) and the form's cap does not.
 *   POST { probe: { n? } }       asks Drive about `n` (20) linked files, newest to oldest, and reads nothing
 *   POST { status: {} }          the counts and the line, nothing read
 *
 *   → { ok, ran, run: { files, kept, addUp, unowned, held, reads, cents, capped }, files: [{ fileId, kept, held,
 *       unowned, why? }], status: { bills, noPdf, read, held, heldTotal, ready, readyFiles }, line }
 *
 * The switch `app_settings.bill_lines_sweep_on_v1` must read 'true' for the cron; a dev may run it off. Refusals: 401
 * with neither door, 403 for a caller who is not a dev, 405 for anything but POST, 409 `off` / `noKey`, 503 without
 * the Drive secret. Secrets: SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET,
 * GOOGLE_SERVICE_ACCOUNT_JSON; the model key from Vault (`model_secret_get('anthropic')`) else ANTHROPIC_API_KEY.
 * verify_jwt is off; the function checks its own doors.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
}

const json = (body: Record<string, unknown>, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })

/** The PDF's text for the code check: a short budget a file and a second across the run, inside the platform's CPU. */
const TEXT_LIMITS: PdfReadLimits = { maxBytes: BILL_FILE_MAX_BYTES, maxPages: SWEEP_MAX_PAGES, budgetMs: 400, passBudgetMs: 1000, passMaxBytes: 48 * 1024 * 1024 }

type InvoiceDbRow = { id: string; supply_house_id: string | null; invoice_number: string | null; invoice_date: string | null; amount: number | string | null; document_kind: string | null; link: string | null }
type HoldDbRow = { invoice_id: string; why: HoldWhy; seen_key: string; tried_at: string; tries: number }

async function pagedRows<T>(read: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await read(from, from + 999)
    if (error) throw new Error(error.message)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < 1000) return out
  }
}

/** The three reads a plan needs: every bill, which have a paper, and the holds. */
async function loadState(admin: SupabaseClient): Promise<{ invoices: SweepInvoice[]; paperInvoiceIds: Set<string>; holds: Map<string, SweepHold> }> {
  const [invoiceRows, paperRows, holdRows] = await Promise.all([
    pagedRows<InvoiceDbRow>((from, to) => admin.from('supply_house_invoices').select('id, supply_house_id, invoice_number, invoice_date, amount, document_kind, link').order('id').range(from, to)),
    pagedRows<{ invoice_id: string }>((from, to) => admin.from('supply_papers').select('invoice_id').not('invoice_id', 'is', null).order('id').range(from, to)),
    pagedRows<HoldDbRow>((from, to) => admin.from('supply_bill_holds').select('invoice_id, why, seen_key, tried_at, tries').order('invoice_id').range(from, to)),
  ])
  return {
    invoices: invoiceRows.map((r) => ({
      id: r.id,
      supplyHouseId: r.supply_house_id,
      number: r.invoice_number ?? '',
      dateYmd: r.invoice_date ?? '',
      amountCents: Math.round(Number(r.amount ?? 0) * 100),
      kind: r.document_kind === 'credit' ? 'credit' : 'invoice',
      link: r.link,
    })),
    paperInvoiceIds: new Set(paperRows.map((r) => r.invoice_id)),
    holds: new Map(holdRows.map((h) => [h.invoice_id, { invoiceId: h.invoice_id, why: h.why, seenKey: h.seen_key, triedAt: h.tried_at, tries: h.tries }])),
  }
}

type DriveMeta = { id: string; name?: string; mimeType?: string; size?: string; trashed?: boolean }

/** What Drive says a file is, or the status it refused with (a rate limit is a 429 here, whatever Drive called it). */
async function driveMeta(google: string, fileId: string): Promise<{ meta: DriveMeta } | { status: number }> {
  const res = await fetch(`${DRIVE}/files/${encodeURIComponent(fileId)}?fields=id,name,mimeType,size,trashed&supportsAllDrives=true`, { headers: { Authorization: `Bearer ${google}` } })
  if (res.ok) return { meta: (await res.json()) as DriveMeta }
  const reason = await res.text().catch(() => '')
  return { status: res.status === 403 && /RateLimitExceeded|rateLimitExceeded|quotaExceeded/.test(reason) ? 429 : res.status }
}

/** A PDF's page ranges as PDFs of their own. Null when pdf-lib cannot open the file. */
async function splitPdf(bytes: Uint8Array, ranges: readonly { from: number; to: number }[]): Promise<Uint8Array[] | null> {
  try {
    const { PDFDocument } = await import('https://esm.sh/pdf-lib@1.17.1')
    const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
    const out: Uint8Array[] = []
    for (const r of ranges) {
      const doc = await PDFDocument.create()
      const pages = await doc.copyPages(src, Array.from({ length: r.to - r.from + 1 }, (_, i) => r.from - 1 + i))
      for (const p of pages) doc.addPage(p)
      out.push(await doc.save())
    }
    return out
  } catch (e) {
    console.warn('[bill-lines-sweep] split', e instanceof Error ? e.message : String(e))
    return null
  }
}

type RangeRead = { papers: FilePaper[]; readId: string | null } | { problem: 'refused' | 'cut' | 'failed'; why: string }

interface RunState {
  admin: SupabaseClient
  google: string
  client: Anthropic
  spend: PassSpend
  startedMs: number
  /** Model reads left under the day's cap. */
  left: number
  run: SweepRun
  /** A run splits one long file; the next waits for the next run. */
  longTaken: boolean
  houseNames: Map<string, string>
}

/** One model read of a file or a range of it, with its row in the ledger. */
async function readRange(s: RunState, args: { bytes: Uint8Array; media: BillMedia; houseId: string | null; houseName: string; fileId: string; fileName: string; mime: string | null; range: { from: number; to: number; of: number } | null }): Promise<RangeRead> {
  s.left -= 1
  s.run.reads += 1
  const ledger = async (fields: { ok: boolean; answer: unknown; why: string | null; usage?: { input_tokens?: number; output_tokens?: number } | null }) => {
    const cents = fields.usage ? billCostCents(BILL_MODEL, fields.usage) : null
    s.run.cents += cents ?? 0
    const { data } = await s.admin
      .from('supply_bill_reads')
      .insert({
        source: 'sweep',
        read_by: null,
        supply_house_id: args.houseId,
        file_path: `drive:${args.fileId}`,
        file_name: `${args.fileName}${args.range ? ` p${args.range.from}-${args.range.to}` : ''}`.slice(0, 240),
        file_mime: args.mime,
        model: BILL_MODEL,
        ok: fields.ok,
        input_tokens: fields.usage?.input_tokens ?? null,
        output_tokens: fields.usage?.output_tokens ?? null,
        cents,
        answer: fields.answer,
        why: fields.why,
      })
      .select('id')
      .maybeSingle()
    return (data as { id?: string } | null)?.id ?? null
  }
  const data = base64OfBytes(args.bytes)
  const document =
    args.media.kind === 'pdf'
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: args.media.mediaType, data } }
  let answer: Awaited<ReturnType<typeof s.client.beta.messages.create>>
  try {
    answer = await s.client.beta.messages.create(
      {
        model: BILL_MODEL,
        max_tokens: SWEEP_MAX_TOKENS,
        // A read Sonnet refuses goes to Anthropic's default fallback inside the same call, as the form's fill does.
        betas: [...BILL_BETAS],
        fallbacks: 'default' as const,
        system: PAPERS_SYSTEM,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: PAPERS_SCHEMA } },
        messages: [{ role: 'user', content: [document, { type: 'text', text: papersUserMessage(args.houseName, args.range) }] }],
      },
      // The run has a clock of its own: a read that hangs is given up on, and tried again another run.
      { timeout: 150_000, maxRetries: 1 },
    )
  } catch (e) {
    const refusal = modelRefusalWhy(e)
    console.error('[bill-lines-sweep]', refusal.status ?? '', refusal.why)
    await ledger({ ok: false, answer: null, why: refusal.why })
    return { problem: 'failed', why: refusal.why }
  }
  if (!('content' in answer)) {
    await ledger({ ok: false, answer: null, why: 'no answer' })
    return { problem: 'failed', why: 'no answer' }
  }
  const usage = answer.usage as { input_tokens?: number; output_tokens?: number }
  if (answer.stop_reason === 'refusal') {
    await ledger({ ok: false, answer: null, why: 'refusal', usage })
    return { problem: 'refused', why: 'The model would not read it.' }
  }
  if (answer.stop_reason === 'max_tokens') {
    await ledger({ ok: false, answer: null, why: 'cut at max_tokens', usage })
    return { problem: 'cut', why: 'The answer ran past its room.' }
  }
  const read = papersFromContent(answer.content as ReadonlyArray<{ type: string; text?: string }>, args.range ? args.range.from - 1 : 0)
  if (!read) {
    await ledger({ ok: false, answer: null, why: 'not the shape asked for', usage })
    return { problem: 'failed', why: 'The answer was not the shape asked for.' }
  }
  const readId = await ledger({ ok: true, answer: { papers: read.papers, pageCount: read.pageCount }, why: null, usage })
  return { papers: read.papers, readId }
}

type FileResult = { fileId: string; kept: number; addUp: number; unowned: number; held: number; why?: string }

/** The first row's `reading` hold is the file's claim: an insert that another run beat, or an update it changed first, loses. */
async function claimFile(s: RunState, job: FileJob, holds: ReadonlyMap<string, SweepHold>): Promise<boolean> {
  const first = [...job.rows].sort((a, b) => a.id.localeCompare(b.id))[0]!
  const prior = holds.get(first.id)
  const now = new Date().toISOString()
  if (!prior) {
    const { error } = await s.admin.from('supply_bill_holds').insert({ invoice_id: first.id, why: 'reading', note: '', drive_file_id: job.fileId, seen_key: seenKey(first), tried_at: now, tries: 1 })
    return !error
  }
  const { data, error } = await s.admin
    .from('supply_bill_holds')
    .update({ why: 'reading', note: '', drive_file_id: job.fileId, seen_key: seenKey(first), tried_at: now, tries: prior.seenKey === seenKey(first) ? prior.tries + 1 : 1 })
    .eq('invoice_id', first.id)
    .eq('tried_at', prior.triedAt)
    .select('invoice_id')
  return !error && (data ?? []).length === 1
}

async function holdRows(s: RunState, job: FileJob, holds: ReadonlyMap<string, SweepHold>, rows: readonly { invoice: SweepInvoice; hold: HoldWhy; note: string }[]): Promise<void> {
  if (!rows.length) return
  const now = new Date().toISOString()
  const { error } = await s.admin.from('supply_bill_holds').upsert(
    rows.map(({ invoice, hold, note }) => {
      // One more try than the hold this run started from, the same figure the claim wrote on the file's first row.
      const prior = holds.get(invoice.id)
      const tries = !prior || prior.seenKey !== seenKey(invoice) ? 1 : prior.tries + 1
      return { invoice_id: invoice.id, why: hold, note: note.slice(0, 400), drive_file_id: job.fileId, seen_key: seenKey(invoice), tried_at: now, tries }
    }),
    { onConflict: 'invoice_id' },
  )
  if (error) console.error('[bill-lines-sweep] hold', error.message)
}

/** Every row of the file held for one reason: the file itself could not be read. */
async function holdFile(s: RunState, job: FileJob, holds: ReadonlyMap<string, SweepHold>, why: HoldWhy, note: string): Promise<FileResult> {
  await holdRows(s, job, holds, job.rows.map((invoice) => ({ invoice, hold: why, note })))
  s.run.held += job.rows.length
  return { fileId: job.fileId, kept: 0, addUp: 0, unowned: 0, held: job.rows.length, why }
}

/** The claim given back: the file is left for another run, as if this one never took it. */
async function releaseFile(s: RunState, job: FileJob): Promise<void> {
  await s.admin.from('supply_bill_holds').delete().in('invoice_id', job.rows.map((r) => r.id)).eq('why', 'reading')
}

async function readFile(s: RunState, job: FileJob, holds: ReadonlyMap<string, SweepHold>): Promise<FileResult | null> {
  if (!(await claimFile(s, job, holds))) return null
  try {
    const got = await driveMeta(s.google, job.fileId)
    if ('status' in got) {
      if (got.status === 404 || got.status === 403) return await holdFile(s, job, holds, 'cannot_open', `Drive answered ${got.status}: the file is gone, or it is not shared with the app.`)
      return await holdFile(s, job, holds, 'failed', `Drive answered ${got.status}.`)
    }
    const meta = got.meta
    const name = meta.name ?? 'bill'
    if (meta.trashed) return await holdFile(s, job, holds, 'cannot_open', 'The file is in the trash in Drive.')
    const media = billMedia(meta.mimeType, name)
    if (!media) return await holdFile(s, job, holds, 'not_readable', `The file is ${meta.mimeType ?? 'of a kind the reader does not know'}.`)
    if (meta.size && Number(meta.size) > BILL_FILE_MAX_BYTES) return await holdFile(s, job, holds, 'too_big', `The file is ${Math.round(Number(meta.size) / 1_000_000)} MB.`)
    const bytes = await driveFileBytes(s.google, job.fileId, BILL_FILE_MAX_BYTES)
    if (bytes === 'tooBig') return await holdFile(s, job, holds, 'too_big', 'The file is over 10 MB.')
    if (!bytes) return await holdFile(s, job, holds, 'failed', 'Drive did not send the file.')

    // The PDF's own text, for the code check, and its page count. A scan has no text and says so.
    let text: PaperText = { text: null, layer: null }
    let pages: number | null = null
    if (media.kind === 'pdf') {
      const layer = await textFromBytes(bytes, { name, mimeType: 'application/pdf' }, { limits: TEXT_LIMITS, spend: s.spend }).catch(() => ({ why: 'error' as const }))
      if ('text' in layer) {
        pages = layer.pages
        const whole = layer.pagesRead == null || layer.pages == null || layer.pagesRead >= layer.pages
        text = whole ? { text: layer.text, layer: true } : { text: null, layer: null }
      } else if (layer.why === 'scan') {
        pages = 'pages' in layer ? (layer.pages ?? null) : null
        text = { text: null, layer: false }
      }
    } else {
      text = { text: null, layer: false }
    }
    if (pages != null && pages > SWEEP_MAX_PAGES) return await holdFile(s, job, holds, 'too_big', `The file has ${pages} pages.`)

    const house = job.rows.reduce((a, r) => (r.dateYmd > a.dateYmd ? r : a), job.rows[0]!)
    const base = { media, houseId: house.supplyHouseId, houseName: (house.supplyHouseId && s.houseNames.get(house.supplyHouseId)) || '', fileId: job.fileId, fileName: name, mime: meta.mimeType ?? null }

    let reads: RangeRead[]
    if (pages != null && pages > PAGES_PER_READ) {
      if (s.longTaken) {
        await releaseFile(s, job)
        return null
      }
      s.longTaken = true
      const ranges = pageRanges(pages)
      const parts = await splitPdf(bytes, ranges)
      if (!parts) {
        reads = [await readRange(s, { ...base, bytes, range: null })]
      } else {
        reads = await Promise.all(ranges.map((r, i) => readRange(s, { ...base, bytes: parts[i]!, range: { ...r, of: pages! } })))
        // A range whose answer was cut is read again a page at a time.
        for (let i = 0; i < reads.length; i++) {
          const r = ranges[i]!
          const first = reads[i]!
          if (!('problem' in first) || first.problem !== 'cut' || r.to === r.from) continue
          const singles = pageRanges(r.to - r.from + 1, 1).map((p) => ({ from: r.from + p.from - 1, to: r.from + p.from - 1 }))
          const singleParts = await splitPdf(bytes, singles)
          if (!singleParts) continue
          const again = await Promise.all(singles.map((p, k) => readRange(s, { ...base, bytes: singleParts[k]!, range: { ...p, of: pages! } })))
          const bad = again.find((a) => 'problem' in a)
          reads[i] = bad ?? { papers: joinPapers(again.map((a) => ('papers' in a ? a.papers : []))), readId: 'readId' in again[0]! ? again[0]!.readId : null }
        }
      }
    } else {
      reads = [await readRange(s, { ...base, bytes, range: null })]
    }
    const bad = reads.find((r): r is Extract<RangeRead, { problem: string }> => 'problem' in r)
    if (bad) return await holdFile(s, job, holds, bad.problem, bad.why)

    const whole = reads as Extract<RangeRead, { papers: FilePaper[] }>[]
    const papers = joinPapers(whole.map((r) => r.papers))
    const readId = whole[0]?.readId ?? null
    const { outcomes, unowned } = matchRows(papers, job.rows)
    const readAt = new Date().toISOString()
    const result: FileResult = { fileId: job.fileId, kept: 0, addUp: 0, unowned: 0, held: 0 }

    // The papers no bill owns are written fresh each read of the file, so a second read never doubles them.
    await s.admin.from('supply_papers').delete().eq('drive_file_id', job.fileId).is('invoice_id', null).like('read_by', 'sweep:%')

    const write = async (paper: FilePaper, invoice: SweepInvoice | null): Promise<'kept' | 'adds_up' | 'taken' | 'failed'> => {
      const row = paperRowOf({ paper, invoice, houseId: house.supplyHouseId, fileId: job.fileId, text, model: BILL_MODEL, readId, readAt })
      const { data, error } = await s.admin.from('supply_papers').insert(row.paper).select('id').maybeSingle()
      // 23505: the bill got a paper while this run read (the form's save, or a person's fix). Theirs stands.
      if (error?.code === '23505') return 'taken'
      if (error || !data) {
        console.error('[bill-lines-sweep] paper', error?.message ?? 'no row came back')
        return 'failed'
      }
      const paperId = (data as { id: string }).id
      if (row.lines.length) {
        const { error: lineError } = await s.admin.from('supply_paper_lines').insert(row.lines.map((l) => ({ ...l, paper_id: paperId })))
        if (lineError) {
          console.error('[bill-lines-sweep] lines', lineError.message)
          await s.admin.from('supply_papers').delete().eq('id', paperId)
          return 'failed'
        }
      }
      return row.check.state === 'adds_up' ? 'adds_up' : 'kept'
    }

    const held: { invoice: SweepInvoice; hold: HoldWhy; note: string }[] = []
    const done: string[] = []
    for (const o of outcomes) {
      if ('hold' in o) {
        held.push(o)
        continue
      }
      const wrote = await write(papers[o.paperIndex]!, o.invoice)
      if (wrote === 'failed') {
        held.push({ invoice: o.invoice, hold: 'failed', note: 'The lines could not be kept.' })
        continue
      }
      done.push(o.invoice.id)
      if (wrote === 'taken') continue
      result.kept += 1
      if (wrote === 'adds_up') result.addUp += 1
    }
    for (const i of unowned) {
      if ((await write(papers[i]!, null)) !== 'failed') result.unowned += 1
    }
    await holdRows(s, job, holds, held)
    if (done.length) await s.admin.from('supply_bill_holds').delete().in('invoice_id', done)
    result.held = held.length
    s.run.kept += result.kept
    s.run.addUp += result.addUp
    s.run.unowned += result.unowned
    s.run.held += result.held
    return result
  } catch (e) {
    console.error('[bill-lines-sweep] file', job.fileId, e instanceof Error ? e.message : String(e))
    return await holdFile(s, job, holds, 'failed', 'The read stopped part way.').catch(() => null)
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })
  if (req.method !== 'POST') return json({ ok: false, error: 'badRequest', words: 'Ask for the sweep with POST.' }, 405)
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    if (!supabaseUrl || !anonKey || !serviceKey) return json({ ok: false, error: 'failed', words: 'The sweep is not set up yet.' }, 503)
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

    // ── The two doors: the cron's secret, or a dev's bearer ────────────────
    const cronSecret = Deno.env.get('CRON_SECRET')
    const headerSecret = req.headers.get('X-Cron-Secret') ?? req.headers.get('x-cron-secret')
    const byCron = Boolean(cronSecret && headerSecret && headerSecret === cronSecret)
    if (!byCron) {
      const authHeader = req.headers.get('Authorization') ?? ''
      const jwt = authHeader.replace(/^Bearer\s+/i, '').trim()
      if (!jwt) return json({ ok: false, error: 'signIn', words: 'The cron secret or a dev’s sign-in is the door.' }, 401)
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } })
      const {
        data: { user },
        error: authError,
      } = await userClient.auth.getUser(jwt)
      if (authError || !user) return json({ ok: false, error: 'signIn', words: 'Sign in first.' }, 401)
      const archivedRefusal = await refuseArchivedCaller(admin, user.id, corsHeaders)
      if (archivedRefusal) return archivedRefusal
      const { data: who } = await admin.from('users').select('id, role, read_only').match(REAL_ACCOUNT).eq('id', user.id).maybeSingle()
      const me = who as { role?: string; read_only?: boolean } | null
      if (!me || me.read_only || me.role !== 'dev') return json({ ok: false, error: 'notAllowed', words: 'Only a dev runs the sweep by hand.' }, 403)
    }

    const body = (await req.json().catch(() => ({}))) as { sweep?: { limit?: unknown }; probe?: { n?: unknown }; status?: unknown }
    const started = Date.now()
    const state = await loadState(admin)
    const plan = sweepPlan({ ...state, nowMs: started })

    if (body.status) return json({ ok: true, ran: false, status: plan.status, line: statusWords(plan.status) })

    const saJson = Deno.env.get('GOOGLE_SERVICE_ACCOUNT_JSON')
    if (!saJson) return json({ ok: false, error: 'failed', words: 'Drive is not set up here yet.' }, 503)

    if (body.probe) {
      const n = Math.min(40, Math.max(1, Number(body.probe.n) || 20))
      const google = await googleAccessToken(saJson)
      const picks = probePick(state.invoices, n)
      const answers = await Promise.all(picks.map(async (p) => ({ ...p, got: await driveMeta(google, p.fileId) })))
      const refused = answers.filter((a) => 'status' in a.got).map((a) => ({ invoiceId: a.invoiceId, status: (a.got as { status: number }).status }))
      const opened = answers.length - refused.length
      return json({ ok: true, ran: false, probe: { tried: answers.length, opened, refused }, status: plan.status, line: probeWords(answers.length, opened) })
    }

    // ── The switch, the key, the cap ───────────────────────────────────────
    const { data: setting } = await admin.from('app_settings').select('value_text').eq('key', BILL_SWEEP_SWITCH_KEY).maybeSingle()
    if (byCron && !billSweepIsOn((setting as { value_text?: string | null } | null)?.value_text)) return json({ ok: false, ran: false, error: 'off', status: plan.status, line: 'Reading bills by themselves is off.' }, 409)
    const { key } = await loadModelKey(admin as unknown as ModelKeyDb, (k) => Deno.env.get(k), 'anthropic')
    if (!key) return json({ ok: false, ran: false, error: 'noKey', status: plan.status, line: 'No model key yet, so no bill was read.' }, 409)
    const since = new Date(started - 24 * 60 * 60_000).toISOString()
    const { count } = await admin.from('supply_bill_reads').select('id', { count: 'exact', head: true }).eq('source', 'sweep').gte('read_at', since)
    const left = BILL_SWEEP_DAILY_CAP - (count ?? 0)

    // A row whose link is no Drive file is held with no read.
    if (plan.linkHolds.length) {
      const now = new Date(started).toISOString()
      await admin.from('supply_bill_holds').upsert(
        plan.linkHolds.map((inv) => ({ invoice_id: inv.id, why: 'link', note: '', drive_file_id: null, seen_key: seenKey(inv), tried_at: now, tries: 1 })),
        { onConflict: 'invoice_id' },
      )
    }

    const limit = Math.min(SWEEP_FILES_MAX, Math.max(1, Number(body.sweep?.limit) || SWEEP_FILES))
    const jobs = plan.files.slice(0, limit)
    const run: SweepRun = { ...EMPTY_SWEEP_RUN, capped: left <= 0 && jobs.length > 0 }
    const results: FileResult[] = []
    if (jobs.length && left > 0) {
      const houseIds = [...new Set(jobs.flatMap((j) => j.rows.map((r) => r.supplyHouseId)).filter((id): id is string => Boolean(id)))]
      const { data: houses } = houseIds.length ? await admin.from('supply_houses').select('id, name').in('id', houseIds) : { data: [] }
      const s: RunState = {
        admin,
        google: await googleAccessToken(saJson),
        client: new Anthropic({ apiKey: key }),
        spend: newPassSpend(),
        startedMs: started,
        left,
        run,
        longTaken: false,
        houseNames: new Map(((houses ?? []) as { id: string; name: string }[]).map((h) => [h.id, h.name])),
      }
      let next = 0
      const worker = async () => {
        for (;;) {
          // Past the clock, the day's cap or the run's share of CPU for PDF text, nothing new starts.
          if (Date.now() - started >= SWEEP_START_BUDGET_MS || s.spend.ms >= TEXT_LIMITS.passBudgetMs) return
          if (s.left <= 0) {
            run.capped = true
            return
          }
          const job = jobs[next++]
          if (!job) return
          const result = await readFile(s, job, state.holds)
          if (result) {
            run.files += 1
            results.push(result)
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(SWEEP_CONCURRENCY, jobs.length) }, worker))
    }

    const after = sweepPlan({ ...(await loadState(admin)), nowMs: Date.now() })
    const line = sweepWords(run, after.status)
    console.log(`[bill-lines-sweep] ${line}`)
    return json({ ok: true, ran: true, run, files: results, status: after.status, ms: Date.now() - started, line })
  } catch (e) {
    const refusal = modelRefusalWhy(e)
    console.error('[bill-lines-sweep]', refusal.status ?? '', refusal.why)
    return json({ ok: false, error: 'failed', words: 'The sweep stopped.', why: refusal.why }, 500)
  }
})
