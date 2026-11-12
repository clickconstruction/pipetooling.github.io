/**
 * Bills sent (punch list #327, PR 1): the reads. The rules are `billsSent.ts`.
 *
 * Nothing is written. The page reads the sent copies of every bill-like paper, newest first, then the facts that
 * make a line readable: each bill's amount and status, each job's words, each statement's total, and every other
 * send on record of the same bills, so a second send can say when the first went. The first read throws its reason
 * when it fails, so the screen says so and offers Retry. The reads after it are best effort: a line still draws
 * with what the copy itself says.
 *
 * PR 2 adds four reads beside the copies, each best effort: the send log of Stripe bill emails, the bills stamped as
 * sent from Housecall Pro or as a PDF, the texts that carried a pay link, and the Stripe bills that carry no send
 * stamp at all. A text names its bill by the link in its words: the bill's id, or its short pay code.
 *
 * PR 3 adds whether each email arrived and the day its bill was paid: `bill_send_marks`, one definer read over the
 * mail log for the copies the caller can read. Before its migration is on the database the call is refused and the
 * lines draw with no word about arriving.
 */
import { supabase } from '../supabase'
import { chunkIds } from '../supabasePaging'
import { parseSentCopy } from '../sent/sentCopies'
import { payLinkRef } from './payLink'
import {
  BILLS_SENT_KIND_PREFIX,
  BILLS_SENT_OTHER_KINDS,
  type BillsSentBill,
  type BillsSentCopy,
  type BillsSentEarlier,
  type BillsSentInput,
  type BillsSentJob,
  type BillsSentMark,
  type BillsSentStamp,
  type BillsSentStatement,
  type BillsSentStripeRow,
  type BillsSentText,
  type BillsSentUnsent,
} from './billsSent'

const COPY_COLS =
  'id, kind, title, how, recipient_name, recipient_emails, subject, source_table, source_id, copy_path, copy_type, copy_hash, attachments, sent_at, sent_by_name, job_ids, bid_id, source_snapshot, resend_email_id'

/** Ids per `in.(…)` list: a longer list makes an address some networks refuse. */
const IN_CHUNK = 80

const text = (v: unknown): string => (typeof v === 'string' ? v : '')
const numberOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() && Number.isFinite(Number(v)) ? Number(v) : null)

async function inChunks<T>(ids: string[], read: (chunk: string[]) => PromiseLike<{ data: unknown; error: unknown }>, parse: (raw: Record<string, unknown>) => T | null): Promise<T[]> {
  if (ids.length === 0) return []
  const parts = await Promise.all(
    chunkIds(ids, IN_CHUNK).map(async (chunk) => {
      try {
        const { data, error } = await read(chunk)
        if (error) return []
        return ((data ?? []) as Array<Record<string, unknown>>).map(parse).filter((r): r is T => r != null)
      } catch {
        return []
      }
    }),
  )
  return parts.flat()
}

/** What a pay link in a text names: a bill's id, or its short code (`payLinkRef`, the pay page's own reading). Null when the words carry no pay link. */
export function payLinkRefInText(body: string): { kind: 'id' | 'code'; value: string } | null {
  const m = /\/pay\/([A-Za-z0-9-]+)/.exec(body)
  return m?.[1] ? payLinkRef(m[1]) : null
}

type BillRow = BillsSentBill & { payCode: string | null }
const BILL_COLS = 'id, job_id, amount, status, pay_code'
const billOf = (r: Record<string, unknown>): BillRow | null =>
  text(r.id) ? { id: text(r.id), jobId: text(r.job_id) || null, amount: numberOrNull(r.amount), status: text(r.status), payCode: text(r.pay_code) || null } : null

/** A list read that answers no rows when it fails: the lines it would add are left out, and the rest still draw. */
async function rows(read: () => PromiseLike<{ data: unknown; error: unknown }>): Promise<Array<Record<string, unknown>>> {
  try {
    const { data, error } = await read()
    return error ? [] : ((data ?? []) as Array<Record<string, unknown>>)
  } catch {
    return []
  }
}

/** Copy ids per call of the marks read. */
const MARKS_SLICE = 200

/** What the mail service last said of each copy, and the day its bill was paid. Best effort: no marks when the read is refused. */
async function readMarks(copyIds: string[]): Promise<Map<string, BillsSentMark>> {
  const out = new Map<string, BillsSentMark>()
  for (let i = 0; i < copyIds.length; i += MARKS_SLICE) {
    try {
      // The function is not in the generated types until the types pass that follows its migration.
      const result = (await supabase.rpc('bill_send_marks' as never, { p_ids: copyIds.slice(i, i + MARKS_SLICE) } as never)) as unknown as { data: Array<Record<string, unknown>> | null; error: unknown }
      if (result.error) return out
      for (const r of result.data ?? []) {
        if (!text(r.id)) continue
        out.set(text(r.id), {
          id: text(r.id),
          lastEvent: text(r.last_event) || null,
          lastEventAtIso: text(r.last_event_at) || null,
          emailType: text(r.email_type) || null,
          paidOn: text(r.paid_on) || null,
          paidHow: text(r.paid_how) || null,
        })
      }
    } catch {
      return out
    }
  }
  return out
}

/**
 * What the screen draws from: the newest `limit` sends of bill-like papers and the facts beside them. Throws when
 * the sends themselves cannot be read.
 */
export async function readBillsSent(opts: { limit: number }): Promise<BillsSentInput> {
  const kinds = [`kind.like.${BILLS_SENT_KIND_PREFIX}*`, `kind.in.(${BILLS_SENT_OTHER_KINDS.join(',')})`].join(',')
  const { data, error } = await supabase
    .from('sent_documents')
    .select(COPY_COLS)
    .or(kinds)
    .order('sent_at', { ascending: false })
    .limit(Math.max(1, Math.min(opts.limit, 1000)))
  if (error) throw error
  const copies: BillsSentCopy[] = ((data ?? []) as unknown[]).flatMap((raw) => {
    const copy = parseSentCopy(raw)
    return copy ? [{ ...copy, resendEmailId: text((raw as Record<string, unknown>).resend_email_id) || null }] : []
  })

  const cap = Math.max(1, Math.min(opts.limit, 1000))
  const [rowRows, stampRows, textRows, unsentRows] = await Promise.all([
    rows(() => supabase.from('jobs_ledger_invoice_stripe_email_sends').select('id, jobs_ledger_invoice_id, sent_at, copy_emails').order('sent_at', { ascending: false }).limit(cap)),
    rows(() =>
      supabase
        .from('jobs_ledger_invoices')
        .select(`${BILL_COLS}, sent_to_customer_at, external_send_channel`)
        .in('external_send_channel', ['housecallpro', 'physical'])
        .not('sent_to_customer_at', 'is', null)
        .order('sent_to_customer_at', { ascending: false })
        .limit(cap),
    ),
    rows(() =>
      supabase
        .from('messages')
        .select('id, at, body, who_text, delivery, jobs_ledger_id, number:contact_channels(value), contact:contacts(name, customer:customers(name))')
        .eq('channel', 'text')
        .eq('direction', 'out')
        .like('body', '%/pay/%')
        .order('at', { ascending: false })
        .limit(cap),
    ),
    rows(() =>
      supabase
        .from('jobs_ledger_invoices')
        .select(`${BILL_COLS}, billed_at, created_at`)
        .in('status', ['billed', 'paid'])
        .is('sent_to_customer_at', null)
        .eq('external_send_channel', 'stripe')
        .or('stripe_mode.is.null,stripe_mode.neq.test')
        .order('billed_at', { ascending: false })
        .limit(cap),
    ),
  ])
  const stripeRows: BillsSentStripeRow[] = rowRows.flatMap((r) =>
    text(r.id) && text(r.jobs_ledger_invoice_id) && text(r.sent_at)
      ? [{ id: text(r.id), billId: text(r.jobs_ledger_invoice_id), atIso: text(r.sent_at), copyEmails: (Array.isArray(r.copy_emails) ? r.copy_emails : []).map(text).filter(Boolean) }]
      : [],
  )
  const stamps: BillsSentStamp[] = stampRows.flatMap((r) =>
    text(r.id) && text(r.sent_to_customer_at) ? [{ billId: text(r.id), atIso: text(r.sent_to_customer_at), channel: text(r.external_send_channel) === 'physical' ? ('physical' as const) : ('housecallpro' as const) }] : [],
  )
  const unsent: BillsSentUnsent[] = unsentRows.flatMap((r) => {
    const bill = billOf(r)
    return bill ? [{ billId: bill.id, jobId: bill.jobId, amount: bill.amount, status: bill.status, billedAtIso: text(r.billed_at) || text(r.created_at) }] : []
  })
  const known: BillRow[] = [...stampRows, ...unsentRows].map(billOf).filter((b): b is BillRow => b != null)

  // The bill each text's link opens: by id, or by the short code the bill carries.
  const refs = textRows.map((r) => payLinkRefInText(text(r.body)))
  const linkIds = [...new Set(refs.filter((x) => x?.kind === 'id').map((x) => x!.value))]
  const linkCodes = [...new Set(refs.filter((x) => x?.kind === 'code').map((x) => x!.value))]
  const coded = await inChunks<BillRow>(linkCodes, (chunk) => supabase.from('jobs_ledger_invoices').select(BILL_COLS).in('pay_code', chunk), billOf)
  const byCode = new Map(coded.filter((b) => b.payCode).map((b) => [b.payCode as string, b]))

  const billIds = [
    ...new Set([
      ...copies.filter((c) => c.sourceTable === 'jobs_ledger_invoices' && c.sourceId).map((c) => c.sourceId as string),
      ...stripeRows.map((r) => r.billId),
      ...linkIds,
    ]),
  ].filter((id) => !known.some((b) => b.id === id))
  const resendIds = [...new Set(copies.filter((c) => c.kind.startsWith('gc_statement') && c.resendEmailId).map((c) => c.resendEmailId as string))]

  const [bills, statements, earlier, marks] = await Promise.all([
    inChunks<BillRow>(billIds, (chunk) => supabase.from('jobs_ledger_invoices').select(BILL_COLS).in('id', chunk), billOf),
    inChunks<BillsSentStatement>(
      resendIds,
      (chunk) => supabase.from('gc_statement_emails').select('resend_email_id, total, job_count').in('resend_email_id', chunk),
      (r) => (text(r.resend_email_id) ? { resendEmailId: text(r.resend_email_id), total: numberOrNull(r.total), jobCount: numberOrNull(r.job_count) } : null),
    ),
    inChunks<BillsSentEarlier>(
      copies.length >= cap ? billIds : [],
      (chunk) => supabase.from('sent_documents').select('source_id, sent_at, kind').eq('source_table', 'jobs_ledger_invoices').in('source_id', chunk).neq('kind', 'bill_copy'),
      (r) => (text(r.source_id) && text(r.sent_at) && text(r.kind).startsWith(BILLS_SENT_KIND_PREFIX) ? { billId: text(r.source_id), atIso: text(r.sent_at) } : null),
    ),
    readMarks(copies.map((c) => c.id)),
  ])

  const allBills = new Map<string, BillRow>([...known, ...coded, ...bills].map((b) => [b.id, b]))
  const texts: BillsSentText[] = textRows.flatMap((r, i) => {
    if (!text(r.id) || !text(r.at)) return []
    const ref = refs[i]
    const bill = ref ? (ref.kind === 'id' ? allBills.get(ref.value) : byCode.get(ref.value)) : undefined
    const contact = (r.contact ?? null) as { name?: unknown; customer?: { name?: unknown } | null } | null
    const number = (r.number ?? null) as { value?: unknown } | null
    return [
      {
        id: text(r.id),
        atIso: text(r.at),
        billId: bill?.id ?? null,
        jobId: text(r.jobs_ledger_id) || bill?.jobId || null,
        number: text(number?.value),
        toName: text(contact?.customer?.name) || text(contact?.name),
        // "Priya · from the bill": the person's name is the part before the dot.
        by: text(r.who_text).split('·')[0]!.trim(),
        delivery: text(r.delivery) || null,
      },
    ]
  })

  const jobIds = [
    ...new Set([
      ...copies.flatMap((c) => c.jobIds ?? []),
      ...[...allBills.values()].map((b) => b.jobId).filter((id): id is string => !!id),
      ...texts.map((t) => t.jobId).filter((id): id is string => !!id),
    ]),
  ]
  const jobs = await inChunks<BillsSentJob>(
    jobIds,
    (chunk) => supabase.from('jobs_ledger').select('id, hcp_number, click_number, job_name, job_address, customer_name').in('id', chunk),
    (r) =>
      text(r.id)
        ? { id: text(r.id), hcp_number: text(r.hcp_number) || null, click_number: text(r.click_number) || null, job_name: text(r.job_name) || null, job_address: text(r.job_address) || null, customer_name: text(r.customer_name) || null }
        : null,
  )

  return {
    copies,
    bills: allBills,
    jobs: new Map(jobs.map((j) => [j.id, j])),
    statements: new Map(statements.map((s) => [s.resendEmailId, s])),
    earlier,
    stripeRows,
    stamps,
    texts,
    unsent,
    marks,
  }
}
