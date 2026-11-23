/**
 * The bill viewer's reads (punch list #431, PR 2), as the signed-in reader. A bill's facts come off its own row under
 * the office's policy on `supply_house_invoices`, so a bill the reader may not open reads as no row. Its paper comes
 * one of two ways: our own copy from the private `message-attachments` bucket when the bill was dropped on the form,
 * or the Drive file its row links, asked of `drive-link`'s `read_bill`, which checks the same row as the caller and
 * that the file sits in the bills folder. One interface, so a smoke hands the viewer a fake.
 */
import { supabase } from '../../supabase'
import { calendarYmdInAppTzFromIso } from '../../../utils/dateUtils'
import { supplyHouseWebsitePortalHref } from '../../supplyHouseWebsite'
import { supabasePaperIo } from '../lines/paperIo'
import { rowLinesWords } from '../lines/paperRows'
import { billOnJobAmount, type BillFacts } from './billViewer'

export type BillLoad = { facts: BillFacts } | { problem: 'notYours' | 'notHere' }

/** The paper's bytes, or the reason there are none in the door's own words, and whether the same ask can go again. */
export type BillBytes = { bytes: ArrayBuffer } | { problem: string; why: string | null; retry: boolean }

export interface BillViewerIo {
  loadBill(invoiceId: string, jobId: string | null): Promise<BillLoad>
  loadBillBytes(facts: Pick<BillFacts, 'invoiceId' | 'ownCopyPath' | 'link'>): Promise<BillBytes>
}

type InvoiceDbRow = {
  id: string
  invoice_number: string | null
  invoice_date: string | null
  amount: number | string | null
  link: string | null
  purchase_order_number: string | null
  is_paid: boolean | null
  paid_at: string | null
  document_kind: string | null
  bill_read: { file?: { path?: unknown } } | null
  supply_houses: { name: string | null; website_url: string | null } | null
}

const BILL_COLUMNS = 'id, invoice_number, invoice_date, amount, link, purchase_order_number, is_paid, paid_at, document_kind, bill_read, supply_houses(name, website_url)'

async function loadBill(invoiceId: string, jobId: string | null): Promise<BillLoad> {
  const { data, error } = await supabase.from('supply_house_invoices' as never).select(BILL_COLUMNS).eq('id', invoiceId).maybeSingle()
  if (error) return { problem: 'notHere' }
  const row = data as InvoiceDbRow | null
  // Under the policy, a row the reader may not open reads as no row.
  if (!row) return { problem: 'notYours' }
  const total = Number(row.amount) || 0
  const [allocations, papers] = await Promise.all([
    jobId
      ? supabase.from('supply_house_invoice_job_allocations' as never).select('job_id, pct').eq('invoice_id', invoiceId).eq('job_id', jobId)
      : Promise.resolve({ data: [] as unknown[], error: null }),
    supabasePaperIo().loadForInvoices([invoiceId]),
  ])
  const allocation = ((allocations.data ?? []) as { job_id: string; pct: number | string }[])[0]
  const pct = allocation ? Number(allocation.pct) : null
  const paper = papers.get(invoiceId) ?? null
  const ownCopyPath = typeof row.bill_read?.file?.path === 'string' && row.bill_read.file.path ? row.bill_read.file.path : null
  const link = (row.link ?? '').trim() || null
  const lines = rowLinesWords(paper, { link, hasFile: !!ownCopyPath })
  return {
    facts: {
      invoiceId: row.id,
      number: row.invoice_number ?? '',
      house: row.supply_houses?.name ?? '',
      houseSite: supplyHouseWebsitePortalHref(row.supply_houses?.website_url),
      dateYmd: (row.invoice_date ?? '').slice(0, 10),
      poText: (row.purchase_order_number ?? '').trim(),
      total,
      kind: row.document_kind ?? 'invoice',
      onJob: pct != null && Number.isFinite(pct) ? { pct, amount: billOnJobAmount(total, pct) } : null,
      paid: row.is_paid === true,
      paidOnYmd: row.paid_at ? calendarYmdInAppTzFromIso(row.paid_at) || null : null,
      link,
      ownCopyPath,
      pageFrom: paper?.pageFrom ?? null,
      pageTo: paper?.pageTo ?? null,
      linesWords: lines.words,
      linesTone: lines.tone,
    },
  }
}

/** What the door's refusal says, read off the function's answer. */
async function doorRefusal(r: { data: unknown; error: unknown }): Promise<{ problem: string; why: string | null; retry: boolean } | null> {
  const said = r.data as { error?: unknown; why?: unknown; retry?: unknown } | null
  if (said && !(said instanceof Blob) && !(said instanceof ArrayBuffer) && typeof said.error === 'string') {
    return { problem: said.error, why: typeof said.why === 'string' ? said.why : null, retry: said.retry === true }
  }
  if (!r.error) return null
  const context = (r.error as { context?: { json?: () => Promise<unknown> } }).context
  const body = typeof context?.json === 'function' ? ((await context.json().catch(() => null)) as { error?: unknown; why?: unknown; retry?: unknown } | null) : null
  // An error with no body to read is a call nothing answered: a lost signal, which may go again.
  if (typeof body?.error !== 'string') return { problem: 'The file did not come. Check your signal and try again.', why: null, retry: true }
  return { problem: body.error, why: typeof body.why === 'string' ? body.why : null, retry: body.retry === true }
}

async function readBillBytes(facts: Pick<BillFacts, 'invoiceId' | 'ownCopyPath' | 'link'>): Promise<BillBytes> {
  if (facts.ownCopyPath) {
    const got = await supabase.storage.from('message-attachments').download(facts.ownCopyPath)
    if (got.error || !got.data) return { problem: 'The app’s copy of this bill did not open.', why: null, retry: true }
    return { bytes: await got.data.arrayBuffer() }
  }
  const r = await supabase.functions.invoke('drive-link', { body: { action: 'read_bill', invoiceId: facts.invoiceId } })
  const refusal = await doorRefusal(r)
  if (refusal) return refusal
  if (r.data instanceof Blob) return { bytes: await r.data.arrayBuffer() }
  if (r.data instanceof ArrayBuffer) return { bytes: r.data }
  return { problem: 'The file came back empty.', why: null, retry: true }
}

/** How many files' bytes are kept while the viewer is in use: a scanned stack behind nineteen bills is read once. */
const BYTES_KEPT = 8
const bytesCache = new Map<string, Promise<BillBytes>>()

function bytesKey(facts: Pick<BillFacts, 'invoiceId' | 'ownCopyPath' | 'link'>): string {
  return facts.ownCopyPath ? `path:${facts.ownCopyPath}` : `link:${facts.link ?? facts.invoiceId}`
}

/** A bill's bytes, kept by its file so the same file is asked for once; a read that failed is not kept. */
export function cachedBillBytes(facts: Pick<BillFacts, 'invoiceId' | 'ownCopyPath' | 'link'>, read: typeof readBillBytes = readBillBytes): Promise<BillBytes> {
  const key = bytesKey(facts)
  const kept = bytesCache.get(key)
  if (kept) {
    // Used again: the newest, so the oldest is the one dropped.
    bytesCache.delete(key)
    bytesCache.set(key, kept)
    return kept
  }
  const reading = read(facts).catch((): BillBytes => ({ problem: 'The file did not come. Check your signal and try again.', why: null, retry: true }))
  bytesCache.set(key, reading)
  void reading.then((got) => {
    if (!('bytes' in got) && bytesCache.get(key) === reading) bytesCache.delete(key)
  })
  while (bytesCache.size > BYTES_KEPT) bytesCache.delete(bytesCache.keys().next().value as string)
  return reading
}

/** For a test: forget every kept file. */
export function forgetBillBytes(): void {
  bytesCache.clear()
}

export const supabaseBillViewerIo: BillViewerIo = {
  loadBill,
  loadBillBytes: (facts) => cachedBillBytes(facts),
}
