import type { JobThreadEventActivityItem } from '../jobActivityEvent'
import { promiseSaidLine, type PaymentPromise } from './paymentPromises'

/**
 * Payment promises as job-thread events (v2.4103). A promise ("They said…" on
 * the Pipeline row, the GC's word on a statement round, the customer's own
 * date from the portal) was its own record and nowhere else: the row's
 * Activity box and the Job window's feed never mentioned it. This maps the
 * live promises on a job into the feed's generic `event` kind — read-side, so
 * nothing is duplicated and a withdrawn promise simply leaves (the list RPC
 * returns live rows only). Pure; the thread hook fetches.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/** "Nov 20, 2026" — a promise is read months later, so the year stays. */
export function promiseDateWords(ymd: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd)
  if (!m) return ymd
  return `${MONTHS[Number(m[2]) - 1] ?? m[2]} ${Number(m[3])}, ${m[1]}`
}

/** The feed line: "Pay by Nov 20, 2026 — Umar Khan · phone · heard by Taunya · “check goes out with the draw”". */
export function promiseSummary(p: PaymentPromise): string {
  const said = promiseSaidLine(p)
  const parts = [`Pay by ${promiseDateWords(p.promisedYmd)}`]
  if (said) parts.push(said)
  if (p.note) parts.push(`\u201c${p.note}\u201d`)
  return parts.join(' \u2014 ').replace(' \u2014 \u201c', ' \u00b7 \u201c')
}

export function paymentPromisesToActivityEvents(promises: ReadonlyArray<PaymentPromise>): JobThreadEventActivityItem[] {
  return promises
    .filter((p) => Boolean(p.createdAt) && !Number.isNaN(new Date(p.createdAt).getTime()))
    .map((p) => ({
      kind: 'event' as const,
      event: {
        dedupeKey: `ev:promise:${p.id}`,
        type: 'payment_promise' as const,
        occurredAt: p.createdAt,
        // The office person who heard it; null when the customer named the date themselves (the feed then says "System").
        actorName: p.source === 'customer' ? null : p.heardByName,
        summary: promiseSummary(p),
        detail: { promisedYmd: p.promisedYmd, source: p.source, channel: p.channel, saidBy: p.saidBy },
        financial: true,
      },
    }))
}
